// プロジェクトを PDF として出力する (Plan §1 / REQUIREMENTS.md §10.1-5 / F-14)。
//
// PoC 構成 (ハイブリッド):
//   - 背景: 現在の Konva 上の pdfCanvas (PDF.js scale=2.0, 約 144DPI 相当) を
//     PNG として addImage する。Phase 2 で 300DPI で再レンダーする品質改善予定。
//   - シンボル / 配線: jsPDF のベクター API (circle / line / text) で直接描画する。
//     拡大しても劣化しないベクター品質を確保 (Plan §5 R-04 達成)。
//
// Phase 2-E3a の修正:
//   - 配線描画追加 (Phase 2-C 以降の wire データを反映)
//   - レイヤーフィルタ (visible のみ / 明示指定の layerIds)
//   - 元図面レイヤー .visible で背景出力を制御
//   - half-circle-with-text を jsPDF の line 群で正式描画 (円代用をやめる)
//
// 当初 Plan §1 では svg2pdf.js を併用予定だったが、Konva 自体に SVG エクスポート API が
// 無いため (toCanvas は ラスターのみ)、シンボルは jsPDF vector API で直接描画する方式に変更。
// 結果として svg2pdf 依存は実際には未使用 (将来 SVG パスシンボルを追加した際に再導入予定)。

import jsPDF from 'jspdf';
import type {
  Dimension,
  Layer,
  Project,
  ProjectSymbol,
  SymbolImage,
  SymbolType,
  Wire,
  WireType,
} from '../data/types';
import { BACKGROUND_LAYER_ID } from '../data/types';
import { getSymbolDefinition, type SymbolShape } from '../symbols/symbol-registry';
import { getWirePoints } from '../utils/wire-geometry';
import { getLayerColor } from '../data/layer-helpers';
import { computeEffectiveSymbolScale } from '../data/render-settings-store';
import { formatDistanceMmAscii } from '../utils/dimension-format';
import { formatScaleRatio } from '../utils/scale-ratio';
import { computeTitleRows, titleBlockOrigin, renderTitleBlockImage } from './title-block';

const MM_PER_INCH = 25.4;
const PT_PER_INCH = 72;
/** mm → pt 変換 (jsPDF の setFontSize は pt 指定) */
const MM_TO_PT = PT_PER_INCH / MM_PER_INCH;

/** Phase 2-E3b: F-14 用紙サイズ選択肢。'auto' は図面実寸をそのまま用紙化。 */
export type PaperSize = 'auto' | 'A4' | 'A3' | 'A2' | 'A1';

/** Phase 2-E3b: 'auto' は drawing.widthMm/heightMm の縦横比から自動判定。 */
export type PageOrientation = 'auto' | 'portrait' | 'landscape';

/** A 系用紙の短辺 × 長辺 (mm)。portrait なら 短辺 × 長辺、landscape は逆。 */
const A_SIZES: Record<Exclude<PaperSize, 'auto'>, { short: number; long: number }> = {
  A4: { short: 210, long: 297 },
  A3: { short: 297, long: 420 },
  A2: { short: 420, long: 594 },
  A1: { short: 594, long: 841 },
};

export interface ExportOptions {
  project: Project;
  /** PDF 背景レンダリング結果。pdfCanvas を渡す。 */
  backgroundCanvas: HTMLCanvasElement;
  /**
   * 出力対象レイヤー ID の集合。
   * 未指定なら project.layers のうち visible: true のものを採用 (BomPanel / 画面表示と整合)。
   * 元図面レイヤー (BACKGROUND_LAYER_ID) が含まれていれば PDF 背景画像も貼付する。
   */
  layerIds?: readonly string[];
  /** Phase 2-E3b: 用紙サイズ。未指定は 'auto' (図面実寸)。 */
  paperSize?: PaperSize;
  /** Phase 2-E3b: 用紙の向き。未指定は 'auto' (図面の縦横比から判定)。 */
  orientation?: PageOrientation;
  /** Phase 2-G1: シンボル背景透過。true で circle/square/half-circle の白塗りを描画しない。
   *  solid-circle (黒丸) は意味上の塗り潰しなのでこのフラグの影響を受けない。 */
  symbolTransparent?: boolean;
  /** Phase 2-G3a: 全シンボル一律のサイズ倍率 (Daisuke の好み)。未指定は 1.0。 */
  globalSizeScale?: number;
  /** Phase 2-G3b: SymbolType ごとのサイズ倍率。未指定型は 1.0。 */
  typeScales?: Partial<Record<SymbolType, number>>;
}

