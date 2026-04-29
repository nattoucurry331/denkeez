// 図面キャンバス (Plan §3 / REQUIREMENTS.md §6.1)。
// M1 では PDF を Konva Image として背景表示するのみ。
// M3 でシンボル配置レイヤー、Phase 2 でレイヤー管理 / ズーム / パン / ミニマップを追加。

import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import { useProjectStore } from '../../data/project-store';

export function CanvasArea(): JSX.Element {
  const drawing = useProjectStore((s) => s.project.drawing);
  const canvas = useProjectStore((s) => s.pdfCanvas);

  if (!drawing || !canvas) {
    return (
      <div style={emptyStyle}>
        <p>メニューから PDF を開いてください</p>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <p style={infoStyle}>
        <code>{drawing.filename}</code> / 実寸{' '}
        {drawing.widthMm.toFixed(0)} × {drawing.heightMm.toFixed(0)} mm
      </p>
      <div style={stageContainerStyle}>
        <Stage width={canvas.width} height={canvas.height}>
          <Layer>
            <KonvaImage image={canvas} alt="" />
          </Layer>
        </Stage>
      </div>
    </div>
  );
}

const emptyStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#666',
};
const containerStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  padding: 16,
  overflow: 'hidden',
};
const infoStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#444',
  marginTop: 0,
};
const stageContainerStyle: React.CSSProperties = {
  flex: 1,
  border: '1px solid #ccc',
  overflow: 'auto',
};
