// スケール設定モード中のオーバーレイ (Phase 2-C1)。
// 1 点目を青い丸でマーキング、マウス移動中は仮線を表示。
// listening=false で hit-test を抑制。

import { Layer, Circle, Line } from 'react-konva';

interface Props {
  /** mode === 'scale' のとき有効 */
  active: boolean;
  /** 1 点目 (canvas 論理座標 = scale 補正後の getRelativePointerPosition 値) */
  firstPointPx?: { x: number; y: number } | undefined;
  /** マウスカーソル位置 (canvas 論理座標) */
  cursorPx?: { x: number; y: number } | undefined;
}

export function ScaleOverlayLayer({ active, firstPointPx, cursorPx }: Props): JSX.Element | null {
  if (!active) return null;

  return (
    <Layer listening={false}>
      {firstPointPx && (
        <Circle x={firstPointPx.x} y={firstPointPx.y} radius={5} fill="#0080ff" stroke="#fff" strokeWidth={1} />
      )}
      {firstPointPx && cursorPx && (
        <Line
          points={[firstPointPx.x, firstPointPx.y, cursorPx.x, cursorPx.y]}
          stroke="#0080ff"
          strokeWidth={1.5}
          dash={[6, 3]}
        />
      )}
      {cursorPx && (
        <Circle x={cursorPx.x} y={cursorPx.y} radius={4} stroke="#0080ff" strokeWidth={1.5} fillEnabled={false} />
      )}
    </Layer>
  );
}
