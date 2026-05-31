// Phase 2-H: ユーザー定義シンボルプリセットの管理 store。
// localStorage に JSON 永続化し、project-store とは独立。
//
// Phase 3 で .dkz 同梱対応を追加予定 (案件特有のプリセットを共有可能に)。

import { create } from 'zustand';
import { generateId } from '../utils/id';
import type { SymbolPreset, SymbolType, PropertyValue } from './types';

const STORAGE_KEY = 'denkeez.presets';

function readInitial(): SymbolPreset[] {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (!v) return [];
    const parsed: unknown = JSON.parse(v);
    if (!Array.isArray(parsed)) return [];
    // 軽い検証 (id / baseType / displayName / defaultProperties が揃っているもの)
    const out: SymbolPreset[] = [];
    for (const item of parsed) {
      if (typeof item !== 'object' || item === null) continue;
      const o = item as Record<string, unknown>;
      if (typeof o.id !== 'string' || typeof o.baseType !== 'string') continue;
      if (typeof o.displayName !== 'string' || o.displayName.trim() === '') continue;
      if (typeof o.defaultProperties !== 'object' || o.defaultProperties === null) continue;
      const preset: SymbolPreset = {
        id: o.id,
        baseType: o.baseType as SymbolType,
        displayName: o.displayName,
        defaultProperties: o.defaultProperties as Record<string, PropertyValue>,
      };
      if (typeof o.textOverride === 'string') preset.textOverride = o.textOverride;
      if (typeof o.scaleOverride === 'number' && Number.isFinite(o.scaleOverride) && o.scaleOverride > 0) {
        preset.scaleOverride = o.scaleOverride;
      }
      // Phase 2-I: 商品画像プリセット (dataUrl は data:image/ のみ受理)
      if (
        typeof o.image === 'object' &&
        o.image !== null &&
        typeof (o.image as Record<string, unknown>).dataUrl === 'string' &&
        ((o.image as Record<string, unknown>).dataUrl as string).startsWith('data:image/') &&
        typeof (o.image as Record<string, unknown>).aspectRatio === 'number'
      ) {
        const im = o.image as Record<string, unknown>;
        preset.image = {
          dataUrl: im.dataUrl as string,
          aspectRatio: im.aspectRatio as number,
          // Phase 2-K2: 表示幅を保持していれば引き継ぐ (正の数のみ)
          ...(typeof im.widthMm === 'number' && Number.isFinite(im.widthMm) && im.widthMm > 0
            ? { widthMm: im.widthMm }
            : {}),
        };
      }
      out.push(preset);
    }
    return out;
  } catch {
    return [];
  }
}

function persist(value: SymbolPreset[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* noop (private mode 等) */
  }
}

interface PresetState {
  presets: SymbolPreset[];

  /** 新規作成。id は自動採番。返り値は採番された id */
  addPreset: (input: Omit<SymbolPreset, 'id'>) => string;
  /** 既存プリセットを部分更新 */
  updatePreset: (id: string, updates: Partial<Omit<SymbolPreset, 'id'>>) => void;
  /** 削除 */
  removePreset: (id: string) => void;
  /** id から取得 (存在しなければ undefined) */
  getPreset: (id: string) => SymbolPreset | undefined;
}

export const usePresetStore = create<PresetState>((set, get) => ({
  presets: readInitial(),

  addPreset: (input) => {
    const id = generateId();
    const preset: SymbolPreset = {
      id,
      baseType: input.baseType,
      displayName: input.displayName.trim(),
      defaultProperties: { ...input.defaultProperties },
    };
    if (input.textOverride !== undefined) preset.textOverride = input.textOverride;
    if (input.scaleOverride !== undefined) preset.scaleOverride = input.scaleOverride;
    // Phase 2-I: 商品画像プリセット
    if (input.image !== undefined) preset.image = input.image;
    const next = [...get().presets, preset];
    persist(next);
    set({ presets: next });
    return id;
  },

  updatePreset: (id, updates) => {
    const next = get().presets.map((p) => {
      if (p.id !== id) return p;
      const merged: SymbolPreset = {
        ...p,
        ...(updates.baseType !== undefined ? { baseType: updates.baseType } : {}),
        ...(updates.displayName !== undefined ? { displayName: updates.displayName.trim() } : {}),
        ...(updates.defaultProperties !== undefined
          ? { defaultProperties: { ...updates.defaultProperties } }
          : {}),
      };
      // textOverride / scaleOverride は明示的に空にする (削除) を許可するため、
      // updates にキーが存在するかで判定する。
      if ('textOverride' in updates) {
        if (updates.textOverride === undefined || updates.textOverride === '') {
          delete merged.textOverride;
        } else {
          merged.textOverride = updates.textOverride;
        }
      }
      if ('scaleOverride' in updates) {
        if (updates.scaleOverride === undefined) {
          delete merged.scaleOverride;
        } else {
          merged.scaleOverride = updates.scaleOverride;
        }
      }
      return merged;
    });
    persist(next);
    set({ presets: next });
  },

  removePreset: (id) => {
    const next = get().presets.filter((p) => p.id !== id);
    persist(next);
    set({ presets: next });
  },

  getPreset: (id) => get().presets.find((p) => p.id === id),
}));
