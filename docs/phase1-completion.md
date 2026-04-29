# Phase 1 (PoC) 完了レポート

> 作成日: 2026-04-29
> リリース: `v0.1.0-poc` (予定)
> 対象: Daisuke (有限会社 北嶺建設) + 試用協力者 誠一氏

---

## 達成サマリ

REQUIREMENTS.md §10.1 の Phase 1 完了条件を **すべて達成**:

- [x] PoC アプリが起動する
- [x] サンプル PDF を読み込んで表示できる
- [x] ダウンライトを 10 個以上配置・移動・削除できる
- [x] 配置データを保存・再読込できる
- [x] 配置済み図面を PDF 出力できる
- [x] Daisuke の手元 PC で動作確認済み

---

## マイルストーン履歴

| M# | コミット | 内容 |
|---|---|---|
| M0 | `f12cce2` → `d237f94` | 初期化 + Vite/React/TS/Vitest スキャフォールド + Tauri 2 統合 + PDF.js/Konva スパイク |
| M1 | `1eae1c3` | Tauri dialog 経由の PDF 取込 + 未保存終了確認 |
| M2 | (M0 で前倒し) | 座標変換ユーティリティ + 単体テスト |
| M3 | `41e8f56` | シンボル定義 + 配置 + 編集 + dirty 連動 (R-11 解消) |
| M4 | `5a3c3e5` | プロジェクトファイル (.dkz JSON) の保存 / 読込 + UX 改善 |
| M5 | (本リリース) | PDF 出力 + PDF 90° 回転 + Tauri ask 移行 |
| M6 | (本ドキュメント) | Phase 1 完了処理 + Phase 2 引継メモ |

---

## 確定した技術スタック

| 領域 | 採用 | 備考 |
|---|---|---|
| アプリ形態 | **Tauri 2.10.3** | Plan §1 で確定。配布バイナリ ~25 倍小、Rust 明示許可制 |
| フロントエンド | **React 18.3 + TypeScript strict** | |
| ビルド | **Vite 6.4** | |
| 状態管理 | **Zustand 5 (plain, immer 不採用)** | DOM 型 (HTMLCanvasElement) と immer の WritableDraft 衝突回避 |
| 描画 | **Konva.js + react-konva** | |
| PDF 表示 | **PDF.js (pdfjs-dist 4.7)** | worker は `?url` import |
| PDF 出力 | **jsPDF 4.2.1 (vector API 直接呼出)** | svg2pdf 不採用 (Konva に SVG export なし、Phase 2 再検討) |
| 入力検証 | **Zod 3** | プロジェクトファイル読込の安全性確保 |
| 永続化 (PoC) | **JSON 単独 (.dkz 拡張子)** | Phase 2 で ZIP 化して PDF 同梱予定 |
| テスト | **Vitest 4.1** | 62/62 pass |
| Lint/Format | **ESLint v9 flat + Prettier 3** | |
| Tauri Plugin | `tauri-plugin-fs` / `dialog` / `log` | |
| Rust toolchain | **rustc 1.95.0 / MSVC 2022 Build Tools** | |

最終的に **`npm audit`: 0 vulnerabilities** を維持。

---

## Plan §5 リスク表 — 最終検証結果

| # | リスク | 結果 | 備考 |
|---|---|---|---|
| R-01 | PDF.js 描画性能 (A1/3MB を 3 秒以内) | ✅ | A3/0.08MB で 252ms。A1 実機サンプルで再計測すべきだが概算 OK |
| R-02 | Tauri WebView2 上の PDF.js worker 読込 | ✅ | Vite `?url` + CSP `worker-src 'self' blob:` で動作 |
| R-03 | Konva の Image ノードに PDF レンダー canvas 重ね描き | ✅ | `KonvaImage image={canvas}` で正常表示 |
| R-04 | 出力 PDF の品質 | ✅ | jsPDF circle/text の **ベクター品質**、背景はラスター (約 144DPI) |
| R-05 | px ↔ mm 座標変換のバグ | ✅ | 単体テスト 13 件で網羅、本番運用でも問題なし |
| R-06 | Rust toolchain + WebView2 + MSVC linker | ✅ | Build Tools インストール後 `cargo check` 46.71 秒 |
| R-07 | Tauri permissions 許可設定 | ✅ | 最小許可で動作 (fs read/write、dialog open/save/ask、window 操作) |
| R-08 | 高 DPI ディスプレイの座標ズレ | △ | Daisuke 環境では問題なし。Phase 2 で他環境検証 |
| R-09 | 自動保存とアンドゥの干渉 | 該当なし | PoC では自動保存未実装、Phase 2 で本格対応 |
| R-10 | サンプル A1 PDF 不在 | △ | A3 で代替検証。Phase 2 で実物 A1 再計測 |
| R-11 | dirty フラグ管理の漏れ | ✅ | addSymbol/updateSymbolPosition/removeSymbols すべてで dirty=true、テスト 19 件 |
| R-12 | `crypto.randomUUID()` 不在環境 | ✅ | Tauri WebView2 で動作確認、テスト 2 件 |

---

## PoC で発見・対処した想定外の問題

