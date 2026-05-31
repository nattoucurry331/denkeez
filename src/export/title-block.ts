// Phase 3 F-14: 表題欄(タイトルブロック)の組み立てと描画。
//
// jsPDF 既定フォントは日本語を描画できないため、表題欄はブラウザの canvas に
// 日本語フォントで描画し、PNG 画像として PDF に貼る方式を採る(背景 PDF と同じ
// ラスター方式・追加フォント依存なし)。computeTitleRows / titleBlockOrigin は
// 純粋関数なので単体テスト可能。renderTitleBlockImage は canvas を使う(ブラウザ専用)。

import type { TitleBlockConfig, TitleBlockPosition } from '../data/types';

export interface TitleRow {
  label: string;
  value: string;
}

/** 表題欄に表示する行(標準6項目)。縮尺は呼び出し側で算出して渡す。 */
export function computeTitleRows(config: TitleBlockConfig, scaleText: string): TitleRow[] {
  return [
    { label: '工事名', value: config.projectName },
    { label: '図面名', value: config.drawingName },
    { label: '縮尺', value: scaleText },
    { label: '日付', value: config.date },
    { label: '作成者', value: config.author },
    { label: '会社名', value: config.company },
  ];
}

/** 配置位置から表題欄左上の PDF mm 座標を求める(純粋関数)。 */
export function titleBlockOrigin(
  position: TitleBlockPosition,
  pageWidthMm: number,
  pageHeightMm: number,
  blockWidthMm: number,
  blockHeightMm: number,
  insetMm: number,
): { x: number; y: number } {
  const right = Math.max(insetMm, pageWidthMm - blockWidthMm - insetMm);
  const bottom = Math.max(insetMm, pageHeightMm - blockHeightMm - insetMm);
  switch (position) {
    case 'top-left':
      return { x: insetMm, y: insetMm };
    case 'top-right':
      return { x: right, y: insetMm };
    case 'bottom-left':
      return { x: insetMm, y: bottom };
    case 'bottom-right':
    default:
      return { x: right, y: bottom };
  }
}

export interface TitleBlockImage {
  dataUrl: string;
  widthMm: number;
  heightMm: number;
}

export interface RenderTitleBlockOptions {
  /** 表題欄の幅 (mm)。既定 85mm */
  widthMm?: number;
  /** 1 行の高さ (mm)。既定 7mm */
  rowHeightMm?: number;
  /** 描画解像度 (px/mm)。既定 8 (高 DPI で文字をくっきり) */
  pxPerMm?: number;
}

/**
 * 表題欄をブラウザ canvas に描画して PNG dataURL を返す(日本語フォント対応)。
 * jsdom には canvas が無いので単体テスト対象外(純粋部分は上の関数でカバー)。
 */
export function renderTitleBlockImage(
  rows: readonly TitleRow[],
  options: RenderTitleBlockOptions = {},
): TitleBlockImage {
  const widthMm = options.widthMm ?? 85;
  const rowHeightMm = options.rowHeightMm ?? 7;
  const pxPerMm = options.pxPerMm ?? 8;
  const heightMm = rowHeightMm * rows.length;

  const W = Math.max(1, Math.round(widthMm * pxPerMm));
  const H = Math.max(1, Math.round(heightMm * pxPerMm));
  const rowH = rowHeightMm * pxPerMm;
  const labelColW = Math.round(22 * pxPerMm); // ラベル列幅 22mm
  const pad = Math.round(1.5 * pxPerMm);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // canvas 不可環境のフォールバック(実用上ブラウザでは到達しない)
    return { dataUrl: '', widthMm, heightMm };
  }

  // 背景白 + 外枠
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = Math.max(1, pxPerMm * 0.18);
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  ctx.textBaseline = 'middle';
  const fontPx = Math.round(pxPerMm * 3.0); // 約 3mm の文字
  const labelFontPx = Math.round(pxPerMm * 2.6);

  rows.forEach((r, i) => {
    const top = i * rowH;
    const midY = top + rowH / 2;
    // 行区切り (1 行目以外)
    if (i > 0) {
      ctx.beginPath();
      ctx.moveTo(0, top);
      ctx.lineTo(W, top);
      ctx.stroke();
    }
    // ラベル列区切り
    ctx.beginPath();
    ctx.moveTo(labelColW, top);
    ctx.lineTo(labelColW, top + rowH);
    ctx.stroke();
    // ラベル列の背景を薄いグレーに
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(0, top, labelColW, rowH);
    // ラベル
    ctx.fillStyle = '#333333';
    ctx.font = `${labelFontPx}px sans-serif`;
    ctx.fillText(r.label, pad, midY);
    // 値
    ctx.fillStyle = '#000000';
    ctx.font = `${fontPx}px sans-serif`;
    ctx.fillText(r.value, labelColW + pad, midY);
  });

  return { dataUrl: canvas.toDataURL('image/png'), widthMm, heightMm };
}
