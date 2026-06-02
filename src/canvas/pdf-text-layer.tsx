// F-18: PDF から抽出した文字 (参照用) の描画レイヤー。
// - 専用「PDF文字」レイヤー所属。既定 locked のため選択・移動不可 (読み取り専用)。
// - レイヤーを非表示にすると描画されない (LayerPanel から切替可)。
// - 編集したい場合は「PDF文字を注記に取り込む」で TextAnnotation 化する。
// - 位置は symbols と同じ pxPerMm 系、フォントは紙面 mm (paperPxPerMm)。

import { Layer, Text } from 'react-konva';
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

  if (!items || items.length === 0) return null;

  const scale: Scale = { pxPerMm };
  const fontScale: Scale = { pxPerMm: paperPxPerMm };
  const hiddenLayerIds = new Set(layers.filter((l) => !l.visible).map((l) => l.id));
  const visible = items.filter((t) => !hiddenLayerIds.has(t.layerId));
  if (visible.length === 0) return null;

  return (
    <Layer listening={false}>
      {visible.map((t) => (
        <Text
          key={t.id}
          x={mmToPx(t.position.x, scale)}
          y={mmToPx(t.position.y, scale)}
          text={t.text}
          fontSize={mmToPx(t.fontSizeMm, fontScale)}
          fill="#555555"
        />
      ))}
    </Layer>
  );
}
