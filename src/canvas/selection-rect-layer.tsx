// 矩形選択中のオーバーレイ (Phase 2-B4)。
// CanvasArea のローカル state から渡された rect を青破線 + 半透明青で描画する。
// listening=false で hit-test を抑制(下のシンボルへのクリックは届く)。

import { Layer, Rect } from 'react-konva';

export interface SelectionRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface Props {
  rect: SelectionRect | null;
}

export function SelectionRectLayer({ rect }: Props): JSX.Element | null {
  if (!rect) return null;
  const x = Math.min(rect.startX, rect.endX);
  const y = Math.min(rect.startY, rect.endY);
  const w = Math.abs(rect.endX - rect.startX);
  const h = Math.abs(rect.endY - rect.startY);
  if (w < 1 && h < 1) return null;

  return (
    <Layer listening={false}>
      <Rect
        x={x}
        y={y}
        width={w}
        height={h}
        stroke="#0080ff"
        strokeWidth={1}
        dash={[4, 2]}
        fill="rgba(0, 128, 255, 0.1)"
      />
    </Layer>
  );
}
