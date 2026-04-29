// Snapshot 型 Zustand store (Plan §1, §3)。
//
// PoC では plain Zustand v5 + spread による immutable 更新を採用。
// 当初 Plan §1 は immer middleware 採用を想定したが、HTMLCanvasElement を state に
// 持たせると immer の WritableDraft 変換が DOM 型の readonly と衝突するため除外。
// Phase 2 でシンボル配列の操作が増えた時点で immer 導入を再検討する。
// Phase 2 のアンドゥ・リドゥは plain Zustand 上に zundo (temporal middleware) を
// 被せれば実装可能 (state 全体スナップショットを履歴に積む方式)。

import { create } from 'zustand';
import { generateId } from '../utils/id';
import { APP_VERSION, SCHEMA_VERSION } from '../shared/constants/app';
import type { Project, ProjectDrawing } from './types';

export interface ProjectState {
  project: Project;
  /** 未保存変更フラグ (CLAUDE.md L196 担保) */
  dirty: boolean;
  /** PDF 1 ページ目のレンダー結果 (背景表示用、永続化対象外) */
  pdfCanvas: HTMLCanvasElement | null;
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

export const useProjectStore = create<ProjectState & ProjectActions>()((set, get) => ({
  project: createEmptyProject(),
  dirty: false,
  pdfCanvas: null,

  newProject: () =>
    set({
      project: createEmptyProject(),
      dirty: false,
      pdfCanvas: null,
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
        meta: {
          ...current.meta,
          updatedAt: new Date().toISOString(),
        },
      },
      pdfCanvas: canvas,
      // PDF を開いただけでは dirty にしない。シンボル配置 (M3) で dirty 化。
      dirty: false,
    });
  },

  setDirty: (value) => set({ dirty: value }),
  markSaved: () => set({ dirty: false }),
}));
