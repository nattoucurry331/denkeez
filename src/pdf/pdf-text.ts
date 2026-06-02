// F-18: PDF 内のテキスト抽出。
//
// PDF.js の getTextContent() で文字とその位置(PDF user space, pt)を取得し、
// 図面内部の座標系 (mm, 左上原点) に変換する。スキャン PDF (画像のみ) は
// 文字が無いため空配列を返す (OCR は対象外)。
//
// 座標変換の核 (mapPdfTextItem) は純粋関数として分離し単体テスト可能にする。

import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import type { Rotation } from './pdf-loader';
import { generateId } from '../utils/id';

/** 1 pt = 25.4/72 mm (tauri/api.ts ptToMm と同値。pdf モジュールを decouple するため再定義) */
const PT_TO_MM = 25.4 / 72;

/** layerId を除いた抽出結果 (store 側でレイヤーに割り当てる) */
export interface ExtractedTextItem {
  id: string;
  text: string;
  position: { x: number; y: number };
  fontSizeMm: number;
}

/**
 * 1 テキスト item を mm 座標へ変換する純粋関数。
 *
 * @param viewportX  viewport.convertToViewportPoint で得た左上原点 X (pt, ベースライン基準)
 * @param viewportY  同 Y (pt, ベースライン基準。下方向が +)
 * @param fontHeightPt 文字高さ (pt)
 * @returns 左上アンカーの mm 位置とフォントサイズ (mm)
 */
export function mapPdfTextItem(
  viewportX: number,
  viewportY: number,
  fontHeightPt: number,
): { position: { x: number; y: number }; fontSizeMm: number } {
  const safeHeight = Number.isFinite(fontHeightPt) && fontHeightPt > 0 ? fontHeightPt : 0;
  // viewportY はベースライン位置なので、文字高さ分だけ上に戻して左上アンカーにする
  return {
    position: {
      x: viewportX * PT_TO_MM,
      y: (viewportY - safeHeight) * PT_TO_MM,
    },
    fontSizeMm: safeHeight * PT_TO_MM,
  };
}

/** TextItem 型ガード (TextMarkedContent には str が無い) */
function isTextItem(item: unknown): item is TextItem {
  return typeof (item as TextItem).str === 'string';
}

/**
 * PDF ファイルから指定ページの文字を抽出する。
 *
 * @param data       PDF バイト列
 * @param pageNumber 1 始まりのページ番号
 * @param rotation   ページ回転 (renderPdfPage と揃える)
 * @returns 抽出文字 (空白のみは除外)。文字が無ければ空配列。
 */
export async function extractPdfText(
  data: ArrayBuffer,
  pageNumber = 1,
  rotation: Rotation = 0,
): Promise<ExtractedTextItem[]> {
  // PDF.js は ArrayBuffer を worker に transfer して detach するためコピーを渡す
  const loadingTask = pdfjsLib.getDocument({ data: data.slice(0) });
  const pdf = await loadingTask.promise;
  if (pageNumber < 1 || pageNumber > pdf.numPages) {
    return [];
  }
  const page = await pdf.getPage(pageNumber);
  // 描画と同じ scale=1 + rotation の viewport で左上原点へ変換する
  const viewport = page.getViewport({ scale: 1, rotation });
  const content = await page.getTextContent();

  const result: ExtractedTextItem[] = [];
  for (const item of content.items) {
    if (!isTextItem(item)) continue;
    const text = item.str;
    if (text.trim() === '') continue;
    const tx = item.transform; // [a, b, c, d, e, f]
    const [vx, vy] = viewport.convertToViewportPoint(tx[4] ?? 0, tx[5] ?? 0);
    // 文字高さ: フォント行列の縦スケール。無ければ item.height をフォールバック
    const fontHeightPt = Math.hypot(tx[2] ?? 0, tx[3] ?? 0) || item.height || 0;
    const mapped = mapPdfTextItem(vx ?? 0, vy ?? 0, fontHeightPt);
    result.push({
      id: generateId(),
      text,
      position: mapped.position,
      fontSizeMm: mapped.fontSizeMm,
    });
  }
  return result;
}
