// シンボル種別ごとの Konva 描画コンポーネント (Phase 2-B1)。
// 5 つの shape kind を実装する: circle-with-text / circle-with-cross /
// square-with-text / solid-circle-with-text / half-circle-with-text
//
// 描画は Group の (0,0) を中心とする。配置時の絶対位置・回転は呼び出し側 (symbols-layer) が担当。

import { Circle, Rect, Text, Line, Arc } from 'react-konva';
import { mmToPx, type Scale } from '../utils/coordinate';
import type { SymbolDefinition, SymbolShape } from '../symbols/symbol-registry';

interface Props {
  shape: SymbolShape;
  scale: Scale;
  /** 線色 / 文字色 / 塗り潰し色 (solid-circle 時) — 省略時は黒 */
  strokeColor?: string;
}

export function SymbolShapeRenderer({ shape, scale, strokeColor = '#000' }: Props): JSX.Element {
  switch (shape.kind) {
    case 'circle-with-text':
      return <CircleWithText shape={shape} scale={scale} strokeColor={strokeColor} />;
    case 'circle-with-cross':
      return <CircleWithCross shape={shape} scale={scale} strokeColor={strokeColor} />;
    case 'square-with-text':
      return <SquareWithText shape={shape} scale={scale} strokeColor={strokeColor} />;
    case 'solid-circle-with-text':
      return <SolidCircleWithText shape={shape} scale={scale} strokeColor={strokeColor} />;
    case 'half-circle-with-text':
      return <HalfCircleWithText shape={shape} scale={scale} strokeColor={strokeColor} />;
  }
}

/** 選択中シンボルの bounding box (px) を取得 (selection ハイライト用) */
export function getShapeBoundingBox(shape: SymbolShape, scale: Scale): {
  width: number;
  height: number;
} {
  switch (shape.kind) {
    case 'circle-with-text':
    case 'circle-with-cross':
    case 'solid-circle-with-text': {
      const r = mmToPx(shape.radiusMm, scale);
      return { width: r * 2, height: r * 2 };
    }
    case 'square-with-text':
      return {
        width: mmToPx(shape.widthMm, scale),
        height: mmToPx(shape.heightMm, scale),
      };
    case 'half-circle-with-text': {
      const r = mmToPx(shape.radiusMm, scale);
      return { width: r * 2, height: r };
    }
  }
}

// ----- 個別 shape の描画コンポーネント -----

function CircleWithText({
  shape,
  scale,
  strokeColor,
}: {
  shape: Extract<SymbolShape, { kind: 'circle-with-text' }>;
  scale: Scale;
  strokeColor: string;
}): JSX.Element {
  const radius = mmToPx(shape.radiusMm, scale);
  const stroke = Math.max(1, mmToPx(shape.strokeWidthMm, scale));
  const fontSize = mmToPx(shape.fontSizeMm, scale);
  const box = radius * 2;
  return (
    <>
      <Circle radius={radius} stroke={strokeColor} strokeWidth={stroke} fill="#fff" />
      {shape.text && (
        <Text
          text={shape.text}
          fontSize={fontSize}
          x={-radius}
          y={-radius}
          width={box}
          height={box}
          align="center"
          verticalAlign="middle"
          fill={strokeColor}
          listening={false}
        />
      )}
    </>
  );
}

function CircleWithCross({
  shape,
  scale,
  strokeColor,
}: {
  shape: Extract<SymbolShape, { kind: 'circle-with-cross' }>;
  scale: Scale;
  strokeColor: string;
}): JSX.Element {
  const radius = mmToPx(shape.radiusMm, scale);
  const stroke = Math.max(1, mmToPx(shape.strokeWidthMm, scale));
  // ×は内接 (45° 方向)、長さ = radius * sqrt(2)
  const half = radius * Math.SQRT1_2;
  return (
    <>
      <Circle radius={radius} stroke={strokeColor} strokeWidth={stroke} fill="#fff" />
      <Line points={[-half, -half, half, half]} stroke={strokeColor} strokeWidth={stroke} listening={false} />
      <Line points={[-half, half, half, -half]} stroke={strokeColor} strokeWidth={stroke} listening={false} />
    </>
  );
}

