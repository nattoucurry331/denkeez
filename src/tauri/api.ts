// Tauri 2 のファイル I/O ラッパ。
// REQUIREMENTS.md §11.4 / Plan §3: capabilities で許可された範囲のみ呼び出せる。
// CSP / permissions は src-tauri/capabilities/default.json を参照。

import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';

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

/** ファイルパスからバイナリを読み込み ArrayBuffer として返す。 */
export async function readBinaryFile(path: string): Promise<ArrayBuffer> {
  const bytes = await readFile(path);
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
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
