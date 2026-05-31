// Phase 2-K2 (E): 商品画像の表示幅ロジックの単体テスト。

import { describe, it, expect } from 'vitest';
import {
  clampWidthMm,
  computeProductPreviewPx,
  PRODUCT_IMAGE_DEFAULT_WIDTH_MM,
  PRODUCT_PREVIEW_PX_PER_MM,
  SIZE_WIDTH_MIN,
  SIZE_WIDTH_MAX,
} from '../src/utils/product-size';

describe('clampWidthMm', () => {
  it('範囲内の値はそのまま返す', () => {
    expect(clampWidthMm(12)).toBe(12);
    expect(clampWidthMm(50)).toBe(50);
  });

  it('下限未満は SIZE_WIDTH_MIN にクランプする', () => {
    expect(clampWidthMm(0.2)).toBe(SIZE_WIDTH_MIN);
  });

  it('上限超過は SIZE_WIDTH_MAX にクランプする', () => {
    expect(clampWidthMm(9999)).toBe(SIZE_WIDTH_MAX);
  });

  it('0 以下は既定値に丸める', () => {
    expect(clampWidthMm(0)).toBe(PRODUCT_IMAGE_DEFAULT_WIDTH_MM);
    expect(clampWidthMm(-5)).toBe(PRODUCT_IMAGE_DEFAULT_WIDTH_MM);
  });

  it('NaN / 無限大は既定値に丸める', () => {
    expect(clampWidthMm(Number.NaN)).toBe(PRODUCT_IMAGE_DEFAULT_WIDTH_MM);
    expect(clampWidthMm(Number.POSITIVE_INFINITY)).toBe(PRODUCT_IMAGE_DEFAULT_WIDTH_MM);
  });
});

describe('computeProductPreviewPx', () => {
  it('幅 × 倍率 × プレビュー px/mm で wPx を求める', () => {
    const { wPx } = computeProductPreviewPx(12, 1, 1);
    expect(wPx).toBe(12 * PRODUCT_PREVIEW_PX_PER_MM);
  });

  it('aspectRatio で高さを割る (正方形なら幅=高さ)', () => {
    const { wPx, hPx } = computeProductPreviewPx(10, 1, 1);
    expect(hPx).toBe(wPx);
  });

  it('横長 (aspectRatio 2) は高さが半分になる', () => {
    const { wPx, hPx } = computeProductPreviewPx(10, 2, 1);
    expect(hPx).toBe(wPx / 2);
  });

  it('scaleFactor を乗算する (描画設定の倍率を反映)', () => {
    const base = computeProductPreviewPx(10, 1, 1).wPx;
    const scaled = computeProductPreviewPx(10, 1, 2).wPx;
    expect(scaled).toBe(base * 2);
  });

  it('aspectRatio <= 0 は高さを 0 にガードする', () => {
    expect(computeProductPreviewPx(10, 0, 1).hPx).toBe(0);
    expect(computeProductPreviewPx(10, -1, 1).hPx).toBe(0);
  });

  it('scaleFactor が不正 (0 / NaN) なら 1 として扱う', () => {
    const base = computeProductPreviewPx(10, 1, 1).wPx;
    expect(computeProductPreviewPx(10, 1, 0).wPx).toBe(base);
    expect(computeProductPreviewPx(10, 1, Number.NaN).wPx).toBe(base);
  });

  it('widthMm が 0 以下なら px は 0', () => {
    expect(computeProductPreviewPx(0, 1, 1).wPx).toBe(0);
    expect(computeProductPreviewPx(-5, 1, 1).wPx).toBe(0);
  });
});
