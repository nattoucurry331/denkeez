// F-18 PDF: 自由テキスト注記を PDF 出力に載せるための canvas ラスター化。
//
// jsPDF 既定フォントは日本語を描画できないため、表題欄(title-block.ts)と同じく
// ブラウザ canvas に日本語フォントで描画し PNG dataURL 化して pdf.addImage する。
// 画面の TextAnnotationLayer (Konva Text) と一致させるため:
//   - 左上アンカー (テキストの左上 = position)
//   - 各行を fontSize で縦に積む
//   - 背景は透明 (図面の上に重ねる)
//
// splitTextLines は純粋関数なので単体テスト対象。renderTextAnnotationImage は
// canvas を使うためブラウザ専用 (jsdom 非対応 → テスト対象外)。

/** テキストを行に分割する。全体が空白だけなら [] を返す(描画スキップ判定用)。 */
export function splitTextLines(text: string): string[] {
  if (text.trim() === '') return [];
  return text.split('\n');
}

export interface TextAnnotationImage {
  /** PNG dataURL。描画不要(空)のときは空文字。 */
  dataUrl: string;
  /** 紙面 mm 幅 (PDF では ts() で用紙倍率を掛ける) */
  widthMm: number;
  /** 紙面 mm 高さ */
  heightMm: number;
}

export interface RenderTextAnnotationOptions {
  /** 描画解像度 (px/mm)。既定 8 (表題欄と同じ。文字をくっきり描く) */
  pxPerMm?: number;
  /** 行高係数 (fontSize に対する倍率)。既定 1.2 */
  lineHeightFactor?: number;
}

/**
 * テキスト注記を透明背景の PNG にラスター化する。
 * 戻り値の widthMm/heightMm は「紙面 mm」(fontSizeMm と同じ系)。
 */
export function renderTextAnnotationImage(
  text: string,
  fontSizeMm: number,
  color: string,
  options: RenderTextAnnotationOptions = {},
): TextAnnotationImage {
  const lines = splitTextLines(text);
  if (lines.length === 0) return { dataUrl: '', widthMm: 0, heightMm: 0 };

  const pxPerMm = options.pxPerMm ?? 8;
  const lineHeightFactor = options.lineHeightFactor ?? 1.2;
  const fontPx = Math.max(1, fontSizeMm * pxPerMm);
  const lineHpx = fontPx * lineHeightFactor;
  const font = `${fontPx}px sans-serif`;

  // 1) 最大行幅を測る
  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) return { dataUrl: '', widthMm: 0, heightMm: 0 };
  probe.font = font;
  let maxW = 1;
  for (const ln of lines) {
    maxW = Math.max(maxW, probe.measureText(ln).width);
  }

  // 2) 本番 canvas (透明背景)。右に少し余白を足して AA クリップを防ぐ
  const W = Math.ceil(maxW) + Math.ceil(fontPx * 0.1);
  const H = Math.ceil(lineHpx * lines.length);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, W);
  canvas.height = Math.max(1, H);
  const ctx = canvas.getContext('2d');
  if (!ctx) return { dataUrl: '', widthMm: 0, heightMm: 0 };

  ctx.font = font;
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  lines.forEach((ln, i) => {
    // 左上アンカー: x=0 で position と一致させる
    ctx.fillText(ln, 0, i * lineHpx);
  });

  return {
    dataUrl: canvas.toDataURL('image/png'),
    widthMm: canvas.width / pxPerMm,
    heightMm: canvas.height / pxPerMm,
  };
}
