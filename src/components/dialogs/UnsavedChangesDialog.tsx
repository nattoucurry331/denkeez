// 未保存変更時の終了確認ダイアログ (CLAUDE.md L196 担保 / Plan §1, §3)。
// PoC では PoC 全体のスタイル設計が無いため、最小の inline style + role="dialog" で実装。
// Phase 2 で UI ライブラリ採用時に置き換える。

interface Props {
  readonly open: boolean;
  readonly onSave: () => void;
  readonly onDiscard: () => void;
  readonly onCancel: () => void;
}

export function UnsavedChangesDialog({
  open,
  onSave,
  onDiscard,
  onCancel,
}: Props): JSX.Element | null {
  if (!open) {
    return null;
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="unsaved-dialog-title" style={overlayStyle}>
      <div style={modalStyle}>
        <h2 id="unsaved-dialog-title" style={headingStyle}>
          未保存の変更があります
        </h2>
        <p>このまま閉じると、保存されていない変更が失われます。</p>
        <div style={buttonsStyle}>
          <button type="button" onClick={onSave} autoFocus>
            保存して閉じる
          </button>
          <button type="button" onClick={onDiscard}>
            保存せず閉じる
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
  minWidth: 360,
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
};
const headingStyle: React.CSSProperties = { marginTop: 0 };
const buttonsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginTop: 16,
  justifyContent: 'flex-end',
};
