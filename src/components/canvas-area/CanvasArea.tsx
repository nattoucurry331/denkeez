// 図面キャンバス (Plan §3 / REQUIREMENTS.md §6.1)。
// PDF を背景レイヤーに、シンボルを上位レイヤーに描画する。
// Phase 2-A1: ビューポートのズーム / パン (Stage の scale + offset、ViewportControls 経由)。
// Phase 2-A2: GridLayer 統合 + cursorMm 発信 (StatusBar 表示用)。
// Phase 2-B4: 矩形選択 (ドラッグで複数シンボル選択)。

import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';
import { useProjectStore } from '../../data/project-store';
import { useViewportStore } from '../../data/viewport-store';
import type { SymbolType } from '../../data/types';
import { useViewportControls } from '../../canvas/viewport-controls';
import { SymbolsLayer } from '../../canvas/symbols-layer';
import { GridLayer } from '../../canvas/grid-layer';
import { Minimap } from '../../canvas/minimap';
import {
  SelectionRectLayer,
  type SelectionRect,
} from '../../canvas/selection-rect-layer';
import { useKeyboardShortcuts } from '../../hooks/use-keyboard-shortcuts';
import { pxToMm, mmToPx } from '../../utils/coordinate';
import { getSymbolDefinition } from '../../symbols/symbol-registry';

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
  const selectSymbols = useProjectStore((s) => s.selectSymbols);

  const scale = useViewportStore((s) => s.scale);
  const offsetX = useViewportStore((s) => s.offsetX);
  const offsetY = useViewportStore((s) => s.offsetY);
  const spaceDown = useViewportStore((s) => s.spaceDown);
  const fitToWindow = useViewportStore((s) => s.fitToWindow);
  const setCursorMm = useViewportStore((s) => s.setCursorMm);

  const viewportControls = useViewportControls();
  const stageRef = useRef<Konva.Stage | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });

  // 矩形選択中の rect (canvas 論理座標 = scale 補正後)
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  // ドラッグ開始位置を記録 (空白から開始したか判定)
  const selectionStartRef = useRef<SelectionRect | null>(null);

  useEffect(() => {
    if (!drawing) return;
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [drawing]);

  const fittedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!canvas) {
      fittedCanvasRef.current = null;
      return;
    }
    if (containerSize.w === 0 || containerSize.h === 0) return;
    if (fittedCanvasRef.current === canvas) return;
    fitToWindow(
      { w: canvas.width, h: canvas.height },
      { w: containerSize.w, h: containerSize.h },
    );
    fittedCanvasRef.current = canvas;
  }, [canvas, fitToWindow, containerSize.w, containerSize.h]);

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

  useKeyboardShortcuts({
    getViewportCenter: () =>
      containerSize.w > 0 && containerSize.h > 0
        ? { x: containerSize.w / 2, y: containerSize.h / 2 }
        : null,
  });

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

  const pxPerMm = canvas.width / drawing.widthMm;
  const scaleObj = { pxPerMm };

  const isStageBackground = (e: KonvaEventObject<MouseEvent>): boolean => {
    const target = e.target;
    const stage = target.getStage();
    if (!stage) return false;
    return target === stage || target.getClassName() === 'Image';
  };

  const handleStageMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    viewportControls.onMouseDown(e);
    // パン中・配置モード中は矩形選択を無効
    if (spaceDown || mode.kind !== 'select') return;
    if (!isStageBackground(e)) return;
    const stage = e.target.getStage();
    const point = stage?.getRelativePointerPosition();
    if (!point) return;
    const rect: SelectionRect = { startX: point.x, startY: point.y, endX: point.x, endY: point.y };
    selectionStartRef.current = rect;
    setSelectionRect(rect);
  };

  const handleStageMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    viewportControls.onMouseMove(e);
    const stage = e.target.getStage();
    if (!stage) return;
    const point = stage.getRelativePointerPosition();
    if (!point) {
      setCursorMm(null);
      return;
    }
    setCursorMm({ x: pxToMm(point.x, scaleObj), y: pxToMm(point.y, scaleObj) });

    // 矩形選択中なら end を更新
    if (selectionStartRef.current) {
      setSelectionRect({
        startX: selectionStartRef.current.startX,
        startY: selectionStartRef.current.startY,
        endX: point.x,
        endY: point.y,
      });
    }
  };

  const handleStageMouseUp = (e: KonvaEventObject<MouseEvent>) => {
    viewportControls.onMouseUp(e);
    // 矩形選択終了
    const rect = selectionStartRef.current;
    if (rect && selectionRect) {
      const minX = Math.min(selectionRect.startX, selectionRect.endX);
      const maxX = Math.max(selectionRect.startX, selectionRect.endX);
      const minY = Math.min(selectionRect.startY, selectionRect.endY);
      const maxY = Math.max(selectionRect.startY, selectionRect.endY);
      const width = maxX - minX;
      const height = maxY - minY;

      // ほぼ無移動 (クリック扱い) なら矩形選択しない
      if (width > 3 || height > 3) {
        const insideIds: string[] = [];
        for (const sym of symbols) {
          const def = getSymbolDefinition(sym.type);
          if (!def) continue;
          // シンボルの中心 (canvas px) を計算
          const cx = mmToPx(sym.position.x, scaleObj);
          const cy = mmToPx(sym.position.y, scaleObj);
          if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
            insideIds.push(sym.id);
          }
        }
        selectSymbols(insideIds);
      }
      selectionStartRef.current = null;
      setSelectionRect(null);
    }
  };

  const handleStageMouseLeave = () => {
    setCursorMm(null);
    selectionStartRef.current = null;
    setSelectionRect(null);
    viewportControls.onMouseUp({} as KonvaEventObject<MouseEvent>);
  };

  const handleStageClick = (e: KonvaEventObject<MouseEvent>) => {
    if (spaceDown) return;
    // 矩形選択が動作した直後はクリック扱いしない
    if (selectionRect) return;
    const stage = e.target.getStage();
    if (!stage) return;
    const point = stage.getRelativePointerPosition();
    if (!point) return;
    if (mode.kind === 'place') {
      addSymbol(mode.symbolType as SymbolType, {
        x: pxToMm(point.x, scaleObj),
        y: pxToMm(point.y, scaleObj),
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
        <Minimap containerSize={containerSize} />
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
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
          onMouseLeave={handleStageMouseLeave}
          onClick={handleStageClick}
          onTap={handleStageClick}
          style={{ cursor }}
        >
          <Layer listening={false}>
            <KonvaImage image={canvas} />
          </Layer>
          <GridLayer pxPerMm={pxPerMm} canvasWidth={canvas.width} canvasHeight={canvas.height} />
          <SymbolsLayer pxPerMm={pxPerMm} />
          <SelectionRectLayer rect={selectionRect} />
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
  position: 'relative',
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
