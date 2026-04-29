# M0 検証ログ

> Plan §7 マイルストーン M0「環境準備 + スパイク検証」の検証結果。
> 実施日: 2026-04-29。検証環境: Daisuke 手元 PC (Windows 11)。

---

## 達成した REQUIREMENTS.md §10.1 項目

- [x] §10.1-1 PoC アプリが起動する
- [x] §10.1-2 サンプル PDF を読み込んで表示できる
- [ ] §10.1-3 ダウンライトを 10 個以上配置・移動・削除できる(M3 で対応)
- [ ] §10.1-4 配置データを保存・再読込できる(M4 で対応)
- [ ] §10.1-5 配置済み図面を PDF 出力できる(M5 で対応)
- [x] §10.1-6 Daisuke の手元 PC で動作確認済み(M0 範囲のみ)

---

## 環境

| 項目 | バージョン / 状態 |
|---|---|
| OS | Windows 11 Home |
| Node.js | 24.14.1 |
| npm | 11.11.0 |
| Git | 2.53.0 |
| Rust (rustc) | 1.95.0 (2026-04-14) |
| Cargo | rustup 経由でインストール |
| WebView2 Runtime | 147.0.3912.86 |
| MSVC Build Tools | C++ によるデスクトップ開発ワークロード導入済み |
| PowerShell ExecutionPolicy | CurrentUser: RemoteSigned |

---

## ライブラリ §1.4 チェック (CLAUDE.md)

- npm 依存: 365 packages、`npm audit` **0 vulnerabilities** 維持
- 主要バージョン:
  - React 18.3 / Vite 6.4 / TypeScript 5.6 / Vitest 4.1
  - Zustand 5 / immer 10 / Konva + react-konva
  - PDF.js (pdfjs-dist) 4.x
  - jsPDF 4.2.1 (CWE-22 / CWE-79 critical 修正版) + svg2pdf.js 2.7
  - Zod / @types/node
- Cargo 依存: tauri 2.10.3 / tauri-plugin-fs 2.5 / tauri-plugin-dialog 2.7 / tauri-plugin-log 2.8

---

## リスク検証結果 (Plan §5)

| # | リスク内容 | 結果 | 備考 |
|---|---|---|---|
| R-01 | PDF.js の WebView2 上での描画性能 (A1/3MB を 3 秒以内) | ✅ | A3/0.08MB で **252ms**。A1/3MB はサンプル入手後に再計測予定 |
| R-02 | Tauri WebView2 上で PDF.js の `pdf.worker.min.mjs` 読込 | ✅ | Vite の `?url` import + CSP `worker-src 'self' blob:` で動作 |
| R-03 | Konva の `Image` ノードに PDF レンダー canvas を背景表示 | ✅ | `KonvaImage image={canvas}` で表示確認 |
| R-04 | jsPDF + svg2pdf の出力品質 | M5 で検証 | 未着手 |
| R-05 | px ↔ mm 座標変換 | ✅ | Vitest 13/13 pass、境界値・回転・負のスケール網羅 |
| R-06 | Rust toolchain + WebView2 + MSVC linker | ✅ | `cargo check` 46.71秒で完了、`npm run tauri dev` でウィンドウ起動 |
| R-07 | Tauri v2 permissions 許可設定 | M4 で検証 | 設定済みだが fs::readFile 経由の読込は未テスト |
| R-08 | 高 DPI ディスプレイの座標ズレ | M6 で検証 | 未着手 |
| R-09 | 自動保存とアンドゥの干渉 | Phase 2 | PoC 範囲外 |
| R-10 | サンプル A1 PDF 不在 | 部分対応 | A3 で R-01 概算 OK、A1 サンプル別途 |
| R-11 | dirty フラグ管理の漏れ | M3 で検証 | 未着手 |
| R-12 | `crypto.randomUUID()` 不在環境 | ✅ | Vitest 2/2 pass、Tauri WebView2 で生成成功 |

---

## 動作確認済みの機能

1. `npm run tauri dev` で Tauri ウィンドウが起動
2. ウィンドウタイトルが `APP_NAME_DISPLAY` 経由で **「Denkeez（デンキーズ・仮称）」** と動的設定
3. ファイル選択ダイアログから PDF を選択 → PDF.js でレンダリング → Konva の Stage に背景表示
4. レンダー時間・ページ数・実寸 (pt) が画面に表示

---

## Phase 2 (MVP) への引継メモ

- **キャンバス UI**: 現状の `pdf-spike.tsx` は M0 検証用。Phase 2 で `pdf-background-layer.tsx` + `symbols-layer.tsx` に分離し、Stage は固定サイズではなくウィンドウフィットさせる
- **状態管理**: Plan §1 で確定した Snapshot 型 Zustand store を `data/project-store.ts` で実装。Phase 2 で `zundo` middleware を被せてアンドゥ・リドゥを実現
- **dirty フラグ**: M1 着手時に `data/dirty-tracker.ts` を実装(Plan §3、CLAUDE.md L196 担保)
- **R-01 残検証**: Daisuke から実物の A1 元図面を 1 枚提供してもらい、3000ms 以内を再計測
- **manualChunks**: 現状メインバンドル 778KB の警告あり。Phase 2 で React/Konva/PDF.js を別チャンクに分割
- **CLAUDE.md L75 / L208**: 「見積管理アプリと揃える」記述は本 Plan で外したため、Phase 1 完了時に CLAUDE.md を更新

---

## ブランチ状況

```
feature/m0-scaffold
├─ f12cce2  追加: プロジェクト初期化
├─ 3331292  追加: M0 — Vite + React + TypeScript strict + Vitest スキャフォールド
├─ 51816b1  追加: Tauri 2 統合 — identifier / CSP / permissions / plugin 登録
├─ 43f374a  追加: PDF.js + Konva 統合スパイクと TypeScript strict 型整備
└─ (このコミット)  追加: M0 完了 — 検証ログと Cargo.toml の features 明示
```
