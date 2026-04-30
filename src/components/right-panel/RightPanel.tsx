// 右側パネルのコンテナ (Phase 2-D2 / Phase 2-E1)。
// 上部: レイヤー / プロパティ の 2 タブ排他切替 (Q4 仕様)。
// 下部: 拾い出しパネル — 折りたたみ可能で常時サマリ表示 (REQUIREMENTS §3.2 F-09 / §6.1)。

import { useState } from 'react';
import { LayerPanel } from '../layer-panel/LayerPanel';
import { PropertyPanel } from '../property-panel/PropertyPanel';
import { BomPanel } from '../bom-panel/BomPanel';

type Tab = 'layers' | 'properties';

export function RightPanel(): JSX.Element {
  const [tab, setTab] = useState<Tab>('properties');

  return (
    <aside style={panelStyle}>
      <div style={tabBarStyle} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'layers'}
          onClick={() => setTab('layers')}
          style={tab === 'layers' ? activeTabStyle : tabStyle}
        >
          レイヤー
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'properties'}
          onClick={() => setTab('properties')}
          style={tab === 'properties' ? activeTabStyle : tabStyle}
        >
          プロパティ
        </button>
      </div>
      <div style={contentStyle}>
        {tab === 'layers' ? <LayerPanel /> : <PropertyPanel />}
      </div>
      <BomPanel />
    </aside>
  );
}

const panelStyle: React.CSSProperties = {
  width: 260,
  borderLeft: '1px solid #ccc',
  background: '#fafafa',
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
};
const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid #ccc',
  background: '#f0f0f0',
};
const tabStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px 12px',
  fontSize: '0.85rem',
  background: 'transparent',
  border: 'none',
  borderBottom: '2px solid transparent',
  cursor: 'pointer',
  color: '#666',
};
const activeTabStyle: React.CSSProperties = {
  ...tabStyle,
  background: '#fff',
  borderBottom: '2px solid #0080ff',
  color: '#0080ff',
  fontWeight: 'bold',
};
const contentStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
};
