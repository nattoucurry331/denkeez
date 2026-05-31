// Phase 3 F-16 Sub-1: 寸法計測モードのオーバーレイ。
// - 1 点目を丸でマーキング、移動中は仮線 + ライブ距離ラベル。
// - 直前の計測結果 (lastMeasurement) を実線 + ラベルで凍結表示 (消える計測の "今表示中")。
// listening=false で hit-test を抑制。
//
// ラベルは Stage の viewport scale を打ち消して常に一定サイズで表示する
// (ズームしても文字が伸び縮みしない)。

import { Layer, Circle, Line, Label, Tag, Text } from 'react-konva';

export interface MeasureSegment {
  fromPx: { x: number; y: number };
  toPx: { x: number; y: number };
  /** 表示ラベル (formatDistanceMm 済み) */
  label: string;
}

interface Props {
  active: boolean;
  /** 1 点目 (canvas 論理座標) */
  firstPointPx?: { x: number; y: number } | undefined;
  /** マウスカーソル位置 (canvas 論理座標) */
  cursorPx?: { x: number; y: number } | undefined;
  /** 進行中(1点目→カーソル)の距離ラベル */
  liveLabel?: string | undefined;
  /** 直前に確定した計測 (凍結表示) */
  lastMeasurement?: MeasureSegment | undefined;
  /** Stage のズーム倍率 (ラベルを一定サイズに保つため逆数を掛ける) */
  viewportScale: number;
}

const ACCENT = '#d35400';

function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function DistanceLabel({
  at,
  text,
  viewportScale,
}: {
  at: { x: number; y: number };
  text: string;
  viewportScale: number;
}): JSX.Element {
  const inv = viewportScale > 0 ? 1 / viewportScale : 1;
  return (
    <Label x={at.x} y={at.y} scaleX={inv} scaleY={inv} listening={false}>
      <Tag fill={ACCENT} cornerRadius={3} />
      <Text text={text} fontSize={12} padding={4} fill="#fff" />
    </Label>
  );
}

export function MeasureOverlayLayer({
  active,
  firstPointPx,
  cursorPx,
  liveLabel,
  lastMeasurement,
  viewportScale,
}: Props): JSX.Element | null {
  if (!active) return null;

  return (
    <Layer listening={false}>
      {/* 凍結表示: 直前の計測結果 */}
      {lastMeasurement && (
        <>
          <Line
            points={[
              lastMeasurement.fromPx.x,
              lastMeasurement.fromPx.y,
              lastMeasurement.toPx.x,
              lastMeasurement.toPx.y,
            ]}
            stroke={ACCENT}
            strokeWidth={1.5}
          />
          <Circle x={lastMeasurement.fromPx.x} y={lastMeasurement.fromPx.y} radius={4} fill={ACCENT} />
          <Circle x={lastMeasurement.toPx.x} y={lastMeasurement.toPx.y} radius={4} fill={ACCENT} />
          <DistanceLabel
            at={midpoint(lastMeasurement.fromPx, lastMeasurement.toPx)}
            text={lastMeasurement.label}
            viewportScale={viewportScale}
          />
        </>
      )}

      {/* 進行中: 1 点目 → カーソル */}
      {firstPointPx && (
        <Circle x={firstPointPx.x} y={firstPointPx.y} radius={5} fill={ACCENT} stroke="#fff" strokeWidth={1} />
      )}
      {firstPointPx && cursorPx && (
        <Line
          points={[firstPointPx.x, firstPointPx.y, cursorPx.x, cursorPx.y]}
          stroke={ACCENT}
          strokeWidth={1.5}
          dash={[6, 3]}
        />
      )}
      {firstPointPx && cursorPx && liveLabel && (
        <DistanceLabel at={midpoint(firstPointPx, cursorPx)} text={liveLabel} viewportScale={viewportScale} />
      )}
      {cursorPx && (
        <Circle x={cursorPx.x} y={cursorPx.y} radius={4} stroke={ACCENT} strokeWidth={1.5} fillEnabled={false} />
      )}
    </Layer>
  );
}
