// 左パレット (Plan §3 / REQUIREMENTS.md §3.2 F-05)。
// Phase 2-B1: 20 種を 5 カテゴリ (照明・スイッチ・コンセント・弱電・その他) で
// 折りたたみ表示。再クリック or ESC で配置モード解除。
// Phase 2-H: ユーザー定義プリセット欄を組み込み 20 種の上に表示。
//   プリセットからの配置は properties / textOverride / scaleOverride を引き継ぐ。

import { useState } from 'react';
import { useProjectStore } from '../../data/project-store';
import { usePresetStore } from '../../data/preset-store';
import {
  CATEGORY_ORDER,
  listByCategory,
} from '../../symbols/symbol-registry';
import type { SymbolCategory, SymbolPreset } from '../../data/types';
import { PresetEditorDialog } from '../dialogs/PresetEditorDialog';

export function SymbolPalette(): JSX.Element {
  const mode = useProjectStore((s) => s.mode);
  const enterPlaceMode = useProjectStore((s) => s.enterPlaceMode);
  const exitMode = useProjectStore((s) => s.exitMode);

  const presets = usePresetStore((s) => s.presets);
  const addPreset = usePresetStore((s) => s.addPreset);
  const updatePreset = usePresetStore((s) => s.updatePreset);
  const removePreset = usePresetStore((s) => s.removePreset);

  // カテゴリ折りたたみの開閉状態 (初期: 全開)
  const [expanded, setExpanded] = useState<Record<SymbolCategory, boolean>>({
    lighting: true,
    switch: true,
    outlet: true,
    'low-voltage': true,
    other: true,
  });
  const [presetExpanded, setPresetExpanded] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<SymbolPreset | null>(null);

  const toggleCategory = (cat: SymbolCategory): void =>
    setExpanded((prev) => ({ ...prev, [cat]: !prev[cat] }));

  const placePreset = (preset: SymbolPreset): void => {
    const presetInfo: import('../../data/project-store').PlacePresetInfo = {
      presetId: preset.id,
      defaultProperties: preset.defaultProperties,
    };
    if (preset.textOverride !== undefined) presetInfo.textOverride = preset.textOverride;
    if (preset.scaleOverride !== undefined) presetInfo.scaleOverride = preset.scaleOverride;
    enterPlaceMode(preset.baseType, presetInfo);
  };

  const isPresetActive = (preset: SymbolPreset): boolean =>
    mode.kind === 'place' && mode.preset?.presetId === preset.id;

  const openEditorNew = (): void => {
    setEditingPreset(null);
    setEditorOpen(true);
  };
  const openEditorEdit = (preset: SymbolPreset): void => {
    setEditingPreset(preset);
    setEditorOpen(true);
  };
  const handleSave = (
    input: Omit<SymbolPreset, 'id'>,
    editingId: string | null,
  ): void => {
    if (editingId) {
      updatePreset(editingId, input);
    } else {
      addPreset(input);
    }
    setEditorOpen(false);
  };
  const handleDelete = (id: string): void => {
    removePreset(id);
    setEditorOpen(false);
    if (mode.kind === 'place' && mode.preset?.presetId === id) {
      exitMode();
    }
  };

  return (
    <aside style={paletteStyle}>
      <h2 style={headingStyle}>シンボル</h2>

      {/* Phase 2-H: プリセット欄 (組み込み 20 種の上に常時表示) */}
      <section style={categoryStyle}>
        <button
          type="button"
          onClick={() => setPresetExpanded((v) => !v)}
          style={categoryHeaderStyle}
          aria-expanded={presetExpanded}
        >
          <span>{presetExpanded ? '▾' : '▸'}</span>
          <span>プリセット</span>
          <span style={countStyle}>({presets.length})</span>
        </button>
        {presetExpanded && (
          <ul style={listStyle}>
            {presets.length === 0 ? (
              <li style={emptyPresetTextStyle}>
                よく使う規格 (LED 7W φ100 等) を保存
              </li>
            ) : (
              presets.map((p) => {
                const active = isPresetActive(p);
                return (
                  <li key={p.id} style={presetItemStyle}>
                    <button
                      type="button"
                      onClick={() => (active ? exitMode() : placePreset(p))}
                      style={{
                        ...presetButtonStyle,
                        ...(active ? activeButtonStyle : {}),
                      }}
                      title={`${p.displayName} を配置`}
                    >
                      {p.displayName}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditorEdit(p)}
                      style={presetEditIconStyle}
                      title="編集"
                      aria-label={`${p.displayName} を編集`}
                    >
                      ✎
                    </button>
                  </li>
                );
              })
            )}
            <li>
              <button type="button" onClick={openEditorNew} style={addPresetButtonStyle}>
                + プリセット作成
              </button>
            </li>
          </ul>
        )}
      </section>

      {/* 組み込み 20 種 */}
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
                  const active =
                    mode.kind === 'place' &&
                    mode.symbolType === def.id &&
                    mode.preset === undefined;
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

      <PresetEditorDialog
        open={editorOpen}
        editing={editingPreset}
        onSave={handleSave}
        {...(editingPreset ? { onDelete: handleDelete } : {})}
        onCancel={() => setEditorOpen(false)}
      />
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
const presetItemStyle: React.CSSProperties = {
  display: 'flex',
  gap: 2,
  alignItems: 'center',
};
const presetButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '4px 8px 4px 20px',
  textAlign: 'left',
  cursor: 'pointer',
  background: '#fffaf0',
  border: '1px solid #ddc090',
  borderRadius: 3,
  fontSize: '0.82rem',
};
const presetEditIconStyle: React.CSSProperties = {
  width: 22,
  padding: '2px 0',
  cursor: 'pointer',
  background: '#fff',
  border: '1px solid #ddd',
  borderRadius: 3,
  fontSize: '0.85rem',
};
const addPresetButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 8px',
  textAlign: 'center',
  cursor: 'pointer',
  background: 'transparent',
  border: '1px dashed #aaa',
  borderRadius: 3,
  fontSize: '0.78rem',
  color: '#666',
  marginTop: 2,
};
const emptyPresetTextStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  color: '#888',
  padding: '4px 8px',
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
