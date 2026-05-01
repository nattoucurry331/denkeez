// Phase 2-H: シンボルプリセット作成・編集ダイアログ。
// シンボルパレット下部の「+ プリセット作成」または既存プリセット「編集」から開く。
//
// ベース種別を選び、規格 (W数・型番・径など) と表示テキスト・サイズを入力すると
// パレットに表示されるカスタムプリセットができる。

import { useState, useEffect, useMemo } from 'react';
import { Stage, Layer, Group } from 'react-konva';
import { listSymbolDefinitions, getSymbolDefinition } from '../../symbols/symbol-registry';
import type { SymbolShape } from '../../symbols/symbol-registry';
import { getPropertySchema } from '../../symbols/property-schemas';
import { SymbolShapeRenderer } from '../../canvas/symbol-shape';
import { PropertyField } from '../property-panel/PropertyField';
import type { SymbolPreset, SymbolType, PropertyValue } from '../../data/types';
import { SIZE_SCALE_MIN, SIZE_SCALE_MAX } from '../../data/render-settings-store';

interface Props {
  readonly open: boolean;
  /** 編集対象 (新規作成時は null) */
  readonly editing: SymbolPreset | null;
  readonly onSave: (input: Omit<SymbolPreset, 'id'>, editingId: string | null) => void;
  readonly onDelete?: (id: string) => void;
  readonly onCancel: () => void;
}

const PREVIEW_SCALE = 12; // プレビュー Stage 内の pxPerMm (大きく見せるための拡大)

export function PresetEditorDialog({
  open,
  editing,
  onSave,
  onDelete,
  onCancel,
}: Props): JSX.Element | null {
  const allDefs = useMemo(() => listSymbolDefinitions(), []);
  const [baseType, setBaseType] = useState<SymbolType>(
    editing?.baseType ?? allDefs[0]!.id,
  );
  const [displayName, setDisplayName] = useState(editing?.displayName ?? '');
  const [properties, setProperties] = useState<Record<string, PropertyValue>>(
    editing?.defaultProperties ?? {},
  );
  const [textOverride, setTextOverride] = useState(editing?.textOverride ?? '');
  const [scaleOverride, setScaleOverride] = useState(editing?.scaleOverride ?? 1.0);

  // open 切替時に editing 内容で初期化
  useEffect(() => {
    if (!open) return;
    setBaseType(editing?.baseType ?? allDefs[0]!.id);
    setDisplayName(editing?.displayName ?? '');
    setProperties(editing?.defaultProperties ?? {});
    setTextOverride(editing?.textOverride ?? '');
    setScaleOverride(editing?.scaleOverride ?? 1.0);
  }, [open, editing, allDefs]);

  if (!open) return null;

  const def = getSymbolDefinition(baseType);
  const propertySchema = getPropertySchema(baseType);

  const handleSave = (): void => {
    const trimmed = displayName.trim();
    if (trimmed === '') return; // 空名前は弾く (button disabled で表示)
    const input: Omit<SymbolPreset, 'id'> = {
      baseType,
      displayName: trimmed,
      defaultProperties: properties,
    };
    if (textOverride.trim() !== '') input.textOverride = textOverride;
    if (scaleOverride !== 1.0) input.scaleOverride = scaleOverride;
    onSave(input, editing?.id ?? null);
  };

  const handlePropertyChange = (key: string, value: PropertyValue): void => {
    setProperties((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="preset-title" style={overlayStyle}>
      <div style={modalStyle}>
        <h2 id="preset-title" style={headingStyle}>
          {editing ? 'プリセット編集' : '+ プリセット作成'}
        </h2>

        <div style={twoColumnStyle}>
          {/* 左: 設定フォーム */}
          <div style={formColumnStyle}>
            <div style={fieldStyle}>
              <label htmlFor="preset-base-type" style={labelStyle}>ベース種別</label>
              <select
                id="preset-base-type"
                value={baseType}
                onChange={(e) => setBaseType(e.target.value as SymbolType)}
                style={inputStyle}
              >
                {allDefs.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div style={fieldStyle}>
              <label htmlFor="preset-display-name" style={labelStyle}>
                表示名 <span style={requiredStyle}>*</span>
              </label>
              <input
                id="preset-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={`例: ${def?.name ?? ''} LED 7W φ100`}
                style={inputStyle}
              />
            </div>

            <div style={fieldStyle}>
              <label htmlFor="preset-text" style={labelStyle}>表示テキスト (上書き)</label>
              <input
                id="preset-text"
                type="text"
                value={textOverride}
                onChange={(e) => setTextOverride(e.target.value)}
                placeholder={`空欄なら既定 (${'text' in (def?.shape ?? {}) ? (def?.shape as { text: string }).text : '無し'})`}
                maxLength={6}
                style={inputStyle}
              />
              <span style={hintStyle}>例: 「100」「150」(径違いを区別する短い文字列)</span>
            </div>

            <div style={fieldStyle}>
              <label htmlFor="preset-scale" style={labelStyle}>サイズ倍率</label>
              <input
                id="preset-scale"
                type="number"
                min={SIZE_SCALE_MIN}
                max={SIZE_SCALE_MAX}
                step={0.1}
                value={scaleOverride}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) setScaleOverride(v);
                }}
                style={inputStyle}
              />
            </div>

            <hr style={hrStyle} />

            <p style={sectionLabelStyle}>規格 (集計時に区別される)</p>
            {propertySchema.length === 0 ? (
              <p style={emptyTextStyle}>このシンボルには規格項目がありません</p>
            ) : (
              propertySchema.map((field) => (
                <PropertyField
                  key={field.key}
                  field={field}
                  value={properties[field.key]}
                  onChange={(v) => handlePropertyChange(field.key, v)}
                />
              ))
            )}
          </div>

          {/* 右: プレビュー */}
          <div style={previewColumnStyle}>
            <p style={sectionLabelStyle}>プレビュー</p>
            <div style={previewBoxStyle}>
              {def && (
                <Stage width={140} height={140}>
                  <Layer>
                    <PreviewSymbol
                      shape={def.shape}
                      textOverride={textOverride.trim() === '' ? undefined : textOverride}
                      scaleOverride={scaleOverride}
                    />
                  </Layer>
                </Stage>
              )}
            </div>
            <p style={previewHintStyle}>
              実際のサイズは図面の縮尺やグローバル倍率に応じて調整されます
            </p>
          </div>
        </div>

        <div style={buttonsStyle}>
          {editing && onDelete && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`「${editing.displayName}」を削除します。よろしいですか?`)) {
                  onDelete(editing.id);
                }
              }}
              style={dangerButtonStyle}
            >
              削除
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button
            type="button"
            onClick={handleSave}
            disabled={displayName.trim() === ''}
            style={primaryButtonStyle}
            autoFocus
          >
            {editing ? '保存' : '作成'}
          </button>
          <button type="button" onClick={onCancel}>
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}

