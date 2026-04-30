// Phase 2-F3: 更新通知ダイアログ。
// MenuBar 右端の「🔔 更新があります」をクリックすると開く。
// 「今すぐ更新」で downloadAndInstall → relaunch、「あとで」で閉じる。

import { useState } from 'react';
import {
  applyUpdateAndRelaunch,
  type DownloadProgress,
  type UpdateInfo,
} from '../../tauri/updater';
import { APP_VERSION } from '../../shared/constants/app';

interface Props {
  readonly open: boolean;
  readonly info: UpdateInfo | null;
  readonly onCancel: () => void;
}

export function UpdateDialog({ open, info, onCancel }: Props): JSX.Element | null {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open || !info) return null;

  const handleApply = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      await applyUpdateAndRelaunch((p) => setProgress(p));
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const percent =
    progress && progress.total > 0
      ? Math.round((progress.downloaded / progress.total) * 100)
      : null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="update-title" style={overlayStyle}>
      <div style={modalStyle}>
        <h2 id="update-title" style={headingStyle}>
          🔔 アップデートがあります
        </h2>
        <p style={versionLineStyle}>
          現在: <code>{APP_VERSION}</code> → 新版: <code>{info.version}</code>
          {info.date && <span style={dateStyle}> ({formatDate(info.date)})</span>}
        </p>
        {info.notes && (
          <details style={notesDetailsStyle}>
            <summary style={notesSummaryStyle}>変更内容</summary>
            <pre style={notesPreStyle}>{info.notes}</pre>
          </details>
        )}
        <p style={hintStyle}>
          更新を適用するとアプリが再起動します。未保存の変更があれば、先に保存してください。
        </p>

        {busy && (
          <div style={progressBoxStyle}>
            <p style={progressLabelStyle}>ダウンロード中…</p>
            {percent !== null && (
              <div style={progressBarOuterStyle}>
                <div
                  style={{
                    ...progressBarInnerStyle,
                    width: `${percent}%`,
                  }}
                />
                <span style={progressTextStyle}>{percent}%</span>
              </div>
            )}
          </div>
        )}

        {error && (
          <p role="alert" style={errorStyle}>
            エラー: {error}
          </p>
        )}

        <div style={buttonsStyle}>
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={busy}
            autoFocus
            style={primaryButtonStyle}
          >
            {busy ? '更新中…' : '今すぐ更新して再起動'}
          </button>
          <button type="button" onClick={onCancel} disabled={busy}>
            あとで
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  // updater が返す date は '2026-05-01 12:34:56.000 +00:00:00' 形式の場合あり
  // 安全に substring で日付部分だけ取り出す
  const parts = iso.split(' ');
  return parts[0] ?? iso;
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
  minWidth: 420,
  maxWidth: 520,
  maxHeight: '85vh',
  overflowY: 'auto',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
};
const headingStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 12,
  fontSize: '1rem',
};
const versionLineStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  color: '#333',
};
const dateStyle: React.CSSProperties = {
  color: '#888',
  fontSize: '0.8rem',
  marginLeft: 8,
};
const notesDetailsStyle: React.CSSProperties = {
  margin: '12px 0',
  border: '1px solid #ddd',
  borderRadius: 4,
};
const notesSummaryStyle: React.CSSProperties = {
  padding: '6px 12px',
  cursor: 'pointer',
  fontSize: '0.85rem',
  background: '#f5f5f5',
};
const notesPreStyle: React.CSSProperties = {
  margin: 0,
  padding: '8px 12px',
  fontSize: '0.8rem',
  color: '#444',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  maxHeight: 200,
  overflow: 'auto',
};
const hintStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  color: '#666',
  margin: '12px 0',
  padding: '8px 12px',
  background: '#fff8e0',
  borderLeft: '3px solid #f0a000',
};
const progressBoxStyle: React.CSSProperties = {
  margin: '12px 0',
};
const progressLabelStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#444',
  marginBottom: 4,
};
const progressBarOuterStyle: React.CSSProperties = {
  position: 'relative',
  height: 18,
  background: '#eee',
  borderRadius: 9,
  overflow: 'hidden',
};
const progressBarInnerStyle: React.CSSProperties = {
  height: '100%',
  background: '#0080ff',
  transition: 'width 0.2s ease-out',
};
const progressTextStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.75rem',
  fontWeight: 'bold',
  color: '#fff',
  textShadow: '0 0 2px rgba(0,0,0,0.4)',
};
const errorStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#c00',
  margin: '8px 0',
};
const buttonsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginTop: 16,
  justifyContent: 'flex-end',
};
const primaryButtonStyle: React.CSSProperties = {
  background: '#0080ff',
  color: '#fff',
  border: 'none',
  padding: '6px 12px',
  borderRadius: 4,
  cursor: 'pointer',
};
