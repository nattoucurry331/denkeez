// Phase 2-I2: 取込画像のダウンスケール + dataURL 化ユーティリティ。
//
// .dkz (JSON) に base64 で inline するため、取込時に縮小して肥大化を防ぐ。
// - 図面配置用: 長辺 maxEdge px (既定 512) / JPEG 圧縮
// - プリセットサムネ用: より小さく (呼び出し側で maxEdge を指定)
//
// 透過 PNG (アイコン等) は JPEG だと背景が黒くなるため、元が PNG かつ
// アルファを持つ可能性がある場合は PNG のまま縮小する選択肢も用意する。

export interface ImportedImage {
  /** ダウンスケール済み dataURL (image/jpeg or image/png) */
  dataUrl: string;
  /** width / height (元画像の縦横比、ProjectSymbol.image.aspectRatio に使う) */
  aspectRatio: number;
  /** 圧縮後のおおよそのバイト数 (UI 表示用) */
  approxBytes: number;
}

export interface DownscaleOptions {
  /** 長辺の最大 px (既定 512) */
  maxEdge?: number;
  /** JPEG 品質 0-1 (既定 0.82)。PNG 維持時は無視 */
  quality?: number;
  /** true なら PNG のまま (透過保持)。既定 false (JPEG 圧縮) */
  keepPng?: boolean;
}

/**
 * File (画像) を読み込み、ダウンスケールして dataURL を返す。
 * 画像でないファイルや読み込み失敗時は reject。
 */
export async function importImageFile(
  file: File,
  options: DownscaleOptions = {},
): Promise<ImportedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('画像ファイルではありません');
  }
  const srcDataUrl = await readFileAsDataUrl(file);
  return downscaleDataUrl(srcDataUrl, options);
}

/** dataURL (任意サイズ) をダウンスケールして dataURL を返す。クリップボード/D&D 共通。 */
export async function downscaleDataUrl(
  srcDataUrl: string,
  options: DownscaleOptions = {},
): Promise<ImportedImage> {
  const { maxEdge = 512, quality = 0.82, keepPng = false } = options;
  const img = await loadImage(srcDataUrl);
  const naturalW = img.naturalWidth || 1;
  const naturalH = img.naturalHeight || 1;
  const aspectRatio = naturalW / naturalH;

  // 縮小後サイズ (長辺を maxEdge に収める。元が小さければ拡大しない)
  const longEdge = Math.max(naturalW, naturalH);
  const ratio = longEdge > maxEdge ? maxEdge / longEdge : 1;
  const outW = Math.max(1, Math.round(naturalW * ratio));
  const outH = Math.max(1, Math.round(naturalH * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('画像処理に失敗しました (canvas 2D 取得不可)');
  // JPEG 出力時は背景を白で塗る (透過部分が黒くならないように)
  if (!keepPng) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outW, outH);
  }
  ctx.drawImage(img, 0, 0, outW, outH);

  const mime = keepPng ? 'image/png' : 'image/jpeg';
  const dataUrl = keepPng ? canvas.toDataURL(mime) : canvas.toDataURL(mime, quality);
  return { dataUrl, aspectRatio, approxBytes: estimateDataUrlBytes(dataUrl) };
}

/** クリップボード貼付 (ClipboardItem / paste イベントの items) から最初の画像を取り込む */
export async function importImageFromClipboard(
  items: DataTransferItemList | null,
  options: DownscaleOptions = {},
): Promise<ImportedImage | null> {
  if (!items) return null;
  for (const item of Array.from(items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) return importImageFile(file, options);
    }
  }
  return null;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('ファイル読み込みに失敗しました'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    img.src = dataUrl;
  });
}

/** dataURL の base64 部分からおおよそのバイト数を推定 */
function estimateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return 0;
  const b64 = dataUrl.slice(comma + 1);
  // base64 4 文字 = 3 バイト
  return Math.floor((b64.length * 3) / 4);
}

/** バイト数を人間可読に (UI 表示用) */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
