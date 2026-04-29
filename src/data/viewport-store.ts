// ビューポート (ズーム / パン) の state。
// Project とは独立した UI state なので別 store に分離 (Plan §4.1 / docs/architecture.md §1)。
// 永続化対象外。zundo (project-store) の履歴にも含めない。

import { create } from 'zustand';

const MIN_SCALE = 0.1; // 10%
const MAX_SCALE = 8.0; // 800%

export interface ViewportState {
  /** 拡大率 (1.0 = 100%) */
  scale: number;
  /** Stage の x オフセット (px) */
  offsetX: number;
  /** Stage の y オフセット (px) */
  offsetY: number;
  /** Space キー押下中 (パンモード) */
  spaceDown: boolean;
  /** カーソル位置 (mm)。Stage 上に無いときは null */
  cursorMm: { x: number; y: number } | null;
}

export interface ViewportActions {
  setScale: (scale: number) => void;
  setOffset: (x: number, y: number) => void;
  /**
   * カーソル位置 (Stage 上の px) を中心にズーム。
   * factor=1.1 で 10% 拡大、1/1.1 で 10% 縮小など。
   */
  zoomAt: (cursorPx: { x: number; y: number }, factor: number) => void;
  resetView: () => void;
  /**
   * 図面全体がビューポートに収まるよう scale + offset を計算。
   * canvasPx = 描画対象 (PDF レンダー結果) のサイズ
   * viewportPx = Stage の表示エリアサイズ
   */
  fitToWindow: (canvasPx: { w: number; h: number }, viewportPx: { w: number; h: number }) => void;
  setSpaceDown: (down: boolean) => void;
  setCursorMm: (mm: { x: number; y: number } | null) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const useViewportStore = create<ViewportState & ViewportActions>()((set, get) => ({
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  spaceDown: false,
  cursorMm: null,

  setScale: (scale) => set({ scale: clamp(scale, MIN_SCALE, MAX_SCALE) }),
  setOffset: (offsetX, offsetY) => set({ offsetX, offsetY }),

  zoomAt: (cursor, factor) => {
    const { scale, offsetX, offsetY } = get();
    const newScale = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
    if (newScale === scale) return; // clamp で変化なし
    // カーソル位置中心ズーム: カーソル下のキャンバス座標が新スケールでも同じ位置に来るよう offset を補正
    const cx = (cursor.x - offsetX) / scale;
    const cy = (cursor.y - offsetY) / scale;
    set({
      scale: newScale,
      offsetX: cursor.x - cx * newScale,
      offsetY: cursor.y - cy * newScale,
    });
  },

  resetView: () => set({ scale: 1, offsetX: 0, offsetY: 0 }),

  fitToWindow: ({ w: cw, h: ch }, { w: vw, h: vh }) => {
    if (cw <= 0 || ch <= 0 || vw <= 0 || vh <= 0) return;
    // 95% 余裕を持たせて中央寄せ
    const scale = clamp(Math.min(vw / cw, vh / ch) * 0.95, MIN_SCALE, MAX_SCALE);
    set({
      scale,
      offsetX: (vw - cw * scale) / 2,
      offsetY: (vh - ch * scale) / 2,
    });
  },

  setSpaceDown: (down) => set({ spaceDown: down }),
  setCursorMm: (mm) => set({ cursorMm: mm }),
}));

export const VIEWPORT_LIMITS = { MIN_SCALE, MAX_SCALE } as const;
