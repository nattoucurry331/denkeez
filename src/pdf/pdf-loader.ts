// PDF.js による PDF レンダリング (Phase 1 PoC)
//
// REQUIREMENTS.md §7.1: A1 サイズ (3MB) を 3 秒以内に表示できることが目標 (R-01)
// Plan §5 R-02: WebView2 上で pdf.worker.min.mjs を読み込めるかの検証
//
// PDF.js v4 系は ESM 主体。Vite の `?url` import で worker の静的 URL を解決し、
// `GlobalWorkerOptions.workerSrc` に設定する。

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// モジュール初回 import 時に worker を 1 度だけ設定する
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

/** ページ回転角度。PDF.js の getViewport({ rotation }) と同じ規約 (右回り)。 */
export type Rotation = 0 | 90 | 180 | 270;

export interface RenderedPage {
  /** Konva の Image ノードに渡す canvas */
  readonly canvas: HTMLCanvasElement;
  /** PDF ページの実寸 (pt) — scale=1 viewport ベース、rotation 適用後の寸法 */
  readonly widthPt: number;
  readonly heightPt: number;
  /** ドキュメントの総ページ数 */
  readonly pageCount: number;
}

/**
 * PDF ファイルから 1 ページをレンダリングする。
 *
 * @param data       PDF バイト列 (File.arrayBuffer や Tauri fs::readFile の結果)
 * @param pageNumber 1 始まりのページ番号
 * @param scale      レンダリングスケール (2.0 で約 144DPI 相当 — Phase 1 PoC 既定値)
 * @param rotation   ページ回転 (0/90/180/270)。0 は PDF 既定の向き
 */
export async function renderPdfPage(
  data: ArrayBuffer,
  pageNumber = 1,
  scale = 2.0,
  rotation: Rotation = 0,
): Promise<RenderedPage> {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error(`[denkeez] scale must be positive, got ${scale}`);
  }

  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;

  if (pageNumber < 1 || pageNumber > pdf.numPages) {
    throw new Error(
      `[denkeez] page number ${pageNumber} is out of range (1..${pdf.numPages})`,
    );
  }

  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale, rotation });

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('[denkeez] failed to acquire 2D rendering context');
  }

  await page.render({ canvasContext: context, viewport }).promise;

  // PDF の実寸 (pt) は scale=1 + 同じ rotation の viewport から取得
  const baseViewport = page.getViewport({ scale: 1, rotation });

  return {
    canvas,
    widthPt: baseViewport.width,
    heightPt: baseViewport.height,
    pageCount: pdf.numPages,
  };
}
