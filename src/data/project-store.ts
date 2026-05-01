// Snapshot 型 Zustand store (Plan §1, §3)。
//
// PoC では plain Zustand v5 + spread による immutable 更新を採用。
// Phase 2 でシンボル配列の操作が増えた時点で immer 導入を再検討する。
// Phase 2 のアンドゥ・リドゥは plain Zustand 上に zundo (temporal middleware) を
// 被せれば実装可能 (state 全体スナップショットを履歴に積む方式)。

import { create } from 'zustand';
import { temporal } from 'zundo';
import { generateId } from '../utils/id';
import { APP_VERSION, SCHEMA_VERSION } from '../shared/constants/app';
import { debounce } from '../utils/debounce';
import type { Rotation } from '../pdf/pdf-loader';
import type {
  Layer,
  Project,
  ProjectDrawing,
  ProjectDrawingScale,
  ProjectSymbol,
  PropertyValue,
  Wire,
} from './types';
import { DEFAULT_GRID_CONFIG } from './types';
import { computeWireLengthMm } from '../utils/wire-geometry';
import { createDefaultLayers, pickFirstUserLayerId } from './layer-defaults';

/** Phase 2-H: 配置モード時にプリセット情報を保持 (preset 経由で properties / text / scale を一括反映) */
export interface PlacePresetInfo {
  presetId: string;
  defaultProperties: Record<string, PropertyValue>;
  textOverride?: string;
  scaleOverride?: number;
}

/** 操作モード。配置モード時は symbolType、スケール設定中は firstPointPx、配線モードは fromSymbolId と waypoints を保持する。 */
export type EditorMode =
  | { kind: 'select' }
  | { kind: 'place'; symbolType: string; preset?: PlacePresetInfo }
  | { kind: 'scale'; firstPointPx?: { x: number; y: number } | undefined }
  | {
      kind: 'wire';
      fromSymbolId?: string | undefined;
      waypoints: { x: number; y: number }[];
    };

export interface ProjectState {
  project: Project;
  /** 未保存変更フラグ (CLAUDE.md L196 担保 / R-11) */
  dirty: boolean;
  /** PDF 1 ページ目のレンダー結果 (背景表示用、永続化対象外) */
  pdfCanvas: HTMLCanvasElement | null;
  /** 元 PDF のバイトデータ (回転再レンダー用、永続化対象外) */
  pdfBuffer: ArrayBuffer | null;
  /** 現在の PDF 表示回転 (0/90/180/270) */
  pdfRotation: Rotation;
  /** 選択中のシンボル ID 配列 */
  selectedIds: string[];
  /** 現在の操作モード */
  mode: EditorMode;
  /** 現在開いているプロジェクトファイルの絶対パス (新規未保存時は null) */
  currentFilePath: string | null;
  /** Phase 2-D1: 現在アクティブなレイヤー (新規 symbol/wire の所属先)。
   *  UI state として扱うため zundo の partialize 対象外。
   *  newProject / loadProject 時に layers から再算出する。 */
  activeLayerId: string;
}

