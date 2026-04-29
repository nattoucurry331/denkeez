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

  // 新規プロジェクトで PDF も未取込の場合
  if (!drawing) {
    return (
      <div style={emptyStyle}>
        <p>「ファイル → PDF を開く」で開始してください</p>
        <p style={mutedStyle}>または「開く」で保存済みプロジェクトを読み込めます</p>
      </div>
    );
  }

  const infoLine = (
    <p style={infoStyle}>
      <code>{drawing.filename}</code> / 実寸{' '}
      {drawing.widthMm.toFixed(0)} × {drawing.heightMm.toFixed(0)} mm / シンボル{' '}
      <strong>{symbols.length}</strong> 個
      {selectedIds.length > 0 && <span> (選択中 {selectedIds.length})</span>}
      {mode.kind === 'place' && (
        <span style={modeBadgeStyle}> 配置モード: {mode.symbolType} (ESC で解除)</span>
      )}
    </p>
  );

  // プロジェクトを開いた直後 (drawing は復元、canvas はまだ null)
  // PoC 仕様: .dkz には PDF 本体を同梱しないため、再選択が必要
  if (!canvas) {
    return (
      <div style={containerStyle}>
        {infoLine}
        <div style={warnBoxStyle}>
          <p style={warnTitleStyle}>PDF 背景が未読込です</p>
          <p>
            「ファイル → PDF を開く」で <code>{drawing.filename}</code> (または同等の PDF) を再選択してください。
          </p>
          <p style={mutedStyle}>
            (Phase 1 PoC では .dkz に PDF を同梱していません。Phase 2 で .dkz=ZIP 化時に同梱予定)
          </p>
        </div>
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
      {infoLine}
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
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#666',
  gap: 8,
};
const mutedStyle: React.CSSProperties = {
  color: '#999',
  fontSize: '0.85rem',
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
const warnBoxStyle: React.CSSProperties = {
  padding: '16px 20px',
  background: '#fff8e0',
  border: '1px solid #f0c060',
  borderRadius: 6,
  color: '#5a4400',
};
const warnTitleStyle: React.CSSProperties = {
  fontWeight: 'bold',
  marginTop: 0,
  fontSize: '0.95rem',
};
