// 上部メニューバー (Plan §3 / REQUIREMENTS.md §6.1)。
// M1: PDF を開く / M3 dirty テスト / M4: 新規・開く・保存 / M5: PDF 出力 + 90° 回転

import { useState, useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { useProjectStore } from '../../data/project-store';
import { deleteSelection } from '../../hooks/delete-selection';
import { renderPdfPage, type Rotation } from '../../pdf/pdf-loader';
import {
  selectPdfFileToSave,
  selectCsvFileToSave,
  selectJsonFileToSave,
  writeBinaryFile,
  askConfirm,
  basename,
  ptToMm,
} from '../../tauri/api';
import { performSave, performSaveAs } from './save-actions';
import { openPdfIntoStore, openProjectIntoStore } from '../../tauri/open-actions';
import { exportProjectAsPdf, suggestedExportName } from '../../export/pdf-exporter';
import { generateBomCsv, suggestedBomCsvName } from '../../export/csv-exporter';
import { generateBomJson, suggestedBomJsonName } from '../../export/json-exporter';
import { formatScaleRatio } from '../../utils/scale-ratio';
import {
  PdfExportDialog,
  type PdfExportSettings,
} from '../dialogs/PdfExportDialog';
import { AboutDialog } from '../dialogs/AboutDialog';
import { TitleBlockDialog } from '../dialogs/TitleBlockDialog';
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
  const selectedIds = useProjectStore((s) => s.selectedIds);
  const pdfTextItems = useProjectStore((s) => s.project.pdfTextItems);
  const enterTextMode = useProjectStore((s) => s.enterTextMode);
  const importPdfTextAsAnnotations = useProjectStore((s) => s.importPdfTextAsAnnotations);
  const enterPdfTextPickMode = useProjectStore((s) => s.enterPdfTextPickMode);
  const selectedPdfTextIds = useProjectStore((s) => s.selectedPdfTextIds);
  const newProject = useProjectStore((s) => s.newProject);
  const markSaved = useProjectStore((s) => s.markSaved);
  const setDirty = useProjectStore((s) => s.setDirty);
  const applyPdfRotation = useProjectStore((s) => s.applyPdfRotation);
  const removeSymbols = useProjectStore((s) => s.removeSymbols);
  const enterScaleMode = useProjectStore((s) => s.enterScaleMode);
  const enterMeasureMode = useProjectStore((s) => s.enterMeasureMode);
  const enterDimensionMode = useProjectStore((s) => s.enterDimensionMode);
  const setTitleBlock = useProjectStore((s) => s.setTitleBlock);
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
  const [titleBlockOpen, setTitleBlockOpen] = useState(false);

  // アンドゥ・リドゥ (zundo temporal の履歴を購読してボタン活性を制御)
  const canUndo = useStore(useProjectStore.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useProjectStore.temporal, (s) => s.futureStates.length > 0);
  const handleUndo = (): void => useProjectStore.temporal.getState().undo();
  const handleRedo = (): void => useProjectStore.temporal.getState().redo();

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
      const result = await openPdfIntoStore();
      if (result.opened) {
        setInfo(
          result.textItemCount > 0
            ? `PDF を開きました。文字 ${result.textItemCount} 件を「PDF文字」レイヤーに取り込みました`
            : 'PDF を開きました(抽出できる文字はありませんでした。画像のみの PDF の可能性があります)',
        );
      }
    });

  // F-18: PDF 文字を編集可能な注記として一括取り込み (アクティブレイヤーへ)
  const handleImportPdfText = (): void => {
    setError(null);
    setInfo(null);
    const items = pdfTextItems ?? [];
    if (items.length === 0) return;
    importPdfTextAsAnnotations(items.map((t) => t.id));
    setInfo(`PDF文字 ${items.length} 件を編集可能なテキスト注記に取り込みました`);
  };

  // F-18 個別取込: pick モードで選んだ PDF 文字だけを注記化して取り込む
  const handleImportSelectedPdfText = (): void => {
    setError(null);
    setInfo(null);
    const ids = selectedPdfTextIds;
    if (ids.length === 0) return;
    importPdfTextAsAnnotations(ids);
    exitMode(); // pick モード終了 + 選択クリア
    setInfo(`選択した PDF文字 ${ids.length} 件を取り込みました`);
  };

  // 発見性改善: 選択中オブジェクトの削除 (Delete キーと同じ処理を共有)
  const handleDelete = (): void => {
    void deleteSelection();
  };

  const handleOpenProject = (): Promise<void> =>
    wrap(async () => {
      await openProjectIntoStore(dirty);
    });

  const handleSave = (): Promise<void> =>
    wrap(async () => {
      const r = await performSave({ currentFilePath, project, markSaved });
      if (r.saved) setInfo(`保存しました: ${basename(r.path ?? '')}`);
    });

  const handleSaveAs = (): Promise<void> =>
    wrap(async () => {
      const r = await performSaveAs({ currentFilePath, project, markSaved });
      if (r.saved) setInfo(`保存しました: ${basename(r.path ?? '')}`);
    });

  // UI改修1: Ctrl+S = 上書き保存 / Ctrl+Shift+S = 名前を付けて保存。
  // 入力欄フォーカス中・ダイアログ表示中は発火させない(ブラウザ/ダイアログに委ねる)。
  const saveHotkeyRef = useRef({ handleSave, handleSaveAs, busy });
  saveHotkeyRef.current = { handleSave, handleSaveAs, busy };
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 's') return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]')) return; // 各種ダイアログ表示中は無効
      e.preventDefault();
      if (saveHotkeyRef.current.busy) return;
      if (e.shiftKey) void saveHotkeyRef.current.handleSaveAs();
      else void saveHotkeyRef.current.handleSave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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

  // PDF バイト列を生成 (保存・プレビューで共用)
  const buildPdfBytes = (settings: PdfExportSettings): Uint8Array => {
    if (!pdfCanvas || !project.drawing) {
      throw new Error('PDF 背景が読み込まれていません');
    }
    return exportProjectAsPdf({
      project,
      backgroundCanvas: pdfCanvas,
      layerIds: settings.layerIds,
      paperSize: settings.paperSize,
      orientation: settings.orientation,
      symbolTransparent,
      globalSizeScale,
      typeScales,
    });
  };

  // Phase 3 F-14d: 出力前プレビュー。PDF を blob URL 化して返す (ダイアログが iframe 表示)。
  const handlePreviewPdf = async (settings: PdfExportSettings): Promise<string | null> => {
    try {
      const bytes = buildPdfBytes(settings);
      const ab = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
      const blob = new Blob([ab], { type: 'application/pdf' });
      return URL.createObjectURL(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'プレビューの生成に失敗しました');
      return null;
    }
  };

  const handleConfirmPdfExport = (settings: PdfExportSettings): Promise<void> =>
    wrap(async () => {
      setPdfDialogOpen(false);
      const path = await selectPdfFileToSave(suggestedExportName(project));
      if (!path) return;
      const bytes = buildPdfBytes(settings);
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

  // Phase 3 F-21 / 3-I2: 拾い出し JSON 出力 (見積管理アプリへのファイル受け渡し I/F)。
  const handleExportJson = (): Promise<void> =>
    wrap(async () => {
      const visibleOnly = readBomVisibleOnlyFromLocalStorage();
      const drawingScale =
        project.drawing && pdfCanvas
          ? formatScaleRatio(project.drawing, pdfCanvas.width)
          : null;
      const json = generateBomJson(
        project.symbols,
        project.wires ?? [],
        project.layers,
        { visibleOnly },
        { siteName: project.meta.name, drawingScale },
      );
      const path = await selectJsonFileToSave(suggestedBomJsonName(project.meta.name));
      if (!path) return;
      await writeBinaryFile(path, new TextEncoder().encode(json));
      const filterDesc = visibleOnly ? '可視レイヤーのみ' : '全レイヤー';
      setInfo(`拾い出し JSON を出力しました: ${basename(path)} (${filterDesc})`);
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
      <div style={groupStyle}>
      <button onClick={handleNew} disabled={busy} type="button">
        新規
      </button>
      <button onClick={handleOpenProject} disabled={busy} type="button" title="保存した .dkz プロジェクトを開く">
        プロジェクトを開く
      </button>
      <button
        onClick={handleSave}
        disabled={busy || (!dirty && !!currentFilePath)}
        type="button"
        title="プロジェクトを保存 (Ctrl+S)"
        style={dirty ? primaryActionStyle : undefined}
      >
        保存{dirty ? ' *' : ''}
      </button>
      <button onClick={handleSaveAs} disabled={busy} type="button">
        名前を付けて保存
      </button>
      </div>
      <div style={groupStyle}>
      {/* 発見性改善: マウス操作で「元に戻す / やり直す / 削除」できるようボタン化 (F-06/F-11) */}
      <button
        onClick={handleUndo}
        disabled={busy || !canUndo}
        type="button"
        title="直前の操作を元に戻す (Ctrl+Z)"
        aria-label="元に戻す"
      >
        ↶ 元に戻す
      </button>
      <button
        onClick={handleRedo}
        disabled={busy || !canRedo}
        type="button"
        title="元に戻した操作をやり直す (Ctrl+Y)"
        aria-label="やり直し"
      >
        ↷ やり直す
      </button>
      <button
        onClick={handleDelete}
        disabled={busy || selectedIds.length === 0}
        type="button"
        title="選択中のシンボル・配線・寸法・文字を削除 (Delete キー)"
      >
        🗑 削除
      </button>
      </div>
      <div style={groupStyle}>
      <button onClick={handleOpenPdf} disabled={busy} type="button" title="元図面の PDF を開いて背景に読み込む">
        PDFを開く
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
      <button
        onClick={handleExportJson}
        disabled={busy}
        type="button"
        title="拾い出しを JSON で出力し、見積管理アプリに取り込む (種別・規格・数量・回路・縮尺)"
      >
        見積用 JSON 出力
      </button>
      <button
        onClick={() => setTitleBlockOpen(true)}
        disabled={busy || !pdfCanvas}
        type="button"
        title="図面の隅に表題欄(工事名・図面名・縮尺・日付・作成者・会社名)を付ける"
        style={project.titleBlock?.enabled ? activeButtonStyle : undefined}
      >
        表題欄{project.titleBlock?.enabled ? ' ✓' : ''}…
      </button>
      </div>
      <div style={groupStyle}>
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
        onClick={() => (mode.kind === 'measure' ? exitMode() : enterMeasureMode())}
        disabled={busy || !pdfCanvas}
        type="button"
        style={mode.kind === 'measure' ? activeButtonStyle : undefined}
        title="寸法を測る: 図面上の 2 点をクリックすると距離を表示 (校正済みなら実寸)"
      >
        {mode.kind === 'measure' ? '✓ 寸法計測中 (ESC で解除)' : '寸法を測る'}
      </button>
      <button
        onClick={() => (mode.kind === 'dimension' ? exitMode() : enterDimensionMode())}
        disabled={busy || !pdfCanvas}
        type="button"
        style={mode.kind === 'dimension' ? activeButtonStyle : undefined}
        title="寸法線を引く: 2 点をクリックすると図面に寸法線が残る (選択して移動・Delete で削除)"
      >
        {mode.kind === 'dimension' ? '✓ 寸法線モード (ESC で解除)' : '寸法線を引く'}
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
      <button
        onClick={() => (mode.kind === 'text' ? exitMode() : enterTextMode())}
        disabled={busy || !pdfCanvas}
        type="button"
        style={mode.kind === 'text' ? activeButtonStyle : undefined}
        title="文字モード: 図面上をクリックして文字を入力 (既存はダブルクリックで編集)"
      >
        {mode.kind === 'text' ? '✓ 文字モード (ESC で解除)' : '文字'}
      </button>
      {pdfTextItems && pdfTextItems.length > 0 && mode.kind !== 'pdf-text-pick' && (
        <>
          <button
            onClick={handleImportPdfText}
            disabled={busy}
            type="button"
            title="PDF から抽出した文字を、編集できるテキスト注記としてアクティブレイヤーに全件取り込む"
          >
            PDF文字を全取込 ({pdfTextItems.length})
          </button>
          <button
            onClick={() => enterPdfTextPickMode()}
            disabled={busy}
            type="button"
            title="PDF の文字を 1 つずつクリックして選び、必要な分だけ取り込む"
          >
            文字を選んで取込
          </button>
        </>
      )}
      {mode.kind === 'pdf-text-pick' && (
        <>
          <button
            onClick={handleImportSelectedPdfText}
            disabled={busy || selectedPdfTextIds.length === 0}
            type="button"
            style={activeButtonStyle}
            title="選択した PDF 文字を編集可能な注記として取り込む"
          >
            ✓ 選んだ文字を取込 ({selectedPdfTextIds.length})
          </button>
          <button onClick={() => exitMode()} disabled={busy} type="button" title="選択取込をやめる (ESC)">
            キャンセル
          </button>
        </>
      )}
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
      </div>
      <div style={groupStyle}>
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
      {import.meta.env.DEV && (
        <button
          onClick={() => setDirty(!dirty)}
          type="button"
          title="dirty フラグを切り替えて未保存終了確認ダイアログをテスト"
        >
          (テスト) dirty: {dirty ? 'true' : 'false'}
        </button>
      )}
      </div>
      <div style={rightClusterStyle}>
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
      </div>
      {project.drawing && (
        <PdfExportDialog
          open={pdfDialogOpen}
          layers={project.layers}
          drawingWidthMm={project.drawing.widthMm}
          drawingHeightMm={project.drawing.heightMm}
          onConfirm={(settings) => {
            void handleConfirmPdfExport(settings);
          }}
          onPreview={handlePreviewPdf}
          onCancel={() => setPdfDialogOpen(false)}
        />
      )}
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <TitleBlockDialog
        open={titleBlockOpen}
        current={project.titleBlock}
        defaultProjectName={project.meta.name}
        today={new Date().toISOString().slice(0, 10)}
        onSave={(config) => {
          setTitleBlock(config);
          setTitleBlockOpen(false);
          setInfo('表題欄を設定しました (PDF 出力に反映されます)');
        }}
        onClear={() => {
          setTitleBlock(undefined);
          setTitleBlockOpen(false);
          setInfo('表題欄を外しました');
        }}
        onCancel={() => setTitleBlockOpen(false)}
      />
    </header>
  );
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
  padding: '6px 12px',
  borderBottom: '1px solid #ccc',
  background: '#f5f5f5',
  flexWrap: 'wrap',
};
// UI改修3: 機能の島(ファイル/編集/図面・出力/作図/表示)。近接した関連ボタンを
// 薄い枠でまとめ、島単位で折り返す(島内の相対位置が安定)。
const groupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 6px',
  borderRadius: 6,
  background: '#e9e9e9',
};
// 右端クラスタ: ヘルプ・パス・更新通知・処理状況をまとめて右寄せ。
const rightClusterStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginLeft: 'auto',
};
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
// UI改修3: プライマリ強調は「保存(未保存時)」1 つだけに限定し、青の意味を
// 「アクティブ=活性モード(activeButtonStyle)」と衝突させない。
const primaryActionStyle: React.CSSProperties = {
  background: '#0080ff',
  color: '#fff',
  borderColor: '#0080ff',
  fontWeight: 'bold',
};
const updateBadgeStyle: React.CSSProperties = {
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
