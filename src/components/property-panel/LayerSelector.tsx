// 選択中の symbol / wire の所属レイヤーを切り替える select (Phase 2-D2 / F-08)。
// PropertyPanel と WirePropertyForm の両方から再利用する。

import { useProjectStore } from '../../data/project-store';

interface Props {
  /** 'symbol' | 'wire' — どちらの move action を呼ぶか */
  kind: 'symbol' | 'wire';
  /** 現在の所属レイヤー ID (selected entity の layerId) */
  currentLayerId: string;
  /** 対象 entity の ID */
  entityId: string;
}

export function LayerSelector({ kind, currentLayerId, entityId }: Props): JSX.Element {
  const layers = useProjectStore((s) => s.project.layers);
  const moveSymbolsToLayer = useProjectStore((s) => s.moveSymbolsToLayer);
  const moveWiresToLayer = useProjectStore((s) => s.moveWiresToLayer);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const next = e.target.value;
    if (next === currentLayerId) return;
    if (kind === 'symbol') {
      moveSymbolsToLayer([entityId], next);
    } else {
      moveWiresToLayer([entityId], next);
    }
  };

  return (
    <div style={fieldStyle}>
      <label htmlFor="layer-selector" style={labelStyle}>
        所属レイヤー
      </label>
      <select
        id="layer-selector"
        value={currentLayerId}
        onChange={handleChange}
        style={selectStyle}
      >
        {layers.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
            {l.kind === 'background' ? ' [背景]' : ''}
          </option>
        ))}
      </select>
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
const selectStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  padding: '4px 6px',
  border: '1px solid #ccc',
  borderRadius: 3,
};
