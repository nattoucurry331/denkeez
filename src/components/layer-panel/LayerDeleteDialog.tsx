// レイヤー削除確認ダイアログ (Phase 2-D2 / Q3 仕様)。
// 中身を持つレイヤーを削除する際、「中身も削除」or「他レイヤーへ移動」を選ばせる。

import { useState, useEffect } from 'react';
import type { Layer } from '../../data/types';

interface Props {
  readonly open: boolean;
  readonly layerName: string;
  readonly symbolCount: number;
  readonly wireCount: number;
  /** 移動先候補 (削除対象自身を除いたユーザーレイヤー) */
  readonly fallbackCandidates: ReadonlyArray<Layer>;
  readonly onConfirm: (
    mode: 'delete-contents' | 'move-to-fallback',
    fallbackLayerId?: string,
  ) => void;
  readonly onCancel: () => void;
}

export function LayerDeleteDialog({
  open,
  layerName,
  symbolCount,
  wireCount,
  fallbackCandidates,
  onConfirm,
  onCancel,
}: Props): JSX.Element | null {
  const hasContents = symbolCount > 0 || wireCount > 0;
  const hasFallback = fallbackCandidates.length > 0;
  const [mode, setMode] = useState<'delete-contents' | 'move-to-fallback'>(
    hasContents && hasFallback ? 'move-to-fallback' : 'delete-contents',
  );
  const [fallbackId, setFallbackId] = useState<string>(
    fallbackCandidates[0]?.id ?? '',
  );

  // open 切替時に初期値リセット
  useEffect(() => {
    if (open) {
      setMode(hasContents && hasFallback ? 'move-to-fallback' : 'delete-contents');
      setFallbackId(fallbackCandidates[0]?.id ?? '');
    }
  }, [open, hasContents, hasFallback, fallbackCandidates]);

  if (!open) return null;

  const handleConfirm = (): void => {
    if (mode === 'move-to-fallback' && fallbackId) {
      onConfirm('move-to-fallback', fallbackId);
    } else {
      onConfirm('delete-contents');
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="layer-delete-title" style={overlayStyle}>
      <div style={modalStyle}>
        <h2 id="layer-delete-title" style={headingStyle}>
          レイヤー「{layerName}」を削除しますか?
        </h2>
        {hasContents ? (
          <>
            <p style={descStyle}>
              このレイヤーには
              {symbolCount > 0 && <strong> シンボル {symbolCount} 個</strong>}
              {symbolCount > 0 && wireCount > 0 && ' と '}
              {wireCount > 0 && <strong>配線 {wireCount} 本</strong>}
              が含まれています。
            </p>
            <div style={radioGroupStyle}>
              {hasFallback && (
                <label style={radioLabelStyle}>
                  <input
                    type="radio"
                    name="layer-delete-mode"
                    checked={mode === 'move-to-fallback'}
                    onChange={() => setMode('move-to-fallback')}
                  />
                  他のレイヤーへ移動する
                  {mode === 'move-to-fallback' && (
                    <select
                      value={fallbackId}
                      onChange={(e) => setFallbackId(e.target.value)}
                      style={selectStyle}
                    >
                      {fallbackCandidates.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
              )}
              <label style={radioLabelStyle}>
                <input
                  type="radio"
                  name="layer-delete-mode"
                  checked={mode === 'delete-contents'}
                  onChange={() => setMode('delete-contents')}
                />
                中身も一緒に削除する (元に戻すで復元可能)
              </label>
            </div>
          </>
        ) : (
          <p style={descStyle}>このレイヤーは空です。削除しますか?</p>
        )}
        <div style={buttonsStyle}>
          <button type="button" onClick={handleConfirm} autoFocus style={dangerButtonStyle}>
            {mode === 'move-to-fallback' ? '移動して削除' : '削除'}
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
  maxWidth: 480,
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
};
const headingStyle: React.CSSProperties = {
  marginTop: 0,
  fontSize: '1rem',
};
const descStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  color: '#333',
  margin: '0 0 12px 0',
};
const radioGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  marginBottom: 16,
};
const radioLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: '0.9rem',
  cursor: 'pointer',
};
const selectStyle: React.CSSProperties = {
  marginLeft: 8,
  fontSize: '0.85rem',
  padding: '2px 6px',
};
const buttonsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginTop: 16,
  justifyContent: 'flex-end',
};
const dangerButtonStyle: React.CSSProperties = {
  background: '#cc4444',
  color: '#fff',
  border: 'none',
  padding: '6px 12px',
  borderRadius: 4,
  cursor: 'pointer',
};