/**
 * Project を 1 ページの PDF (Uint8Array) として出力する。
 * 用紙サイズは drawing.widthMm × drawing.heightMm に合わせる (Phase 2-E3b で A4/A3/A2/A1 選択を追加予定)。
 * 向きは縦/横を自動判定する。
 */
export function exportProjectAsPdf(options: ExportOptions): Uint8Array {
  const { project, backgroundCanvas } = options;
  const drawing = project.drawing;
  if (!drawing) {
    throw new Error('[denkeez] PDF 背景が読み込まれていません');
  }

  // Phase 2-E3a: 出力対象レイヤー集合を確定
  const allowedLayers = resolveAllowedLayers(project.layers, options.layerIds);

  // Phase 2-E3b: 用紙サイズ・向き・scale-to-fit 計算
  const layout = computePageLayout(
    drawing.widthMm,
    drawing.heightMm,
    options.paperSize ?? 'auto',
    options.orientation ?? 'auto',
  );

  const pdf = new jsPDF({
    orientation: layout.pageOrientation,
    unit: 'mm',
    format: [layout.pageShortMm, layout.pageLongMm],
    compress: true,
  });

  // Phase 2-E5: シンボル/配線の position は実寸 mm 系 (校正後)。PDF ページは紙面 mm 系。
  // 校正済みなら paperPerReal で実寸 mm → 紙面 mm 変換が必要、未校正なら 1.0 (恒等)。
  const paperPerReal = computePaperPerRealRatio(drawing, backgroundCanvas.width);

  // 描画原点 (offsetX, offsetY) と倍率 (layout.scale) を適用するヘルパ。
  //   - tx / ty: 実寸 mm の position → PDF 上の最終 mm 座標
  //   - ts:      紙面 mm のサイズ (radiusMm 等) → PDF 上の最終 mm サイズ
  const tx = (realMm: number): number => realMm * paperPerReal * layout.scale + layout.offsetX;
  const ty = (realMm: number): number => realMm * paperPerReal * layout.scale + layout.offsetY;
  const ts = (paperMm: number): number => paperMm * layout.scale;

  // 背景 (PNG dataURL を PDF に貼付) — 元図面レイヤーが対象に含まれている場合のみ。
  // 背景画像のサイズは drawing.widthMm/heightMm (= 紙面 mm) なので ts で OK。
  if (allowedLayers.has(BACKGROUND_LAYER_ID)) {
    const backgroundDataUrl = backgroundCanvas.toDataURL('image/png');
    pdf.addImage(
      backgroundDataUrl,
      'PNG',
      layout.offsetX,
      layout.offsetY,
      ts(drawing.widthMm),
      ts(drawing.heightMm),
      undefined,
      'FAST',
    );
  }

  // Phase 2-E3a: 出力対象 entity をフィルタしてから描画
  const { symbols: visibleSymbols, wires: visibleWires } = filterRenderableEntities(
    project.symbols,
    project.wires ?? [],
    allowedLayers,
  );

  // 配線をシンボルより先に描画 (画面表示と同じ z 順を維持)
  drawWires(pdf, visibleWires, project.symbols, project.layers, layout.scale, tx, ty);

  const symbolTransparent = options.symbolTransparent ?? false;
  const globalSizeScale = options.globalSizeScale ?? 1.0;
  const typeScales = options.typeScales ?? {};
  for (const symbol of visibleSymbols) {
    const sizeMultiplier = computeEffectiveSymbolScale(
      globalSizeScale,
      typeScales,
      symbol.type,
      symbol.scale,
    );
    // Phase 2-I: 画像シンボルは addImage で描画 (registry shape を持たない)
    if (symbol.image) {
      drawImageSymbol(pdf, symbol.image, symbol.position, sizeMultiplier, tx, ty, ts);
      continue;
    }
    const def = getSymbolDefinition(symbol.type);
    if (!def) continue;
    const color = getLayerColor(symbol.layerId, project.layers);
    drawSymbol(
      pdf,
      symbol,
      def.shape,
      color,
      symbolTransparent,
      sizeMultiplier,
      layout.scale,
      tx,
      ty,
      ts,
      symbol.text,
    );
  }

  // Phase 3 F-16 Sub-4: 寸法注記をシンボルの上に描画 (レイヤーフィルタ適用)
  drawDimensions(pdf, project.dimensions ?? [], allowedLayers, project.layers, !!drawing.scale, tx, ty);

  // Phase 3 F-14: 表題欄を最前面に合成 (日本語は canvas でラスター描画した画像を貼る)
  if (project.titleBlock?.enabled) {
    const scaleText = formatScaleRatio(drawing, backgroundCanvas.width) ?? '(縮尺未設定)';
    const rows = computeTitleRows(project.titleBlock, scaleText);
    const img = renderTitleBlockImage(rows, { widthMm: 85 });
    if (img.dataUrl) {
      const origin = titleBlockOrigin(
        project.titleBlock.position,
        layout.pageWidthMm,
        layout.pageHeightMm,
        img.widthMm,
        img.heightMm,
        3,
      );
      try {
        pdf.addImage(img.dataUrl, 'PNG', origin.x, origin.y, img.widthMm, img.heightMm);
      } catch {
        // 表題欄描画に失敗しても本体出力は止めない
      }
    }
  }

  const buffer = pdf.output('arraybuffer');
  return new Uint8Array(buffer);
}

