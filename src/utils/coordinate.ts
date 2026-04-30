// スクリーン座標 (px) と実寸座標 (mm) の双方向変換ユーティリティ。
//
// REQUIREMENTS.md §9.1.1 / CLAUDE.md L184:
//   座標系の二重管理を避けるため、UI コードから直接ピクセル計算しない。
//   すべての座標変換は本ユーティリティを経由すること。
//
// Phase 1 PoC では「1 mm あたりのスクリーンピクセル数」を Scale として持ち、
// Konva の Stage scale や PDF.js のレンダー DPI から導出する。
// Phase 2 でズーム・パン・回転を含む 2D アフィン変換に拡張予定。

export interface Scale {
  /** 1 mm あたりのスクリーンピクセル数。devicePixelRatio を考慮済みの値を渡す */
  readonly pxPerMm: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`[denkeez] ${label} must be a finite number, got ${value}`);
  }
}

function assertPositiveScale(scale: Scale): void {
  if (!Number.isFinite(scale.pxPerMm) || scale.pxPerMm <= 0) {
    throw new Error(
      `[denkeez] Scale.pxPerMm must be a positive finite number, got ${scale.pxPerMm}`,
    );
  }
}

export function mmToPx(mm: number, scale: Scale): number {
  assertFiniteNumber(mm, 'mm');
  assertPositiveScale(scale);
  return mm * scale.pxPerMm;
}

export function pxToMm(px: number, scale: Scale): number {
  assertFiniteNumber(px, 'px');
  assertPositiveScale(scale);
  return px / scale.pxPerMm;
}

export function pointMmToPx(point: Point, scale: Scale): Point {
  return {
    x: mmToPx(point.x, scale),
    y: mmToPx(point.y, scale),
  };
}

export function pointPxToMm(point: Point, scale: Scale): Point {
  return {
    x: pxToMm(point.x, scale),
    y: pxToMm(point.y, scale),
  };
}

/**
 * Phase 2-C1: drawing と canvas size から pxPerMm を計算する。
 * scale 設定時は校正済みの実寸ベース、未設定時は紙面実寸ベース (Phase 1 既存挙動)。
 */
export function computePxPerMm(
  drawing: {
    widthMm: number;
    scale?: { pixelDistanceCanvas: number; realDistanceMm: number } | undefined;
  },
  canvasWidth: number,
): number {
  if (drawing.scale && drawing.scale.realDistanceMm > 0) {
    return drawing.scale.pixelDistanceCanvas / drawing.scale.realDistanceMm;
  }
  if (drawing.widthMm > 0 && canvasWidth > 0) {
    return canvasWidth / drawing.widthMm;
  }
  return 1; // フォールバック (実用上は到達しない)
}

/**
 * 2 点 (canvas px) の距離を計算する。スケール校正で使う。
 */
export function distancePx(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}
