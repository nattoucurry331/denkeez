// Tauri 2 のファイル I/O ラッパ。
// REQUIREMENTS.md §11.4 / Plan §3: capabilities で許可された範囲のみ呼び出せる。
// CSP / permissions は src-tauri/capabilities/default.json を参照。

import { open, save } from '@tauri-apps/plugin-dialog';
import { readFile, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { APP_FILE_EXTENSION } from '../shared/constants/app';

/** PDF ファイル選択ダイアログを表示。キャンセル時は null を返す。 */
export async function selectPdfFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (selected === null) {
    return null;
  }
  return Array.isArray(selected) ? (selected[0] ?? null) : selected;
}

/** プロジェクトファイル選択 (開く)。 */
export async function selectProjectFileToOpen(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'Denkeez Project', extensions: [APP_FILE_EXTENSION, 'json'] }],
  });
  if (selected === null) {
    return null;
  }
  return Array.isArray(selected) ? (selected[0] ?? null) : selected;
}

/** プロジェクトファイル保存ダイアログ (名前を付けて保存)。 */
export async function selectProjectFileToSave(defaultName?: string): Promise<string | null> {
  const path = await save({
    filters: [{ name: 'Denkeez Project', extensions: [APP_FILE_EXTENSION] }],
    defaultPath: defaultName ?? `untitled.${APP_FILE_EXTENSION}`,
  });
  return path;
}

/** ファイルパスからバイナリを読み込み ArrayBuffer として返す。 */
export async function readBinaryFile(path: string): Promise<ArrayBuffer> {
  const bytes = await readFile(path);
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

/** プロジェクトファイル (text) を読込。 */
export async function readProjectFile(path: string): Promise<string> {
  return await readTextFile(path);
}

/** プロジェクトファイル (text) を書込。 */
export async function writeProjectFile(path: string, content: string): Promise<void> {
  await writeTextFile(path, content);
}

/** Windows / Unix 両対応のファイル名抽出。 */
export function basename(path: string): string {
  const segments = path.split(/[/\\]/);
  return segments[segments.length - 1] ?? path;
}

/** PDF の pt → mm 変換 (1 pt = 25.4/72 mm)。 */
export function ptToMm(pt: number): number {
  return pt * (25.4 / 72);
}