/**
 * Phase 3 F-16 Sub-4: 寸法注記を PDF に描画する。
 * 端点は実寸 mm 系 (tx/ty で PDF mm 化)。距離は端点間ユークリッド距離から再計算。
 * ラベルは jsPDF 既定フォント (日本語不可) のため ASCII 専用関数を使う。
 */
function drawDimensions(
  pdf: jsPDF,
  dimensions: readonly Dimension[],
  allowedLayers: ReadonlySet<string>,
  layers: readonly Layer[],
  calibrated: boolean,
  tx: (mm: number) => number,
  ty: (mm: number) => number,
): void {
  for (const d of dimensions) {
    if (!allowedLayers.has(d.layerId)) continue;
    const color = getLayerColor(d.layerId, layers);
    const x1 = tx(d.from.x);
    const y1 = ty(d.from.y);
    const x2 = tx(d.to.x);
    const y2 = ty(d.to.y);
    pdf.setDrawColor(color);
    pdf.setFillColor(color);
    pdf.setTextColor(color);
    pdf.setLineWidth(0.2);
    pdf.line(x1, y1, x2, y2);
    pdf.circle(x1, y1, 0.6, 'F');
    pdf.circle(x2, y2, 0.6, 'F');
    const distMm = Math.hypot(d.to.x - d.from.x, d.to.y - d.from.y);
    pdf.setFontSize(8);
    pdf.text(formatDistanceMmAscii(distMm, calibrated), (x1 + x2) / 2, (y1 + y2) / 2 - 1, {
      align: 'center',
    });
  }
}

/**
 * Phase 2-E5: 「実寸 mm」→「紙面 mm」の換算比を求める。
 *
 *  - drawing.scale (校正済み) があれば: 校正値から factor を計算
 *  - 未校正の場合: 1.0 (= 紙面 mm 系のまま、変換なし)
 *
 *  導出:
 *    paperPxPerMm = canvasWidth / drawing.widthMm    (canvas 1 paper-mm あたりの px 数)
 *    pxPerMmReal  = drawing.scale.pixelDistanceCanvas / drawing.scale.realDistanceMm
 *    任意の px 数 P について:
 *      P を paper mm に換算: P / paperPxPerMm
 *      P を real mm に換算:  P / pxPerMmReal
 *    paper_mm / real_mm = (P/paperPxPerMm) / (P/pxPerMmReal) = pxPerMmReal / paperPxPerMm
 *
 *  例: 1/100 縮尺の図面で正しく校正されると factor ≈ 0.01。
 */
