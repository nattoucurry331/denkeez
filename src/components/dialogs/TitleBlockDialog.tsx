// Phase 3 F-14: 表題欄(タイトルブロック)編集ダイアログ。
// 標準6項目(工事名/図面名/縮尺[自動]/日付/作成者/会社名)+ 配置位置 + ON/OFF。
// 会社名・作成者は localStorage に記憶し、次回以降プリフィルする(手入力削減・3-F14e)。

import { useState, useEffect } from 'react';
import type { TitleBlockConfig, TitleBlockPosition } from '../../data/types';

const LS_COMPANY = 'denkeez.titleBlock.company';
const LS_AUTHOR = 'denkeez.titleBlock.author';

const POSITION_OPTIONS: { value: TitleBlockPosition; label: string }[] = [
  { value: 'bottom-right', label: '右下' },
  { value: 'top-right', label: '右上' },
  { value: 'bottom-left', label: '左下' },
  { value: 'top-left', label: '左上' },
];

interface Props {
  readonly open: boolean;
  /** 既存設定 (なければ undefined) */
  readonly current: TitleBlockConfig | undefined;
  /** 既定の工事名 (プロジェクト名) */
  readonly defaultProjectName: string;
  /** 今日の日付 (ISO yyyy-mm-dd)。テスト容易性のため呼び出し側から渡す */
  readonly today: string;
  readonly onSave: (config: TitleBlockConfig) => void;
  /** 表題欄を付けない (config を消す) */
  readonly onClear: () => void;
  readonly onCancel: () => void;
}

function readLs(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}
function writeLs(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* noop */
  }
}

export function TitleBlockDialog({
  open,
  current,
  defaultProjectName,
  today,
  onSave,
  onClear,
  onCancel,
}: Props): JSX.Element | null {
  const [position, setPosition] = useState<TitleBlockPosition>('bottom-right');
  const [projectName, setProjectName] = useState('');
  const [drawingName, setDrawingName] = useState('');
  const [date, setDate] = useState('');
  const [author, setAuthor] = useState('');
  const [company, setCompany] = useState('');

  useEffect(() => {
    if (!open) return;
    if (current) {
      setPosition(current.position);
      setProjectName(current.projectName);
      setDrawingName(current.drawingName);
      setDate(current.date);
      setAuthor(current.author);
      setCompany(current.company);
    } else {
      // 新規: プロジェクト名・今日の日付・前回の会社名/作成者をプリフィル
      setPosition('bottom-right');
      setProjectName(defaultProjectName);
      setDrawingName('');
      setDate(today);
      setAuthor(readLs(LS_AUTHOR));
      setCompany(readLs(LS_COMPANY));
    }
  }, [open, current, defaultProjectName, today]);

  if (!open) return null;

  const handleSave = (): void => {
    writeLs(LS_COMPANY, company.trim());
    writeLs(LS_AUTHOR, author.trim());
    onSave({
      enabled: true,
      position,
      projectName: projectName.trim(),
      drawingName: drawingName.trim(),
      date: date.trim(),
      author: author.trim(),
      company: company.trim(),
    });
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="title-block-title" style={overlayStyle}>
      <div style={modalStyle}>
        <h2 id="title-block-title" style={headingStyle}>
          表題欄(タイトル枠)
        </h2>
        <p style={noteStyle}>
          PDF 出力時に図面の隅に表題欄を載せます。縮尺は校正値から自動で入ります。
        </p>

        <div style={fieldStyle}>
          <label htmlFor="tb-pos" style={labelStyle}>配置位置</label>
          <select
            id="tb-pos"
            value={position}
            onChange={(e) => setPosition(e.target.value as TitleBlockPosition)}
            style={inputStyle}
          >
            {POSITION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <Field id="tb-project" label="工事名" value={projectName} onChange={setProjectName} placeholder="例: ○○邸 新築工事" />
        <Field id="tb-drawing" label="図面名" value={drawingName} onChange={setDrawingName} placeholder="例: 1階 電気設備図" />
        <Field id="tb-date" label="日付" value={date} onChange={setDate} placeholder="例: 2026-05-31" />
        <Field id="tb-author" label="作成者" value={author} onChange={setAuthor} placeholder="例: 山田太郎" />
        <Field id="tb-company" label="会社名" value={company} onChange={setCompany} placeholder="例: 有限会社 北嶺建設" />

        <div style={buttonsStyle}>
          <button type="button" onClick={onCancel} style={cancelBtnStyle}>キャンセル</button>
          <span style={{ flex: 1 }} />
          {current?.enabled && (
            <button type="button" onClick={onClear} style={secondaryBtnStyle} title="この図面の表題欄を外す">
              表題欄を外す
            </button>
          )}
          <button type="button" onClick={handleSave} style={primaryBtnStyle} autoFocus>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}): JSX.Element {
  return (
    <div style={fieldStyle}>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
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
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
};
const headingStyle: React.CSSProperties = { marginTop: 0, marginBottom: 6, fontSize: '1rem' };
const noteStyle: React.CSSProperties = { fontSize: '0.78rem', color: '#666', margin: '0 0 14px' };
const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  marginBottom: 10,
};
const labelStyle: React.CSSProperties = { fontSize: '0.78rem', color: '#444', fontWeight: 'bold' };
const inputStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  padding: '5px 7px',
  border: '1px solid #ccc',
  borderRadius: 3,
};
const buttonsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  marginTop: 8,
};
const primaryBtnStyle: React.CSSProperties = {
  background: '#0080ff',
  color: '#fff',
  border: 'none',
  padding: '6px 16px',
  borderRadius: 4,
  cursor: 'pointer',
};
const secondaryBtnStyle: React.CSSProperties = {
  background: '#fff',
  color: '#0080ff',
  border: '1px solid #0080ff',
  padding: '6px 14px',
  borderRadius: 4,
  cursor: 'pointer',
};
const cancelBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: '#666',
  border: '1px solid #ccc',
  padding: '6px 14px',
  borderRadius: 4,
  cursor: 'pointer',
};
