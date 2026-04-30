// ステータスバー (Phase 2-A2)。
// 拡大率と現在のカーソル mm 座標、グリッド設定を一覧表示する。
// REQUIREMENTS.md §6.1 の「ステータスバー (用紙/縮尺/グリッド/自動保存時刻)」に対応。

import { useProjectStore } from '../../data/project-store';
import { useViewportStore } from '../../data/viewport-store';
import { DEFAULT_GRID_CONFIG, GRID_SPACING_OPTIONS } from '../../data/types';

function computeScaleRatio(
  drawing: {
    widthMm: number;
    scale?: { pixelDistanceCanvas: number; realDistanceMm: number } | undefined;
  },
  canvasWidth: number,
): number | null {
  if (!drawing.scale || canvasWidth === 0 || drawing.widthMm === 0) return null;
  // 図面上 1mm = 紙面 mm/px = drawing.widthMm / canvasWidth
  // 実寸 1mm = scale.pixelDistanceCanvas / scale.realDistanceMm px
  // 縮尺 N = 実寸 mm / 紙面 mm
  const ratio =
    (drawing.scale.realDistanceMm * canvasWidth) /
    (drawing.scale.pixelDistanceCanvas * drawing.widthMm);
  return Math.round(ratio);
}

export function StatusBar(): JSX.Element {
  const viewportScale = useViewportStore((s) => s.scale);
  const cursorMm = useViewportStore((s) => s.cursorMm);
  const drawing = useProjectStore((s) => s.project.drawing);
  const pdfCanvas = useProjectStore((s) => s.pdfCanvas);
  const grid = useProjectStore((s) => s.project.grid) ?? DEFAULT_GRID_CONFIG;
  const toggleGrid = useProjectStore((s) => s.toggleGrid);
  const setGridSpacing = useProjectStore((s) => s.setGridSpacing);

  const scaleRatio =
    drawing && pdfCanvas ? computeScaleRatio(drawing, pdfCanvas.width) : null;

  return (
    <footer style={statusBarStyle}>
      <span style={cellStyle}>
        拡大率: <strong>{Math.round(viewportScale * 100)}%</strong>
      </span>
      <span style={separator}>|</span>
      <span style={cellStyle}>
        座標:{' '}
        <strong>
          {cursorMm ? `${cursorMm.x.toFixed(0)}, ${cursorMm.y.toFixed(0)} mm` : '---'}
        </strong>
      </span>
      <span style={separator}>|</span>
      <span style={cellStyle}>
        縮尺:{' '}
        <strong>{scaleRatio !== null ? `1/${scaleRatio}` : '紙面実寸 (校正なし)'}</strong>
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
        onChange={(e) => setGridSpacing(Number(e.target.value) as 910 | 455 | 100 | 50)}
        disabled={!grid.enabled}
        style={selectStyle}
        aria-label="グリッド間隔"
      >
        {GRID_SPACING_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt}mm
          </option>
        ))}
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
