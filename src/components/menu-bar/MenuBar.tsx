// 上部メニューバー (Plan §3 / REQUIREMENTS.md §6.1)。
// M1 では「ファイル → PDF を開く」と、M3 着手前のテスト用 dirty 切替ボタンのみ。
// M3 以降に「シンボル」「保存」「PDF 出力」等を順次追加。

import { useState } from 'react';
import { useProjectStore } from '../../data/project-store';
import { renderPdfPage } from '../../pdf/pdf-loader';
import { selectPdfFile, readBinaryFile, basename, ptToMm } from '../../tauri/api';

export function MenuBar(): JSX.Element {
  const loadPdf = useProjectStore((s) => s.loadPdf);
  const setDirty = useProjectStore((s) => s.setDirty);
  const dirty = useProjectStore((s) => s.dirty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenPdf = async (): Promise<void> => {
    setError(null);
    const path = await selectPdfFile();
    if (!path) {
      return;
    }
    setBusy(true);
    try {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <header style={menuBarStyle}>
      <button onClick={handleOpenPdf} disabled={busy} type="button">
        ファイル → PDF を開く
      </button>
      <button
        onClick={() => setDirty(!dirty)}
        type="button"
        title="M3 シンボル配置までの仮ボタン: dirty フラグを切り替えて未保存終了確認ダイアログをテスト"
      >
        (テスト) dirty: {dirty ? 'true' : 'false'} を切り替え
      </button>
      {busy && <span style={statusStyle}>読み込み中…</span>}
      {error && (
        <span style={errorStyle} role="alert">
          エラー: {error}
        </span>
      )}
    </header>
  );
}

const menuBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  padding: '8px 16px',
  borderBottom: '1px solid #ccc',
  background: '#f5f5f5',
};
const statusStyle: React.CSSProperties = { color: '#444', fontSize: '0.85rem' };
const errorStyle: React.CSSProperties = { color: '#c00', fontSize: '0.85rem' };
