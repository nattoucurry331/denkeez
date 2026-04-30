// 配線の幾何計算 (Phase 2-C2)。
// 端点 + 中継点の連続線分の長さを算出する。

import type { ProjectSymbol, Wire } from '../data/types';

export interface Point {
  x: number;
  y: number;
}

/** 連続点列の総距離を mm で返す */
export function pathLengthMm(points: Point[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

/** Wire の総距離を計算 (from → waypoints → to) */
export function computeWireLengthMm(
  wire: Pick<Wire, 'fromSymbolId' | 'toSymbolId' | 'waypoints'>,
  symbols: readonly ProjectSymbol[],
): number {
  const from = symbols.find((s) => s.id === wire.fromSymbolId);
  const to = symbols.find((s) => s.id === wire.toSymbolId);
  if (!from || !to) return 0;
  return pathLengthMm([from.position, ...wire.waypoints, to.position]);
}

/** Wire の端点 (from / to) と waypoints を 1 つの座標列にまとめる */
export function getWirePoints(
  wire: Pick<Wire, 'fromSymbolId' | 'toSymbolId' | 'waypoints'>,
  symbols: readonly ProjectSymbol[],
): Point[] | null {
  const from = symbols.find((s) => s.id === wire.fromSymbolId);
  const to = symbols.find((s) => s.id === wire.toSymbolId);
  if (!from || !to) return null;
  return [from.position, ...wire.waypoints, to.position];
}