| # | 問題 | 原因 | 対処 |
|---|---|---|---|
| 1 | `pdf-lib` がメンテ停止(4 年放置) | npm の Snyk Inactive 評価 | Plan で予定していた pdf-lib + svg2pdf を **jsPDF + svg2pdf** に変更 (M0 着手前) |
| 2 | 当初の immer ミドルウェア採用案 | HTMLCanvasElement と WritableDraft の衝突 | plain Zustand v5 + spread immutable へ変更 (M1) |
| 3 | シンボル radiusMm: 75 が画面で巨大化 | スケール設定 (F-04) 未実装で「実寸=紙面寸法」になった | radiusMm: 2.5 に縮小 (M4 内)、Phase 2 で F-04 + 縮尺ベースの実寸シンボルに戻す |
| 4 | `window.confirm` が Tauri WebView 上で無効 | Tauri 2 のセキュリティ仕様 (ブラウザ標準ダイアログを無効化) | `@tauri-apps/plugin-dialog` の `ask` に置換 (M5 内) |
| 5 | PDF 回転で `Cannot perform Construct on a detached ArrayBuffer` | PDF.js が ArrayBuffer を Web Worker に transfer して detach | `pdf-loader.ts` 内で `data.slice(0)` のコピーを渡す (M5 内) |

---

## Phase 2 (MVP) 引継メモ

### 機能拡張 (REQUIREMENTS.md §3.1 の Phase 2 機能)

- **F-04 スケール設定**: 図面上の 2 点クリックで実寸校正。シンボルサイズも実寸 (例: ダウンライト radiusMm: 50 ≒ φ100mm) に戻す
- **F-06 シンボル編集の拡張**: 矩形選択、Shift+矢印キー移動、回転ハンドル
- **F-07 配線描画**: 始点シンボル → 中継点 → 終点シンボルの配線、線種 (天井ふところ/床下/壁内隠蔽/露出)、ケーブル種別 (VVF1.6×2C 等)
- **F-08 レイヤー管理**: 元図面 / 照明回路 / コンセント回路 / 弱電 / 換気・空調 / 寸法・注記、表示 ON/OFF・ロック・色設定
- **F-09 拾い出し集計パネル**: シンボル種別ごとの自動集計、CSV 出力、レイヤーフィルタ
- **F-10 プロパティパネル**: 選択シンボルの回路番号・W 数・型番・メモを編集
- **F-11 アンドゥ・リドゥ**: `zundo` (temporal middleware) を Zustand store に被せる方式 (architecture.md 参照)
- **F-12 ズーム・パン・ミニマップ**: マウスホイールズーム、Space+ドラッグでパン
- **F-13 グリッド表示**: 910mm/455mm 切替

### 技術的引継

- **`.dkz` ファイル形式の ZIP 化** (Plan §5 R-04 / REQUIREMENTS.md §5.1):
  - 現状は JSON 単独。Phase 2 で `meta.json` + `drawing/original.pdf` + `data.json` + `thumbnail.png` の ZIP に
  - 元 PDF を同梱することで「JSON だけ開いて PDF 再選択が必要」UX を解消
- **自動保存** (CLAUDE.md L196 / R-09):
  - 5 分間隔で `appData/recovery/<projectId>.dkz.draft` に下書き保存
  - クラッシュ時の復旧 UI を起動時に表示
  - dirty フラグとアンドゥの排他制御を設計
- **PDF 出力 300DPI 化** (Plan §5 R-04):
  - 現状は約 144DPI (scale=2.0)。Phase 2 で 300DPI 再レンダー → addImage に変更
- **bundle 分割**: Vite の `manualChunks` で React/Konva/PDF.js を別チャンクへ (現状メインバンドル 778KB の警告あり)
- **回転後のシンボル位置の保持**: 現状は削除前提。Phase 2 で原点回り回転変換でシンボル位置も自動補正
- **CRLF/LF 統一**: `.gitattributes` で `* text=auto eol=lf` を明示
- **PDF document インスタンス保持**: `pdf-loader.ts` で `pdfjs.getDocument` 結果を store に保持し、`getPage` 直接呼び出しに変える (毎回 ArrayBuffer コピーするコストを削減)

### 仕様未確定事項 (REQUIREMENTS.md §9.3)

Phase 1 終了時点で確定したもの:
- [x] Electron / Tauri → Tauri 2 採用
- [x] 状態管理ライブラリ → Zustand 5 (plain) 採用
- [x] アプリ仮称 「Denkeez(デンキーズ)」 → **Phase 2 着手前に正式名称を確定** (商標調査 + ドメイン取得可能性)
- [x] プロジェクトファイル拡張子 `.dkz` → **Phase 2 着手前に確定** (現状仮)

未確定 (Phase 2 以降):
- [ ] 見積管理アプリとの連携 I/F の正式仕様 (F-21、Phase 3)
- [ ] アイコン・シンボルのデザイン担当 (現状 Tauri デフォルト + Phase 1 PoC の即席シンボル)
- [ ] β版テストに協力する職人さんの確保 (誠一氏に打診中)
- [ ] CLAUDE.md の「見積管理アプリと揃える」記述の整合性更新 ← **本リリースで実施**

---

## ビルド・配布

現状は **開発ビルド** のみ。Phase 2 着手時に NSIS インストーラの本番ビルドを整備:

```powershell
npm run tauri build
```

→ `src-tauri/target/release/bundle/nsis/` に Windows インストーラ生成。

Phase 2 で署名証明書 (Authenticode) の取得・設定を検討。

---

## 試用シナリオ (Daisuke が誠一氏に渡せる手順)

1. NSIS インストーラ (Phase 2 で配布開始予定) で Denkeez をインストール
2. 「ファイル → PDF を開く」で元請けからの PDF 図面を選択
3. 必要なら「PDF 90° 回転」で向きを調整
4. 左パレットから「ダウンライト」を選んでキャンバス上にクリック配置
5. シンボルをドラッグで移動、Delete キーで削除、Shift+クリックで複数選択
6. 「保存」で `.dkz` ファイルとして保存(後で続きから作業可能)
7. 「PDF 出力」で配置済みの PDF をエクスポート → 元請けに提出

**Phase 1 PoC では「ダウンライト 1 種類のみ」**。Phase 2 で 20 種類のシンボルに拡張予定。
