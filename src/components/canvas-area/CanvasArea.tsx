// 図面キャンバス (Plan §3 / REQUIREMENTS.md §6.1)。
// PDF を背景レイヤーに、シンボルを上位レイヤーに描画する。
// ステージ上のクリック・キーボード操作を一手にハンドリングする。

import { useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useProjectStore } from '../../data/project-store';
import { SymbolsLayer } from '../../canvas/symbols-layer';
import { pxToMm } from '../../utils/coordinate';

export function CanvasArea(): JSX.Element {
  const drawing = useProjectStore((s) => s.project.drawing);
  const canvas = useProjectStore((s) => s.pdfCanvas);
  const symbols = useProjectStore((s) => s.project.symbols);
  const selectedIds = useProjectStore((s) => s.selectedIds);
  const mode = useProjectStore((s) => s.mode);
  const addSymbol = useProjectStore((s) => s.addSymbol);
  const removeSymbols = useProjectStore((s) => s.removeSymbols);
  const exitMode = useProjectStore((s) => s.exitMode);
  const clearSelection = useProjectStore((s) => s.clearSelection);

  // キーボードショートカット (CLAUDE.md L197 Windows 標準準拠)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mode.kind === 'place') {
          exitMode();
        } else {
          clearSelection();
        }
      } else if (e.key === 'Delete' && selectedIds.length > 0) {
        removeSymbols(selectedIds);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode.kind, selectedIds, exitMode, clearSelection, removeSymbols]);

  if (!drawing || !canvas) {
    return (
      <div style={emptyStyle}>
        <p>メニューから PDF を開いてください</p>
      </div>
    );
  }

  // 1mm あたりのスクリーンピクセル数 (REQUIREMENTS.md §9.1.1: utils/coordinate に集約)
  const pxPerMm = canvas.width / drawing.widthMm;

  const handleStageClick = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) {
      return;
    }
    const point = stage.getPointerPosition();
    if (!point) {
      return;
    }
    if (mode.kind === 'place') {
      addSymbol(mode.symbolType as 'downlight', {
        x: pxToMm(point.x, { pxPerMm }),
        y: pxToMm(point.y, { pxPerMm }),
      });
    } else if (e.target === stage) {
      // 何もないところをクリック → 選択解除
      clearSelection();
    }
  };

  return (
    <div style={containerStyle}>
      <p style={infoStyle}>
        <code>{drawing.filename}</code> / 実寸{' '}
        {drawing.widthMm.toFixed(0)} × {drawing.heightMm.toFixed(0)} mm / シンボル{' '}
        <strong>{symbols.length}</strong> 個
        {selectedIds.length > 0 && <span> (選択中 {selectedIds.length})</span>}
        {mode.kind === 'place' && (
          <span style={modeBadgeStyle}> 配置モード: {mode.symbolType} (ESC で解除)</span>
        )}
      </p>
      <div style={stageContainerStyle}>
        <Stage
          width={canvas.width}
          height={canvas.height}
          onClick={handleStageClick}
          onTap={handleStageClick}
          style={{ cursor: mode.kind === 'place' ? 'crosshair' : 'default' }}
        >
          <Layer listening={false}>
            <KonvaImage image={canvas} />
          </Layer>
          <SymbolsLayer pxPerMm={pxPerMm} />
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
const modeBadgeStyle: React.CSSProperties = {
  marginLeft: 8,
  padding: '2px 8px',
  background: '#0080ff',
  color: '#fff',
  borderRadius: 4,
  fontSize: '0.8rem',
};
const stageContainerStyle: React.CSSProperties = {
  flex: 1,
  border: '1px solid #ccc',
  overflow: 'auto',
};
