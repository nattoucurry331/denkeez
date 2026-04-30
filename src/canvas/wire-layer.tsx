// 配線描画レイヤー (Phase 2-C2 / REQUIREMENTS.md F-07)。
// Project.wires の各 Wire を Konva Line で描画する。
// 種別ごとのスタイル(ceiling/floor/concealed/exposed)は Phase 2-C3 で UI 編集を追加、
// データ上はすでに type フィールドを持っているのでスタイル切替もここで実装する。

import { Layer, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useProjectStore } from '../data/project-store';
import { mmToPx, type Scale } from '../utils/coordinate';
import { getWirePoints } from '../utils/wire-geometry';
import type { Wire, WireType } from '../data/types';

interface Props {
  pxPerMm: number;
}

interface WireStyle {
  stroke: string;
  dash?: number[] | undefined;
}

function styleFor(type: WireType): WireStyle {
  switch (type) {
    case 'ceiling':
      return { stroke: '#000' };
    case 'floor':
      return { stroke: '#000', dash: [10, 5] };
    case 'concealed':
      return { stroke: '#000', dash: [3, 3] };
    case 'exposed':
      return { stroke: '#0066cc' };
  }
}

export function WireLayer({ pxPerMm }: Props): JSX.Element {
  const wires = useProjectStore((s) => s.project.wires) ?? [];
  const symbols = useProjectStore((s) => s.project.symbols);
  const layers = useProjectStore((s) => s.project.layers);
  const selectedIds = useProjectStore((s) => s.selectedIds);
  const selectSymbols = useProjectStore((s) => s.selectSymbols);
  const toggleSelectSymbol = useProjectStore((s) => s.toggleSelectSymbol);

  const scale: Scale = { pxPerMm };
  const selectedSet = new Set(selectedIds);
  // Phase 2-D2: 非表示レイヤーに所属する wire、または端点シンボルが非表示レイヤーの場合は描画しない (F-08)
  const hiddenLayerIds = new Set(layers.filter((l) => !l.visible).map((l) => l.id));
  const symbolLayer = new Map(symbols.map((s) => [s.id, s.layerId]));
  const visibleWires = wires.filter((w) => {
    if (hiddenLayerIds.has(w.layerId)) return false;
    const fromLayer = symbolLayer.get(w.fromSymbolId);
    const toLayer = symbolLayer.get(w.toSymbolId);
    if (fromLayer !== undefined && hiddenLayerIds.has(fromLayer)) return false;
    if (toLayer !== undefined && hiddenLayerIds.has(toLayer)) return false;
    return true;
  });

  return (
    <Layer>
      {visibleWires.map((wire) => {
        const points = getWirePoints(wire, symbols);
        if (!points || points.length < 2) return null;
        const flat = points.flatMap((p) => [mmToPx(p.x, scale), mmToPx(p.y, scale)]);
        const style = styleFor(wire.type);
        const selected = selectedSet.has(wire.id);

        const handleClick = (e: KonvaEventObject<MouseEvent>) => {
          e.cancelBubble = true;
          if (e.evt.shiftKey) {
            toggleSelectSymbol(wire.id);
          } else {
            selectSymbols([wire.id]);
          }
        };

        return (
          <WireRenderer
            key={wire.id}
            wire={wire}
            flat={flat}
            style={style}
            selected={selected}
            onClick={handleClick}
          />
        );
      })}
    </Layer>
  );
}

interface RendererProps {
  wire: Wire;
  flat: number[];
  style: WireStyle;
  selected: boolean;
  onClick: (e: KonvaEventObject<MouseEvent>) => void;
}

function WireRenderer({ flat, style, selected, onClick }: RendererProps): JSX.Element {
  return (
    <>
      {/* 選択時のハイライト下線 (太い半透明青) */}
      {selected && (
        <Line
          points={flat}
          stroke="#0080ff"
          strokeWidth={5}
          opacity={0.35}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
      <Line
        points={flat}
        stroke={style.stroke}
        strokeWidth={1.5}
        hitStrokeWidth={10}
        onClick={onClick}
        onTap={onClick}
        perfectDrawEnabled={false}
        {...(style.dash !== undefined ? { dash: style.dash } : {})}
      />
    </>
  );
}
