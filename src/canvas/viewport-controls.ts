// Konva Stage 用のズーム/パン操作ハンドラを React hook として提供する (Plan §4 / R-A5)。
// マウスホイール: カーソル位置中心ズーム
// Space + ドラッグ: パン
// 入力フィールド (input/textarea) フォーカス時は Space キー操作を抑止する。

import { useEffect, useRef } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useViewportStore } from '../data/viewport-store';

const ZOOM_FACTOR = 1.1;

interface DragSnapshot {
  startScreenX: number;
  startScreenY: number;
  startOffsetX: number;
  startOffsetY: number;
}

export interface ViewportHandlers {
  onWheel: (e: KonvaEventObject<WheelEvent>) => void;
  onMouseDown: (e: KonvaEventObject<MouseEvent>) => void;
  onMouseMove: (e: KonvaEventObject<MouseEvent>) => void;
  onMouseUp: (e: KonvaEventObject<MouseEvent>) => void;
  /** パン中に true (cursor を grabbing にする等) */
  isPanning: () => boolean;
}

export function useViewportControls(): ViewportHandlers {
  const zoomAt = useViewportStore((s) => s.zoomAt);
  const setOffset = useViewportStore((s) => s.setOffset);
  const setSpaceDown = useViewportStore((s) => s.setSpaceDown);
  const dragRef = useRef<DragSnapshot | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (isInputFocused()) return;
      e.preventDefault();
      setSpaceDown(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      setSpaceDown(false);
      dragRef.current = null;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [setSpaceDown]);

  const onWheel = (e: KonvaEventObject<WheelEvent>): void => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const factor = e.evt.deltaY > 0 ? 1 / ZOOM_FACTOR : ZOOM_FACTOR;
    zoomAt(pointer, factor);
  };

  const onMouseDown = (e: KonvaEventObject<MouseEvent>): void => {
    const { spaceDown, offsetX, offsetY } = useViewportStore.getState();
    if (!spaceDown) return;
    e.evt.preventDefault();
    e.cancelBubble = true; // Stage の他のクリックハンドラが配置を呼ばないように
    dragRef.current = {
      startScreenX: e.evt.clientX,
      startScreenY: e.evt.clientY,
      startOffsetX: offsetX,
      startOffsetY: offsetY,
    };
  };

  const onMouseMove = (e: KonvaEventObject<MouseEvent>): void => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.evt.clientX - drag.startScreenX;
    const dy = e.evt.clientY - drag.startScreenY;
    setOffset(drag.startOffsetX + dx, drag.startOffsetY + dy);
  };

  const onMouseUp = (_e: KonvaEventObject<MouseEvent>): void => {
    dragRef.current = null;
  };

  const isPanning = (): boolean => dragRef.current !== null;

  return { onWheel, onMouseDown, onMouseMove, onMouseUp, isPanning };
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (el == null) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable === true;
}
