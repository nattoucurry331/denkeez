// F-18: PDF から抽出した文字 (参照用) の描画レイヤー。
// - 専用「PDF文字」レイヤー所属。既定 locked のため通常は読み取り専用。
// - レイヤーを非表示にすると描画されない (LayerPanel から切替可)。
// - 一括取込「PDF文字を取り込む」、または pick モードで 1 つずつ選んで TextAnnotation 化。
// - 位置は symbols と同じ pxPerMm 系、フォントは紙面 mm (paperPxPerMm)。

import { Layer, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useProjectStore } from '../data/project-store';
import { mmToPx, type Scale } from '../utils/coordinate';

interface Props {
  /** mm → canvas px (位置スケール) */
  pxPerMm: number;
  /** 紙面 mm → canvas px (フォントサイズ用) */
  paperPxPerMm: number;
}

export function PdfTextLayer({ pxPerMm, paperPxPerMm }: Props): JSX.Element | null {
  const items = useProjectStore((s) => s.project.pdfTextItems);
  const layers = useProjectStore((s) => s.project.layers);
  const mode = useProjectStore((s) => s.mode);
  const selectedPdfTextIds = useProjectStore((s) => s.selectedPdfTextIds);
  const togglePdfTextPick = useProjectStore((s) => s.togglePdfTextPick);

  if (!items || items.length === 0) return null;

  const pickMode = mode.kind === 'pdf-text-pick';
  const scale: Scale = { pxPerMm };
  const fontScale: Scale = { pxPerMm: paperPxPerMm };
  const hiddenLayerIds = new Set(layers.filter((l) => !l.visible).map((l) => l.id));
  const selectedSet = new Set(selectedPdfTextIds);
  const visible = items.filter((t) => !hiddenLayerIds.has(t.layerId));
  if (visible.length === 0) return null;

  return (
    <Layer listening={pickMode}>
      {visible.map((t) => {
        const fontSize = mmToPx(t.fontSizeMm, fontScale);
        const selected = selectedSet.has(t.id);
        // 通常: グレー。pick モード: クリック可能を示す青、選択中は濃い青+太字。
        const fill = !pickMode ? '#555555' : selected ? '#0050ff' : '#3a7bd5';
        const handleClick = (e: KonvaEventObject<MouseEvent>): void => {
          e.cancelBubble = true;
          togglePdfTextPick(t.id);
        };
        return (
          <Text
            key={t.id}
            x={mmToPx(t.position.x, scale)}
            y={mmToPx(t.position.y, scale)}
            text={t.text}
            fontSize={fontSize}
            fill={fill}
            {...(pickMode ? { fontStyle: selected ? 'bold' : 'normal' } : {})}
            listening={pickMode}
            {...(pickMode
              ? { hitStrokeWidth: Math.max(8, fontSize), onClick: handleClick, onTap: handleClick }
              : {})}
          />
        );
      })}
    </Layer>
  );
}
