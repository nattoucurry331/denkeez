// プロパティパネル内の個別フィールド (Phase 2-B2)。
// kind に応じて text/number/select/multiline の入力 UI を切り替える。

import type { PropertyFieldDef } from '../../symbols/property-schemas';
import type { PropertyValue } from '../../data/types';

interface Props {
  field: PropertyFieldDef;
  value: PropertyValue | undefined;
  onChange: (value: PropertyValue) => void;
}

export function PropertyField({ field, value, onChange }: Props): JSX.Element {
  const labelEl = (
    <label htmlFor={`prop-${field.key}`} style={labelStyle}>
      {field.label}
      {field.unit && <span style={unitStyle}>({field.unit})</span>}
    </label>
  );

  if (field.kind === 'multiline') {
    return (
      <div style={fieldStyle}>
        {labelEl}
        <textarea
          id={`prop-${field.key}`}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          style={textareaStyle}
          placeholder={field.placeholder}
        />
      </div>
    );
  }

  if (field.kind === 'number') {
    const numValue = typeof value === 'number' ? value : '';
    return (
      <div style={fieldStyle}>
        {labelEl}
        <input
          id={`prop-${field.key}`}
          type="number"
          value={numValue === '' ? '' : numValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') {
              // 空にした場合: 0 として扱うか、削除扱いか — ここでは空文字を文字列で渡す
              // (number kind なので空 = 未入力 = 0 で更新)
              onChange(0);
            } else {
              const n = Number(v);
              if (Number.isFinite(n)) onChange(n);
            }
          }}
          style={inputStyle}
          placeholder={field.placeholder}
        />
      </div>
    );
  }

  if (field.kind === 'select') {
    const opts = field.options ?? [];
    return (
      <div style={fieldStyle}>
        {labelEl}
        <select
          id={`prop-${field.key}`}
          value={typeof value === 'string' ? value : (opts[0] ?? '')}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        >
          {opts.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // text (default)
  return (
    <div style={fieldStyle}>
      {labelEl}
      <input
        id={`prop-${field.key}`}
        type="text"
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
        placeholder={field.placeholder}
      />
    </div>
  );
}

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
const unitStyle: React.CSSProperties = {
  marginLeft: 4,
  color: '#888',
  fontWeight: 'normal',
};
const inputStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  padding: '4px 6px',
  border: '1px solid #ccc',
  borderRadius: 3,
};
const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  fontFamily: 'inherit',
  resize: 'vertical',
};
