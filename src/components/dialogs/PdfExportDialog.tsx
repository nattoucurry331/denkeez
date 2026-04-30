// Phase 2-E3b: F-14 PDF 出力ダイアログ。
// 用紙サイズ・向き・出力レイヤー選択をユーザーに提示し、
// 確定で exportProjectAsPdf に渡すオプションを返す。
//
// REQUIREMENTS §3.2 F-14:
//   - 用紙サイズ: A4 / A3 / A2 / A1
//   - 向き: 縦 / 横
//   - 出力レイヤーを選択可能
//   (- 余白・タイトル枠・印刷プレビューは Phase 3 へ送り)

import { useState, useEffect, useMemo } from 'react';
import type { Layer } from '../../data/types';
import type { PaperSize, PageOrientation } from '../../export/pdf-exporter';
import { computePageLayout } from '../../export/pdf-exporter';

export interface PdfExportSettings {
  paperSize: PaperSize;
  orientation: PageOrientation;
  layerIds: string[];
}

interface Props {
  readonly open: boolean;
  readonly layers: readonly Layer[];
  /** 図面実寸 (プレビュー文字列で使用) */
  readonly drawingWidthMm: number;
  readonly drawingHeightMm: number;
  readonly onConfirm: (settings: PdfExportSettings) => void;
  readonly onCancel: () => void;
}

const PAPER_SIZE_OPTIONS: { value: PaperSize; label: string }[] = [
  { value: 'auto', label: '自動 (図面実寸)' },
  { value: 'A4', label: 'A4 (210×297mm)' },
  { value: 'A3', label: 'A3 (297×420mm)' },
  { value: 'A2', label: 'A2 (420×594mm)' },
  { value: 'A1', label: 'A1 (594×841mm)' },
];

const ORIENTATION_OPTIONS: { value: PageOrientation; label: string }[] = [
  { value: 'auto', label: '自動 (図面の縦横比)' },
  { value: 'portrait', label: '縦' },
  { value: 'landscape', label: '横' },
];

export function PdfExportDialog({
  open,
  layers,
  drawingWidthMm,
  drawingHeightMm,
  onConfirm,
  onCancel,
}: Props): JSX.Element | null {
  const [paperSize, setPaperSize] = useState<PaperSize>('auto');
  const [orientation, setOrientation] = useState<PageOrientation>('auto');
  // 初期チェック状態は visible: true のレイヤーのみ
  const [checkedIds, setCheckedIds] = useState<ReadonlySet<string>>(
    () => new Set(layers.filter((l) => l.visible).map((l) => l.id)),
  );

  // open のたびに layers の visible 状態に合わせて再初期化
  useEffect(() => {
    if (open) {
      setCheckedIds(new Set(layers.filter((l) => l.visible).map((l) => l.id)));
    }
  }, [open, layers]);

  // プレビュー: 用紙サイズと向きから実際の寸法・スケールを計算
  const layout = useMemo(
    () => computePageLayout(drawingWidthMm, drawingHeightMm, paperSize, orientation),
    [drawingWidthMm, drawingHeightMm, paperSize, orientation],
  );
  const scalePercent = (layout.scale * 100).toFixed(1);

  if (!open) return null;

  const toggleLayer = (id: string): void => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = (): void => {
    onConfirm({
      paperSize,
      orientation,
      layerIds: [...checkedIds],
    });
  };

  // 表示順は LayerPanel と同じ最上層 → 元図面 (= 配列の逆順)
  const displayedLayers = [...layers].reverse();

  const checkedCount = checkedIds.size;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="pdf-export-title" style={overlayStyle}>
      <div style={modalStyle}>
        <h2 id="pdf-export-title" style={headingStyle}>
          PDF 出力設定
        </h2>

        <div style={fieldGroupStyle}>
          <label style={labelStyle} htmlFor="paper-size">
            用紙サイズ
          </label>
          <select
            id="paper-size"
            value={paperSize}
            onChange={(e) => setPaperSize(e.target.value as PaperSize)}
            style={selectStyle}
          >
            {PAPER_SIZE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div style={fieldGroupStyle}>
          <label style={labelStyle} htmlFor="orientation">
            向き
          </label>
          <select
            id="orientation"
            value={orientation}
            onChange={(e) => setOrientation(e.target.value as PageOrientation)}
            style={selectStyle}
          >
            {ORIENTATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <p style={previewStyle}>
          出力寸法: <strong>{layout.pageWidthMm.toFixed(0)} × {layout.pageHeightMm.toFixed(0)} mm</strong>
          {' '}/ 縮尺: <strong>{scalePercent}%</strong>
          {layout.scale < 0.999 && (
            <span style={hintStyle}> (図面が用紙に収まるよう縮小されます)</span>
          )}
        </p>

        <hr style={hrStyle} />

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>出力レイヤー ({checkedCount}/{layers.length})</label>
          <div style={layerListStyle}>
            {displayedLayers.map((layer) => (
              <label key={layer.id} style={layerItemStyle}>
                <input
                  type="checkbox"
                  checked={checkedIds.has(layer.id)}
                  onChange={() => toggleLayer(layer.id)}
                />
                <span
                  style={{
                    ...colorChipStyle,
                    background: layer.color,
                    opacity: layer.visible ? 1 : 0.4,
                  }}
                />
                <span style={layer.visible ? undefined : { color: '#999' }}>
                  {layer.name}
                  {layer.kind === 'background' && (
                    <span style={badgeStyle}> [背景]</span>
                  )}
                  {!layer.visible && <span style={badgeStyle}> 非表示</span>}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div style={buttonsStyle}>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={checkedCount === 0}
            autoFocus
            style={primaryButtonStyle}
            title={checkedCount === 0 ? '少なくとも 1 つのレイヤーを選んでください' : undefined}
          >
            出力先を選択して保存
          </button>
          <button type="button" onClick={onCancel}>
            キャンセル
          </button>
        </div>
      </div>
    </div>
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
  minWidth: 420,
  maxWidth: 520,
  maxHeight: '85vh',
  overflowY: 'auto',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
};
const headingStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 12,
  fontSize: '1rem',
};
const fieldGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginBottom: 12,
};
const labelStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 'bold',
  color: '#444',
};
const selectStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  padding: '4px 6px',
  border: '1px solid #ccc',
  borderRadius: 3,
};
const previewStyle: React.CSSProperties = {
  fontSize: '0.82rem',
  color: '#444',
  margin: '4px 0 8px 0',
  padding: '6px 10px',
  background: '#f0f7ff',
  borderRadius: 4,
};
const hintStyle: React.CSSProperties = {
  color: '#0080ff',
};
const hrStyle: React.CSSProperties = {
  border: 'none',
  borderTop: '1px solid #ddd',
  margin: '12px 0',
};
const layerListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  maxHeight: 200,
  overflowY: 'auto',
  padding: 4,
  border: '1px solid #ddd',
  borderRadius: 3,
};
const layerItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '2px 4px',
  fontSize: '0.85rem',
  cursor: 'pointer',
};
const colorChipStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: 2,
  border: '1px solid #ccc',
  flexShrink: 0,
};
const badgeStyle: React.CSSProperties = {
  marginLeft: 6,
  fontSize: '0.72rem',
  color: '#888',
};
const buttonsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginTop: 16,
  justifyContent: 'flex-end',
};
const primaryButtonStyle: React.CSSProperties = {
  background: '#0080ff',
  color: '#fff',
  border: 'none',
  padding: '6px 12px',
  borderRadius: 4,
  cursor: 'pointer',
};
