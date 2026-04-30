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
  Project,
  ProjectDrawing,
  ProjectDrawingScale,
  ProjectSymbol,
  PropertyValue,
  Wire,
} from './types';
import { DEFAULT_GRID_CONFIG } from './types';
import { computeWireLengthMm } from '../utils/wire-geometry';

/** 操作モード。配置モード時は symbolType、スケール設定中は firstPointPx、配線モードは fromSymbolId と waypoints を保持する。 */
export type EditorMode =
  | { kind: 'select' }
  | { kind: 'place'; symbolType: string }
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
  addSymbol: (symbolType: ProjectSymbol['type'], position: { x: number; y: number }) => void;
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
  enterPlaceMode: (symbolType: string) => void;
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
  temporal((set, get) => ({
  project: createEmptyProject(),
  dirty: false,
  pdfCanvas: null,
  pdfBuffer: null,
  pdfRotation: 0,
  selectedIds: [],
  mode: { kind: 'select' },
  currentFilePath: null,

  newProject: () =>
    set({
      project: createEmptyProject(),
      dirty: false,
      pdfCanvas: null,
      pdfBuffer: null,
      pdfRotation: 0,
      selectedIds: [],
      mode: { kind: 'select' },
      currentFilePath: null,
    }),

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

  addSymbol: (symbolType, position) => {
    const current = get().project;
    const newSymbol: ProjectSymbol = {
      id: generateId(),
      type: symbolType,
      position,
      rotation: 0,
      properties: {},
    };
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

  enterPlaceMode: (symbolType) =>
    set({
      mode: { kind: 'place', symbolType },
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
  }),
  {
    partialize: (state) => ({ project: state.project }),
    limit: 50,
    handleSet: (handleSet) => debounce(handleSet, 100),
  }),
);
