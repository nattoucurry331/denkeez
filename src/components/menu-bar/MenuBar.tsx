// 上部メニューバー (Plan §3 / REQUIREMENTS.md §6.1)。
// M1: PDF を開く / M3 dirty テスト / M4: 新規・開く・保存 / M5: PDF 出力 + 90° 回転

import { useState } from 'react';
import { useProjectStore } from '../../data/project-store';
import { renderPdfPage, type Rotation } from '../../pdf/pdf-loader';
import {
  selectPdfFile,
  selectProjectFileToOpen,
  selectProjectFileToSave,
  selectPdfFileToSave,
  selectCsvFileToSave,
  readBinaryFile,
  readProjectFile,
  writeProjectFile,
  writeBinaryFile,
  askConfirm,
  basename,
  ptToMm,
} from '../../tauri/api';
import { serializeProject, deserializeProject } from '../../data/project-io';
import { exportProjectAsPdf, suggestedExportName } from '../../export/pdf-exporter';
import { generateBomCsv, suggestedBomCsvName } from '../../export/csv-exporter';
import {
  PdfExportDialog,
  type PdfExportSettings,
} from '../dialogs/PdfExportDialog';
import { AboutDialog } from '../dialogs/AboutDialog';
import { useUpdaterStore } from '../../data/updater-store';
import { useRenderSettingsStore } from '../../data/render-settings-store';