export function computePaperPerRealRatio(
  drawing: { widthMm: number; scale?: { pixelDistanceCanvas: number; realDistanceMm: number } | undefined },
  canvasWidth: number,
): number {
  if (!drawing.scale) return 1;
  if (drawing.scale.realDistanceMm <= 0) return 1;
  if (drawing.widthMm <= 0 || canvasWidth <= 0) return 1;
  const paperPxPerMm = canvasWidth / drawing.widthMm;
  const pxPerMmReal = drawing.scale.pixelDistanceCanvas / drawing.scale.realDistanceMm;
  if (pxPerMmReal <= 0) return 1;
  return pxPerMmReal / paperPxPerMm;
}

/**
 * Phase 2-E3b: 用紙レイアウト (用紙サイズ + 向き + scale-to-fit + 中央寄せ) を算出する。
 * テストのため export する。
 */
export interface PageLayout {
  /** jsPDF に渡す向き */
  pageOrientation: 'portrait' | 'landscape';
  /** 用紙の短辺 (mm) — jsPDF format[0] */
  pageShortMm: number;
  /** 用紙の長辺 (mm) — jsPDF format[1] */
  pageLongMm: number;
  /** 配置時の用紙幅 (mm)、orientation 適用後 */
  pageWidthMm: number;
  /** 配置時の用紙高さ (mm)、orientation 適用後 */
  pageHeightMm: number;
  /** 図面実寸 → 用紙実寸への scale 倍率 (paperSize='auto' なら常に 1) */
  scale: number;
  /** 用紙原点からの図面左上オフセット (mm)、中央寄せのため */
  offsetX: number;
  /** 用紙原点からの図面左上オフセット (mm) */
  offsetY: number;
}

export function computePageLayout(
  drawingWidthMm: number,
  drawingHeightMm: number,
  paperSize: PaperSize,
  orientation: PageOrientation,
): PageLayout {
  // 1. 向きを決定
  const isLandscape =
    orientation === 'landscape'
      ? true
      : orientation === 'portrait'
        ? false
        : drawingWidthMm >= drawingHeightMm; // 'auto'

  // 2. 用紙の短辺・長辺
  let pageShortMm: number;
  let pageLongMm: number;
  if (paperSize === 'auto') {
    // 図面実寸そのまま
    pageShortMm = Math.min(drawingWidthMm, drawingHeightMm);
    pageLongMm = Math.max(drawingWidthMm, drawingHeightMm);
  } else {
    pageShortMm = A_SIZES[paperSize].short;
    pageLongMm = A_SIZES[paperSize].long;
  }

  // 3. orientation 適用後の用紙寸法
  const pageWidthMm = isLandscape ? pageLongMm : pageShortMm;
  const pageHeightMm = isLandscape ? pageShortMm : pageLongMm;

  // 4. scale-to-fit (paperSize='auto' は drawing == page なので scale=1 になるはず)
  const scaleX = pageWidthMm / drawingWidthMm;
  const scaleY = pageHeightMm / drawingHeightMm;
  const scale = Math.min(scaleX, scaleY);

  // 5. 中央寄せのオフセット
  const offsetX = (pageWidthMm - drawingWidthMm * scale) / 2;
  const offsetY = (pageHeightMm - drawingHeightMm * scale) / 2;

  return {
    pageOrientation: isLandscape ? 'landscape' : 'portrait',
    pageShortMm,
    pageLongMm,
    pageWidthMm,
    pageHeightMm,
    scale,
    offsetX,
    offsetY,
  };
}

/**
 * 出力対象レイヤー集合を解決する (Phase 2-E3a)。
 *  - layerIds 明示指定 → そのまま set 化
 *  - 未指定 → layers のうち visible: true のみ
 * 純粋関数として exportProjectAsPdf 内部から呼ばれる。テストの容易性のため export する。
 */
