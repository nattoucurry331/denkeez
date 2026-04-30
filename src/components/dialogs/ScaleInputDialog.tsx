// スケール設定の実寸入力モーダル (Phase 2-C1)。
// ユーザーが図面上で 2 点クリックした後に開く。
// 入力値は正の数値 mm。OK で確定、キャンセル / ESC でモード解除。

import { useEffect, useRef, useState } from 'react';

interface Props {
  open: boolean;
  /** 2 点間の canvas px 距離 (情報表示用) */
  pixelDistanceCanvas: number;
  onConfirm: (realDistanceMm: number) => void;
  onCancel: () => void;
}

export function ScaleInputDialog({ open, pixelDistanceCanvas, onConfirm, onCancel }: Props): JSX.Element | null {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setText('');
      setError(null);
      // 1 tick 後に focus
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    return;
  }, [open]);

  if (!open) return null;

  const handleConfirm = () => {
    const trimmed = text.trim();
    const num = Number(trimmed);
    if (trimmed === '' || !Number.isFinite(num) || num <= 0) {
      setError('正の数値を入力してください (mm)');
      return;
    }
    onConfirm(num);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="scale-dialog-title" style={overlayStyle}>
      <div style={modalStyle}>
        <h2 id="scale-dialog-title" style={headingStyle}>
          スケール設定
        </h2>
        <p style={infoStyle}>
          2 点間の canvas 距離: <strong>{pixelDistanceCanvas.toFixed(1)} px</strong>
        </p>
        <label style={labelStyle}>
          実寸の長さ (mm) を入力:
          <input
            ref={inputRef}
            type="number"
            min={1}
            step={1}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            style={inputStyle}
            placeholder="例: 5000 (= 5m)"
          />
        </label>
        {error && (
          <p style={errorStyle} role="alert">
            {error}
          </p>
        )}
        <p style={hintStyle}>
          例: 平面図で「3,640 mm」と書かれた壁の 2 点をクリックしたなら 3640 を入力。
        </p>
        <div style={buttonsStyle}>
          <button type="button" onClick={handleConfirm}>
            OK
          </button>
          <button type="button" onClick={onCancel}>
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};
const modalStyle: React.CSSProperties = {
  background: '#fff',
  padding: '1.5rem 2rem',
  borderRadius: 8,
  minWidth: 380,
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
};
const headingStyle: React.CSSProperties = { marginTop: 0, fontSize: '1.05rem' };
const infoStyle: React.CSSProperties = { fontSize: '0.85rem', color: '#444', marginBottom: 12 };
const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: '0.85rem',
  color: '#222',
};
const inputStyle: React.CSSProperties = {
  fontSize: '1rem',
  padding: '6px 8px',
  border: '1px solid #ccc',
  borderRadius: 4,
};
const errorStyle: React.CSSProperties = { color: '#c00', fontSize: '0.85rem', marginTop: 6 };
const hintStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#888',
  marginTop: 8,
};
const buttonsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginTop: 16,
  justifyContent: 'flex-end',
};
