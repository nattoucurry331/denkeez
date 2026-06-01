import { describe, it, expect } from 'vitest';
import { mapPdfTextItem } from '../src/pdf/pdf-text';

// F-18: PDF テキスト item の mm 変換ロジック (純粋関数) の単体テスト。
// 1 pt = 25.4/72 mm。

const PT_TO_MM = 25.4 / 72;

describe('mapPdfTextItem', () => {
  it('viewport pt 座標を mm に変換する (X はそのまま、Y はベースライン→左上補正)', () => {
    const r = mapPdfTextItem(72, 144, 10);
    expect(r.position.x).toBeCloseTo(72 * PT_TO_MM, 6); // 25.4mm
    // y はベースライン(144pt)から文字高さ10ptを引いた左上
    expect(r.position.y).toBeCloseTo((144 - 10) * PT_TO_MM, 6);
    expect(r.fontSizeMm).toBeCloseTo(10 * PT_TO_MM, 6);
  });

  it('原点・ゼロ高さを安全に扱う', () => {
    const r = mapPdfTextItem(0, 0, 0);
    expect(r.position).toEqual({ x: 0, y: 0 });
    expect(r.fontSizeMm).toBe(0);
  });

  it('不正なフォント高さ (NaN/負) は 0 として扱い位置をベースラインのままにする', () => {
    const nan = mapPdfTextItem(36, 50, NaN);
    expect(nan.fontSizeMm).toBe(0);
    expect(nan.position.y).toBeCloseTo(50 * PT_TO_MM, 6);

    const neg = mapPdfTextItem(36, 50, -5);
    expect(neg.fontSizeMm).toBe(0);
    expect(neg.position.y).toBeCloseTo(50 * PT_TO_MM, 6);
  });
});
