// Snapshot 型 Zustand store (Plan §1, §3)。
//
// PoC では plain Zustand v5 + spread による immutable 更新を採用。
// Phase 2 でシンボル配列の操作が増えた時点で immer 導入を再検討する。
// Phase 2 のアンドゥ・リドゥは plain Zustand 上に zundo (temporal middleware) を
// 被せれば実装可能 (state 全体スナップショットを履歴に積む方式)。

import { create } from 'zustand';
import { generateId } from '../utils/id';
import { APP_VERSION, SCHEMA_VERSION } from '../shared/constants/app';
import type { Project, ProjectDrawing, ProjectSymbol } from './types';

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
  /** 選択中のシンボル ID 配列 */
  selectedIds: string[];
  /** 現在の操作モード */
  mode: EditorMode;
}

export interface ProjectActions {
  newProject: () => void;
  loadPdf: (
    filename: string,
    drawing: Omit<ProjectDrawing, 'type' | 'filename'>,
    canvas: HTMLCanvasElement,
  ) => void;
  setDirty: (value: boolean) => void;
  markSaved: () => void;
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
  selectedIds: [],
  mode: { kind: 'select' },

  newProject: () =>
    set({
      project: createEmptyProject(),
      dirty: false,
      pdfCanvas: null,
      selectedIds: [],
      mode: { kind: 'select' },
    }),

  loadPdf: (filename, drawing, canvas) => {
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
      dirty: false,
    });
  },

  setDirty: (value) => set({ dirty: value }),
  markSaved: () => set({ dirty: false }),

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
}));
