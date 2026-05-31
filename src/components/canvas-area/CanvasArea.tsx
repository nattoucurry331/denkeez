// 図面キャンバス (Plan §3 / REQUIREMENTS.md §6.1)。
// PDF を背景レイヤーに、シンボルを上位レイヤーに描画する。
// Phase 2-A1: ビューポートのズーム / パン (Stage の scale + offset、ViewportControls 経由)。
// Phase 2-A2: GridLayer 統合 + cursorMm 発信 (StatusBar 表示用)。
// Phase 2-B4: 矩形選択 (ドラッグで複数シンボル選択)。
// Phase 2-C1: スケール設定 (2 点クリック → ScaleInputDialog → setScale)。

import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';
import { useProjectStore } from '../../data/project-store';
import { useViewportStore } from '../../data/viewport-store';
import type { SymbolType } from '../../data/types';
import { useViewportControls } from '../../canvas/viewport-controls';
import { askConfirm } from '../../tauri/api';
import { SymbolsLayer } from '../../canvas/symbols-layer';
import { GridLayer } from '../../canvas/grid-layer';
import { Minimap } from '../../canvas/minimap';
import {
  SelectionRectLayer,
  type SelectionRect,
} from '../../canvas/selection-rect-layer';
import { ScaleOverlayLayer } from '../../canvas/scale-overlay-layer';
import {
  MeasureOverlayLayer,
  type MeasureSegment,
} from '../../canvas/measure-overlay-layer';
import { formatDistanceMm } from '../../utils/dimension-format';
import { WireLayer } from '../../canvas/wire-layer';
import { WirePreviewLayer } from '../../canvas/wire-preview-layer';
import { ScaleInputDialog } from '../dialogs/ScaleInputDialog';
import { useKeyboardShortcuts } from '../../hooks/use-keyboard-shortcuts';
import { pxToMm, computePxPerMm, distancePx } from '../../utils/coordinate';
import { getSymbolDefinition } from '../../symbols/symbol-registry';
import {
  filterEditableEntityIds,
  lockedLayerIds,
} from '../../data/layer-helpers';
import { BACKGROUND_LAYER_ID } from '../../data/types';
import { PRODUCT_IMAGE_DEFAULT_WIDTH_MM } from '../../utils/product-size';
import { WelcomeScreen } from './WelcomeScreen';

/** Konva の Node 階層を遡って `sym-XXX` の id を持つ祖先 (= シンボル Group) を探す */
function findSymbolIdFromTarget(target: Konva.Node): string | null {
  let node: Konva.Node | null = target;
  while (node) {
    const id = node.id();
    if (typeof id === 'string' && id.startsWith('sym-')) {
      return id.substring(4);
    }
    node = node.getParent();
  }
  return null;
}

