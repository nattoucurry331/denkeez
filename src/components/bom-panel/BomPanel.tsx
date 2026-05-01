// 拾い出しパネル (Phase 2-E1 / REQUIREMENTS.md F-09)。
// RightPanel の下部に折りたたみ可能で常時表示される。
// 上部タブ (レイヤー / プロパティ) と独立して動作する。
//
// 折りたたみ時: ヘッダ 1 行のみ「拾い出し: シンボル N 個 / 配線 X.X m」
// 展開時: シンボル種別ごとの数量表 + 配線種別ごとの総長表

import { useMemo, useState } from 'react';
import { useProjectStore } from '../../data/project-store';
import { buildBomReport, type BomFilter } from '../../data/bom-aggregator';
import { getSymbolDefinition } from '../../symbols/symbol-registry';

const LS_KEY_EXPANDED = 'denkeez.bom.expanded';
const LS_KEY_VISIBLE_ONLY = 'denkeez.bom.visibleOnly';

function readBool(key: string, fallback: boolean): boolean {
  try {
    const v = window.localStorage.getItem(key);
    if (v === 'true') return true;
    if (v === 'false') return false;
    return fallback;
  } catch {
    return fallback;
  }
}

function writeBool(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, value ? 'true' : 'false');
  } catch {
    // noop (private mode 等)
  }
}

export function BomPanel(): JSX.Element {
  const symbols = useProjectStore((s) => s.project.symbols);
  const wires = useProjectStore((s) => s.project.wires) ?? [];
  const layers = useProjectStore((s) => s.project.layers);

  // localStorage から復元 (UI 状態なので永続化は OS レベルの便宜上)
  const [expanded, setExpanded] = useState<boolean>(() => readBool(LS_KEY_EXPANDED, false));
  const [visibleOnly, setVisibleOnly] = useState<boolean>(() =>
    readBool(LS_KEY_VISIBLE_ONLY, true),
  );

  const filter: BomFilter = { visibleOnly };
  const report = useMemo(
    () => buildBomReport(symbols, wires, layers, filter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [symbols, wires, layers, visibleOnly],
  );

  const handleToggleExpand = (): void => {
    const next = !expanded;
    setExpanded(next);
    writeBool(LS_KEY_EXPANDED, next);
  };

  const handleToggleVisibleOnly = (): void => {
    const next = !visibleOnly;
    setVisibleOnly(next);
    writeBool(LS_KEY_VISIBLE_ONLY, next);
  };

  const summaryText = `シンボル ${report.symbolTotal} 個 / 配線 ${(
    report.wireTotalMm / 1000
  ).toFixed(2)} m`;

  return (
    <section style={panelStyle} aria-label="拾い出し">
      <header
        style={headerStyle}
        onClick={handleToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggleExpand();
          }
        }}
        aria-expanded={expanded}
      >
        <span style={chevronStyle}>{expanded ? '▾' : '▸'}</span>
        <span style={titleStyle}>拾い出し</span>
        <span style={summaryStyle}>{summaryText}</span>
      </header>
      {expanded && (
        <div style={contentStyle}>
          <div style={filterRowStyle}>
            <label style={filterLabelStyle}>
              <input
                type="checkbox"
                checked={visibleOnly}
                onChange={handleToggleVisibleOnly}
              />
              可視レイヤーのみ集計
            </label>
            {visibleOnly && report.hiddenLayerCount > 0 && (
              <span style={hintStyle}>
                ({report.hiddenLayerCount} レイヤー除外中)
              </span>
            )}
          </div>

          <h3 style={sectionHeadingStyle}>
            シンボル <span style={totalChipStyle}>合計 {report.symbolTotal}</span>
          </h3>
          {report.symbolRows.length === 0 ? (
            <p style={emptyTextStyle}>
              {symbols.length === 0
                ? '配置されたシンボルがありません'
                : '対象レイヤーにシンボルがありません'}
            </p>
          ) : (
            <table style={tableStyle}>
              <tbody>
                {report.symbolRows.map((row) => {
                  const name = getSymbolDefinition(row.type)?.name ?? row.type;
                  return (
                    <tr key={`${row.type}|${row.spec}`}>
                      <td style={tdNameStyle}>
                        <span>{name}</span>
                        {row.spec && <span style={specStyle}>{row.spec}</span>}
                      </td>
                      <td style={tdCountStyle}>{row.count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <h3 style={sectionHeadingStyle}>
            配線{' '}
            <span style={totalChipStyle}>
              合計 {(report.wireTotalMm / 1000).toFixed(2)} m
            </span>
          </h3>
          {report.wireRows.length === 0 ? (
            <p style={emptyTextStyle}>
              {wires.length === 0
                ? '配線がありません'
                : '対象レイヤーに配線がありません'}
            </p>
          ) : (
            <table style={tableStyle}>
              <tbody>
                {report.wireRows.map((row) => (
                  <tr key={row.label}>
                    <td style={tdNameStyle}>{row.label}</td>
                    <td style={tdCountStyle}>
                      {(row.totalMm / 1000).toFixed(2)} m
                      <span style={countSuffixStyle}> ({row.count} 本)</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}

const panelStyle: React.CSSProperties = {
  borderTop: '1px solid #ccc',
  background: '#f5f5f5',
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  // 展開時に縦解像度を圧迫しすぎないよう最大高さを設定
  maxHeight: '50%',
  overflow: 'hidden',
};
const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  cursor: 'pointer',
  fontSize: '0.85rem',
  background: '#ececec',
  userSelect: 'none',
};
const chevronStyle: React.CSSProperties = {
  width: 12,
  color: '#666',
  fontSize: '0.8rem',
};
const titleStyle: React.CSSProperties = {
  fontWeight: 'bold',
  color: '#333',
};
const summaryStyle: React.CSSProperties = {
  marginLeft: 'auto',
  color: '#555',
  fontSize: '0.78rem',
};
const contentStyle: React.CSSProperties = {
  padding: '8px 10px',
  overflowY: 'auto',
};
const filterRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginBottom: 8,
  fontSize: '0.78rem',
};
const filterLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  cursor: 'pointer',
  color: '#444',
};
const hintStyle: React.CSSProperties = {
  color: '#888',
  fontSize: '0.72rem',
};
const sectionHeadingStyle: React.CSSProperties = {
  fontSize: '0.82rem',
  margin: '8px 0 4px 0',
  color: '#333',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};
const totalChipStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 'normal',
  color: '#0080ff',
  background: '#e0f0ff',
  padding: '1px 6px',
  borderRadius: 8,
};
const emptyTextStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  color: '#888',
  margin: '4px 0 8px 0',
};
const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.8rem',
};
const tdNameStyle: React.CSSProperties = {
  padding: '2px 4px',
  color: '#333',
  display: 'flex',
  alignItems: 'baseline',
  gap: 6,
  flexWrap: 'wrap',
};
const specStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  color: '#666',
  fontWeight: 'normal',
};
const tdCountStyle: React.CSSProperties = {
  padding: '2px 4px',
  textAlign: 'right',
  color: '#222',
  fontVariantNumeric: 'tabular-nums',
};
const countSuffixStyle: React.CSSProperties = {
  color: '#888',
  fontSize: '0.72rem',
  marginLeft: 4,
};
