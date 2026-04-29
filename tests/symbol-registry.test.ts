import { describe, it, expect } from 'vitest';
import {
  getSymbolDefinition,
  listSymbolDefinitions,
  isKnownSymbolType,
} from '../src/symbols/symbol-registry';

describe('symbol-registry', () => {
  it('listSymbolDefinitions は最低 1 件返す (Phase 1: ダウンライト)', () => {
    const defs = listSymbolDefinitions();
    expect(defs.length).toBeGreaterThanOrEqual(1);
  });

  it('downlight 定義を取得できる', () => {
    const def = getSymbolDefinition('downlight');
    expect(def).toBeDefined();
    expect(def?.id).toBe('downlight');
    expect(def?.name).toBe('ダウンライト');
    expect(def?.shape.kind).toBe('circle-with-text');
  });

  it('未知の id では undefined を返す', () => {
    expect(getSymbolDefinition('unknown')).toBeUndefined();
  });

  it('isKnownSymbolType で type guard できる', () => {
    expect(isKnownSymbolType('downlight')).toBe(true);
    expect(isKnownSymbolType('unknown')).toBe(false);
  });

  it('全定義が必須フィールドを持つ', () => {
    for (const def of listSymbolDefinitions()) {
      expect(def.id).toBeTruthy();
      expect(def.name).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.shape.radiusMm).toBeGreaterThan(0);
      expect(def.shape.fontSizeMm).toBeGreaterThan(0);
      expect(def.shape.text).toBeTruthy();
    }
  });
});
