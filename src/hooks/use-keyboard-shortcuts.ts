// グローバルキーボードショートカット (Plan §8 / CLAUDE.md L197 Windows 標準準拠)。
//
// CanvasArea 固有の Escape / Delete は CanvasArea 内に残し、
// 本フックではアンドゥ・リドゥ・ズーム・グリッド切替などのアプリ全体で有効な操作を扱う。

import { useEffect } from 'react';
import { useProjectStore } from '../data/project-store';
import { useViewportStore } from '../data/viewport-store';

interface Options {
  /**
   * 画面ズームの中心点 (px)。CanvasArea の containerSize の中央を渡す。
   * canvas 未読込時は null を返してもよい (その場合ショートカットは無視)。
   */
  getViewportCenter: () => { x: number; y: number } | null;
}

export function useKeyboardShortcuts(options: Options): void {
  const { getViewportCenter } = options;

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      // 入力フィールド内ではブラウザ標準の挙動を尊重 (Ctrl+Z は text undo として動作)
      if (isInputFocused()) return;

      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+Z / Ctrl+Shift+Z (Y) でアンドゥ・リドゥ
      if (ctrl && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        useProjectStore.temporal.getState().undo();
        return;
      }
      if (ctrl && ((e.shiftKey && (e.key === 'z' || e.key === 'Z')) || e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        useProjectStore.temporal.getState().redo();
        return;
      }

      // Ctrl++ / Ctrl+= / Ctrl+; でズームイン
      if (ctrl && (e.key === '+' || e.key === '=' || e.key === ';')) {
        e.preventDefault();
        const center = getViewportCenter();
        if (center) useViewportStore.getState().zoomAt(center, 1.2);
        return;
      }
      // Ctrl+- でズームアウト
      if (ctrl && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        const center = getViewportCenter();
        if (center) useViewportStore.getState().zoomAt(center, 1 / 1.2);
        return;
      }
      // Ctrl+0 でビューリセット (100%)
      if (ctrl && e.key === '0') {
        e.preventDefault();
        useViewportStore.getState().resetView();
        return;
      }

      // G: グリッド ON/OFF / Shift+G: spacing 切替 (現状 100 ↔ 50)
      if (!ctrl && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        if (e.shiftKey) {
          const current = useProjectStore.getState().project.grid?.spacingMm ?? 100;
          const next: 100 | 50 = current === 100 ? 50 : 100;
          useProjectStore.getState().setGridSpacing(next);
        } else {
          useProjectStore.getState().toggleGrid();
        }
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [getViewportCenter]);
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (el == null) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if ((el as HTMLElement).isContentEditable === true) return true;
  return false;
}
