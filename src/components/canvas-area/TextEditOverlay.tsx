// F-18: テキスト注記をキャンバス上で直接編集する HTML オーバーレイ。
// Konva は <textarea> を持てないため、注記のスクリーン座標に重ねて表示する。
// - Enter (Shift なし) または フォーカスアウトで確定。
// - Esc で取消。改行は Shift+Enter。
// - <textarea> 内なので use-keyboard-shortcuts の isInputFocused により
//   アプリのショートカット (Ctrl+Z 等) は抑止され、ブラウザ標準の文字編集が効く。

import { useEffect, useRef, useState } from 'react';

export interface TextEditTarget {
  /** stageContainer 内の左上 px */
  leftPx: number;
  topPx: number;
  /** 画面表示上のフォントサイズ px (viewportScale 反映済み) */
  fontSizePx: number;
  color: string;
  /** 編集開始時の文字列 */
  text: string;
}

interface Props {
  target: TextEditTarget | null;
  onCommit: (text: string) => void;
  onCancel: () => void;
}

export function TextEditOverlay({ target, onCommit, onCancel }: Props): JSX.Element | null {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (target) {
      setValue(target.text);
      // マウント直後にフォーカス + 全選択
      requestAnimationFrame(() => {
        const el = ref.current;
        if (el) {
          el.focus();
          el.select();
        }
      });
    }
  }, [target]);

  if (!target) return null;

  const fontPx = Math.max(12, target.fontSizePx);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          onCommit(value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
        // それ以外のキーはブラウザ標準編集に任せる (Stage へ伝播させない)
        e.stopPropagation();
      }}
      style={{
        position: 'absolute',
        left: target.leftPx,
        top: target.topPx,
        margin: 0,
        padding: '1px 2px',
        border: '1px solid #0080ff',
        borderRadius: 2,
        background: 'rgba(255,255,255,0.95)',
        color: target.color,
        fontSize: fontPx,
        lineHeight: 1.1,
        fontFamily: 'sans-serif',
        minWidth: 60,
        minHeight: fontPx * 1.4,
        resize: 'both',
        overflow: 'hidden',
        zIndex: 20,
        boxShadow: '0 1px 6px rgba(0,0,0,0.2)',
      }}
      aria-label="テキスト注記の編集"
      placeholder="文字を入力"
    />
  );
}
