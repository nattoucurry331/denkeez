// F-16 Sub-2: グリッド吸着 + 直角拘束のテスト。

import { describe, it, expect } from 'vitest';
import { snapPointMm, constrainOrtho } from '../src/utils/snap-grid';

describe('snapPointMm', () => {
  it('910 グリッドで近い交点に丸める', () => {
    expect(snapPointMm({ x: 1360, y: 100 }, 910)).toEqual({ x: 910, y: 0 }); // 1360/910=1.49→910, 100→0
    expect(snapPointMm({ x: 1500, y: 500 }, 910)).toEqual({ x: 1820, y: 910 }); // 1500/910=1.65→1820, 500→910
  });

  it('ちょうど中間は四捨五入(.5 は上へ)', () => {
    expect(snapPointMm({ x: 455, y: 0 }, 910)).toEqual({ x: 910, y: 0 }); // 455/910=0.5 → 1*910
  });

  it('交点上の点はそのまま', () => {
    expect(snapPointMm({ x: 1820, y: 910 }, 910)).toEqual({ x: 1820, y: 910 });
  });

  it('負座標も最寄り交点へ', () => {
    expect(snapPointMm({ x: -100, y: -500 }, 910)).toEqual({ x: 0, y: -910 });
  });

  it('別間隔(100mm)に追従', () => {
    expect(snapPointMm({ x: 149, y: 151 }, 100)).toEqual({ x: 100, y: 200 });
  });

  it('spacing<=0 / 非有限はそのまま', () => {
    const p = { x: 123.4, y: 567.8 };
    expect(snapPointMm(p, 0)).toEqual(p);
    expect(snapPointMm(p, -10)).toEqual(p);
    expect(snapPointMm(p, Number.NaN)).toEqual(p);
  });
});

describe('constrainOrtho', () => {
  const from = { x: 100, y: 100 };

  it('横長の変位は水平線(y を from に揃える)', () => {
    expect(constrainOrtho(from, { x: 900, y: 130 })).toEqual({ x: 900, y: 100 });
  });

  it('縦長の変位は垂直線(x を from に揃える)', () => {
    expect(constrainOrtho(from, { x: 130, y: 900 })).toEqual({ x: 100, y: 900 });
  });

  it('dx==dy は水平を優先(y を揃える)', () => {
    expect(constrainOrtho(from, { x: 300, y: 300 })).toEqual({ x: 300, y: 100 });
  });
});