export function resolveAllowedLayers(
  layers: readonly Layer[],
  layerIds: readonly string[] | undefined,
): ReadonlySet<string> {
  if (layerIds !== undefined) {
    return new Set(layerIds);
  }
  return new Set(layers.filter((l) => l.visible).map((l) => l.id));
}

/**
 * 出力対象 entity をフィルタする (Phase 2-E3a)。
 * シンボル: layerId ∈ allowedLayers のみ。
 * 配線: wire.layerId ∈ allowedLayers かつ 端点 symbol の layerId も ∈ allowedLayers のみ
 *       (画面表示の WireLayer / 集計の BomPanel と整合)。
 * テストのため export する。
 */
export function filterRenderableEntities(
  symbols: readonly ProjectSymbol[],
  wires: readonly Wire[],
  allowedLayers: ReadonlySet<string>,
): { symbols: ProjectSymbol[]; wires: Wire[] } {
  const visibleSymbols = symbols.filter((s) => allowedLayers.has(s.layerId));
  const symbolLayer = new Map(symbols.map((s) => [s.id, s.layerId]));
  const visibleWires = wires.filter((w) => {
    if (!allowedLayers.has(w.layerId)) return false;
    const fromLayer = symbolLayer.get(w.fromSymbolId);
    const toLayer = symbolLayer.get(w.toSymbolId);
    if (fromLayer !== undefined && !allowedLayers.has(fromLayer)) return false;
    if (toLayer !== undefined && !allowedLayers.has(toLayer)) return false;
    return true;
  });
  return { symbols: visibleSymbols, wires: visibleWires };
}

// -----------------------------------------------------------------------------
// 配線描画 (Phase 2-E3a / Phase 2-E4 で色をレイヤー由来に変更)
// -----------------------------------------------------------------------------

/** 配線種別ごとの PDF 描画スタイル (テストで参照するため export)。
 *  Phase 2-E4: 色は layer.color に統一。ここでは dash パターンのみ持つ。 */
export interface WireStyle {
  /** 破線/点線パターン (mm)、未指定なら実線 */
  dash?: number[];
}

function dashForWireType(type: WireType): number[] | undefined {
  switch (type) {
    case 'ceiling':
      return undefined; // 実線
    case 'floor':
      return [2.5, 1.5]; // 破線
    case 'concealed':
      return [0.7, 0.7]; // 点線
    case 'exposed':
      return undefined; // 実線 (色はレイヤーに従う)
  }
}

/** wires (フィルタ済) を順に jsPDF 上に描画する。 */
function drawWires(
  pdf: jsPDF,
  wires: readonly Wire[],
  symbols: readonly ProjectSymbol[],
  layers: readonly Layer[],
  scale: number,
  tx: (mm: number) => number,
  ty: (mm: number) => number,
): void {
  // Phase 2-E3b: scale-to-fit に応じて線幅・dash パターンも縮小
  pdf.setLineWidth(0.35 * scale);

  for (const wire of wires) {
    const points = getWirePoints(wire, symbols);
    if (!points || points.length < 2) continue;

    pdf.setDrawColor(getLayerColor(wire.layerId, layers));
    const dash = dashForWireType(wire.type);
    if (dash) {
      pdf.setLineDashPattern(
        dash.map((d) => d * scale),
        0,
      );
    } else {
      pdf.setLineDashPattern([], 0);
    }

    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      pdf.line(tx(a.x), ty(a.y), tx(b.x), ty(b.y));
    }
  }

  // 後続のシンボル描画に dash / 色設定が漏れないようリセット
  pdf.setLineDashPattern([], 0);
  pdf.setDrawColor(0, 0, 0);
}

/** 配線種別ごとの PDF 描画スタイル。テストのため export する。 */
export function getWirePdfStyle(type: WireType): WireStyle {
  const dash = dashForWireType(type);
  return dash !== undefined ? { dash } : {};
}

