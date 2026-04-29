// Konva 上のシンボル描画レイヤー (Plan §3)。
// 各シンボルは Group 単位で配置・選択・ドラッグ移動を担当する。
// 座標は store 上 mm、描画時に utils/coordinate で px に変換する (REQUIREMENTS.md §9.1.1)。

import { Layer, Group, Circle, Text, Rect } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useProjectStore } from '../data/project-store';
import { mmToPx, pxToMm, type Scale } from '../utils/coordinate';
import { getSymbolDefinition } from '../symbols/symbol-registry';
import type { ProjectSymbol } from '../data/types';

interface Props {
  pxPerMm: number;
}

export function SymbolsLayer({ pxPerMm }: Props): JSX.Element {
  const symbols = useProjectStore((s) => s.project.symbols);
  const selectedIds = useProjectStore((s) => s.selectedIds);
  const updateSymbolPosition = useProjectStore((s) => s.updateSymbolPosition);
  const selectSymbols = useProjectStore((s) => s.selectSymbols);
  const toggleSelectSymbol = useProjectStore((s) => s.toggleSelectSymbol);

  const scale: Scale = { pxPerMm };
  const selectedSet = new Set(selectedIds);

  return (
    <Layer>
      {symbols.map((sym) => (
        <SymbolNode
          key={sym.id}
          symbol={sym}
          scale={scale}
          selected={selectedSet.has(sym.id)}
          onClick={(shiftKey) => {
            if (shiftKey) {
              toggleSelectSymbol(sym.id);
            } else {
              selectSymbols([sym.id]);
            }
          }}
          onDragEnd={(pxPos) => {
            updateSymbolPosition(sym.id, {
              x: pxToMm(pxPos.x, scale),
              y: pxToMm(pxPos.y, scale),
            });
          }}
        />
      ))}
    </Layer>
  );
}

interface SymbolNodeProps {
  symbol: ProjectSymbol;
  scale: Scale;
  selected: boolean;
  onClick: (shiftKey: boolean) => void;
  onDragEnd: (pxPos: { x: number; y: number }) => void;
}

function SymbolNode({ symbol, scale, selected, onClick, onDragEnd }: SymbolNodeProps): JSX.Element | null {
  const def = getSymbolDefinition(symbol.type);
  if (!def) {
    return null;
  }
  const shape = def.shape;
  const x = mmToPx(symbol.position.x, scale);
  const y = mmToPx(symbol.position.y, scale);
  const radiusPx = mmToPx(shape.radiusMm, scale);
  const strokeWidthPx = Math.max(1, mmToPx(shape.strokeWidthMm, scale));
  const fontSizePx = mmToPx(shape.fontSizeMm, scale);
  const boxSize = radiusPx * 2;

  const handleClick = (e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    onClick(e.evt.shiftKey);
  };
  const handleTap = (e: KonvaEventObject<TouchEvent>) => {
    e.cancelBubble = true;
    onClick(false);
  };

  return (
    <Group
      x={x}
      y={y}
      rotation={symbol.rotation}
      draggable
      onClick={handleClick}
      onTap={handleTap}
      onDragEnd={(e) => onDragEnd({ x: e.target.x(), y: e.target.y() })}
    >
      <Circle radius={radiusPx} stroke="#000" strokeWidth={strokeWidthPx} fill="#fff" />
      <Text
        text={shape.text}
        fontSize={fontSizePx}
        x={-radiusPx}
        y={-radiusPx}
        width={boxSize}
        height={boxSize}
        align="center"
        verticalAlign="middle"
        listening={false}
      />
      {selected && (
        <Rect
          x={-radiusPx - strokeWidthPx * 2}
          y={-radiusPx - strokeWidthPx * 2}
          width={boxSize + strokeWidthPx * 4}
          height={boxSize + strokeWidthPx * 4}
          stroke="#0080ff"
          strokeWidth={1.5}
          dash={[6, 3]}
          fillEnabled={false}
          listening={false}
        />
      )}
    </Group>
  );
}
