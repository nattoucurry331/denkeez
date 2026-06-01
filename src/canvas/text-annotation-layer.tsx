// F-18: 図面に自由配置したテキスト注記の描画レイヤー。
// - 位置は symbols と同じ pxPerMm(校正済みなら実寸)系。
// - フォントサイズは「紙面 mm」(paperPxPerMm)で描画し、縮尺に依らず一定の見やすさにする。
// - select モードでのみ選択・ドラッグ移動可(ロック中レイヤーは不可)。
// - ダブルクリックで編集要求 (onRequestEdit) を親 (CanvasArea) に通知する。

import { Layer, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useProjectStore } from '../data/project-store';
import { mmToPx, pxToMm, type Scale } from '../utils/coordinate';
import { lockedLayerIds } from '../data/layer-helpers';

interface Props {
  /** mm → canvas px (位置スケール) */
  pxPerMm: number;
  /** 紙面 mm → canvas px (フォントサイズ用) */
  paperPxPerMm: number;
  /** 注記の編集を要求(ダブルクリック時)。HTML オーバーレイは親が出す。 */
  onRequestEdit: (id: string) => void;
  /** 編集中の注記 ID(オーバーレイ表示中はキャンバス側を隠す) */
  editingId: string | null;
}

export function TextAnnotationLayer({
  pxPerMm,
  paperPxPerMm,
  onRequestEdit,
  editingId,
}: Props): JSX.Element {
  const annotations = useProjectStore((s) => s.project.textAnnotations);
  const layers = useProjectStore((s) => s.project.layers);
  const selectedIds = useProjectStore((s) => s.selectedIds);
  const mode = useProjectStore((s) => s.mode);
  const selectSymbols = useProjectStore((s) => s.selectSymbols);
  const toggleSelectSymbol = useProjectStore((s) => s.toggleSelectSymbol);
  const updateTextAnnotation = useProjectStore((s) => s.updateTextAnnotation);

  const scale: Scale = { pxPerMm };
  const fontScale: Scale = { pxPerMm: paperPxPerMm };
  const hiddenLayerIds = new Set(layers.filter((l) => !l.visible).map((l) => l.id));
  const lockedIds = lockedLayerIds(layers);
  const selectedSet = new Set(selectedIds);
  const interactable = mode.kind === 'select';

  const visible = (annotations ?? []).filter((a) => !hiddenLayerIds.has(a.layerId));

  return (
    <Layer>
      {visible.map((a) => {
        if (a.id === editingId) return null; // 編集中はオーバーレイに任せる
        const locked = lockedIds.has(a.layerId);
        const x = mmToPx(a.position.x, scale);
        const y = mmToPx(a.position.y, scale);
        const fontSize = mmToPx(a.fontSizeMm, fontScale);
        const selected = selectedSet.has(a.id);
        const empty = a.text.trim() === '';

        const handleClick = (e: KonvaEventObject<MouseEvent>): void => {
          if (!interactable || locked) return;
          e.cancelBubble = true;
          if (e.evt.shiftKey) toggleSelectSymbol(a.id);
          else selectSymbols([a.id]);
        };

        // 選択中は薄い縁取りで強調 (exactOptionalPropertyTypes 対応で条件付きキー)
        const selectedStrokeProps = selected
          ? {
              stroke: '#0080ff',
              strokeWidth: Math.max(0.5, fontSize * 0.04),
              fillAfterStrokeEnabled: true,
            }
          : {};

        return (
          <Text
            key={a.id}
            id={`text-${a.id}`}
            x={x}
            y={y}
            text={empty ? '(空のテキスト)' : a.text}
            fontSize={fontSize}
            fill={empty ? '#aaaaaa' : a.color}
            draggable={interactable && !locked}
            listening={interactable && !locked}
            {...selectedStrokeProps}
            onClick={handleClick}
            onTap={handleClick}
            onDblClick={(e) => {
              if (locked) return;
              e.cancelBubble = true;
              onRequestEdit(a.id);
            }}
            onDblTap={(e) => {
              if (locked) return;
              e.cancelBubble = true;
              onRequestEdit(a.id);
            }}
            onDragEnd={(e) => {
              const node = e.target;
              updateTextAnnotation(a.id, {
                position: { x: pxToMm(node.x(), scale), y: pxToMm(node.y(), scale) },
              });
            }}
          />
        );
      })}
    </Layer>
  );
}
