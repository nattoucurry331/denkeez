// プロパティパネル (Phase 2-B2 / REQUIREMENTS.md F-10)。
// 単一選択時に種別固有のフィールドを表示し、編集を store に反映する。
// Phase 2-B では複数選択編集は未対応 (R-B9)。
// Phase 2-D2: RightPanel タブ内に格納されるためパネル外周スタイルを持たない。
//             所属レイヤー切替 UI を追加 (F-08)。

import { useProjectStore } from '../../data/project-store';
import { getSymbolDefinition } from '../../symbols/symbol-registry';
import { getPropertySchema } from '../../symbols/property-schemas';
import { PropertyField } from './PropertyField';
import { EmptyPropertyPanel } from './EmptyPropertyPanel';
import { WirePropertyForm } from './WirePropertyForm';
import { LayerSelector } from './LayerSelector';
import type { PropertyValue } from '../../data/types';

export function PropertyPanel(): JSX.Element {
  const selectedIds = useProjectStore((s) => s.selectedIds);
  const symbols = useProjectStore((s) => s.project.symbols);
  const wires = useProjectStore((s) => s.project.wires) ?? [];
  const updateSymbolProperties = useProjectStore((s) => s.updateSymbolProperties);

  if (selectedIds.length === 0) {
    return (
      <EmptyPropertyPanel
        message="未選択"
        hint="シンボルや配線をクリックすると、ここで詳細を編集できます。"
      />
    );
  }

  if (selectedIds.length > 1) {
    return (
      <EmptyPropertyPanel
        message={`${selectedIds.length} 個選択中`}
        hint="プロパティの編集は単一選択時のみ可能です。"
      />
    );
  }

  const selectedId = selectedIds[0];
  if (!selectedId) {
    return <EmptyPropertyPanel message="未選択" />;
  }

  const wire = wires.find((w) => w.id === selectedId);
  if (wire) {
    return <WirePropertyForm wire={wire} />;
  }

  const symbol = symbols.find((s) => s.id === selectedId);
  if (!symbol) {
    return <EmptyPropertyPanel message="選択されたエンティティが見つかりません" />;
  }

  const schema = getPropertySchema(symbol.type);
  const definition = getSymbolDefinition(symbol.type);

  const handleChange = (key: string, value: PropertyValue): void => {
    updateSymbolProperties(symbol.id, { ...symbol.properties, [key]: value });
  };

  return (
    <div style={containerStyle}>
      <h2 style={headingStyle}>プロパティ</h2>
      <div style={typeBoxStyle}>
        <span style={typeLabelStyle}>種別</span>
        <span style={typeNameStyle}>{definition?.name ?? symbol.type}</span>
      </div>
      <p style={mutedStyle}>位置: {symbol.position.x.toFixed(0)}, {symbol.position.y.toFixed(0)} mm</p>
      <hr style={hrStyle} />
      <LayerSelector kind="symbol" currentLayerId={symbol.layerId} entityId={symbol.id} />
      <hr style={hrStyle} />
      {schema.length === 0 ? (
        <p style={mutedStyle}>このシンボルには編集可能なプロパティがありません。</p>
      ) : (
        schema.map((field) => (
          <PropertyField
            key={field.key}
            field={field}
            value={symbol.properties[field.key]}
            onChange={(v) => handleChange(field.key, v)}
          />
        ))
      )}
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
const typeBoxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 8,
  padding: '6px 8px',
  background: '#e0f0ff',
  borderRadius: 4,
};
const typeLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#0080ff',
};
const typeNameStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  color: '#003070',
  fontWeight: 'bold',
};
const mutedStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#888',
  marginTop: 4,
  marginBottom: 4,
};
const hrStyle: React.CSSProperties = {
  border: 'none',
  borderTop: '1px solid #ddd',
  margin: '8px 0',
};
