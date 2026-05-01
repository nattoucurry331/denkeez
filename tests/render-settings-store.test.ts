import { describe, it, expect } from 'vitest';
import { computeEffectiveSymbolScale } from '../src/data/render-settings-store';

// Phase 2-G3a: 3 段階倍率 (global × type × per-symbol) の合成テスト

describe('computeEffectiveSymbolScale', () => {
  it('全部未指定 (1.0) なら 1.0', () => {
    expect(computeEffectiveSymbolScale(1.0, {}, 'downlight', undefined)).toBe(1.0);
  });

  it('global のみ 1.5 → 1.5', () => {
    expect(computeEffectiveSymbolScale(1.5, {}, 'downlight', undefined)).toBe(1.5);
  });

  it('type のみ 0.8 → 0.8', () => {
    expect(computeEffectiveSymbolScale(1.0, { downlight: 0.8 }, 'downlight', undefined)).toBe(0.8);
  });

  it('per-symbol のみ 2.0 → 2.0', () => {
    expect(computeEffectiveSymbolScale(1.0, {}, 'downlight', 2.0)).toBe(2.0);
  });

  it('3 段階すべて積算 (1.5 × 0.8 × 2.0 = 2.4)', () => {
    const r = computeEffectiveSymbolScale(1.5, { downlight: 0.8 }, 'downlight', 2.0);
    expect(r).toBeCloseTo(2.4, 6);
  });

  it('typeScales に該当 type が無いと 1.0 として扱う', () => {
    expect(
      computeEffectiveSymbolScale(2.0, { 'switch-1pole': 0.5 }, 'downlight', undefined),
    ).toBe(2.0);
  });

  it('per-symbol scale=undefined は 1.0 として扱う (後方互換)', () => {
    expect(computeEffectiveSymbolScale(1.0, {}, 'downlight', undefined)).toBe(1.0);
  });
});
