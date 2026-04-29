// 図面キャンバス (Plan §3 / REQUIREMENTS.md §6.1)。
// PDF を背景レイヤーに、シンボルを上位レイヤーに描画する。
// Phase 2-A1: ビューポートのズーム / パン (Stage の scale + offset、ViewportControls 経由)。

import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';
import { useProjectStore } from '../../data/project-store';
import { useViewportStore } from '../../data/viewport-store';
import { useViewportControls } from '../../canvas/viewport-controls';
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

  const scale = useViewportStore((s) => s.scale);
  const offsetX = useViewportStore((s) => s.offsetX);
  const offsetY = useViewportStore((s) => s.offsetY);
  const spaceDown = useViewportStore((s) => s.spaceDown);
  const fitToWindow = useViewportStore((s) => s.fitToWindow);

  const viewportControls = useViewportControls();
  const stageRef = useRef<Konva.Stage | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });

  // ResizeObserver でコンテナサイズを追跡
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // PDF 読み込み直後に図面全体をフィット表示
  useEffect(() => {
    if (canvas && containerSize.w > 0 && containerSize.h > 0) {
      fitToWindow(
        { w: canvas.width, h: canvas.height },
        { w: containerSize.w, h: containerSize.h },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas, fitToWindow]);

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
            (Phase 1 PoC では .dkz に PDF を同梱していません。Phase 2-E で .dkz=ZIP 化時に同梱予定)
          </p>
        </div>
      </div>
    );
  }

  // 1mm あたりのスクリーンピクセル数 (REQUIREMENTS.md §9.1.1: utils/coordinate に集約)
  const pxPerMm = canvas.width / drawing.widthMm;

  // Stage の物理サイズはコンテナにフィット、内部 content は viewport state で transform
  const handleStageMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    viewportControls.onMouseDown(e);
  };

  const handleStageClick = (e: KonvaEventObject<MouseEvent>) => {
    // パン中はクリック扱いしない
    if (spaceDown) return;
    const stage = e.target.getStage();
    if (!stage) return;
    // getRelativePointerPosition() は scale + offset を補正済み (R-A5)
    const point = stage.getRelativePointerPosition();
    if (!point) return;
    if (mode.kind === 'place') {
      addSymbol(mode.symbolType as 'downlight', {
        x: pxToMm(point.x, { pxPerMm }),
        y: pxToMm(point.y, { pxPerMm }),
      });
    } else if (e.target === stage) {
      clearSelection();
    }
  };

  const cursor =
    spaceDown
      ? viewportControls.isPanning()
        ? 'grabbing'
        : 'grab'
      : mode.kind === 'place'
        ? 'crosshair'
        : 'default';

  return (
    <div style={containerStyle}>
      {infoLine}
      <div ref={containerRef} style={stageContainerStyle}>
        <Stage
          ref={stageRef}
          width={containerSize.w}
          height={containerSize.h}
          scaleX={scale}
          scaleY={scale}
          x={offsetX}
          y={offsetY}
          onWheel={viewportControls.onWheel}
          onMouseDown={handleStageMouseDown}
          onMouseMove={viewportControls.onMouseMove}
          onMouseUp={viewportControls.onMouseUp}
          onClick={handleStageClick}
          onTap={handleStageClick}
          style={{ cursor }}
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
  overflow: 'hidden',
  background: '#f8f8f8',
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
