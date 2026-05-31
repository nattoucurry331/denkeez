// Phase 3 F-16 Sub-1: 寸法表示整形のテスト。

import { describe, it, expect } from 'vitest';
import { formatDistanceMm } from '../src/utils/dimension-format';

describe('formatDistanceMm', () => {
  it('校正済みは "mm / m" を併記し 3 桁区切りする', () => {
    expect(formatDistanceMm(3640, true)).toBe('3,640 mm / 3.64 m');
  });

  it('校正済みは m を小数2桁に丸める', () => {
    expect(formatDistanceMm(1234, true)).toBe('1,234 mm / 1.23 m');
  });

  it('未校正は "(紙面)" を明示し mm のみ', () => {
    expect(formatDistanceMm(500, false)).toBe('(紙面) 500 mm');
  });

  it('mm は四捨五入される', () => {
    expect(formatDistanceMm(99.6, true)).toBe('100 mm / 0.10 m');
  });

  it('0 や負・非数は 0 mm 扱い', () => {
    expect(formatDistanceMm(0, true)).toBe('0 mm / 0.00 m');
    expect(formatDistanceMm(-5, false)).toBe('(紙面) 0 mm');
    expect(formatDistanceMm(Number.NaN, true)).toBe('0 mm / 0.00 m');
  });
});
