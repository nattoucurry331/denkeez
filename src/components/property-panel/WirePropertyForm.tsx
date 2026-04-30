// 配線 (Wire) 用のプロパティ編集フォーム (Phase 2-C3 / REQUIREMENTS.md F-10)。
// 種別 / ケーブル / 回路番号 / 配線長 / 所属レイヤー を表示・編集する。
// Phase 2-D2: RightPanel タブ内に格納されるためパネル外周スタイルを持たない。

import { useProjectStore } from '../../data/project-store';
import { WIRE_TYPE_OPTIONS, CABLE_TYPE_OPTIONS } from '../../data/types';
import type { Wire, WireType, CableType } from '../../data/types';
import { LayerSelector } from './LayerSelector';

interface Props {
  wire: Wire;
}

export function WirePropertyForm({ wire }: Props): JSX.Element {
  const updateWire = useProjectStore((s) => s.updateWire);

  return (
    <div style={containerStyle}>
      <h2 style={headingStyle}>配線プロパティ</h2>
      <div style={typeBoxStyle}>
        <span style={typeLabelStyle}>配線</span>
        <span style={typeNameStyle}>
          {WIRE_TYPE_OPTIONS.find((o) => o.value === wire.type)?.label ?? wire.type}
        </span>
      </div>

      <LayerSelector kind="wire" currentLayerId={wire.layerId} entityId={wire.id} />

      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="wire-type">配線種別</label>
        <select
          id="wire-type"
          value={wire.type}
          onChange={(e) => updateWire(wire.id, { type: e.target.value as WireType })}
          style={inputStyle}
        >
          {WIRE_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="wire-cable">ケーブル</label>
        <select
          id="wire-cable"
          value={wire.cable}
          onChange={(e) => updateWire(wire.id, { cable: e.target.value as CableType })}
          style={inputStyle}
        >
          {CABLE_TYPE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      {wire.cable === 'その他' && (
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="wire-cable-custom">ケーブル名 (自由入力)</label>
          <input
            id="wire-cable-custom"
            type="text"
            value={wire.cableCustom ?? ''}
            onChange={(e) => updateWire(wire.id, { cableCustom: e.target.value })}
            style={inputStyle}
            placeholder="例: VVF1.6×3C"
          />
        </div>
      )}

      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="wire-circuit">回路番号</label>
        <input
          id="wire-circuit"
          type="text"
          value={wire.circuit}
          onChange={(e) => updateWire(wire.id, { circuit: e.target.value })}
          style={inputStyle}
          placeholder="L-1"
        />
      </div>

      <hr style={hrStyle} />
      <p style={lengthStyle}>
        配線長: <strong>{wire.lengthMm.toFixed(0)} mm</strong> (
        {(wire.lengthMm / 1000).toFixed(2)} m)
      </p>
      <p style={mutedStyle}>
        中継点 {wire.waypoints.length} 個 / 端点 2 個
      </p>
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
  background: '#fff0e0',
  borderRadius: 4,
  marginBottom: 8,
};
const typeLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#cc6600',
};
const typeNameStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#663300',
  fontWeight: 'bold',
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
const inputStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  padding: '4px 6px',
  border: '1px solid #ccc',
  borderRadius: 3,
};
const hrStyle: React.CSSProperties = {
  border: 'none',
  borderTop: '1px solid #ddd',
  margin: '8px 0',
};
const lengthStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#222',
  marginTop: 4,
  marginBottom: 4,
};
const mutedStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#888',
};
