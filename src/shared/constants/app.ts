// アプリ名は仮称のため、UI 表示用文字列はすべてこの定数経由で参照すること。
// CLAUDE.md L100-112 の必須ルール。

export const APP_NAME = 'Denkeez';
export const APP_NAME_KANA = 'デンキーズ';
export const APP_NAME_DISPLAY = `${APP_NAME}（${APP_NAME_KANA}・仮称）`;
export const APP_FILE_EXTENSION = 'dkz';
export const APP_VERSION = '0.1.0';

// プロジェクトファイルのスキーマバージョン。
// REQUIREMENTS.md §5.2 — 後方互換のためファイルに保存し、
// マイグレーション戦略は Phase 2 で確定する。
export const SCHEMA_VERSION = 1;