export interface ProjectActions {
  newProject: () => void;
  loadPdf: (
    filename: string,
    drawing: Omit<ProjectDrawing, 'type' | 'filename'>,
    canvas: HTMLCanvasElement,
    buffer: ArrayBuffer,
  ) => void;
  /** 永続化されたプロジェクトを state に注入する (M4) */
  loadProject: (filePath: string, project: Project) => void;
  /** PDF を回転して再レンダーした結果を反映する (M5 追加機能) */
  applyPdfRotation: (
    rotation: Rotation,
    canvas: HTMLCanvasElement,
    widthMm: number,
    heightMm: number,
  ) => void;
  setDirty: (value: boolean) => void;
  markSaved: (filePath?: string) => void;
  setCurrentFilePath: (path: string | null) => void;
  // M3: シンボル CRUD
  /** Phase 2-H: options で preset 由来のプロパティ・倍率・テキストを引き継ぐ */
  addSymbol: (
    symbolType: ProjectSymbol['type'],
    position: { x: number; y: number },
    options?: {
      properties?: Record<string, PropertyValue>;
      text?: string;
      scale?: number;
    },
  ) => void;
  updateSymbolPosition: (id: string, position: { x: number; y: number }) => void;
  /** Phase 2-B2: シンボルのプロパティ (回路番号 / W数 等) を一括更新 */
  updateSymbolProperties: (id: string, properties: Record<string, PropertyValue>) => void;
  /** Phase 2-B3: シンボルの回転角度を更新 (Transformer から呼ばれる) */
  updateSymbolRotation: (id: string, rotation: number) => void;
  /** Phase 2-B3: 複数シンボルを一括で delta 移動 (矢印キー用) */
  moveSymbols: (ids: readonly string[], deltaMm: { x: number; y: number }) => void;
  removeSymbols: (ids: readonly string[]) => void;
  // M3: 選択
  selectSymbols: (ids: readonly string[]) => void;
  toggleSelectSymbol: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  // M3: モード切替
  /** Phase 2-H: preset 引数があれば配置モードに preset を持たせる */
  enterPlaceMode: (symbolType: string, preset?: PlacePresetInfo) => void;
  exitMode: () => void;
  // Phase 2-A2: グリッド
  toggleGrid: () => void;
  setGridSpacing: (spacing: 910 | 455 | 100 | 50) => void;
  // Phase 2-C1: スケール設定
  enterScaleMode: () => void;
  setScaleFirstPoint: (pointPx: { x: number; y: number } | undefined) => void;
  setScale: (scale: ProjectDrawingScale | undefined) => void;
  // Phase 2-C2: 配線
  enterWireMode: () => void;
  setWireFromSymbol: (symbolId: string) => void;
  appendWireWaypoint: (pointMm: { x: number; y: number }) => void;
  resetWireProgress: () => void;
  addWire: (
    fromSymbolId: string,
    toSymbolId: string,
    waypoints: { x: number; y: number }[],
  ) => string;
  updateWire: (id: string, updates: Partial<Omit<Wire, 'id' | 'lengthMm'>>) => void;
  removeWires: (ids: readonly string[]) => void;
  // Phase 2-D1: レイヤー管理 (F-08)
  /** ユーザーレイヤーを末尾に追加。返り値は新規生成された ID */
  addLayer: (name: string, color: string) => string;
  /**
   * レイヤーを削除する。
   * - 元図面レイヤー (kind: 'background') は削除不可 (throw)
   * - 最後のユーザーレイヤーは削除不可 (throw)
   * - mode='delete-contents': 該当レイヤー所属の symbol/wire も同時削除し、
   *   削除された symbol を参照する wire も連鎖削除 (Phase 2-C4 と同方針)
   * - mode='move-to-fallback': 該当レイヤーの symbol/wire を fallbackLayerId に移動
   *   (fallbackLayerId 未指定時は残ったレイヤーの最初のユーザーレイヤーへ)
   */
  removeLayer: (
    id: string,
    options:
      | { mode: 'delete-contents' }
      | { mode: 'move-to-fallback'; fallbackLayerId?: string | undefined },
  ) => void;
  /** レイヤーの name / color / visible / locked を部分更新 */
  updateLayer: (
    id: string,
    updates: Partial<Pick<Layer, 'name' | 'color' | 'visible' | 'locked'>>,
  ) => void;
  /**
   * レイヤー順序を一括更新。orderedIds は現在の全レイヤー ID 集合と一致する必要があり、
   * かつ index 0 は kind: 'background' のレイヤーでなければならない (元図面は常に最下層)。
   */
  reorderLayers: (orderedIds: readonly string[]) => void;
  /** アクティブレイヤー (新規 symbol/wire の所属先) を切替。存在しない ID は無視 */
  setActiveLayer: (id: string) => void;
  /** 既存 symbol を別レイヤーへ移動 (PropertyPanel のレイヤー切替用) */
  moveSymbolsToLayer: (symbolIds: readonly string[], layerId: string) => void;
  /** 既存 wire を別レイヤーへ移動 */
  moveWiresToLayer: (wireIds: readonly string[], layerId: string) => void;
}

