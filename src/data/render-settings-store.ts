// Phase 2-G1〜G3: シンボル背景の透過/不透過 + サイズ倍率 などの「描画設定」を保持する store。
// project-store と独立 (永続化対象外、アンドゥ対象外、localStorage に保存)。
//
// Daisuke の好み (Macro 設定) を扱う。プロジェクトファイル間で共有 (どの .dkz を開いても同じ)。
// 案件単位の調整は ProjectSymbol.scale (個別) で行う。

import { create } from 'zustand';
import type { SymbolType } from './types';

const STORAGE_KEY_TRANSPARENT = 'denkeez.render.symbolTransparent';
const STORAGE_KEY_GLOBAL_SCALE = 'denkeez.render.globalSizeScale';
const STORAGE_KEY_TYPE_SCALES = 'denkeez.render.typeScales';

/** Phase 2-G3: 倍率の実用的な範囲 (UI 側でクランプ) */
export const SIZE_SCALE_MIN = 0.5;
export const SIZE_SCALE_MAX = 3.0;

function readBool(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function readNumber(key: string, fallback: number): number {
  try {
    const v = window.localStorage.getItem(key);
    if (v === null) return fallback;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
}

function readJsonRecord(key: string): Partial<Record<SymbolType, number>> {
  try {
    const v = window.localStorage.getItem(key);
    if (!v) return {};
    const parsed: unknown = JSON.parse(v);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const result: Partial<Record<SymbolType, number>> = {};
    for (const [k, val] of Object.entries(parsed)) {
      if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
        result[k as SymbolType] = val;
      }
    }
    return result;
  } catch {
    return {};
  }
}

function persistBool(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, value ? 'true' : 'false');
  } catch {
    // private mode 等で localStorage が無効: state 更新だけ続ける
  }
}

function persistNumber(key: string, value: number): void {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    /* noop */
  }
}

function persistJsonRecord(
  key: string,
  value: Partial<Record<SymbolType, number>>,
): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* noop */
  }
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return 1.0;
  return Math.min(max, Math.max(min, n));
}

interface RenderSettingsState {
  /** Phase 2-G1: シンボル背景透過 (solid-circle 黒丸は除外) */
  symbolTransparent: boolean;
  /** Phase 2-G3a: 全シンボル一律のサイズ倍率 (Daisuke の好み) */
  globalSizeScale: number;
  /** Phase 2-G3b: SymbolType ごとのサイズ倍率上書き (key 不在は 1.0) */
  typeScales: Partial<Record<SymbolType, number>>;

  toggleSymbolTransparent: () => void;
  setSymbolTransparent: (value: boolean) => void;
  setGlobalSizeScale: (value: number) => void;
  setTypeScale: (type: SymbolType, value: number | undefined) => void;
  resetAllTypeScales: () => void;
}

export const useRenderSettingsStore = create<RenderSettingsState>((set, get) => ({
  symbolTransparent: readBool(STORAGE_KEY_TRANSPARENT),
  globalSizeScale: readNumber(STORAGE_KEY_GLOBAL_SCALE, 1.0),
  typeScales: readJsonRecord(STORAGE_KEY_TYPE_SCALES),

  toggleSymbolTransparent: () => {
    const next = !get().symbolTransparent;
    persistBool(STORAGE_KEY_TRANSPARENT, next);
    set({ symbolTransparent: next });
  },
  setSymbolTransparent: (value) => {
    persistBool(STORAGE_KEY_TRANSPARENT, value);
    set({ symbolTransparent: value });
  },
  setGlobalSizeScale: (value) => {
    const clamped = clamp(value, SIZE_SCALE_MIN, SIZE_SCALE_MAX);
    persistNumber(STORAGE_KEY_GLOBAL_SCALE, clamped);
    set({ globalSizeScale: clamped });
  },
  setTypeScale: (type, value) => {
    const current = { ...get().typeScales };
    if (value === undefined || value === 1.0) {
      // 1.0 は デフォルトと同じなので保存しない (リセット相当)
      delete current[type];
    } else {
      current[type] = clamp(value, SIZE_SCALE_MIN, SIZE_SCALE_MAX);
    }
    persistJsonRecord(STORAGE_KEY_TYPE_SCALES, current);
    set({ typeScales: current });
  },
  resetAllTypeScales: () => {
    persistJsonRecord(STORAGE_KEY_TYPE_SCALES, {});
    set({ typeScales: {} });
  },
}));

/**
 * 1 つのシンボルに適用される最終倍率を求める (テストのため export)。
 * 最終 = global × type × per-symbol、未指定はそれぞれ 1.0。
 */
export function computeEffectiveSymbolScale(
  globalSize: number,
  typeScales: Partial<Record<SymbolType, number>>,
  type: SymbolType,
  perSymbol: number | undefined,
): number {
  const t = typeScales[type] ?? 1.0;
  const s = perSymbol ?? 1.0;
  return globalSize * t * s;
}
