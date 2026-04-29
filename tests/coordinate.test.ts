import { describe, it, expect } from 'vitest';
import {
  mmToPx,
  pxToMm,
  pointMmToPx,
  pointPxToMm,
  type Scale,
  type Point,
} from '../src/utils/coordinate';

describe('coordinate', () => {
  const scale: Scale = { pxPerMm: 2 };

  describe('mmToPx', () => {
    it('正の値を変換できる', () => {
      expect(mmToPx(10, scale)).toBe(20);
    });

    it('0 を 0 に変換する', () => {
      expect(mmToPx(0, scale)).toBe(0);
    });

    it('負の値も対応する (キャンバス左上原点でない座標系を考慮)', () => {
      expect(mmToPx(-5, scale)).toBe(-10);
    });

    it('NaN を弾く', () => {
      expect(() => mmToPx(NaN, scale)).toThrow(/finite/);
    });

    it('Infinity を弾く', () => {
      expect(() => mmToPx(Infinity, scale)).toThrow(/finite/);
    });

    it('スケール 0 を弾く', () => {
      expect(() => mmToPx(10, { pxPerMm: 0 })).toThrow(/positive/);
    });

    it('負のスケールを弾く', () => {
      expect(() => mmToPx(10, { pxPerMm: -1 })).toThrow(/positive/);
    });
  });

  describe('pxToMm', () => {
    it('正の値を変換できる', () => {
      expect(pxToMm(20, scale)).toBe(10);
    });

    it('mmToPx と往復で復元する', () => {
      const original = 123.456;
      expect(pxToMm(mmToPx(original, scale), scale)).toBeCloseTo(original);
    });

    it('NaN を弾く', () => {
      expect(() => pxToMm(NaN, scale)).toThrow(/finite/);
    });

    it('負のスケールを弾く', () => {
      expect(() => pxToMm(20, { pxPerMm: -1 })).toThrow(/positive/);
    });
  });

  describe('pointMmToPx / pointPxToMm', () => {
    it('Point を mm → px に変換する', () => {
      expect(pointMmToPx({ x: 10, y: 20 }, scale)).toEqual({ x: 20, y: 40 });
    });

    it('Point を px → mm → px で往復復元する', () => {
      const p: Point = { x: 100.5, y: 200.25 };
      const round = pointMmToPx(pointPxToMm(p, scale), scale);
      expect(round.x).toBeCloseTo(p.x);
      expect(round.y).toBeCloseTo(p.y);
    });
  });
});
