// Phase 2-I: dataURL → HTMLImageElement を生成してキャッシュするフック。
// Konva の <Image> は HTMLImageElement (or canvas) を受け取るため、dataURL から
// 1 度だけ Image を生成して使い回す。外部依存 (use-image) は入れず最小実装。
//
// dataURL は同一文字列なら同じ Image を返す (モジュールスコープ Map でキャッシュ)。
// プロジェクト内に同じ商品画像が大量に配置されても Image は 1 つで済む。

import { useEffect, useState } from 'react';

// dataURL → ロード済み HTMLImageElement のグローバルキャッシュ
const imageCache = new Map<string, HTMLImageElement>();

/**
 * dataURL を読み込んだ HTMLImageElement を返す。
 * 読み込み完了まで null。dataURL が変わると再ロード。
 */
export function useImageElement(dataUrl: string | undefined): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(() =>
    dataUrl ? (imageCache.get(dataUrl) ?? null) : null,
  );

  useEffect(() => {
    if (!dataUrl) {
      setImage(null);
      return;
    }
    // キャッシュヒット (ロード済み)
    const cached = imageCache.get(dataUrl);
    if (cached) {
      setImage(cached);
      return;
    }
    // 新規ロード
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (cancelled) return;
      imageCache.set(dataUrl, img);
      setImage(img);
    };
    img.onerror = () => {
      if (cancelled) return;
      setImage(null);
    };
    img.src = dataUrl;
    return () => {
      cancelled = true;
    };
  }, [dataUrl]);

  return image;
}
