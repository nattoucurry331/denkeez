// 未選択時 / 複数選択時の PropertyPanel プレースホルダ (Phase 2-B2)。

interface Props {
  message: string;
  hint?: string;
}

export function EmptyPropertyPanel({ message, hint }: Props): JSX.Element {
  return (
    <aside style={panelStyle}>
      <h2 style={headingStyle}>プロパティ</h2>
      <p style={messageStyle}>{message}</p>
      {hint && <p style={hintStyle}>{hint}</p>}
    </aside>
  );
}

const panelStyle: React.CSSProperties = {
  width: 240,
  borderLeft: '1px solid #ccc',
  padding: '12px 12px',
  background: '#fafafa',
  overflowY: 'auto',
  flexShrink: 0,
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
