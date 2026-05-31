// アプリ名は仮称のため、UI 表示用文字列はすべてこの定数経由で参照すること。
// CLAUDE.md L100-112 の必須ルール。

export const APP_NAME = 'Denkeez';
export const APP_NAME_KANA = 'デンキーズ';
export const APP_NAME_DISPLAY = `${APP_NAME}（${APP_NAME_KANA}・仮称）`;
export const APP_FILE_EXTENSION = 'dkz';
export const APP_VERSION = '0.13.0';

// プロジェクトファイルのスキーマバージョン。
// REQUIREMENTS.md §5.2 — 後方互換のためファイルに保存し、
// マイグレーション戦略は Phase 2 で確定する。
//
// バージョン履歴:
//  1: Phase 1〜2-C  (symbols, wires?, grid?)
//  2: Phase 2-D1〜  (layers 必須、ProjectSymbol.layerId / Wire.layerId 必須)
//                   旧 v1 ファイルは project-io.ts のマイグレーションで「未分類」レイヤーに自動割当。
//  3: Phase 3 F-16 Sub-3 (Project.dimensions 追加)。v2 以前は dimensions 欠落 → [] 扱い。
export const SCHEMA_VERSION = 3;
