// 配線描画レイヤー (Phase 2-C2 / REQUIREMENTS.md F-07)。
// Project.wires の各 Wire を Konva Line で描画する。
// 種別ごとのスタイル(ceiling/floor/concealed/exposed)は Phase 2-C3 で UI 編集を追加、
// データ上はすでに type フィールドを持っているのでスタイル切替もここで実装する。

import { Layer, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useProjectStore } from '../data/project-store';
import { mmToPx, type Scale } from '../utils/coordinate';
import { getWirePoints } from '../utils/wire-geometry';
import { lockedLayerIds, sortWiresByLayerOrder, getLayerColor } from '../data/layer-helpers';
import type { Wire, WireType } from '../data/types';

interface Props {
  pxPerMm: number;
}

/** 配線種別ごとの dash パターン (Phase 2-E4 でレイヤー色一本化、stroke 色は layer.color から決まる)。 */
function dashFor(type: WireType): number[] | undefined {
  switch (type) {
    case 'ceiling':
      return undefined; // 実線
    case 'floor':
      return [10, 5]; // 破線
    case 'concealed':
      return [3, 3]; // 点線
    case 'exposed':
      return undefined; // 実線 (色はレイヤーに従う)
  }
}

export function WireLayer({ pxPerMm }: Props): JSX.Element {
  const wires = useProjectStore((s) => s.project.wires) ?? [];
  const symbols = useProjectStore((s) => s.project.symbols);
  const layers = useProjectStore((s) => s.project.layers);
  const mode = useProjectStore((s) => s.mode);
  const selectedIds = useProjectStore((s) => s.selectedIds);
  const selectSymbols = useProjectStore((s) => s.selectSymbols);
  const toggleSelectSymbol = useProjectStore((s) => s.toggleSelectSymbol);
  const wireModeActive = mode.kind === 'wire';

  const scale: Scale = { pxPerMm };
  const selectedSet = new Set(selectedIds);
  // Phase 2-D2: 非表示レイヤーに所属する wire、または端点シンボルが非表示レイヤーの場合は描画しない (F-08)
  const hiddenLayerIds = new Set(layers.filter((l) => !l.visible).map((l) => l.id));
  const lockedIds = lockedLayerIds(layers);
  const symbolLayer = new Map(symbols.map((s) => [s.id, s.layerId]));
  const filteredWires = wires.filter((w) => {
    if (hiddenLayerIds.has(w.layerId)) return false;
    const fromLayer = symbolLayer.get(w.fromSymbolId);
    const toLayer = symbolLayer.get(w.toSymbolId);
    if (fromLayer !== undefined && hiddenLayerIds.has(fromLayer)) return false;
    if (toLayer !== undefined && hiddenLayerIds.has(toLayer)) return false;
    return true;
  });
  // Phase 2-D3: layers 配列順 (= z-index) でソート (案 B)
  const visibleWires = sortWiresByLayerOrder(filteredWires, layers);

  return (
    <Layer>
      {visibleWires.map((wire) => {
        const points = getWirePoints(wire, symbols);
        if (!points || points.length < 2) return null;
        const flat = points.flatMap((p) => [mmToPx(p.x, scale), mmToPx(p.y, scale)]);
        const dash = dashFor(wire.type);
        const stroke = getLayerColor(wire.layerId, layers);
        const selected = selectedSet.has(wire.id);
        const locked = lockedIds.has(wire.layerId);

        const handleClick = (e: KonvaEventObject<MouseEvent>) => {
          if (locked) return;
          if (wireModeActive) {
            // wire モード中は Stage 側 (handleStageClick) で waypoint 追加 / 終点判定。
            // 既存配線への click は何もしない (バブルさせて Stage に判断を委ねる)。
            return;
          }
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
            stroke={stroke}
            dash={dash}
            selected={selected}
            locked={locked}
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
  stroke: string;
  dash: number[] | undefined;
  selected: boolean;
  /** Phase 2-D3: ロック中レイヤー所属。クリックを無視して下層へ通す */
  locked: boolean;
  onClick: (e: KonvaEventObject<MouseEvent>) => void;
}

function WireRenderer({ flat, stroke, dash, selected, locked, onClick }: RendererProps): JSX.Element {
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
        stroke={stroke}
        strokeWidth={1.5}
        hitStrokeWidth={10}
        listening={!locked}
        onClick={onClick}
        onTap={onClick}
        perfectDrawEnabled={false}
        {...(dash !== undefined ? { dash } : {})}
      />
    </>
  );
}