export function MenuBar(): JSX.Element {
  const project = useProjectStore((s) => s.project);
  const dirty = useProjectStore((s) => s.dirty);
  const currentFilePath = useProjectStore((s) => s.currentFilePath);
  const pdfCanvas = useProjectStore((s) => s.pdfCanvas);
  const pdfBuffer = useProjectStore((s) => s.pdfBuffer);
  const pdfRotation = useProjectStore((s) => s.pdfRotation);
  const mode = useProjectStore((s) => s.mode);
  const loadPdf = useProjectStore((s) => s.loadPdf);
  const loadProject = useProjectStore((s) => s.loadProject);
  const newProject = useProjectStore((s) => s.newProject);
  const markSaved = useProjectStore((s) => s.markSaved);
  const setDirty = useProjectStore((s) => s.setDirty);
  const applyPdfRotation = useProjectStore((s) => s.applyPdfRotation);
  const removeSymbols = useProjectStore((s) => s.removeSymbols);
  const enterScaleMode = useProjectStore((s) => s.enterScaleMode);
  const exitMode = useProjectStore((s) => s.exitMode);
  const setScale = useProjectStore((s) => s.setScale);
  const enterWireMode = useProjectStore((s) => s.enterWireMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Phase 2-E3b: PDF 出力ダイアログ
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);

  // Phase 2-F3: 自動更新通知
  const updateAvailable = useUpdaterStore((s) => s.available);
  const updateInfo = useUpdaterStore((s) => s.info);
  const openUpdateDialog = useUpdaterStore((s) => s.openDialog);

  // Phase 2-G1: シンボル背景の透過/不透過 トグル
  const symbolTransparent = useRenderSettingsStore((s) => s.symbolTransparent);
  const toggleSymbolTransparent = useRenderSettingsStore((s) => s.toggleSymbolTransparent);

  // Phase 2-G3a: シンボルサイズ倍率
  const globalSizeScale = useRenderSettingsStore((s) => s.globalSizeScale);
  const setGlobalSizeScale = useRenderSettingsStore((s) => s.setGlobalSizeScale);
  const typeScales = useRenderSettingsStore((s) => s.typeScales);

  // Phase 2-G2: About / 免責ダイアログ
  const [aboutOpen, setAboutOpen] = useState(false);

  const wrap = async (fn: () => Promise<void>): Promise<void> => {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleNew = (): Promise<void> =>
    wrap(async () => {
      if (dirty) {
        const ok = await askConfirm(
          '未保存の変更があります。新規プロジェクトを開始すると失われます。続行しますか?',
          '新規プロジェクト',
        );
        if (!ok) return;
      }
      newProject();
    });

  const handleOpenPdf = (): Promise<void> =>
    wrap(async () => {
      const path = await selectPdfFile();
      if (!path) return;
      const buffer = await readBinaryFile(path);
      const rendered = await renderPdfPage(buffer, 1, 2.0, 0);
      loadPdf(
        basename(path),
        {
          selectedPage: 1,
          widthMm: ptToMm(rendered.widthPt),
          heightMm: ptToMm(rendered.heightPt),
        },
        rendered.canvas,
        buffer,
      );
    });

  const handleOpenProject = (): Promise<void> =>
    wrap(async () => {
      if (dirty) {
        const ok = await askConfirm(
          '未保存の変更があります。別ファイルを開くと失われます。続行しますか?',
          'プロジェクトを開く',
        );
        if (!ok) return;
      }
      const path = await selectProjectFileToOpen();
      if (!path) return;
      const json = await readProjectFile(path);
      const loaded = deserializeProject(json);
      loadProject(path, loaded);
    });

  const handleSave = (): Promise<void> =>
    wrap(async () => {
      const targetPath =
        currentFilePath ?? (await selectProjectFileToSave(suggestedName(project.meta.name)));
      if (!targetPath) return;
      await writeProjectFile(targetPath, serializeProject(project));
      markSaved(targetPath);
    });

  const handleSaveAs = (): Promise<void> =>
    wrap(async () => {
      const targetPath = await selectProjectFileToSave(suggestedName(project.meta.name));
      if (!targetPath) return;
      await writeProjectFile(targetPath, serializeProject(project));
      markSaved(targetPath);
    });

  // Phase 2-E3b: 「PDF 出力」ボタン → 設定ダイアログ → 確定 → ファイル保存
  const handleOpenPdfDialog = (): void => {
    setError(null);
    setInfo(null);
    if (!pdfCanvas || !project.drawing) {
      setError('先に「ファイル → PDF を開く」で図面を読み込んでください');
      return;
    }
    setPdfDialogOpen(true);
  };

  const handleConfirmPdfExport = (settings: PdfExportSettings): Promise<void> =>
    wrap(async () => {
      setPdfDialogOpen(false);
      if (!pdfCanvas || !project.drawing) {
        throw new Error('PDF 背景が読み込まれていません');
      }
      const path = await selectPdfFileToSave(suggestedExportName(project));
      if (!path) return;
      const bytes = exportProjectAsPdf({
        project,
        backgroundCanvas: pdfCanvas,
        layerIds: settings.layerIds,
        paperSize: settings.paperSize,
        orientation: settings.orientation,
        symbolTransparent,
        globalSizeScale,
        typeScales,
      });
      await writeBinaryFile(path, bytes);
      setInfo(`PDF を出力しました: ${basename(path)}`);
    });

  // Phase 2-E2: 拾い出し CSV 出力 (F-15)。
  // BomPanel と同じ「可視レイヤーのみ」設定 (localStorage) を踏襲して集計。
  const handleExportCsv = (): Promise<void> =>
    wrap(async () => {
      const visibleOnly = readBomVisibleOnlyFromLocalStorage();
      const csv = generateBomCsv(
        project.symbols,
        project.wires ?? [],
        project.layers,
        { visibleOnly },
      );
      const path = await selectCsvFileToSave(suggestedBomCsvName(project.meta.name));
      if (!path) return;
      // UTF-8 BOM が文字列に含まれているのでバイナリ書き込みでそのまま保存
      await writeBinaryFile(path, new TextEncoder().encode(csv));
      const filterDesc = visibleOnly ? '可視レイヤーのみ' : '全レイヤー';
      setInfo(`拾い出し CSV を出力しました: ${basename(path)} (${filterDesc})`);
    });

  const handleRotatePdf = (): Promise<void> =>
    wrap(async () => {
      if (!pdfBuffer || !project.drawing) {
        throw new Error('先に「ファイル → PDF を開く」で図面を読み込んでください');
      }
      const symbolCount = project.symbols.length;
      if (symbolCount > 0) {
        const ok = await askConfirm(
          `配置済みシンボル ${symbolCount} 個 は座標系が変わるため削除されます。続行しますか?`,
          'PDF 90° 回転',
        );
        if (!ok) return;
      }
      const next = ((pdfRotation + 90) % 360) as Rotation;
      const rendered = await renderPdfPage(pdfBuffer, project.drawing.selectedPage, 2.0, next);
      if (symbolCount > 0) {
        removeSymbols(project.symbols.map((s) => s.id));
      }
      applyPdfRotation(next, rendered.canvas, ptToMm(rendered.widthPt), ptToMm(rendered.heightPt));
      setDirty(symbolCount > 0);
      setInfo(`PDF を ${next}° に回転しました`);
    });

  return (
    <header style={menuBarStyle}>
      <button onClick={handleNew} disabled={busy} type="button">
        新規
      </button>
      <button onClick={handleOpenProject} disabled={busy} type="button">
        開く
      </button>
      <button onClick={handleSave} disabled={busy || (!dirty && !!currentFilePath)} type="button">
        保存{dirty ? ' *' : ''}
      </button>
      <button onClick={handleSaveAs} disabled={busy} type="button">
        名前を付けて保存
      </button>
      <span style={separatorStyle}>|</span>
      <button onClick={handleOpenPdf} disabled={busy} type="button">
        ファイル → PDF を開く
      </button>
      <button
        onClick={handleRotatePdf}
        disabled={busy || !pdfBuffer}
        type="button"
        title={pdfBuffer ? `現在 ${pdfRotation}°、押すと +90°` : 'PDF を読み込むと有効'}
      >
        PDF 90° 回転
      </button>
      <button onClick={handleOpenPdfDialog} disabled={busy || !pdfCanvas} type="button">
        PDF 出力…
      </button>
      <button
        onClick={handleExportCsv}
        disabled={busy}
        type="button"
        title="シンボル種別と配線種別ごとに集計し CSV ファイルとして保存 (BomPanel のフィルタ設定を踏襲)"
      >
        拾い出し CSV 出力
      </button>
      <span style={separatorStyle}>|</span>
      <button
        onClick={() => (mode.kind === 'scale' ? exitMode() : enterScaleMode())}
        disabled={busy || !pdfCanvas}
        type="button"
        style={mode.kind === 'scale' ? activeButtonStyle : undefined}
        title="図面上の 2 点をクリックして実寸を入力 (F-04)"
      >
        {mode.kind === 'scale' ? '✓ スケール設定中 (ESC で解除)' : 'スケール設定'}
      </button>
      <button
        onClick={() => (mode.kind === 'wire' ? exitMode() : enterWireMode())}
        disabled={busy || !pdfCanvas}
        type="button"
        style={mode.kind === 'wire' ? activeButtonStyle : undefined}
        title="配線モード: シンボル → 中継点 → シンボル の順にクリック"
      >
        {mode.kind === 'wire' ? '✓ 配線モード (ESC で解除)' : '配線'}
      </button>
      {project.drawing?.scale && (
        <button
          onClick={() =>
            wrap(async () => {
              const ok = await askConfirm(
                'スケール校正を解除しますか? 紙面実寸モードに戻ります。',
                'スケール解除',
              );
              if (ok) setScale(undefined);
            })
          }
          disabled={busy}
          type="button"
          title="スケール校正を解除して紙面実寸モードに戻す"
        >
          スケール解除
        </button>
      )}
      <span style={separatorStyle}>|</span>
      <button
        onClick={toggleSymbolTransparent}
        type="button"
        style={symbolTransparent ? activeButtonStyle : undefined}
        title="ON: シンボルの白塗り背景を透過にして PDF 図面を透けて見せる (黒丸スイッチは除く)"
      >
        {symbolTransparent ? '✓ シンボル透過' : 'シンボル不透過'}
      </button>
      <label
        style={sizeScaleLabelStyle}
        title="全シンボル一律のサイズ倍率 (0.5〜3.0、種別/個別倍率に重ねて作用)"
      >
        サイズ ×
        <input
          type="number"
          min={0.5}
          max={3.0}
          step={0.1}
          value={globalSizeScale}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) setGlobalSizeScale(v);
          }}
          style={sizeScaleInputStyle}
          aria-label="シンボルサイズ倍率"
        />
      </label>
      <button
        onClick={() => setDirty(!dirty)}
        type="button"
        title="dirty フラグを切り替えて未保存終了確認ダイアログをテスト"
      >
        (テスト) dirty: {dirty ? 'true' : 'false'}
      </button>
      <button
        onClick={() => setAboutOpen(true)}
        type="button"
        title="バージョン情報・ライセンス・免責事項・連絡先"
        style={helpButtonStyle}
      >
        ヘルプ
      </button>
      {currentFilePath && (
        <span style={pathStyle} title={currentFilePath}>
          {basename(currentFilePath)}
        </span>
      )}
      {updateAvailable && updateInfo && (
        <button
          type="button"
          onClick={openUpdateDialog}
          style={updateBadgeStyle}
          title={`新しいバージョン ${updateInfo.version} があります — クリックで更新`}
        >
          🔔 更新があります (v{updateInfo.version})
        </button>
      )}
      {busy && <span style={statusStyle}>処理中…</span>}
      {info && <span style={infoStyle}>{info}</span>}
      {error && (
        <span style={errorStyle} role="alert">
          エラー: {error}
        </span>
      )}
      {project.drawing && (
        <PdfExportDialog
          open={pdfDialogOpen}
          layers={project.layers}
          drawingWidthMm={project.drawing.widthMm}
          drawingHeightMm={project.drawing.heightMm}
          onConfirm={(settings) => {
            void handleConfirmPdfExport(settings);
          }}
          onCancel={() => setPdfDialogOpen(false)}
        />
      )}
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </header>
  );
}

