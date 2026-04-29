// グリッドレイヤー (Phase 2-A2 / REQUIREMENTS.md F-13)。
// 和室基準の 910mm or 455mm 間隔で破線グリッドを描画する。
// Project に grid 設定が無い or enabled=false なら何も描画しない。
//
// Phase 2-A2 では canvas 全体に描画する (cull なし)。A1 + 910mm でも本数は数百本程度で
// Konva の処理範囲。Phase 2-D 以降の負荷検証で必要なら viewport cull に切替。

import { Layer, Line } from 'react-konva';
import { useProjectStore } from '../data/project-store';
import { DEFAULT_GRID_CONFIG } from '../data/types';

interface Props {
  /** 1mm あたりのスクリーン px */
  pxPerMm: number;
  /** Konva canvas の幅 (px) — PDF レンダー canvas のサイズ */
  canvasWidth: number;
  canvasHeight: number;
}

export function GridLayer({ pxPerMm, canvasWidth, canvasHeight }: Props): JSX.Element | null {
  const grid = useProjectStore((s) => s.project.grid) ?? DEFAULT_GRID_CONFIG;
  if (!grid.enabled) {
    return null;
  }
  const spacingPx = grid.spacingMm * pxPerMm;
  if (spacingPx <= 0 || !Number.isFinite(spacingPx)) {
    return null;
  }

  const verticalLines: number[] = [];
  for (let x = 0; x <= canvasWidth; x += spacingPx) {
    verticalLines.push(x);
  }
  const horizontalLines: number[] = [];
  for (let y = 0; y <= canvasHeight; y += spacingPx) {
    horizontalLines.push(y);
  }

  return (
    <Layer listening={false}>
      {verticalLines.map((x) => (
        <Line
          key={`v-${x}`}
          points={[x, 0, x, canvasHeight]}
          stroke={grid.color}
          strokeWidth={0.5}
          dash={[3, 3]}
          perfectDrawEnabled={false}
        />
      ))}
      {horizontalLines.map((y) => (
        <Line
          key={`h-${y}`}
          points={[0, y, canvasWidth, y]}
          stroke={grid.color}
          strokeWidth={0.5}
          dash={[3, 3]}
          perfectDrawEnabled={false}
        />
      ))}
    </Layer>
  );
}
