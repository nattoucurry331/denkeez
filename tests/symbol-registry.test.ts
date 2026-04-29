import { describe, it, expect } from 'vitest';
import {
  getSymbolDefinition,
  listSymbolDefinitions,
  listByCategory,
  isKnownSymbolType,
} from '../src/symbols/symbol-registry';

const VALID_SHAPE_KINDS = [
  'circle-with-text',
  'circle-with-cross',
  'square-with-text',
  'solid-circle-with-text',
  'half-circle-with-text',
] as const;

describe('symbol-registry', () => {
  it('Phase 2-B では 20 種登録されている', () => {
    expect(listSymbolDefinitions()).toHaveLength(20);
  });

  it('カテゴリ別の件数 (照明 6 / スイッチ 5 / コンセント 4 / 弱電 3 / その他 2)', () => {
    expect(listByCategory('lighting')).toHaveLength(6);
    expect(listByCategory('switch')).toHaveLength(5);
    expect(listByCategory('outlet')).toHaveLength(4);
    expect(listByCategory('low-voltage')).toHaveLength(3);
    expect(listByCategory('other')).toHaveLength(2);
  });

  it('downlight 定義を取得できる', () => {
    const def = getSymbolDefinition('downlight');
    expect(def).toBeDefined();
    expect(def?.id).toBe('downlight');
    expect(def?.name).toBe('ダウンライト');
    expect(def?.shape.kind).toBe('circle-with-text');
    expect(def?.category).toBe('lighting');
  });

  it('未知の id では undefined を返す', () => {
    expect(getSymbolDefinition('unknown')).toBeUndefined();
  });

  it('isKnownSymbolType で type guard できる', () => {
    expect(isKnownSymbolType('downlight')).toBe(true);
    expect(isKnownSymbolType('unknown')).toBe(false);
  });

  it('全 20 種の id がユニーク', () => {
    const ids = listSymbolDefinitions().map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('全 20 種が共通フィールド (id, name, category, description, shape) を持ち、shape.kind が 5 種に含まれる', () => {
    for (const def of listSymbolDefinitions()) {
      expect(def.id).toBeTruthy();
      expect(def.name).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.category).toBeTruthy();
      expect(def.shape).toBeDefined();
      expect(VALID_SHAPE_KINDS).toContain(def.shape.kind);
    }
  });
});
