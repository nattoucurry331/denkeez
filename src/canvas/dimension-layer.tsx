// Phase 3 F-16 Sub-3: 図面に残した寸法注記の描画レイヤー。
// - 常時表示(非表示レイヤー所属は除外、色はレイヤー色)。
// - select モードでのみクリック選択・ドラッグ移動可(ロック中レイヤーは不可)。
// - ラベルは viewport の逆数を掛けてズーム非依存サイズ。
// - 距離は端点間ユークリッド距離から再計算するので、後でスケール校正しても整合する。

import { Layer, Group, Line, Circle, Label, Tag, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useProjectStore } from '../data/project-store';
import { mmToPx, pxToMm, type Scale } from '../utils/coordinate';
import { formatDistanceMm } from '../utils/dimension-format';
import { lockedLayerIds, getLayerColor } from '../data/layer-helpers';

interface Props {
  /** mm → canvas px (位置と同じスケール) */
  pxPerMm: number;
  /** 縮尺校正済みか (ラベルの実寸/紙面表示の切替) */
  calibrated: boolean;
  /** Stage ズーム倍率 (ラベルを一定サイズに保つ) */
  viewportScale: number;
}

export function DimensionLayer({ pxPerMm, calibrated, viewportScale }: Props): JSX.Element {
  const dimensions = useProjectStore((s) => s.project.dimensions);
  const layers = useProjectStore((s) => s.project.layers);
  const selectedIds = useProjectStore((s) => s.selectedIds);
  const mode = useProjectStore((s) => s.mode);
  const selectSymbols = useProjectStore((s) => s.selectSymbols);
  const toggleSelectSymbol = useProjectStore((s) => s.toggleSelectSymbol);
  const updateDimensionPoints = useProjectStore((s) => s.updateDimensionPoints);

  const scale: Scale = { pxPerMm };
  const hiddenLayerIds = new Set(layers.filter((l) => !l.visible).map((l) => l.id));
  const lockedIds = lockedLayerIds(layers);
  const selectedSet = new Set(selectedIds);
  const interactable = mode.kind === 'select';
  const inv = viewportScale > 0 ? 1 / viewportScale : 1;

  const visible = (dimensions ?? []).filter((d) => !hiddenLayerIds.has(d.layerId));

  return (
    <Layer>
      {visible.map((d) => {
        const locked = lockedIds.has(d.layerId);
        const color = getLayerColor(d.layerId, layers);
        const fromPx = { x: mmToPx(d.from.x, scale), y: mmToPx(d.from.y, scale) };
        const toPx = { x: mmToPx(d.to.x, scale), y: mmToPx(d.to.y, scale) };
        const distMm = Math.hypot(d.to.x - d.from.x, d.to.y - d.from.y);
        const label = formatDistanceMm(distMm, calibrated);
        const selected = selectedSet.has(d.id);
        const mid = { x: (fromPx.x + toPx.x) / 2, y: (fromPx.y + toPx.y) / 2 };

        const handleClick = (e: KonvaEventObject<MouseEvent>): void => {
          if (!interactable || locked) return;
          e.cancelBubble = true;
          if (e.evt.shiftKey) toggleSelectSymbol(d.id);
          else selectSymbols([d.id]);
        };

        return (
          <Group
            key={d.id}
            draggable={interactable && !locked}
            listening={interactable && !locked}
            onClick={handleClick}
            onTap={(e) => {
              if (!interactable || locked) return;
              e.cancelBubble = true;
              selectSymbols([d.id]);
            }}
            onDragEnd={(e) => {
              const node = e.target;
              const dxMm = pxToMm(node.x(), scale);
              const dyMm = pxToMm(node.y(), scale);
              node.x(0);
              node.y(0);
              updateDimensionPoints(
                d.id,
                { x: d.from.x + dxMm, y: d.from.y + dyMm },
                { x: d.to.x + dxMm, y: d.to.y + dyMm },
              );
            }}
          >
            {/* クリックしやすい透明の太線 (ヒット領域) */}
            <Line
              points={[fromPx.x, fromPx.y, toPx.x, toPx.y]}
              stroke="transparent"
              strokeWidth={14}
            />
            <Line
              points={[fromPx.x, fromPx.y, toPx.x, toPx.y]}
              stroke={color}
              strokeWidth={selected ? 2.5 : 1.2}
            />
            <Circle x={fromPx.x} y={fromPx.y} radius={3.5} fill={color} />
            <Circle x={toPx.x} y={toPx.y} radius={3.5} fill={color} />
            <Label x={mid.x} y={mid.y} scaleX={inv} scaleY={inv} listening={false}>
              <Tag fill={selected ? '#0080ff' : '#333'} cornerRadius={3} />
              <Text text={label} fontSize={11} padding={3} fill="#fff" />
            </Label>
          </Group>
        );
      })}
    </Layer>
  );
}
