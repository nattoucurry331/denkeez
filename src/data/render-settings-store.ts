// Phase 2-G1: シンボル背景の透過/不透過 などの「描画設定」を保持する store。
// project-store と独立 (永続化対象外、アンドゥ対象外、localStorage に保存)。
//
// 現状は symbolTransparent のみ。将来 grid 色やライン太さ等のレンダリング個人設定を
// ここに集約する想定。

import { create } from 'zustand';

const STORAGE_KEY = 'denkeez.render.symbolTransparent';

function readInitial(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function persist(value: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  } catch {
    // private mode 等で localStorage が無効: state 更新だけ続ける
  }
}

interface RenderSettingsState {
  /** true なら circle-with-text 等の白塗りを透過にする (solid-circle 黒丸は除外) */
  symbolTransparent: boolean;
  toggleSymbolTransparent: () => void;
  setSymbolTransparent: (value: boolean) => void;
}

export const useRenderSettingsStore = create<RenderSettingsState>((set, get) => ({
  symbolTransparent: readInitial(),
  toggleSymbolTransparent: () => {
    const next = !get().symbolTransparent;
    persist(next);
    set({ symbolTransparent: next });
  },
  setSymbolTransparent: (value) => {
    persist(value);
    set({ symbolTransparent: value });
  },
}));
