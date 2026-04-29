// ステータスバー (Phase 2-A2)。
// 拡大率と現在のカーソル mm 座標、グリッド設定を一覧表示する。
// REQUIREMENTS.md §6.1 の「ステータスバー (用紙/縮尺/グリッド/自動保存時刻)」に対応。

import { useProjectStore } from '../../data/project-store';
import { useViewportStore } from '../../data/viewport-store';
import { DEFAULT_GRID_CONFIG } from '../../data/types';

export function StatusBar(): JSX.Element {
  const scale = useViewportStore((s) => s.scale);
  const cursorMm = useViewportStore((s) => s.cursorMm);
  const grid = useProjectStore((s) => s.project.grid) ?? DEFAULT_GRID_CONFIG;
  const toggleGrid = useProjectStore((s) => s.toggleGrid);
  const setGridSpacing = useProjectStore((s) => s.setGridSpacing);

  return (
    <footer style={statusBarStyle}>
      <span style={cellStyle}>
        拡大率: <strong>{Math.round(scale * 100)}%</strong>
      </span>
      <span style={separator}>|</span>
      <span style={cellStyle}>
        座標:{' '}
        <strong>
          {cursorMm ? `${cursorMm.x.toFixed(0)}, ${cursorMm.y.toFixed(0)} mm` : '---'}
        </strong>
      </span>
      <span style={separator}>|</span>
      <label style={cellStyle}>
        <input
          type="checkbox"
          checked={grid.enabled}
          onChange={() => toggleGrid()}
          style={{ marginRight: 4 }}
        />
        グリッド
      </label>
      <select
        value={grid.spacingMm}
        onChange={(e) => setGridSpacing(Number(e.target.value) as 910 | 455)}
        disabled={!grid.enabled}
        style={selectStyle}
        aria-label="グリッド間隔"
      >
        <option value={910}>910mm</option>
        <option value={455}>455mm</option>
      </select>
    </footer>
  );
}

const statusBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  alignItems: 'center',
  padding: '4px 12px',
  borderTop: '1px solid #ccc',
  background: '#f5f5f5',
  fontSize: '0.8rem',
  color: '#444',
};
const cellStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 2,
};
const separator: React.CSSProperties = { color: '#aaa', margin: '0 4px' };
const selectStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  padding: '0 4px',
};
