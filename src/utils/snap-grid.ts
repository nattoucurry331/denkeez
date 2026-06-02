// F-16 Sub-2: グリッド吸着 + 直角拘束の純粋関数。
//
// 寸法計測・寸法線・配線の 2 点系操作で、点を最寄りのグリッド交点に吸着し、
// Shift 押下時は 1 点目から見て水平/垂直に拘束する。座標は mm 系(symbols と同じ)。
// グリッドは mm 0,0 原点なので round(mm/spacing)*spacing が交点に一致する。

import type { Point } from './coordinate';

/**
 * 点を最寄りのグリッド交点 (mm) に吸着する。
 * spacingMm が 0 以下・非有限なら吸着せずそのまま返す。
 */
export function snapPointMm(p: Point, spacingMm: number): Point {
  if (!Number.isFinite(spacingMm) || spacingMm <= 0) return p;
  const nx = Math.round(p.x / spacingMm) * spacingMm;
  const ny = Math.round(p.y / spacingMm) * spacingMm;
  // -0 を +0 に正規化 (表示・比較の一貫性のため)
  return { x: nx === 0 ? 0 : nx, y: ny === 0 ? 0 : ny };
}

/**
 * 2 点目を 1 点目から見て水平 or 垂直に拘束する(直角拘束)。
 * 変位の大きい軸を残し、もう一方の軸を 1 点目に揃える。
 * 同値の場合は水平(y を揃える)を優先する(決定的挙動)。
 */
export function constrainOrtho(fromMm: Point, toMm: Point): Point {
  const dx = Math.abs(toMm.x - fromMm.x);
  const dy = Math.abs(toMm.y - fromMm.y);
  if (dx >= dy) {
    // 横方向が優勢 → 水平線 (y を from に揃える)
    return { x: toMm.x, y: fromMm.y };
  }
  // 縦方向が優勢 → 垂直線 (x を from に揃える)
  return { x: fromMm.x, y: toMm.y };
}
