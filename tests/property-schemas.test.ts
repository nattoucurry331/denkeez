import { describe, it, expect } from 'vitest';
import { getPropertySchema } from '../src/symbols/property-schemas';
import { listSymbolDefinitions } from '../src/symbols/symbol-registry';

describe('property-schemas', () => {
  it('全 20 種が schema を持ち、最低 1 フィールドある', () => {
    for (const def of listSymbolDefinitions()) {
      const schema = getPropertySchema(def.id);
      expect(schema.length).toBeGreaterThan(0);
    }
  });

  it('全 schema が note (メモ) フィールドを含む', () => {
    for (const def of listSymbolDefinitions()) {
      const schema = getPropertySchema(def.id);
      const hasNote = schema.some((f) => f.key === 'note');
      expect(hasNote).toBe(true);
    }
  });

  it('downlight は固有フィールド (diameter) を持つ', () => {
    const schema = getPropertySchema('downlight');
    const keys = schema.map((f) => f.key);
    expect(keys).toContain('circuit');
    expect(keys).toContain('wattage');
    expect(keys).toContain('diameter');
    expect(keys).toContain('model');
    expect(keys).toContain('note');
  });

  it('outlet-200v は容量 (amperage) フィールドを持つ', () => {
    const schema = getPropertySchema('outlet-200v');
    const keys = schema.map((f) => f.key);
    expect(keys).toContain('amperage');
  });

  it('スイッチ系は連用個数 (group) フィールドを持つ', () => {
    const schema = getPropertySchema('switch-1pole');
    const keys = schema.map((f) => f.key);
    expect(keys).toContain('group');
  });

  it('コンセント系は接地 (grounded) フィールド を持つ (200V を除く)', () => {
    const schema = getPropertySchema('outlet-general');
    const keys = schema.map((f) => f.key);
    expect(keys).toContain('grounded');
  });
});
