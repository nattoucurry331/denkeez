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
import type { Layer, Project, ProjectSymbol, Wire, WireType } from '../data/types';
import { BACKGROUND_LAYER_ID } from '../data/types';
import { getSymbolDefinition, type SymbolShape } from '../symbols/symbol-registry';
import { getWirePoints } from '../utils/wire-geometry';

const MM_PER_INCH = 25.4;
const PT_PER_INCH = 72;
/** mm → pt 変換 (jsPDF の setFontSize は pt 指定) */
const MM_TO_PT = PT_PER_INCH / MM_PER_INCH;

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

  // jsPDF の format は [短辺, 長辺] (mm)、orientation で配置が決まる
  const orientation: 'portrait' | 'landscape' =
    drawing.widthMm >= drawing.heightMm ? 'landscape' : 'portrait';
  const longSide = Math.max(drawing.widthMm, drawing.heightMm);
  const shortSide = Math.min(drawing.widthMm, drawing.heightMm);

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: [shortSide, longSide],
    compress: true,
  });

  // 背景 (PNG dataURL を PDF に貼付) — 元図面レイヤーが対象に含まれている場合のみ
  if (allowedLayers.has(BACKGROUND_LAYER_ID)) {
    const backgroundDataUrl = backgroundCanvas.toDataURL('image/png');
    pdf.addImage(
      backgroundDataUrl,
      'PNG',
      0,
      0,
      drawing.widthMm,
      drawing.heightMm,
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
  drawWires(pdf, visibleWires, project.symbols);

  for (const symbol of visibleSymbols) {
    const def = getSymbolDefinition(symbol.type);
    if (!def) continue;
    drawSymbol(pdf, symbol, def.shape);
  }

  const buffer = pdf.output('arraybuffer');
  return new Uint8Array(buffer);
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
// 配線描画 (Phase 2-E3a 新規)
// -----------------------------------------------------------------------------

/** 配線種別ごとの PDF 描画スタイル (テストで参照するため export)。 */
export interface WireStyle {
  /** [r, g, b] (0-255) */
  color: [number, number, number];
  /** 破線/点線パターン (mm)、未指定なら実線 */
  dash?: number[];
}

function styleForWireType(type: WireType): WireStyle {
  switch (type) {
    case 'ceiling':
      return { color: [0, 0, 0] };
    case 'floor':
      return { color: [0, 0, 0], dash: [2.5, 1.5] }; // 破線
    case 'concealed':
      return { color: [0, 0, 0], dash: [0.7, 0.7] }; // 点線
    case 'exposed':
      return { color: [0, 102, 204] }; // 青実線
  }
}

/** wires (フィルタ済) を順に jsPDF 上に描画する。 */
function drawWires(
  pdf: jsPDF,
  wires: readonly Wire[],
  symbols: readonly ProjectSymbol[],
): void {
  pdf.setLineWidth(0.35); // 0.35mm ≈ 1pt 相当の見やすい配線太さ

  for (const wire of wires) {
    const points = getWirePoints(wire, symbols);
    if (!points || points.length < 2) continue;

    const style = styleForWireType(wire.type);
    pdf.setDrawColor(style.color[0], style.color[1], style.color[2]);
    if (style.dash) {
      pdf.setLineDashPattern(style.dash, 0);
    } else {
      pdf.setLineDashPattern([], 0);
    }

    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      pdf.line(a.x, a.y, b.x, b.y);
    }
  }

  // 後続のシンボル描画に dash 設定が漏れないよう実線にリセット
  pdf.setLineDashPattern([], 0);
  pdf.setDrawColor(0, 0, 0);
}

/** 配線種別ごとの PDF 描画スタイル。テストのため export する。 */
export function getWirePdfStyle(type: WireType): WireStyle {
  return styleForWireType(type);
}

// -----------------------------------------------------------------------------
// シンボル描画 (Phase 2-B / Phase 2-E3a で half-circle 正式対応)
// -----------------------------------------------------------------------------

function drawSymbol(pdf: jsPDF, symbol: ProjectSymbol, shape: SymbolShape): void {
  const { x, y } = symbol.position;

  pdf.setDrawColor(0, 0, 0);
  pdf.setFillColor(255, 255, 255);
  pdf.setTextColor(0, 0, 0);

  if (shape.kind === 'circle-with-text') {
    pdf.setLineWidth(shape.strokeWidthMm);
    pdf.circle(x, y, shape.radiusMm, 'FD');
    if (shape.text) {
      pdf.setFontSize(shape.fontSizeMm * MM_TO_PT);
      pdf.text(shape.text, x, y, { align: 'center', baseline: 'middle' });
    }
  } else if (shape.kind === 'solid-circle-with-text') {
    pdf.setFillColor(0, 0, 0);
    pdf.circle(x, y, shape.radiusMm, 'F');
    if (shape.text) {
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(shape.fontSizeMm * MM_TO_PT);
      pdf.text(shape.text, x, y, { align: 'center', baseline: 'middle' });
    }
  } else if (shape.kind === 'square-with-text') {
    pdf.setLineWidth(shape.strokeWidthMm);
    pdf.rect(x - shape.widthMm / 2, y - shape.heightMm / 2, shape.widthMm, shape.heightMm, 'FD');
    if (shape.text) {
      pdf.setFontSize(shape.fontSizeMm * MM_TO_PT);
      pdf.text(shape.text, x, y, { align: 'center', baseline: 'middle' });
    }
  } else if (shape.kind === 'circle-with-cross') {
    pdf.setLineWidth(shape.strokeWidthMm);
    pdf.circle(x, y, shape.radiusMm, 'FD');
    // 内接 × (45° 方向、長さ = radius * sqrt(2))
    const half = shape.radiusMm * Math.SQRT1_2;
    pdf.line(x - half, y - half, x + half, y + half);
    pdf.line(x - half, y + half, x + half, y - half);
  } else if (shape.kind === 'half-circle-with-text') {
    // Phase 2-E3a: 上半円 (∩ 形) を ベジェ近似で正式描画。
    // 単位円の上半分はベジェ 4 制御点で十分近似可能。
    // 中心 (x, y) から半径 r、左端 (-r, 0)、右端 (+r, 0)、頂点 (0, -r) を結ぶ ∩ 形。
    pdf.setLineWidth(shape.strokeWidthMm);
    drawHalfCircle(pdf, x, y, shape.radiusMm);
    if (shape.text) {
      pdf.setFontSize(shape.fontSizeMm * MM_TO_PT);
      // テキストは半円の中央寄り (y を半分上に)
      pdf.text(shape.text, x, y - shape.radiusMm * 0.4, { align: 'center', baseline: 'middle' });
    }
  }
}

/**
 * 上半円 (底辺は直線、上が曲線、PDF 座標は Y 下向き) を fill+stroke で描画する。
 * jsPDF に半円 API が無いため、3 次ベジェで上半円弧を近似 + 底辺を直線で閉じる。
 *
 * 単位円の四分円ベジェ近似定数 K ≈ 0.5523 (8 分の 4 円で誤差 0.027% 程度)。
 */
function drawHalfCircle(pdf: jsPDF, cx: number, cy: number, r: number): void {
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
    'FD', // fill + stroke
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
