// UI改修1: プロジェクト保存フローの共有ロジック。
// MenuBar の保存ボタン・Ctrl+S・close-handler(保存して閉じる)が同じ関数を使う(DRY)。
// フィードバック(busy/info/error)は呼び出し側が担当し、ここは「保存する」ことだけを担う。

import { serializeProject } from '../../data/project-io';
import { selectProjectFileToSave, writeProjectFile } from '../../tauri/api';
import { APP_FILE_EXTENSION } from '../../shared/constants/app';
import type { Project } from '../../data/types';

/** プロジェクト名から保存ファイル名候補を作る。 */
export function suggestedProjectFileName(name: string): string {
  const safe = name.trim() === '' ? 'untitled' : name.trim();
  return `${safe}.${APP_FILE_EXTENSION}`;
}

export interface SaveDeps {
  /** 現在開いているファイルパス (新規未保存なら null) */
  readonly currentFilePath: string | null;
  readonly project: Project;
  readonly markSaved: (path?: string) => void;
}

export interface SaveResult {
  /** 実際に保存できたか (false = ユーザーがダイアログをキャンセル) */
  saved: boolean;
  path?: string;
}

async function writeAndMark(deps: SaveDeps, path: string): Promise<SaveResult> {
  await writeProjectFile(path, serializeProject(deps.project));
  deps.markSaved(path);
  return { saved: true, path };
}

/**
 * 上書き保存。既存パスがあればそこへ、無ければ「名前を付けて保存」ダイアログ。
 * キャンセル時は { saved: false }(呼び出し側はウィンドウを閉じない等の判断に使う)。
 */
export async function performSave(deps: SaveDeps): Promise<SaveResult> {
  const targetPath =
    deps.currentFilePath ??
    (await selectProjectFileToSave(suggestedProjectFileName(deps.project.meta.name)));
  if (!targetPath) return { saved: false };
  return writeAndMark(deps, targetPath);
}

/** 名前を付けて保存。常にダイアログを開く。 */
export async function performSaveAs(deps: SaveDeps): Promise<SaveResult> {
  const targetPath = await selectProjectFileToSave(
    suggestedProjectFileName(deps.project.meta.name),
  );
  if (!targetPath) return { saved: false };
  return writeAndMark(deps, targetPath);
}
