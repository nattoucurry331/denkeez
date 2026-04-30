// Konva 上のシンボル描画レイヤー (Plan §3 / Phase 2-B 拡張)。
// 各シンボルは Group 単位で配置・選択・ドラッグ移動を担当する。
// 座標は store 上 mm、描画時に utils/coordinate で px に変換 (REQUIREMENTS.md §9.1.1)。
//
// Phase 2-B1: shape kind 5 種に対応するため、描画ロジックを symbol-shape.tsx に委譲。
// Phase 2-B3: 単一選択シンボルに Konva Transformer (回転ハンドルのみ) を attach。

import { useEffect, useRef } from 'react';
import { Layer, Group, Rect, Transformer } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';
import { useProjectStore } from '../data/project-store';
import { mmToPx, pxToMm, type Scale } from '../utils/coordinate';
import { getSymbolDefinition } from '../symbols/symbol-registry';
import { SymbolShapeRenderer, getShapeBoundingBox } from './symbol-shape';
import { lockedLayerIds, sortSymbolsByLayerOrder, getLayerColor } from '../data/layer-helpers';
import type { ProjectSymbol } from '../data/types';

interface Props {
  pxPerMm: number;
}

export function SymbolsLayer({ pxPerMm }: Props): JSX.Element {
  const symbols = useProjectStore((s) => s.project.symbols);
  const layers = useProjectStore((s) => s.project.layers);
  const selectedIds = useProjectStore((s) => s.selectedIds);
  const mode = useProjectStore((s) => s.mode);
  const updateSymbolPosition = useProjectStore((s) => s.updateSymbolPosition);
  const updateSymbolRotation = useProjectStore((s) => s.updateSymbolRotation);
  const selectSymbols = useProjectStore((s) => s.selectSymbols);
  const toggleSelectSymbol = useProjectStore((s) => s.toggleSelectSymbol);

  const scale: Scale = { pxPerMm };
  const selectedSet = new Set(selectedIds);
  // Phase 2-D2: 非表示レイヤーに所属する symbol は描画しない (F-08)
  const hiddenLayerIds = new Set(layers.filter((l) => !l.visible).map((l) => l.id));
  // Phase 2-D3: ロック中レイヤーは draggable: false / クリック無視
  const lockedIds = lockedLayerIds(layers);
  // Phase 2-D3: layers 配列順 (= z-index) でソートして描画順を決定 (案 B)
  const visibleSymbols = sortSymbolsByLayerOrder(
    symbols.filter((s) => !hiddenLayerIds.has(s.layerId)),
    layers,
  );

  const transformerRef = useRef<Konva.Transformer>(null);
  const layerRef = useRef<Konva.Layer>(null);

  // 単一選択時のみ Transformer を attach (Phase 2-B 仕様 / R-B9)
  useEffect(() => {
    const tr = transformerRef.current;
    const layer = layerRef.current;
    if (!tr || !layer) return;

    if (selectedIds.length === 1) {
      const id = selectedIds[0];
      // Phase 2-D3: 単一選択でもロック中レイヤーなら Transformer を出さない
      const sym = symbols.find((s) => s.id === id);
      const isLocked = sym ? lockedIds.has(sym.layerId) : false;
      if (isLocked) {
        tr.nodes([]);
      } else {
        const node = layer.findOne(`#sym-${id}`);
        if (node) {
          tr.nodes([node]);
        } else {
          tr.nodes([]);
        }
      }
    } else {
      tr.nodes([]);
    }
    layer.batchDraw();
  }, [selectedIds, symbols, visibleSymbols.length, lockedIds]);

  return (
    <Layer ref={layerRef}>
      {visibleSymbols.map((sym) => {
        const isLocked = lockedIds.has(sym.layerId);
        const symbolColor = getLayerColor(sym.layerId, layers);
        return (
          <SymbolNode
            key={sym.id}
            symbol={sym}
            scale={scale}
            selected={selectedSet.has(sym.id)}
            locked={isLocked}
            strokeColor={symbolColor}
            // 配線モード中はクリックをバブルさせて Stage 側 (CanvasArea.handleStageClick) で
            // setWireFromSymbol / addWire を処理する。select モードのみ自前で選択する。
            wireModeActive={mode.kind === 'wire'}
            onClick={(shiftKey) => {
              if (isLocked) return;
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
            onTransformEnd={(rotation) => updateSymbolRotation(sym.id, rotation)}
          />
        );
      })}
      <Transformer
        ref={transformerRef}
        resizeEnabled={false}
        rotateEnabled={true}
        rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
        rotationSnapTolerance={5}
        anchorSize={8}
        borderEnabled={true}
        borderStroke="#0080ff"
      />
    </Layer>
  );
}

interface SymbolNodeProps {
  symbol: ProjectSymbol;
  scale: Scale;
  selected: boolean;
  /** Phase 2-D3: ロック中レイヤー所属。draggable / click を抑止 */
  locked: boolean;
  /**
   * Phase 2-E3 fix: 配線モード中なら true。
   * true のときはクリックを cancelBubble せず、Stage 側 handleStageClick に届ける
   * (setWireFromSymbol / addWire は CanvasArea が一元管理しているため)。
   */
  wireModeActive: boolean;
  /** 線色 / 文字色 — 所属レイヤーの color */
  strokeColor: string;
  onClick: (shiftKey: boolean) => void;
  onDragEnd: (pxPos: { x: number; y: number }) => void;
  onTransformEnd: (rotation: number) => void;
}

function SymbolNode({
  symbol,
  scale,
  selected,
  locked,
  wireModeActive,
  strokeColor,
  onClick,
  onDragEnd,
  onTransformEnd,
}: SymbolNodeProps): JSX.Element | null {
  const def = getSymbolDefinition(symbol.type);
  if (!def) {
    return null;
  }
  const x = mmToPx(symbol.position.x, scale);
  const y = mmToPx(symbol.position.y, scale);
  const bbox = getShapeBoundingBox(def.shape, scale);

  const handleClick = (e: KonvaEventObject<MouseEvent>) => {
    if (wireModeActive) {
      // Stage の handleStageClick で wire 始点/終点判定するためバブルさせる。
      // 自前 selectSymbols は呼ばない (配線中に選択状態を変えない)
      return;
    }
    e.cancelBubble = true;
    onClick(e.evt.shiftKey);
  };
  const handleTap = (e: KonvaEventObject<TouchEvent>) => {
    if (wireModeActive) return;
    e.cancelBubble = true;
    onClick(false);
  };

  return (
    <Group
      id={`sym-${symbol.id}`}
      x={x}
      y={y}
      rotation={symbol.rotation}
      // wire モード中はドラッグ起動を抑止 (mousedown→mousemove で onClick が消えるのを避ける)
      draggable={!locked && !wireModeActive}
      listening={!locked}
      onClick={handleClick}
      onTap={handleTap}
      onDragEnd={(e) => onDragEnd({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={(e) => {
        const node = e.target;
        const rot = node.rotation();
        // scale はリサイズ無効なので 1 を維持 (Konva が一時的に scale 変更することへの保険)
        node.scaleX(1);
        node.scaleY(1);
        onTransformEnd(rot);
      }}
    >
      <SymbolShapeRenderer shape={def.shape} scale={scale} strokeColor={strokeColor} />
      {selected && (
        <Rect
          x={-bbox.width / 2 - 3}
          y={-bbox.height / 2 - 3}
          width={bbox.width + 6}
          height={bbox.height + 6}
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
