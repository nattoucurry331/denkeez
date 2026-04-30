// 未選択時 / 複数選択時の PropertyPanel プレースホルダ (Phase 2-B2)。
// Phase 2-D2: RightPanel タブ内に格納されるため、パネル外周のスタイルは持たない。

interface Props {
  message: string;
  hint?: string;
}

export function EmptyPropertyPanel({ message, hint }: Props): JSX.Element {
  return (
    <div style={containerStyle}>
      <h2 style={headingStyle}>プロパティ</h2>
      <p style={messageStyle}>{message}</p>
      {hint && <p style={hintStyle}>{hint}</p>}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  padding: '12px 12px',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
};
const headingStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  margin: '0 0 8px 0',
  color: '#333',
};
const messageStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#666',
  marginTop: 8,
};
const hintStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#999',
  marginTop: 6,
};