export function CanvasArea(): JSX.Element {
  const drawing = useProjectStore((s) => s.project.drawing);
  const canvas = useProjectStore((s) => s.pdfCanvas);
  const symbols = useProjectStore((s) => s.project.symbols);
  const layers = useProjectStore((s) => s.project.layers);
  const selectedIds = useProjectStore((s) => s.selectedIds);
  const mode = useProjectStore((s) => s.mode);
  const addSymbol = useProjectStore((s) => s.addSymbol);
  const removeSymbols = useProjectStore((s) => s.removeSymbols);
  const exitMode = useProjectStore((s) => s.exitMode);
  const clearSelection = useProjectStore((s) => s.clearSelection);
  const selectSymbols = useProjectStore((s) => s.selectSymbols);
  const setScaleFirstPoint = useProjectStore((s) => s.setScaleFirstPoint);
  const setScale = useProjectStore((s) => s.setScale);
  const enterScaleMode = useProjectStore((s) => s.enterScaleMode);
  const setMeasureFirstPoint = useProjectStore((s) => s.setMeasureFirstPoint);
  const setWireFromSymbol = useProjectStore((s) => s.setWireFromSymbol);
  const appendWireWaypoint = useProjectStore((s) => s.appendWireWaypoint);
  const addWire = useProjectStore((s) => s.addWire);
  const resetWireProgress = useProjectStore((s) => s.resetWireProgress);

  const viewportScale = useViewportStore((s) => s.scale);
  const offsetX = useViewportStore((s) => s.offsetX);
  const offsetY = useViewportStore((s) => s.offsetY);
  const spaceDown = useViewportStore((s) => s.spaceDown);
  const fitToWindow = useViewportStore((s) => s.fitToWindow);
  const setCursorMm = useViewportStore((s) => s.setCursorMm);

  const viewportControls = useViewportControls();
  const stageRef = useRef<Konva.Stage | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });

  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const selectionStartRef = useRef<SelectionRect | null>(null);

  // スケール設定モード用 state
  const [scaleCursorPx, setScaleCursorPx] = useState<{ x: number; y: number } | null>(null);
  const [scaleDialog, setScaleDialog] = useState<{ open: boolean; pixelDistance: number }>({
    open: false,
    pixelDistance: 0,
  });
  // 配線モード用カーソル位置 (canvas 論理座標)
  const [wireCursorPx, setWireCursorPx] = useState<{ x: number; y: number } | null>(null);
  // Phase 3 F-16 Sub-1: 寸法計測モード用カーソル位置 + 直前の計測結果 (消える計測)
  const [measureCursorPx, setMeasureCursorPx] = useState<{ x: number; y: number } | null>(null);
  const [lastMeasurement, setLastMeasurement] = useState<MeasureSegment | null>(null);
  // Phase 2-J2: スケール未設定バナーを閉じたか (セッション内)
  const [scaleBannerDismissed, setScaleBannerDismissed] = useState(false);

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

  // Phase 3 F-16: 計測モードを抜けたら計測表示をクリア (消える計測)
  useEffect(() => {
    if (mode.kind !== 'measure') {
      setLastMeasurement(null);
      setMeasureCursorPx(null);
    }
  }, [mode.kind]);

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
        if (mode.kind === 'wire') {
          // 配線モードは「途中状態破棄 → モード解除」の 2 段階
          if (mode.fromSymbolId || mode.waypoints.length > 0) {
            resetWireProgress();
          } else {
            exitMode();
          }
          setWireCursorPx(null);
        } else if (mode.kind === 'place' || mode.kind === 'scale') {
          exitMode();
          setScaleCursorPx(null);
        } else if (mode.kind === 'measure') {
          exitMode();
          setMeasureCursorPx(null);
          setLastMeasurement(null);
        } else {
          clearSelection();
        }
      } else if (e.key === 'Delete' && selectedIds.length > 0) {
        // Phase 2-C4: 参照する Wire があれば確認してから削除
        // Phase 2-D3: ロック中レイヤー所属の id は削除対象から除外。
        //   selectedIds には symbol/wire の両方が混在し得るので、
        //   それぞれの editable な部分集合を計算して removeSymbols / removeWires を呼ぶ。
        void (async () => {
          const state = useProjectStore.getState();
          const allWires = state.project.wires ?? [];
          const editable = filterEditableEntityIds(
            selectedIds,
            state.project.symbols,
            allWires,
            state.project.layers,
          );
          if (editable.length === 0) return;
          const editableSet = new Set(editable);
          const symbolIds = state.project.symbols
            .filter((s) => editableSet.has(s.id))
            .map((s) => s.id);
          const directWireIds = allWires
            .filter((w) => editableSet.has(w.id))
            .map((w) => w.id);
          // シンボル削除で連鎖削除される wire (端点参照)
          const symbolIdSet = new Set(symbolIds);
          const cascadingWires = allWires.filter(
            (w) =>
              !directWireIds.includes(w.id) &&
              (symbolIdSet.has(w.fromSymbolId) || symbolIdSet.has(w.toSymbolId)),
          );
          if (cascadingWires.length > 0) {
            const ok = await askConfirm(
              `選択中のシンボルに接続された ${cascadingWires.length} 本の配線も一緒に削除されます。続行しますか?`,
              'シンボル削除',
            );
            if (!ok) return;
          }
          if (directWireIds.length > 0) {
            useProjectStore.getState().removeWires(directWireIds);
          }
          if (symbolIds.length > 0) {
            removeSymbols(symbolIds);
          }
        })();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, selectedIds, exitMode, clearSelection, removeSymbols, resetWireProgress]);

  useKeyboardShortcuts({
    getViewportCenter: () =>
      containerSize.w > 0 && containerSize.h > 0
        ? { x: containerSize.w / 2, y: containerSize.h / 2 }
        : null,
  });

  if (!drawing) {
    return <WelcomeScreen />;
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
      {mode.kind === 'scale' && (
        <span style={scaleModeBadgeStyle}>
          スケール設定中: {mode.firstPointPx ? '2 点目をクリック' : '1 点目をクリック'} (ESC で解除)
        </span>
      )}
      {mode.kind === 'measure' && (
        <span style={measureModeBadgeStyle}>
          寸法計測中: {mode.firstPointPx ? '2 点目をクリック' : '1 点目をクリック'}
          {!drawing.scale && ' ／ 縮尺未設定のため「紙面寸法」です'}
          {lastMeasurement && ` ／ 直前: ${lastMeasurement.label}`}
          {' '}(ESC で解除)
        </span>
      )}
      {mode.kind === 'wire' && (
        <span style={wireModeBadgeStyle}>
          配線モード: {!mode.fromSymbolId ? '始点シンボルをクリック' : '中継点クリック / 終点シンボルをクリック'} (ESC で途中解除)
        </span>
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

  // Phase 2-C1: scale 設定済みなら校正値ベース、未設定なら紙面ベースで pxPerMm を計算
  // → 「位置」の mm↔px 変換に使う (校正後は実寸 mm 系)
  const pxPerMm = computePxPerMm(drawing, canvas.width);
  const scaleObj = { pxPerMm };
  // Phase 2-E5: シンボル形状サイズ・配線太さなど「紙面 mm」前提の値は常に紙面スケールで描画。
  //   (JIS C 0303 の慣例: 記号は縮尺に関わらず一定の見やすい大きさで描く)
  const paperPxPerMm = canvas.width / drawing.widthMm;

  const isStageBackground = (e: KonvaEventObject<MouseEvent>): boolean => {
    const target = e.target;
    const stage = target.getStage();
    if (!stage) return false;
    return target === stage || target.getClassName() === 'Image';
  };

  const handleStageMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    viewportControls.onMouseDown(e);
    // パン中・配置/スケールモード中は矩形選択を無効
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

    if (mode.kind === 'scale') {
      setScaleCursorPx(point);
    }
    if (mode.kind === 'measure') {
      setMeasureCursorPx(point);
    }
    if (mode.kind === 'wire') {
      setWireCursorPx(point);
    }

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
    const rect = selectionStartRef.current;
    if (rect && selectionRect) {
      const minX = Math.min(selectionRect.startX, selectionRect.endX);
      const maxX = Math.max(selectionRect.startX, selectionRect.endX);
      const minY = Math.min(selectionRect.startY, selectionRect.endY);
      const maxY = Math.max(selectionRect.startY, selectionRect.endY);
      const width = maxX - minX;
      const height = maxY - minY;
      if (width > 3 || height > 3) {
        // Phase 2-D3: ロック中レイヤー所属の symbol は矩形選択から除外
        const locked = lockedLayerIds(layers);
        const insideIds: string[] = [];
        for (const sym of symbols) {
          if (locked.has(sym.layerId)) continue;
          const def = getSymbolDefinition(sym.type);
          if (!def) continue;
          const cx = sym.position.x * pxPerMm;
          const cy = sym.position.y * pxPerMm;
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
    setScaleCursorPx(null);
    setMeasureCursorPx(null);
    selectionStartRef.current = null;
    setSelectionRect(null);
    viewportControls.onMouseUp({} as KonvaEventObject<MouseEvent>);
  };

  const handleStageClick = (e: KonvaEventObject<MouseEvent>) => {
    if (spaceDown) return;
    if (selectionRect) return;
    const stage = e.target.getStage();
    if (!stage) return;
    const point = stage.getRelativePointerPosition();
    if (!point) return;

    if (mode.kind === 'scale') {
      if (!mode.firstPointPx) {
        setScaleFirstPoint(point);
      } else {
        const distance = distancePx(mode.firstPointPx, point);
        if (distance < 1) {
          return;
        }
        setScaleDialog({ open: true, pixelDistance: distance });
      }
      return;
    }

    if (mode.kind === 'measure') {
      if (!mode.firstPointPx) {
        // 新しい計測の開始: 直前の結果を消して 1 点目を置く
        setLastMeasurement(null);
        setMeasureFirstPoint(point);
      } else {
        const distance = distancePx(mode.firstPointPx, point);
        if (distance < 1) return;
        // px → mm 変換は scaleObj (校正済みなら実寸、未校正は紙面 mm)
        const mm = distance / pxPerMm;
        const calibrated = !!drawing.scale;
        setLastMeasurement({
          fromPx: mode.firstPointPx,
          toPx: point,
          label: formatDistanceMm(mm, calibrated),
        });
        // 2 点目確定 → 次の計測に備えて 1 点目をクリア (結果は凍結表示が残る)
        setMeasureFirstPoint(undefined);
      }
      return;
    }

    if (mode.kind === 'wire') {
      // Phase 2-D3: ロック中レイヤーのシンボルは始点・終点にできない (listening=false で
      // 通常はそもそも target にならないが、防御として symbolId 確定後にフィルタ)
      const symbolId = findSymbolIdFromTarget(e.target);
      const lockedSet = lockedLayerIds(layers);
      const symbol = symbolId
        ? symbols.find((s) => s.id === symbolId && !lockedSet.has(s.layerId))
        : null;
      const usableSymbolId = symbol?.id ?? null;
      const pointMm = { x: pxToMm(point.x, scaleObj), y: pxToMm(point.y, scaleObj) };

      if (!mode.fromSymbolId) {
        // 1 点目は必ずシンボル
        if (usableSymbolId) {
          setWireFromSymbol(usableSymbolId);
        }
        return;
      }
      // from 設定済み: シンボルなら配線確定、それ以外なら waypoint 追加
      if (usableSymbolId && usableSymbolId !== mode.fromSymbolId) {
        addWire(mode.fromSymbolId, usableSymbolId, mode.waypoints);
        resetWireProgress(); // 連続配線モード継続
      } else if (!usableSymbolId) {
        appendWireWaypoint(pointMm);
      }
      return;
    }

    if (mode.kind === 'place') {
      // Phase 2-H: preset 由来の properties / text / scale を addSymbol に渡す
      const positionMm = {
        x: pxToMm(point.x, scaleObj),
        y: pxToMm(point.y, scaleObj),
      };
      const opts: {
        properties?: Record<string, import('../../data/types').PropertyValue>;
        text?: string;
        scale?: number;
        image?: import('../../data/types').SymbolImage;
      } = {};
      if (mode.preset) {
        opts.properties = mode.preset.defaultProperties;
        if (mode.preset.textOverride !== undefined) opts.text = mode.preset.textOverride;
        if (mode.preset.scaleOverride !== undefined) opts.scale = mode.preset.scaleOverride;
        // Phase 2-I/2-K2: 商品画像プリセット。preset が表示幅を持てばそれを使い、
        // 無ければ既定値で SymbolImage に展開する。
        if (mode.preset.image !== undefined) {
          opts.image = {
            dataUrl: mode.preset.image.dataUrl,
            aspectRatio: mode.preset.image.aspectRatio,
            widthMm: mode.preset.image.widthMm ?? PRODUCT_IMAGE_DEFAULT_WIDTH_MM,
          };
        }
      }
      addSymbol(mode.symbolType as SymbolType, positionMm, opts);
    } else if (e.target === stage) {
      clearSelection();
    }
  };

  const handleScaleConfirm = (realDistanceMm: number): void => {
    setScale({
      pixelDistanceCanvas: scaleDialog.pixelDistance,
      realDistanceMm,
    });
    setScaleDialog({ open: false, pixelDistance: 0 });
    setScaleFirstPoint(undefined);
    setScaleCursorPx(null);
    exitMode();
  };

  const handleScaleCancel = (): void => {
    setScaleDialog({ open: false, pixelDistance: 0 });
    // 1 点目クリアして再度 1 点目から
    setScaleFirstPoint(undefined);
  };

  const cursor =
    spaceDown
      ? viewportControls.isPanning()
        ? 'grabbing'
        : 'grab'
      : mode.kind === 'place' ||
          mode.kind === 'scale' ||
          mode.kind === 'measure' ||
          mode.kind === 'wire'
        ? 'crosshair'
        : 'default';

  // Phase 3 F-16: 進行中(1点目→カーソル)のライブ距離ラベル
  const measureLiveLabel =
    mode.kind === 'measure' && mode.firstPointPx && measureCursorPx
      ? formatDistanceMm(distancePx(mode.firstPointPx, measureCursorPx) / pxPerMm, !!drawing.scale)
      : undefined;

  // Phase 2-J2: スケール未設定なら「まず縮尺を合わせましょう」を案内 (select モード時のみ)
  const showScaleBanner =
    !drawing.scale && !scaleBannerDismissed && mode.kind === 'select';

  return (
    <div style={containerStyle}>
      {infoLine}
      {showScaleBanner && (
        <div style={scaleBannerStyle}>
          <span style={scaleBannerIconStyle} aria-hidden="true">📏</span>
          <span style={scaleBannerTextStyle}>
            まず<strong>縮尺を合わせましょう</strong>。図面の既知寸法 2 点をクリックして実寸を入れると、配線長や拾い出しが正確になります。
          </span>
          <button
            type="button"
            onClick={() => enterScaleMode()}
            style={scaleBannerCtaStyle}
          >
            縮尺を設定
          </button>
          <button
            type="button"
            onClick={() => setScaleBannerDismissed(true)}
            style={scaleBannerCloseStyle}
            aria-label="閉じる"
            title="閉じる"
          >
            ✕
          </button>
        </div>
      )}
      <div ref={containerRef} style={stageContainerStyle}>
        <Minimap containerSize={containerSize} />
        <Stage
          ref={stageRef}
          width={containerSize.w}
          height={containerSize.h}
          scaleX={viewportScale}
          scaleY={viewportScale}
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
          {/* Phase 2-D3: 元図面レイヤー (background) の visible で PDF 描画を出し分け */}
          {(layers.find((l) => l.id === BACKGROUND_LAYER_ID)?.visible ?? true) && (
            <Layer listening={false}>
              <KonvaImage image={canvas} />
            </Layer>
          )}
          <GridLayer pxPerMm={pxPerMm} canvasWidth={canvas.width} canvasHeight={canvas.height} />
          <WireLayer pxPerMm={pxPerMm} />
          <SymbolsLayer pxPerMm={pxPerMm} paperPxPerMm={paperPxPerMm} />
          <WirePreviewLayer
            pxPerMm={pxPerMm}
            cursorPx={mode.kind === 'wire' ? wireCursorPx ?? undefined : undefined}
          />
          <SelectionRectLayer rect={selectionRect} />
          <ScaleOverlayLayer
            active={mode.kind === 'scale'}
            firstPointPx={mode.kind === 'scale' ? mode.firstPointPx : undefined}
            cursorPx={mode.kind === 'scale' ? scaleCursorPx ?? undefined : undefined}
          />
          <MeasureOverlayLayer
            active={mode.kind === 'measure'}
            firstPointPx={mode.kind === 'measure' ? mode.firstPointPx : undefined}
            cursorPx={mode.kind === 'measure' ? measureCursorPx ?? undefined : undefined}
            liveLabel={measureLiveLabel}
            lastMeasurement={mode.kind === 'measure' ? lastMeasurement ?? undefined : undefined}
            viewportScale={viewportScale}
          />
        </Stage>
      </div>
      <ScaleInputDialog
        open={scaleDialog.open}
        pixelDistanceCanvas={scaleDialog.pixelDistance}
        onConfirm={handleScaleConfirm}
        onCancel={handleScaleCancel}
      />
    </div>
  );
}

const scaleBannerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 14px',
  background: '#fff8e0',
  borderBottom: '1px solid #f0d080',
  fontSize: '0.85rem',
  color: '#5a4400',
};
const scaleBannerIconStyle: React.CSSProperties = { fontSize: '1.1rem', flexShrink: 0 };
const scaleBannerTextStyle: React.CSSProperties = { flex: 1, lineHeight: 1.5 };
const scaleBannerCtaStyle: React.CSSProperties = {
  flexShrink: 0,
  padding: '5px 14px',
  background: '#f0a000',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: '0.82rem',
  fontWeight: 700,
  cursor: 'pointer',
};
const scaleBannerCloseStyle: React.CSSProperties = {
  flexShrink: 0,
  width: 24,
  height: 24,
  padding: 0,
  background: 'transparent',
  border: 'none',
  color: '#9a8000',
  cursor: 'pointer',
  fontSize: '0.9rem',
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
const scaleModeBadgeStyle: React.CSSProperties = {
  ...modeBadgeStyle,
  background: '#ff7700',
};
const wireModeBadgeStyle: React.CSSProperties = {
  ...modeBadgeStyle,
  background: '#ff5500',
};
const measureModeBadgeStyle: React.CSSProperties = {
  ...modeBadgeStyle,
  background: '#d35400',
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