// -----------------------------------------------------------------------------
// 画像シンボル描画 (Phase 2-I)
// -----------------------------------------------------------------------------

/** dataURL の MIME から jsPDF の addImage フォーマット文字列を判定 */
function imageFormatOf(dataUrl: string): 'JPEG' | 'PNG' {
  return dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
}

/**
 * 商品画像シンボルを PDF に配置する。
 * 位置は実寸 mm (tx/ty で PDF mm 化)、表示幅は紙面 mm × sizeMultiplier (ts で PDF mm 化)。
 * 注: 現状 rotation は未対応 (ベクター記号と同じ制約。Phase 3 で matrix 回転を検討)。
 */
function drawImageSymbol(
  pdf: jsPDF,
  image: SymbolImage,
  position: { x: number; y: number },
  sizeMultiplier: number,
  tx: (mm: number) => number,
  ty: (mm: number) => number,
  ts: (mm: number) => number,
): void {
  const cx = tx(position.x);
  const cy = ty(position.y);
  const w = ts(image.widthMm * sizeMultiplier);
  const h = w / image.aspectRatio;
  try {
    pdf.addImage(image.dataUrl, imageFormatOf(image.dataUrl), cx - w / 2, cy - h / 2, w, h);
  } catch {
    // 不正な dataURL 等で addImage が失敗しても PDF 出力全体は止めない
  }
}

// -----------------------------------------------------------------------------
// シンボル描画 (Phase 2-B / Phase 2-E3a で half-circle 正式対応)
// -----------------------------------------------------------------------------

function drawSymbol(
  pdf: jsPDF,
  symbol: ProjectSymbol,
  shape: SymbolShape,
  strokeColor: string,
  /** Phase 2-G1: true で circle/square/half-circle の白塗りを省略 (solid-circle は除外) */
  transparent: boolean,
  /** Phase 2-G3a: シンボル個別の最終サイズ倍率 (global × type × per-symbol)。1.0 で従来通り。 */
  sizeMultiplier: number,
  scale: number,
  tx: (mm: number) => number,
  ty: (mm: number) => number,
  ts: (mm: number) => number,
  /** Phase 2-H: 表示テキスト上書き (preset 由来 or 個別) */
  textOverride: string | undefined,
): void {
  const cx = tx(symbol.position.x);
  const cy = ty(symbol.position.y);

  pdf.setDrawColor(strokeColor);
  pdf.setFillColor(255, 255, 255);
  pdf.setTextColor(strokeColor);

  // 'FD' = fill + stroke (不透過時)、'D' = stroke のみ (透過時)
  const fillStyle = transparent ? 'D' : 'FD';
  // 紙面 mm にシンボル倍率を掛けてから ts() で PDF mm に変換するヘルパ
  const tsm = (paperMm: number): number => ts(paperMm * sizeMultiplier);
  // 線幅・フォントサイズも倍率を反映 (sizeMultiplier × scale = layout 込みの最終倍率)
  const strokeMul = sizeMultiplier * scale;
  const fontMul = sizeMultiplier * scale;

  // shape.text を override で上書き (Phase 2-H)
  const baseText = 'text' in shape ? shape.text : '';
  const effectiveText =
    textOverride !== undefined && textOverride !== '' ? textOverride : baseText;

  if (shape.kind === 'circle-with-text') {
    pdf.setLineWidth(shape.strokeWidthMm * strokeMul);
    pdf.circle(cx, cy, tsm(shape.radiusMm), fillStyle);
    if (effectiveText) {
      pdf.setFontSize(shape.fontSizeMm * MM_TO_PT * fontMul);
      pdf.text(effectiveText, cx, cy, { align: 'center', baseline: 'middle' });
    }
  } else if (shape.kind === 'solid-circle-with-text') {
    // 黒丸スイッチは意味上の塗り潰し → transparent フラグの影響を受けない
    pdf.setFillColor(strokeColor);
    pdf.circle(cx, cy, tsm(shape.radiusMm), 'F');
    if (effectiveText) {
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(shape.fontSizeMm * MM_TO_PT * fontMul);
      pdf.text(effectiveText, cx, cy, { align: 'center', baseline: 'middle' });
    }
  } else if (shape.kind === 'square-with-text') {
    pdf.setLineWidth(shape.strokeWidthMm * strokeMul);
    const w = tsm(shape.widthMm);
    const h = tsm(shape.heightMm);
    pdf.rect(cx - w / 2, cy - h / 2, w, h, fillStyle);
    if (effectiveText) {
      pdf.setFontSize(shape.fontSizeMm * MM_TO_PT * fontMul);
      pdf.text(effectiveText, cx, cy, { align: 'center', baseline: 'middle' });
    }
  } else if (shape.kind === 'circle-with-cross') {
    pdf.setLineWidth(shape.strokeWidthMm * strokeMul);
    const r = tsm(shape.radiusMm);
    pdf.circle(cx, cy, r, fillStyle);
    // 内接 × (45° 方向、長さ = radius * sqrt(2))
    const half = r * Math.SQRT1_2;
    pdf.line(cx - half, cy - half, cx + half, cy + half);
    pdf.line(cx - half, cy + half, cx + half, cy - half);
  } else if (shape.kind === 'half-circle-with-text') {
    // Phase 2-E3a: 上半円 (∩ 形) を ベジェ近似で正式描画。
    pdf.setLineWidth(shape.strokeWidthMm * strokeMul);
    drawHalfCircle(pdf, cx, cy, tsm(shape.radiusMm), fillStyle);
    if (effectiveText) {
      pdf.setFontSize(shape.fontSizeMm * MM_TO_PT * fontMul);
      pdf.text(effectiveText, cx, cy - tsm(shape.radiusMm) * 0.4, {
        align: 'center',
        baseline: 'middle',
      });
    }
  }
}

