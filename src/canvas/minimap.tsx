// 右下のミニマップ (Phase 2-A3 / REQUIREMENTS.md F-12)。
// 図面全体を縮小表示し、現在のメインビュー位置を青い矩形でハイライト。
// ミニマップ上をクリックすると、その位置がメインビューの中心に来るよう offset を更新する。
//
// パフォーマンス対策 (Plan §5 R-A3, R-A10):
// - listening を最低限の Stage 全体のみで、内部の Image / Rect は listening:false
// - PDF サムネイルは pdfCanvas を直接 KonvaImage に渡す (再生成なし)

import { Stage, Layer, Image as KonvaImage, Rect } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useProjectStore } from '../data/project-store';
import { useViewportStore } from '../data/viewport-store';

const MINIMAP_W = 200;
const MINIMAP_H = 140;

interface Props {
  /** メインビューのコンテナサイズ (px) */
  containerSize: { w: number; h: number };
}

export function Minimap({ containerSize }: Props): JSX.Element | null {
  const canvas = useProjectStore((s) => s.pdfCanvas);
  const scale = useViewportStore((s) => s.scale);
  const offsetX = useViewportStore((s) => s.offsetX);
  const offsetY = useViewportStore((s) => s.offsetY);
  const setOffset = useViewportStore((s) => s.setOffset);

  if (!canvas) return null;
  if (containerSize.w <= 0 || containerSize.h <= 0) return null;
  if (canvas.width <= 0 || canvas.height <= 0) return null;

  // PDF を縮小したときの倍率 (短辺フィット)
  const miniScale = Math.min(MINIMAP_W / canvas.width, MINIMAP_H / canvas.height);
  const thumbW = canvas.width * miniScale;
  const thumbH = canvas.height * miniScale;
  // ミニマップ内で中央寄せするオフセット
  const padX = (MINIMAP_W - thumbW) / 2;
  const padY = (MINIMAP_H - thumbH) / 2;

  // メインビューが現在表示している canvas px 範囲
  const viewLeftCanvas = -offsetX / scale;
  const viewTopCanvas = -offsetY / scale;
  const viewWidthCanvas = containerSize.w / scale;
  const viewHeightCanvas = containerSize.h / scale;

  // ミニマップ上の現ビュー矩形
  const rectX = padX + viewLeftCanvas * miniScale;
  const rectY = padY + viewTopCanvas * miniScale;
  const rectW = viewWidthCanvas * miniScale;
  const rectH = viewHeightCanvas * miniScale;

  const handleClick = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const point = stage.getPointerPosition();
    if (!point) return;
    // クリック位置 (mini px) → canvas px
    const canvasPxX = (point.x - padX) / miniScale;
    const canvasPxY = (point.y - padY) / miniScale;
    // canvas px がメインビューの中央に来るよう offset 計算
    const newOffsetX = containerSize.w / 2 - canvasPxX * scale;
    const newOffsetY = containerSize.h / 2 - canvasPxY * scale;
    setOffset(newOffsetX, newOffsetY);
  };

  return (
    <div style={containerStyle} aria-label="ミニマップ">
      <Stage width={MINIMAP_W} height={MINIMAP_H} onClick={handleClick} onTap={handleClick}>
        <Layer listening={false}>
          <Rect x={0} y={0} width={MINIMAP_W} height={MINIMAP_H} fill="#fff" />
          <KonvaImage image={canvas} x={padX} y={padY} width={thumbW} height={thumbH} />
          <Rect
            x={rectX}
            y={rectY}
            width={rectW}
            height={rectH}
            stroke="#0080ff"
            strokeWidth={1.5}
            fillEnabled={false}
          />
          <Rect
            x={0}
            y={0}
            width={MINIMAP_W}
            height={MINIMAP_H}
            stroke="#999"
            strokeWidth={1}
            fillEnabled={false}
          />
        </Layer>
      </Stage>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  right: 16,
  bottom: 16,
  border: '1px solid #999',
  background: '#fff',
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
  zIndex: 10,
};
