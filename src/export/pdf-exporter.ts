// プロジェクトを PDF として出力する (Plan §1 / REQUIREMENTS.md §10.1-5 / F-14)。
//
// PoC 構成 (ハイブリッド):
//   - 背景: 現在の Konva 上の pdfCanvas (PDF.js scale=2.0, 約 144DPI 相当) を
//     PNG として addImage する。Phase 2 で 300DPI で再レンダーする品質改善予定。
//   - シンボル: jsPDF のベクター API (circle / text) で直接描画する。
//     拡大しても劣化しないベクター品質を確保 (Plan §5 R-04 達成)。
//
// 当初 Plan §1 では svg2pdf.js を併用予定だったが、Konva 自体に SVG エクスポート API が
// 無いため (toCanvas は ラスターのみ)、シンボルは jsPDF vector API で直接描画する方式に変更。
// 結果として svg2pdf 依存は実際には未使用 (将来 Phase 2 で SVG パスシンボルを追加した際に再導入予定)。

import jsPDF from 'jspdf';
import type { Project } from '../data/types';
import { getSymbolDefinition } from '../symbols/symbol-registry';

const MM_PER_INCH = 25.4;
const PT_PER_INCH = 72;
/** mm → pt 変換 (jsPDF の setFontSize は pt 指定) */
const MM_TO_PT = PT_PER_INCH / MM_PER_INCH;

export interface ExportOptions {
  project: Project;
  /** PDF 背景レンダリング結果。pdfCanvas を渡す。 */
  backgroundCanvas: HTMLCanvasElement;
}

/**
 * Project を 1 ページの PDF (Uint8Array) として出力する。
 * 用紙サイズは drawing.widthMm × drawing.heightMm に合わせる。
 * 向きは縦/横を自動判定する。
 */
export function exportProjectAsPdf(options: ExportOptions): Uint8Array {
  const { project, backgroundCanvas } = options;
  const drawing = project.drawing;
  if (!drawing) {
    throw new Error('[denkeez] PDF 背景が読み込まれていません');
  }

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

  // 背景 (PNG dataURL を PDF に貼付)
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

  // シンボルをベクター描画
  // Phase 2-B では shape kind が 5 種に拡張されたが、PDF 出力は当面 circle-with-text のみ対応。
  // 他の kind (square / solid / cross / half-circle) は Phase 2-D で順次対応する。
  for (const symbol of project.symbols) {
    const def = getSymbolDefinition(symbol.type);
    if (!def) continue;
    const { x, y } = symbol.position;
    const shape = def.shape;

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
      // 上半円 (∩ 形) は jsPDF に直接描画 API が無いため、ellipse の上半分を近似。
      // 簡略化: 円で代用 (Phase 2-D で正式対応)。
      pdf.setLineWidth(shape.strokeWidthMm);
      pdf.circle(x, y, shape.radiusMm, 'FD');
      if (shape.text) {
        pdf.setFontSize(shape.fontSizeMm * MM_TO_PT);
        pdf.text(shape.text, x, y, { align: 'center', baseline: 'middle' });
      }
    }
  }

  const buffer = pdf.output('arraybuffer');
  return new Uint8Array(buffer);
}

/**
 * デフォルトの出力ファイル名を生成。
 * 例: project.meta.name = "現場 A" → "現場 A.pdf"
 */
export function suggestedExportName(project: Project): string {
  const base = project.meta.name.trim() || 'denkeez-export';
  return `${base}.pdf`;
}
