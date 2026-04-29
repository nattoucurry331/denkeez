// 上部メニューバー (Plan §3 / REQUIREMENTS.md §6.1)。
// M1: PDF を開く / M3 dirty テスト / M4: 新規・開く・保存・名前を付けて保存 / M5: PDF 出力

import { useState } from 'react';
import { useProjectStore } from '../../data/project-store';
import { renderPdfPage } from '../../pdf/pdf-loader';
import {
  selectPdfFile,
  selectProjectFileToOpen,
  selectProjectFileToSave,
  selectPdfFileToSave,
  readBinaryFile,
  readProjectFile,
  writeProjectFile,
  writeBinaryFile,
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
  const loadPdf = useProjectStore((s) => s.loadPdf);
  const loadProject = useProjectStore((s) => s.loadProject);
  const newProject = useProjectStore((s) => s.newProject);
  const markSaved = useProjectStore((s) => s.markSaved);
  const setDirty = useProjectStore((s) => s.setDirty);
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

  const handleNew = (): void => {
    if (
      dirty &&
      !window.confirm('未保存の変更があります。新規プロジェクトを開始すると失われます。続行しますか?')
    ) {
      return;
    }
    newProject();
    setError(null);
    setInfo(null);
  };

  const handleOpenPdf = (): Promise<void> =>
    wrap(async () => {
      const path = await selectPdfFile();
      if (!path) return;
      const buffer = await readBinaryFile(path);
      const rendered = await renderPdfPage(buffer, 1, 2.0);
      loadPdf(
        basename(path),
        {
          selectedPage: 1,
          widthMm: ptToMm(rendered.widthPt),
          heightMm: ptToMm(rendered.heightPt),
        },
        rendered.canvas,
      );
    });

  const handleOpenProject = (): Promise<void> =>
    wrap(async () => {
      if (
        dirty &&
        !window.confirm('未保存の変更があります。別ファイルを開くと失われます。続行しますか?')
      ) {
        return;
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
      <button onClick={handleExportPdf} disabled={busy || !pdfCanvas} type="button">
        PDF 出力
      </button>
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