/** プレビュー用: 既存 SymbolShapeRenderer を Stage 中央に配置 */
function PreviewSymbol({
  shape,
  textOverride,
  scaleOverride,
}: {
  shape: SymbolShape;
  textOverride: string | undefined;
  scaleOverride: number;
}): JSX.Element {
  // SymbolShapeRenderer の出力は (0,0) を中心に描画する Konva ノード群なので、
  // Group で 140×140 Stage の中央 (70,70) にトランスレート。
  return (
    <Group x={70} y={70}>
      <SymbolShapeRenderer
        shape={shape}
        scale={{ pxPerMm: PREVIEW_SCALE * scaleOverride }}
        textOverride={textOverride}
      />
    </Group>
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
  minWidth: 600,
  maxWidth: 720,
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
};
const headingStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 12,
  fontSize: '1rem',
};
const twoColumnStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 200px',
  gap: 16,
};
const formColumnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};
const previewColumnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};
const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  marginBottom: 8,
};
const labelStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  color: '#444',
  fontWeight: 'bold',
};
const requiredStyle: React.CSSProperties = {
  color: '#cc4444',
};
const inputStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  padding: '4px 6px',
  border: '1px solid #ccc',
  borderRadius: 3,
};
const hintStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: '#888',
};
const hrStyle: React.CSSProperties = {
  border: 'none',
  borderTop: '1px solid #ddd',
  margin: '8px 0',
};
const sectionLabelStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  fontWeight: 'bold',
  color: '#444',
  margin: '4px 0',
};
const emptyTextStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  color: '#888',
};
const previewBoxStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  borderRadius: 4,
  background: '#f5f5f5',
  width: 140,
  height: 140,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
const previewHintStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: '#888',
  margin: 0,
};
const buttonsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginTop: 16,
  alignItems: 'center',
};
const primaryButtonStyle: React.CSSProperties = {
  background: '#0080ff',
  color: '#fff',
  border: 'none',
  padding: '6px 16px',
  borderRadius: 4,
  cursor: 'pointer',
};
const dangerButtonStyle: React.CSSProperties = {
  background: '#cc4444',
  color: '#fff',
  border: 'none',
  padding: '6px 12px',
  borderRadius: 4,
  cursor: 'pointer',
};