function SquareWithText({
  shape,
  scale,
  strokeColor,
}: {
  shape: Extract<SymbolShape, { kind: 'square-with-text' }>;
  scale: Scale;
  strokeColor: string;
}): JSX.Element {
  const w = mmToPx(shape.widthMm, scale);
  const h = mmToPx(shape.heightMm, scale);
  const stroke = Math.max(1, mmToPx(shape.strokeWidthMm, scale));
  const fontSize = mmToPx(shape.fontSizeMm, scale);
  return (
    <>
      <Rect x={-w / 2} y={-h / 2} width={w} height={h} stroke={strokeColor} strokeWidth={stroke} fill="#fff" />
      {shape.text && (
        <Text
          text={shape.text}
          fontSize={fontSize}
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          align="center"
          verticalAlign="middle"
          fill={strokeColor}
          listening={false}
        />
      )}
    </>
  );
}

function SolidCircleWithText({
  shape,
  scale,
  strokeColor,
}: {
  shape: Extract<SymbolShape, { kind: 'solid-circle-with-text' }>;
  scale: Scale;
  strokeColor: string;
}): JSX.Element {
  const radius = mmToPx(shape.radiusMm, scale);
  const fontSize = mmToPx(shape.fontSizeMm, scale);
  const box = radius * 2;
  return (
    <>
      <Circle radius={radius} fill={strokeColor} />
      {shape.text && (
        <Text
          text={shape.text}
          fontSize={fontSize}
          x={-radius}
          y={-radius}
          width={box}
          height={box}
          align="center"
          verticalAlign="middle"
          fill="#fff"
          listening={false}
        />
      )}
    </>
  );
}

function HalfCircleWithText({
  shape,
  scale,
  strokeColor,
}: {
  shape: Extract<SymbolShape, { kind: 'half-circle-with-text' }>;
  scale: Scale;
  strokeColor: string;
}): JSX.Element {
  const radius = mmToPx(shape.radiusMm, scale);
  const stroke = Math.max(1, mmToPx(shape.strokeWidthMm, scale));
  const fontSize = mmToPx(shape.fontSizeMm, scale);
  // 下半円 (底辺が直線、上が曲線)。Konva の Arc を使う: angle 180、rotation 180 で下半分
  // または Wedge / カスタム Path。シンプルに Arc を 0-180° に。
  // Arc は中心からの角度で描画。angle=180 + rotation=0 で右半円、rotation=180 で左半円。
  // 下半円: angle=180, rotation=180? 確認: Konva Arc は 0° が右、CW 回転。
  // 下半円 (Y 軸下向き) なら 0-180° (右→下→左)、つまり angle=180, rotation=0 でなく、
  // angle=180, rotation=0 だと右半分 (12 時 → 6 時)。Y 軸下向きなら 0° 始まりで CW なので
  // 上半円。下半円なら rotation=180 で 6 時始まり、180° 回って 12 時。
  // ここは「コンセント記号 = 上が曲線、底辺が直線」つまり下半円 (12 時から 6 時) ではなく
  // 「下半円 = 上に膨らむ」が適切。シンプル化: 上半円で OK。
  // angle=180, rotation=180 で「6時始まり、180°CW」= 左半分→上半分→右半分 → 上半円 (∩ 形)
  return (
    <>
      <Arc
        innerRadius={0}
        outerRadius={radius}
        angle={180}
        rotation={180}
        stroke={strokeColor}
        strokeWidth={stroke}
        fill="#fff"
      />
      {shape.text && (
        <Text
          text={shape.text}
          fontSize={fontSize}
          x={-radius}
          y={-radius * 0.85}
          width={radius * 2}
          height={radius * 0.7}
          align="center"
          verticalAlign="middle"
          fill={strokeColor}
          listening={false}
        />
      )}
    </>
  );
}

/** Phase 2-B 単一エクスポート (symbols-layer から呼ぶ) */
export function renderSymbolShape(
  def: SymbolDefinition,
  scale: Scale,
  strokeColor?: string,
): JSX.Element {
  return (
    <SymbolShapeRenderer
      shape={def.shape}
      scale={scale}
      {...(strokeColor !== undefined ? { strokeColor } : {})}
    />
  );
}
