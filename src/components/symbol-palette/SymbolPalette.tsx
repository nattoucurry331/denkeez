// 左パレット (Plan §3 / REQUIREMENTS.md §3.2 F-05)。
// シンボル種別をクリックして配置モードに入る。再クリック or ESC で解除。

import { useProjectStore } from '../../data/project-store';
import { listSymbolDefinitions } from '../../symbols/symbol-registry';

export function SymbolPalette(): JSX.Element {
  const mode = useProjectStore((s) => s.mode);
  const enterPlaceMode = useProjectStore((s) => s.enterPlaceMode);
  const exitMode = useProjectStore((s) => s.exitMode);
  const definitions = listSymbolDefinitions();

  return (
    <aside style={paletteStyle}>
      <h2 style={headingStyle}>シンボル</h2>
      <ul style={listStyle}>
        {definitions.map((def) => {
          const active = mode.kind === 'place' && mode.symbolType === def.id;
          return (
            <li key={def.id}>
              <button
                type="button"
                onClick={() => (active ? exitMode() : enterPlaceMode(def.id))}
                style={{ ...buttonStyle, ...(active ? activeButtonStyle : {}) }}
                title={def.description}
              >
                {def.name}
              </button>
            </li>
          );
        })}
      </ul>
      {mode.kind === 'place' ? (
        <p style={hintStyle}>キャンバスをクリックで配置 / ESC で解除</p>
      ) : (
        <p style={hintMutedStyle}>シンボルを選んで配置開始</p>
      )}
    </aside>
  );
}

const paletteStyle: React.CSSProperties = {
  width: 200,
  borderRight: '1px solid #ccc',
  padding: '12px 8px',
  background: '#fafafa',
  overflowY: 'auto',
  flexShrink: 0,
};
const headingStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  margin: '0 0 8px 4px',
  color: '#333',
};
const listStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};
const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  textAlign: 'left',
  cursor: 'pointer',
  background: '#fff',
  border: '1px solid #ccc',
  borderRadius: 4,
};
const activeButtonStyle: React.CSSProperties = {
  background: '#e0f0ff',
  borderColor: '#0080ff',
  fontWeight: 'bold',
};
const hintStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#0080ff',
  marginTop: 12,
};
const hintMutedStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#888',
  marginTop: 12,
};