function createEmptyProject(): Project {
  const now = new Date().toISOString();
  return {
    meta: {
      id: generateId(),
      name: '',
      createdAt: now,
      updatedAt: now,
      appVersion: APP_VERSION,
      schemaVersion: SCHEMA_VERSION,
    },
    drawing: null,
    layers: createDefaultLayers(),
    symbols: [],
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

// Phase 2-A4: zundo (temporal middleware) でアンドゥ・リドゥを実装。
// partialize: project のみ履歴に含める (UI state や DOM = pdfCanvas/pdfBuffer/mode/selectedIds は除外)
// limit: 50 件まで
// handleSet: 連続更新 (ドラッグ中の updateSymbolPosition 60件/秒) を 100ms debounce で 1 件に間引く
export const useProjectStore = create<ProjectState & ProjectActions>()(
  temporal((set, get) => {
  const initialProject = createEmptyProject();
  return {
  project: initialProject,
  dirty: false,
  pdfCanvas: null,
  pdfBuffer: null,
  pdfRotation: 0,
  selectedIds: [],
  mode: { kind: 'select' },
  currentFilePath: null,
  activeLayerId: pickFirstUserLayerId(initialProject.layers),

  newProject: () => {
    const project = createEmptyProject();
    set({
      project,
      dirty: false,
      pdfCanvas: null,
      pdfBuffer: null,
      pdfRotation: 0,
      selectedIds: [],
      mode: { kind: 'select' },
      currentFilePath: null,
      activeLayerId: pickFirstUserLayerId(project.layers),
    });
  },

  loadPdf: (filename, drawing, canvas, buffer) => {
    const current = get().project;
    set({
      project: {
        ...current,
        drawing: {
          type: 'pdf',
          filename,
          selectedPage: drawing.selectedPage,
          widthMm: drawing.widthMm,
          heightMm: drawing.heightMm,
        },
        meta: { ...current.meta, updatedAt: nowIso() },
      },
      pdfCanvas: canvas,
      pdfBuffer: buffer,
      pdfRotation: 0,
      dirty: false,
    });
  },

  loadProject: (filePath, project) =>
    set({
      project,
      // PDF 本体は別途再読込が必要 (PoC スコープでは PDF を JSON に同梱しない)
      pdfCanvas: null,
      pdfBuffer: null,
      pdfRotation: 0,
      selectedIds: [],
      mode: { kind: 'select' },
      dirty: false,
      currentFilePath: filePath,
      activeLayerId: pickFirstUserLayerId(project.layers),
    }),

  applyPdfRotation: (rotation, canvas, widthMm, heightMm) => {
    const current = get().project;
    if (!current.drawing) return;
    set({
      project: {
        ...current,
        drawing: { ...current.drawing, widthMm, heightMm },
        meta: { ...current.meta, updatedAt: nowIso() },
      },
      pdfCanvas: canvas,
      pdfRotation: rotation,
      // 回転後のシンボル位置の整合性は呼び出し側で扱う (シンボル削除前提)。
      // dirty は呼び出し側で setDirty(true) する。
    });
  },

  setDirty: (value) => set({ dirty: value }),

  markSaved: (filePath) =>
    set(filePath !== undefined ? { dirty: false, currentFilePath: filePath } : { dirty: false }),

  setCurrentFilePath: (path) => set({ currentFilePath: path }),

  addSymbol: (symbolType, position, options) => {
    const current = get().project;
    // activeLayerId が現存しない可能性 (load 後 / undo 後) → fallback
    const targetLayerId = current.layers.some((l) => l.id === get().activeLayerId)
      ? get().activeLayerId
      : pickFirstUserLayerId(current.layers);
    const newSymbol: ProjectSymbol = {
      id: generateId(),
      type: symbolType,
      position,
      rotation: 0,
      properties: options?.properties ? { ...options.properties } : {},
      layerId: targetLayerId,
    };
    // Phase 2-H: preset 由来の text / scale を反映 (exactOptionalPropertyTypes 対応で
    // 値があるときのみキー設定)
    if (options?.text !== undefined && options.text !== '') {
      newSymbol.text = options.text;
    }
    if (options?.scale !== undefined && options.scale > 0) {
      newSymbol.scale = options.scale;
    }
    set({
      project: {
        ...current,
        symbols: [...current.symbols, newSymbol],
        meta: { ...current.meta, updatedAt: nowIso() },
      },
      dirty: true,
    });
  },

  updateSymbolPosition: (id, position) => {
    const current = get().project;
    const newSymbols = current.symbols.map((s) => (s.id === id ? { ...s, position } : s));
    // Phase 2-C4: 参照する Wire の lengthMm を再計算
    const newWires = (current.wires ?? []).map((w) =>
      w.fromSymbolId === id || w.toSymbolId === id
        ? { ...w, lengthMm: computeWireLengthMm(w, newSymbols) }
        : w,
    );
    set({
      project: {
        ...current,
        symbols: newSymbols,
        wires: newWires,
        meta: { ...current.meta, updatedAt: nowIso() },
      },
      dirty: true,
    });
  },

  updateSymbolProperties: (id, properties) => {
    const current = get().project;
    set({
      project: {
        ...current,
        symbols: current.symbols.map((s) =>
          s.id === id ? { ...s, properties: { ...properties } } : s,
        ),
        meta: { ...current.meta, updatedAt: nowIso() },
      },
      dirty: true,
    });
  },

  updateSymbolRotation: (id, rotation) => {
    const current = get().project;
    set({
      project: {
        ...current,
        symbols: current.symbols.map((s) => (s.id === id ? { ...s, rotation } : s)),
        meta: { ...current.meta, updatedAt: nowIso() },
      },
      dirty: true,
    });
  },

  moveSymbols: (ids, deltaMm) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const current = get().project;
    const newSymbols = current.symbols.map((s) =>
      idSet.has(s.id)
        ? { ...s, position: { x: s.position.x + deltaMm.x, y: s.position.y + deltaMm.y } }
        : s,
    );
    // Phase 2-C4: 参照する Wire の lengthMm を再計算
    const newWires = (current.wires ?? []).map((w) =>
      idSet.has(w.fromSymbolId) || idSet.has(w.toSymbolId)
        ? { ...w, lengthMm: computeWireLengthMm(w, newSymbols) }
        : w,
    );
    set({
      project: {
        ...current,
        symbols: newSymbols,
        wires: newWires,
        meta: { ...current.meta, updatedAt: nowIso() },
      },
      dirty: true,
    });
  },

  removeSymbols: (ids) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const current = get().project;
    // Phase 2-C4: 削除対象シンボルを参照する Wire も削除 (参照整合性)
    const wires = current.wires ?? [];
    const remainingWires = wires.filter(
      (w) => !idSet.has(w.fromSymbolId) && !idSet.has(w.toSymbolId),
    );
    const removedWireIds = new Set(
      wires.filter((w) => idSet.has(w.fromSymbolId) || idSet.has(w.toSymbolId)).map((w) => w.id),
    );
    set({
      project: {
        ...current,
        symbols: current.symbols.filter((s) => !idSet.has(s.id)),
        wires: remainingWires,
        meta: { ...current.meta, updatedAt: nowIso() },
      },
      dirty: true,
      selectedIds: get().selectedIds.filter((id) => !idSet.has(id) && !removedWireIds.has(id)),
    });
  },

  selectSymbols: (ids) => set({ selectedIds: [...ids] }),

  toggleSelectSymbol: (id) => {
    const current = get().selectedIds;
    set({
      selectedIds: current.includes(id)
        ? current.filter((i) => i !== id)
        : [...current, id],
    });
  },

  selectAll: () =>
    set({ selectedIds: get().project.symbols.map((s) => s.id) }),

  clearSelection: () => set({ selectedIds: [] }),

  enterPlaceMode: (symbolType, preset) =>
    set({
      mode: preset
        ? { kind: 'place', symbolType, preset }
        : { kind: 'place', symbolType },
      selectedIds: [],
    }),

  exitMode: () => set({ mode: { kind: 'select' } }),

  toggleGrid: () => {
    const current = get().project;
    const grid = current.grid ?? DEFAULT_GRID_CONFIG;
    set({
      project: {
        ...current,
        grid: { ...grid, enabled: !grid.enabled },
        meta: { ...current.meta, updatedAt: nowIso() },
      },
      dirty: true,
    });
  },

  setGridSpacing: (spacing) => {
    const current = get().project;
    const grid = current.grid ?? DEFAULT_GRID_CONFIG;
    set({
      project: {
        ...current,
        grid: { ...grid, spacingMm: spacing },
        meta: { ...current.meta, updatedAt: nowIso() },
      },
      dirty: true,
    });
  },

  enterScaleMode: () =>
    set({
      mode: { kind: 'scale' },
      selectedIds: [],
    }),

  setScaleFirstPoint: (pointPx) =>
    set({
      mode: { kind: 'scale', firstPointPx: pointPx },
    }),

  setScale: (scale) => {
    const current = get().project;
    if (!current.drawing) return;
    set({
      project: {
        ...current,
        drawing: { ...current.drawing, scale },
        meta: { ...current.meta, updatedAt: nowIso() },
      },
      dirty: true,
    });
  },

  // Phase 2-C2: 配線関連 actions
  enterWireMode: () =>
    set({
      mode: { kind: 'wire', waypoints: [] },
      selectedIds: [],
    }),

  setWireFromSymbol: (symbolId) => {
    const current = get().mode;
    if (current.kind !== 'wire') return;
    set({
      mode: { kind: 'wire', fromSymbolId: symbolId, waypoints: [] },
    });
  },

  appendWireWaypoint: (pointMm) => {
    const current = get().mode;
    if (current.kind !== 'wire' || !current.fromSymbolId) return;
    set({
      mode: {
        kind: 'wire',
        fromSymbolId: current.fromSymbolId,
        waypoints: [...current.waypoints, pointMm],
      },
    });
  },

  resetWireProgress: () => {
    const current = get().mode;
    if (current.kind !== 'wire') return;
    set({
      mode: { kind: 'wire', waypoints: [] },
    });
  },

  addWire: (fromSymbolId, toSymbolId, waypoints) => {
    const current = get().project;
    const targetLayerId = current.layers.some((l) => l.id === get().activeLayerId)
      ? get().activeLayerId
      : pickFirstUserLayerId(current.layers);
    const newId = generateId();
    const lengthMm = computeWireLengthMm(
      { fromSymbolId, toSymbolId, waypoints },
      current.symbols,
    );
    const wire: Wire = {
      id: newId,
      fromSymbolId,
      toSymbolId,
      waypoints,
      type: 'ceiling',
      cable: 'VVF1.6×2C',
      circuit: '',
      lengthMm,
      layerId: targetLayerId,
    };
    set({
      project: {
        ...current,
        wires: [...(current.wires ?? []), wire],
        meta: { ...current.meta, updatedAt: nowIso() },
      },
      dirty: true,
    });
    return newId;
  },

  updateWire: (id, updates) => {
    const current = get().project;
    const wires = current.wires ?? [];
    set({
      project: {
        ...current,
        wires: wires.map((w) => {
          if (w.id !== id) return w;
          const merged = { ...w, ...updates };
          // waypoints / from / to が変わったら lengthMm 再計算
          if (
            updates.waypoints !== undefined ||
            updates.fromSymbolId !== undefined ||
            updates.toSymbolId !== undefined
          ) {
            merged.lengthMm = computeWireLengthMm(merged, current.symbols);
          }
          return merged;
        }),
        meta: { ...current.meta, updatedAt: nowIso() },
      },
      dirty: true,
    });
  },

  removeWires: (ids) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const current = get().project;
    const wires = current.wires ?? [];
    set({
      project: {
        ...current,
        wires: wires.filter((w) => !idSet.has(w.id)),
        meta: { ...current.meta, updatedAt: nowIso() },
      },
      dirty: true,
      selectedIds: get().selectedIds.filter((sid) => !idSet.has(sid)),
    });
  },

  // Phase 2-D1: レイヤー管理 (F-08)

  addLayer: (name, color) => {
    const newLayer: Layer = {
      id: generateId(),
      name,
      color,
      visible: true,
      locked: false,
      kind: 'user',
    };
    const current = get().project;
    set({
      project: {
        ...current,
        layers: [...current.layers, newLayer],
        meta: { ...current.meta, updatedAt: nowIso() },
      },
      dirty: true,
    });
    return newLayer.id;
  },

  removeLayer: (id, options) => {
    const current = get().project;
    const target = current.layers.find((l) => l.id === id);
    if (!target) return;
    if (target.kind === 'background') {
      throw new Error('元図面レイヤーは削除できません');
    }
    const userLayerCount = current.layers.filter((l) => l.kind === 'user').length;
    if (userLayerCount <= 1) {
      throw new Error('ユーザーレイヤーは少なくとも 1 つ必要です');
    }

    let nextSymbols = current.symbols;
    let nextWires = current.wires ?? [];

    if (options.mode === 'delete-contents') {
      // 該当レイヤー所属の symbol を削除し、それを参照する wire も連鎖削除 (Phase 2-C4 同様)
      const removedSymbolIds = new Set(
        nextSymbols.filter((s) => s.layerId === id).map((s) => s.id),
      );
      nextSymbols = nextSymbols.filter((s) => s.layerId !== id);
      nextWires = nextWires.filter(
        (w) =>
          w.layerId !== id &&
          !removedSymbolIds.has(w.fromSymbolId) &&
          !removedSymbolIds.has(w.toSymbolId),
      );
    } else {
      const remaining = current.layers.filter((l) => l.id !== id);
      const fallbackId =
        options.fallbackLayerId !== undefined
          ? options.fallbackLayerId
          : pickFirstUserLayerId(remaining);
      const fallbackExists =
        fallbackId !== id && remaining.some((l) => l.id === fallbackId);
      if (!fallbackExists) {
        throw new Error('移動先レイヤーが不正です');
      }
      nextSymbols = nextSymbols.map((s) =>
        s.layerId === id ? { ...s, layerId: fallbackId } : s,
      );
      nextWires = nextWires.map((w) =>
        w.layerId === id ? { ...w, layerId: fallbackId } : w,
      );
    }

    const nextLayers = current.layers.filter((l) => l.id !== id);
    const currentActive = get().activeLayerId;
    const nextActive =
      currentActive === id ? pickFirstUserLayerId(nextLayers) : currentActive;

    const remainingSymbolIds = new Set(nextSymbols.map((s) => s.id));
    const remainingWireIds = new Set(nextWires.map((w) => w.id));
    const nextSelected = get().selectedIds.filter(
      (sid) => remainingSymbolIds.has(sid) || remainingWireIds.has(sid),
    );

    set({
      project: {
        ...current,
        layers: nextLayers,
        symbols: nextSymbols,
        wires: nextWires,
        meta: { ...current.meta, updatedAt: nowIso() },
      },
      activeLayerId: nextActive,
      dirty: true,
      selectedIds: nextSelected,
    });
  },

  updateLayer: (id, updates) => {
    const current = get().project;
    if (!current.layers.some((l) => l.id === id)) return;
    set({
      project: {
        ...current,
        layers: current.layers.map((l) => (l.id === id ? { ...l, ...updates } : l)),
        meta: { ...current.meta, updatedAt: nowIso() },
      },
      dirty: true,
    });
  },

  reorderLayers: (orderedIds) => {
    const current = get().project;
    if (orderedIds.length !== current.layers.length) {
      throw new Error('reorderLayers: ID 数が現在のレイヤー数と一致しません');
    }
    const idSet = new Set(orderedIds);
    if (idSet.size !== orderedIds.length) {
      throw new Error('reorderLayers: orderedIds に重複があります');
    }
    if (current.layers.some((l) => !idSet.has(l.id))) {
      throw new Error('reorderLayers: orderedIds に存在しないレイヤー ID が含まれます');
    }
    const backgroundId = current.layers.find((l) => l.kind === 'background')?.id;
    if (backgroundId !== undefined && orderedIds[0] !== backgroundId) {
      throw new Error('元図面レイヤーは常に最下層 (index 0) である必要があります');
    }
    const idToLayer = new Map(current.layers.map((l) => [l.id, l]));
    const nextLayers = orderedIds
      .map((id) => idToLayer.get(id))
      .filter((l): l is Layer => l !== undefined);
    set({
      project: {
        ...current,
        layers: nextLayers,
        meta: { ...current.meta, updatedAt: nowIso() },
      },
      dirty: true,
    });
  },

  setActiveLayer: (id) => {
    const current = get().project;
    if (!current.layers.some((l) => l.id === id)) return;
    set({ activeLayerId: id });
  },

  moveSymbolsToLayer: (symbolIds, layerId) => {
    if (symbolIds.length === 0) return;
    const current = get().project;
    if (!current.layers.some((l) => l.id === layerId)) {
      throw new Error('指定レイヤーが存在しません');
    }
    const idSet = new Set(symbolIds);
    set({
      project: {
        ...current,
        symbols: current.symbols.map((s) => (idSet.has(s.id) ? { ...s, layerId } : s)),
        meta: { ...current.meta, updatedAt: nowIso() },
      },
      dirty: true,
    });
  },

  moveWiresToLayer: (wireIds, layerId) => {
    if (wireIds.length === 0) return;
    const current = get().project;
    if (!current.layers.some((l) => l.id === layerId)) {
      throw new Error('指定レイヤーが存在しません');
    }
    const idSet = new Set(wireIds);
    set({
      project: {
        ...current,
        wires: (current.wires ?? []).map((w) =>
          idSet.has(w.id) ? { ...w, layerId } : w,
        ),
        meta: { ...current.meta, updatedAt: nowIso() },
      },
      dirty: true,
    });
  },
  };
  }, {
    partialize: (state) => ({ project: state.project }),
    limit: 50,
    handleSet: (handleSet) => debounce(handleSet, 100),
  }),
);
