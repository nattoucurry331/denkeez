// 右側パネルのタブ切替コンテナ (Phase 2-D2 / Q4 仕様)。
// レイヤー / プロパティ の 2 タブを提供し、縦解像度を圧迫しないよう排他表示にする。

import { useState } from 'react';
import { LayerPanel } from '../layer-panel/LayerPanel';
import { PropertyPanel } from '../property-panel/PropertyPanel';

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
};
