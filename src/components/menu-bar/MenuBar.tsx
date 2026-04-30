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

  const handleExportPdf = (): Promise<void> =>
    wrap(async () => {
      if (!pdfCanvas || !project.drawing) {
        throw new Error('先に「ファイル → PDF を開く」で図面を読み込んでください');
      }
      const path = await selectPdfFileToSave(suggestedExportName(project));
      if (!path) return;
      const bytes = exportProjectAsPdf({
        project,
        backgroundCanvas: pdfCanvas,
      });
      await writeBinaryFile(path, bytes);
      setInfo(`PDF を出力しました: ${basename(path)}`);
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
      <button onClick={handleExportPdf} disabled={busy || !pdfCanvas} type="button">
        PDF 出力
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
        onClick={() => setDirty(!dirty)}
        type="button"
        title="dirty フラグを切り替えて未保存終了確認ダイアログをテスト"
      >
        (テスト) dirty: {dirty ? 'true' : 'false'}
      </button>
      {currentFilePath && (
        <span style={pathStyle} title={currentFilePath}>
          {basename(currentFilePath)}
        </span>
      )}
      {busy && <span style={statusStyle}>処理中…</span>}
      {info && <span style={infoStyle}>{info}</span>}
      {error && (
        <span style={errorStyle} role="alert">
          エラー: {error}
        </span>
      )}
    </header>
  );
}

function suggestedName(name: string): string {
  const safe = name.trim() === '' ? 'untitled' : name;
  return `${safe}.dkz`;
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