/**
 * 上半円 (底辺は直線、上が曲線、PDF 座標は Y 下向き) を描画する。
 * jsPDF に半円 API が無いため、3 次ベジェで上半円弧を近似 + 底辺を直線で閉じる。
 *
 * 単位円の四分円ベジェ近似定数 K ≈ 0.5523 (8 分の 4 円で誤差 0.027% 程度)。
 *
 * fillStyle:
 *   'FD' (= fill + stroke): 白塗り済みの不透過モード (デフォルト)
 *   'D' (= stroke only): 透過モード
 */
function drawHalfCircle(
  pdf: jsPDF,
  cx: number,
  cy: number,
  r: number,
  fillStyle: 'FD' | 'D',
): void {
  const K = 0.5522847498307933;
  const handleX = r * K;
  const handleY = r * K;

  // PDF の座標は Y 下向き。上半円 = cy - r が上端。
  // パスの開始: 左端 (cx - r, cy) → 上頂点 (cx, cy - r) → 右端 (cx + r, cy) → 左端 (閉路)
  // jsPDF の lines() で複数セグメントをまとめて描画する。
  // lines(linesArray, x, y, scale, style, closed)
  //   linesArray は相対座標の配列、各要素は [x1,y1,x2,y2,x3,y3] (3 次ベジェ) または [x,y] (直線)
  pdf.lines(
    [
      // 左端 → 上頂点 (3 次ベジェ): control points (0, -handleY), (r - handleX, -r) を相対指定
      [0, -handleY, r - handleX, -r, r, -r],
      // 上頂点 → 右端 (3 次ベジェ): (handleX, 0), (r, r - handleY) を相対指定
      [handleX, 0, r, r - handleY, r, r],
      // 右端 → 左端 (直線で底辺を閉じる)
      [-2 * r, 0],
    ],
    cx - r, // 開始点 x (左端)
    cy, // 開始点 y
    [1, 1], // scale
    fillStyle,
    true, // 閉じる
  );
}

/**
 * デフォルトの出力ファイル名を生成。
 * 例: project.meta.name = "現場 A" → "現場 A.pdf"
 */
export function suggestedExportName(project: Project): string {
  const base = project.meta.name.trim() || 'denkeez-export';
  return `${base}.pdf`;
}
