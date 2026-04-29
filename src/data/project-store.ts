// Snapshot 型 Zustand store (Plan §1, §3)。
//
// PoC では plain Zustand v5 + spread による immutable 更新を採用。
// Phase 2 でシンボル配列の操作が増えた時点で immer 導入を再検討する。
// Phase 2 のアンドゥ・リドゥは plain Zustand 上に zundo (temporal middleware) を
// 被せれば実装可能 (state 全体スナップショットを履歴に積む方式)。

import { create } from 'zustand';
import { generateId } from '../utils/id';
import { APP_VERSION, SCHEMA_VERSION } from '../shared/constants/app';
import type { Rotation } from '../pdf/pdf-loader';
import type { Project, ProjectDrawing, ProjectSymbol } from './types';
import { DEFAULT_GRID_CONFIG } from './types';

/** 操作モード。配置モード時は symbolType を保持する。 */
export type EditorMode =
  | { kind: 'select' }
  | { kind: 'place'; symbolType: string };

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
  setGridSpacing: (spacing: 910 | 455) => void;
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

export const useProjectStore = create<ProjectState & ProjectActions>()((set, get) => ({
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
    set({
      project: {
        ...current,
        symbols: current.symbols.map((s) =>
          s.id === id ? { ...s, position } : s,
        ),
        meta: { ...current.meta, updatedAt: nowIso() },
      },
      dirty: true,
    });
  },

  removeSymbols: (ids) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const current = get().project;
    set({
      project: {
        ...current,
        symbols: current.symbols.filter((s) => !idSet.has(s.id)),
        meta: { ...current.meta, updatedAt: nowIso() },
      },
      dirty: true,
      selectedIds: get().selectedIds.filter((id) => !idSet.has(id)),
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
}));