function suggestedName(name: string): string {
  const safe = name.trim() === '' ? 'untitled' : name;
  return `${safe}.dkz`;
}

// BomPanel と同じキーを参照 (UI 状態の便宜的な永続化)。
function readBomVisibleOnlyFromLocalStorage(): boolean {
  try {
    const v = window.localStorage.getItem('denkeez.bom.visibleOnly');
    if (v === 'false') return false;
    return true; // 未設定 / 'true' / その他 → デフォルト ON
  } catch {
    return true;
  }
}

const menuBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  padding: '8px 16px',
  borderBottom: '1px solid #ccc',
  background: '#f5f5f5',
  flexWrap: 'wrap',
};
const separatorStyle: React.CSSProperties = { color: '#aaa', margin: '0 4px' };
const pathStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: '#666',
  marginLeft: 8,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: 240,
};
const statusStyle: React.CSSProperties = { color: '#444', fontSize: '0.85rem' };
const infoStyle: React.CSSProperties = { color: '#0a7000', fontSize: '0.85rem' };
const errorStyle: React.CSSProperties = { color: '#c00', fontSize: '0.85rem' };
const activeButtonStyle: React.CSSProperties = {
  background: '#e0f0ff',
  borderColor: '#0080ff',
  fontWeight: 'bold',
};
const updateBadgeStyle: React.CSSProperties = {
  marginLeft: 'auto',
  padding: '4px 10px',
  background: '#fff8e0',
  border: '1px solid #f0a000',
  borderRadius: 16,
  fontSize: '0.82rem',
  color: '#5a4400',
  cursor: 'pointer',
  fontWeight: 'bold',
};
const helpButtonStyle: React.CSSProperties = {
  background: '#f5f5f5',
};
const sizeScaleLabelStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: '0.82rem',
  color: '#444',
};
const sizeScaleInputStyle: React.CSSProperties = {
  width: 50,
  fontSize: '0.85rem',
  padding: '2px 4px',
  border: '1px solid #ccc',
  borderRadius: 3,
  fontVariantNumeric: 'tabular-nums',
};
