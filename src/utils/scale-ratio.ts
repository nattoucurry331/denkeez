// Phase 3 (F-21/F-14) 3-I2: 図面の縮尺「1/N」算出の共有純粋関数。
// StatusBar 表示・見積連携 JSON・(将来)タイトルブロックで同じ計算を使うため集約 (DRY)。

export interface DrawingScaleInput {
  /** 紙面幅 (mm) */
  widthMm: number;
  /** F-04 校正データ。未校正なら undefined。 */
  scale?: { pixelDistanceCanvas: number; realDistanceMm: number } | undefined;
}

/**
 * 縮尺の分母 N (= 1/N の N) を求める。校正なし/不正値は null。
 *   図面上 1mm = 紙面 mm/px = widthMm / canvasWidth
 *   実寸 1mm = pixelDistanceCanvas / realDistanceMm px
 *   N = 実寸 mm / 紙面 mm
 */
export function computeScaleRatio(
  drawing: DrawingScaleInput,
  canvasWidth: number,
): number | null {
  if (!drawing.scale || canvasWidth <= 0 || drawing.widthMm <= 0) return null;
  const { pixelDistanceCanvas, realDistanceMm } = drawing.scale;
  if (pixelDistanceCanvas <= 0 || realDistanceMm <= 0) return null;
  const ratio = (realDistanceMm * canvasWidth) / (pixelDistanceCanvas * drawing.widthMm);
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  return Math.round(ratio);
}

/** "1/100" 形式の文字列を返す。校正なしは null。 */
export function formatScaleRatio(
  drawing: DrawingScaleInput,
  canvasWidth: number,
): string | null {
  const n = computeScaleRatio(drawing, canvasWidth);
  return n === null ? null : `1/${n}`;
}
