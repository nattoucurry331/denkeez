// Phase 2-J1: PDF / プロジェクトを開く一連の処理を共有化。
// MenuBar とウェルカム空状態 (CanvasArea) の両方から呼べるよう、
// UI state (busy/error) を持たない純粋なフロー関数として切り出す。
// loadPdf / loadProject 等の store アクションは getState() 経由で取得する。

import { useProjectStore } from '../data/project-store';
import { renderPdfPage } from '../pdf/pdf-loader';
import { deserializeProject } from '../data/project-io';
import {
  selectPdfFile,
  selectProjectFileToOpen,
  readBinaryFile,
  readProjectFile,
  askConfirm,
  basename,
  ptToMm,
} from './api';

/**
 * PDF ファイル選択 → 1 ページ目をレンダー → store に反映。
 * @returns 実際に読み込んだら true、キャンセルなら false
 */
export async function openPdfIntoStore(): Promise<boolean> {
  const path = await selectPdfFile();
  if (!path) return false;
  const buffer = await readBinaryFile(path);
  const rendered = await renderPdfPage(buffer, 1, 2.0, 0);
  useProjectStore.getState().loadPdf(
    basename(path),
    {
      selectedPage: 1,
      widthMm: ptToMm(rendered.widthPt),
      heightMm: ptToMm(rendered.heightPt),
    },
    rendered.canvas,
    buffer,
  );
  return true;
}

/**
 * 保存済みプロジェクト (.dkz) を開く。
 * dirty 時は確認ダイアログを出す (confirmIfDirty=true)。
 * @returns 実際に読み込んだら true、キャンセルなら false
 */
export async function openProjectIntoStore(confirmIfDirty = true): Promise<boolean> {
  if (confirmIfDirty && useProjectStore.getState().dirty) {
    const ok = await askConfirm(
      '未保存の変更があります。別ファイルを開くと失われます。続行しますか?',
      'プロジェクトを開く',
    );
    if (!ok) return false;
  }
  const path = await selectProjectFileToOpen();
  if (!path) return false;
  const json = await readProjectFile(path);
  const loaded = deserializeProject(json);
  useProjectStore.getState().loadProject(path, loaded);
  return true;
}
