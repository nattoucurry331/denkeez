// Phase 2-K2 (E): メーカー商品画像の「図面上の表示幅 (mm)」に関する純粋ロジック。
//
// widthMm は紙面 mm 系 (校正の有無に関わらず一定。JIS 記号と同じ扱い)。
// SymbolsLayer の描画 px = widthMm × paperPxPerMm × globalSizeScale ×
//   (typeScales['product-image'] ?? 1) × (symbol.scale ?? 1) と一致させる。
//
// 取込ダイアログのプレビューは canvas/zoom に依存しないよう、固定の
// PRODUCT_PREVIEW_PX_PER_MM を使い、10mm スケールバーで実寸感を示す。

/** 配置時のデフォルト表示幅 (紙面 mm)。JIS 記号 (φ5mm 円) より少し大きめ。 */
export const PRODUCT_IMAGE_DEFAULT_WIDTH_MM = 12;

/** 表示幅スライダーの実用範囲 (紙面 mm)。 */
export const SIZE_WIDTH_MIN = 1;
export const SIZE_WIDTH_MAX = 200;

/** 取込ダイアログのプレビュー倍率 (1mm あたりの px)。canvas の zoom とは独立。 */
export const PRODUCT_PREVIEW_PX_PER_MM = 3;

/** プレビューに添えるスケールバーの基準長 (mm)。 */
export const PREVIEW_SCALE_BAR_MM = 10;

export interface SizePreset {
  /** ボタン表示。器具の実径を併記して職人が選びやすくする */
  readonly label: string;
  /** 図面上の表示幅 (紙面 mm) */
  readonly widthMm: number;
}

/**
 * 寸法プリセット。ラベルは器具の実径 (φ) を目安に併記するが、格納値は
 * 「図面上の表示幅 (紙面 mm)」。JIS 記号と同様、実寸を縮尺で割った値ではなく
 * 見やすい一定サイズで描く。スライダーで微調整できる。
 */
export const SIZE_PRESETS: readonly SizePreset[] = [
  { label: '小 (スイッチ類)', widthMm: 8 },
  { label: '標準 (ダウンライト φ100)', widthMm: 12 },
  { label: '中 (φ150 器具)', widthMm: 18 },
  { label: '大 (シーリング・盤)', widthMm: 28 },
];

/**
 * 表示幅 (mm) を実用範囲にクランプする。
 * 非数・0 以下は既定値 (PRODUCT_IMAGE_DEFAULT_WIDTH_MM) に丸める。
 */
export function clampWidthMm(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return PRODUCT_IMAGE_DEFAULT_WIDTH_MM;
  return Math.min(SIZE_WIDTH_MAX, Math.max(SIZE_WIDTH_MIN, value));
}

/**
 * プレビュー上の画像サイズ (px) を求める。
 * scaleFactor = globalSizeScale × (typeScales['product-image'] ?? 1)。
 * aspectRatio <= 0 のときは高さ 0 にガード (NaN/Infinity を流さない)。
 */
export function computeProductPreviewPx(
  widthMm: number,
  aspectRatio: number,
  scaleFactor = 1,
): { wPx: number; hPx: number } {
  const factor = Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1;
  const safeWidth = Number.isFinite(widthMm) && widthMm > 0 ? widthMm : 0;
  const wPx = safeWidth * PRODUCT_PREVIEW_PX_PER_MM * factor;
  const hPx = aspectRatio > 0 ? wPx / aspectRatio : 0;
  return { wPx, hPx };
}
