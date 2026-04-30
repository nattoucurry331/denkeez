// 左パレット (Plan §3 / REQUIREMENTS.md §3.2 F-05)。
// Phase 2-B1: 20 種を 5 カテゴリ (照明・スイッチ・コンセント・弱電・その他) で
// 折りたたみ表示。再クリック or ESC で配置モード解除。

import { useState } from 'react';
import { useProjectStore } from '../../data/project-store';
import {
  CATEGORY_ORDER,
  listByCategory,
} from '../../symbols/symbol-registry';
import type { SymbolCategory } from '../../data/types';

export function SymbolPalette(): JSX.Element {
  const mode = useProjectStore((s) => s.mode);
  const enterPlaceMode = useProjectStore((s) => s.enterPlaceMode);
  const exitMode = useProjectStore((s) => s.exitMode);

  // カテゴリ折りたたみの開閉状態 (初期: 全開)
  const [expanded, setExpanded] = useState<Record<SymbolCategory, boolean>>({
    lighting: true,
    switch: true,
    outlet: true,
    'low-voltage': true,
    other: true,
  });

  const toggleCategory = (cat: SymbolCategory): void =>
    setExpanded((prev) => ({ ...prev, [cat]: !prev[cat] }));

  return (
    <aside style={paletteStyle}>
      <h2 style={headingStyle}>シンボル</h2>
      {CATEGORY_ORDER.map(({ id: catId, label }) => {
        const items = listByCategory(catId);
        const isOpen = expanded[catId];
        return (
          <section key={catId} style={categoryStyle}>
            <button
              type="button"
              onClick={() => toggleCategory(catId)}
              style={categoryHeaderStyle}
              aria-expanded={isOpen}
            >
              <span>{isOpen ? '▾' : '▸'}</span>
              <span>{label}</span>
              <span style={countStyle}>({items.length})</span>
            </button>
            {isOpen && (
              <ul style={listStyle}>
                {items.map((def) => {
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
            )}
          </section>
        );
      })}
      {mode.kind === 'place' ? (
        <p style={hintStyle}>キャンバスをクリックで配置 / ESC で解除</p>
      ) : (
        <p style={hintMutedStyle}>シンボルを選んで配置開始</p>
      )}
    </aside>
  );
}

const paletteStyle: React.CSSProperties = {
  width: 220,
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
const categoryStyle: React.CSSProperties = {
  marginBottom: 8,
};
const categoryHeaderStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 6px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.85rem',
  color: '#444',
  textAlign: 'left',
  fontWeight: 'bold',
};
const countStyle: React.CSSProperties = {
  marginLeft: 'auto',
  color: '#888',
  fontSize: '0.75rem',
  fontWeight: 'normal',
};
const listStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: '4px 0 0 0',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};
const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 8px 4px 20px',
  textAlign: 'left',
  cursor: 'pointer',
  background: '#fff',
  border: '1px solid #ddd',
  borderRadius: 3,
  fontSize: '0.82rem',
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
