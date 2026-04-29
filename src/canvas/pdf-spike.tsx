// PDF.js + Konva 統合スパイク (M0 検証用)
//
// 検証対象リスク:
//   R-02: PDF.js の worker (pdf.worker.min.mjs) を Vite + WebView2 環境で読み込めるか
//   R-03: Konva の Image ノードに PDF.js のレンダー結果 canvas を背景として重ねられるか
//   R-01: A1/3MB を 3 秒以内に表示できるか (パフォーマンス計測ログ)
//
// Phase 2 で本格的な PdfBackgroundLayer / SymbolsLayer に置き換える。

import { useState, type ChangeEvent } from 'react';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import { renderPdfPage, type RenderedPage } from '../pdf/pdf-loader';

interface LoadResult {
  readonly rendered: RenderedPage;
  readonly elapsedMs: number;
  readonly fileSizeBytes: number;
  readonly fileName: string;
}

export function PdfSpike(): JSX.Element {
  const [result, setResult] = useState<LoadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const buffer = await file.arrayBuffer();
      const start = performance.now();
      const rendered = await renderPdfPage(buffer, 1, 2.0);
      const elapsedMs = performance.now() - start;
      setResult({
        rendered,
        elapsedMs,
        fileSizeBytes: file.size,
        fileName: file.name,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section style={{ marginTop: '1rem' }}>
      <h2>PDF.js + Konva スパイク</h2>
      <p style={{ fontSize: '0.85rem', color: '#666' }}>
        R-01 性能 / R-02 worker 読込 / R-03 Konva 重ね描き の検証用
      </p>
      <input type="file" accept="application/pdf" onChange={handleFileChange} disabled={loading} />
      {loading && <p>レンダリング中…</p>}
      {error && (
        <p style={{ color: '#c00' }} role="alert">
          エラー: {error}
        </p>
      )}
      {result && (
        <>
          <p style={{ fontSize: '0.85rem' }}>
            <code>{result.fileName}</code> ({(result.fileSizeBytes / 1024 / 1024).toFixed(2)} MB) /{' '}
            {result.rendered.pageCount} ページ / 実寸 {result.rendered.widthPt.toFixed(0)} ×{' '}
            {result.rendered.heightPt.toFixed(0)} pt / レンダー時間{' '}
            <strong>{result.elapsedMs.toFixed(0)} ms</strong>
            {result.elapsedMs > 3000 && (
              <span style={{ color: '#c60' }}> (REQUIREMENTS.md §7.1 の 3000ms を超過)</span>
            )}
          </p>
          <div style={{ border: '1px solid #ccc', display: 'inline-block', overflow: 'auto', maxWidth: '100%' }}>
            <Stage width={result.rendered.canvas.width} height={result.rendered.canvas.height}>
              <Layer>
                <KonvaImage image={result.rendered.canvas} />
              </Layer>
            </Stage>
          </div>
        </>
      )}
    </section>
  );
}
