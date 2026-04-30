// 配線モード中の仮線プレビュー (Phase 2-C2)。
// from シンボル位置 → waypoints → カーソル位置 の橙色破線を描画。
// listening=false で hit-test を抑制 (シンボルクリックを通す)。

import { Layer, Line, Circle } from 'react-konva';
import { useProjectStore } from '../data/project-store';
import { mmToPx, type Scale } from '../utils/coordinate';

interface Props {
  pxPerMm: number;
  /** カーソル位置 (canvas 論理座標) */
  cursorPx?: { x: number; y: number } | undefined;
}

export function WirePreviewLayer({ pxPerMm, cursorPx }: Props): JSX.Element | null {
  const mode = useProjectStore((s) => s.mode);
  const symbols = useProjectStore((s) => s.project.symbols);

  if (mode.kind !== 'wire') return null;

  const fromSymbol = mode.fromSymbolId
    ? symbols.find((s) => s.id === mode.fromSymbolId)
    : undefined;

  const scale: Scale = { pxPerMm };

  // 確定済み waypoints までの実線
  const points: number[] = [];
  if (fromSymbol) {
    points.push(mmToPx(fromSymbol.position.x, scale), mmToPx(fromSymbol.position.y, scale));
    for (const wp of mode.waypoints) {
      points.push(mmToPx(wp.x, scale), mmToPx(wp.y, scale));
    }
  }

  // 最終 waypoint (or from) からカーソルへの仮線
  const lastConfirmedPx =
    mode.waypoints.length > 0
      ? {
          x: mmToPx(mode.waypoints[mode.waypoints.length - 1]!.x, scale),
          y: mmToPx(mode.waypoints[mode.waypoints.length - 1]!.y, scale),
        }
      : fromSymbol
        ? {
            x: mmToPx(fromSymbol.position.x, scale),
            y: mmToPx(fromSymbol.position.y, scale),
          }
        : null;

  return (
    <Layer listening={false}>
      {points.length >= 4 && (
        <Line points={points} stroke="#ff7700" strokeWidth={1.5} />
      )}
      {/* 確定済み中継点を小さい丸で表示 */}
      {mode.waypoints.map((wp, i) => (
        <Circle
          key={i}
          x={mmToPx(wp.x, scale)}
          y={mmToPx(wp.y, scale)}
          radius={3}
          fill="#ff7700"
        />
      ))}
      {/* 仮線 (最終 waypoint → カーソル) */}
      {lastConfirmedPx && cursorPx && (
        <Line
          points={[lastConfirmedPx.x, lastConfirmedPx.y, cursorPx.x, cursorPx.y]}
          stroke="#ff7700"
          strokeWidth={1.5}
          dash={[5, 3]}
        />
      )}
    </Layer>
  );
}
