# Denkeez アーキテクチャ概要

> Phase 1 (PoC) 着手時点でのモジュール構成と主要設計判断を記録する。
> Phase 2 着手時にこの文書をベースに正式なアーキテクチャ図(Mermaid 等)へ拡張する。

---

## レイヤー構成

```
┌─────────────────────────────────────────────────────────┐
│ React UI (src/components/)                              │
│   MenuBar / SymbolPalette / CanvasArea / Dialogs        │
├─────────────────────────────────────────────────────────┤
│ Domain Layer (src/data/, src/symbols/)                  │
│   project-store (Zustand) / dirty-tracker / types       │
│   symbol-registry / symbols.json                        │
├─────────────────────────────────────────────────────────┤
│ Render & I/O (src/canvas/, src/pdf/, src/tauri/)        │
│   symbols-layer (Konva) / pdf-loader (PDF.js)           │
│   tauri/api (dialog + fs) / close-handler               │
├─────────────────────────────────────────────────────────┤
│ Utilities (src/utils/)                                  │
│   coordinate (px ↔ mm) / id (UUID)                      │
└─────────────────────────────────────────────────────────┘
                       │
                       ▼ Tauri 2 IPC
┌─────────────────────────────────────────────────────────┐
│ Rust Backend (src-tauri/)                               │
│   tauri-plugin-fs / tauri-plugin-dialog / tauri-plugin-log │
│   capabilities/default.json で許可リスト制限             │
└─────────────────────────────────────────────────────────┘
```

---

## 主要設計判断

### 1. State 管理: plain Zustand v5 (immer なし)

Plan §1 では当初 Zustand 5 + immer を想定したが、PoC 着手時に
`HTMLCanvasElement` を store に持たせる場面で immer の `WritableDraft<T>` 変換が
DOM 型(深い readonly チェーン)と衝突したため、**plain Zustand + spread による
immutable 更新** に変更した。

- **影響**: シンボル配列の操作が `[...state, newItem]` / `state.map(...)` /
  `state.filter(...)` で記述される(若干冗長)
- **メリット**: HTMLCanvasElement / DOM 型を制約なく state に置ける
- **Phase 2 での再検討**: シンボル数が数百を超え、配列スプレッド負荷が顕在化したら
  immer 再導入 or normalized state(`Record<id, Symbol>`)を検討

### 2. アンドゥ・リドゥの将来実装方針 (Plan §5 R-09)

Phase 1 では未実装だが、Phase 2 で以下の方針で追加する:

- **採用候補**: `zundo`(pmndrs / MIT / Zustand 公式系列)を temporal middleware として
  store に被せる
- **方式**: Snapshot 型(state 全体スナップショットを履歴に積む)
- **理由**:
  - plain Zustand v5 store にミドルウェアを適用するだけで導入できる
  - Command パターンより実装コストが低く、複合操作(複数シンボル一括移動など)も
    自動的に 1 つの履歴エントリにまとまる
  - PoC のシンボル規模(1 現場あたり 数十〜数百)ではメモリ負荷が許容範囲
- **干渉リスク (R-09)**: 自動保存が走るタイミングでアンドゥが発生すると不整合の可能性。
  Phase 2 では「保存処理中はアンドゥロックする」方式で排他制御する

### 3. 座標系の二重管理 (REQUIREMENTS.md §9.1.1 / Plan §5 R-05)

UI コードから直接ピクセル計算しないルールを徹底。

- **store 上は mm 単位**で `position: { x, y }`、`drawing.widthMm/heightMm` を保持
- **Konva 描画時に px に変換**: `utils/coordinate.mmToPx(value, scale)`
- **scale**: `pxPerMm = canvas.width / drawing.widthMm` を CanvasArea で都度計算
- **境界値テスト**: `tests/coordinate.test.ts` でスケール 0/負値、回転、Inf/NaN を網羅

### 4. dirty フラグ管理 (CLAUDE.md L196 / R-11)

未保存変更があるとウィンドウ閉じる際に確認ダイアログを出す仕組み。

- **方針**: state を変更する全 action 内で `dirty: true` を明示的にセット
- **subscribe ベースの自動追跡** は採用しない(Phase 2 で必要なら検討)
- **テスト**: `tests/project-store.test.ts` で `addSymbol` /
  `updateSymbolPosition` / `removeSymbols` が dirty=true 化することを検証
- **保存後リセット**: `markSaved()` または `loadPdf()` で dirty=false

### 5. Tauri 2 permissions (Plan §5 R-07)

`src-tauri/capabilities/default.json` に最小権限のみ列挙:

- `core:default` / `core:window:allow-set-title` / `:allow-destroy` / `:allow-close`
- `dialog:allow-open` / `dialog:allow-save`
- `fs:allow-read-file`(PDF バイナリ)
- `fs:allow-write-text-file`(JSON プロジェクトファイル、M4 で利用)

scope 制限(`$DOCUMENT/*` 等)は M4 着手時に追加する。

### 6. シンボル定義の外部化 (REQUIREMENTS.md §4.4)

- `src/symbols/symbols.json` に種別とパラメータ(円の半径、文字、フォントサイズ等)を保持
- `symbol-registry.ts` で型付けして UI / 描画レイヤーに供給
- Phase 2 で 20 種類に拡張時もコード変更なしで JSON を増やすだけ
- ユーザー独自シンボル追加(Phase 3 以降)はこの仕組みを延長する

---

## ディレクトリ構成 (Phase 1 PoC 時点)

```
src/
├ App.tsx
├ main.tsx
├ vite-env.d.ts
├ shared/constants/app.ts        # APP_NAME 等 (CLAUDE.md L100-112 必須)
├ data/
│  ├ types.ts                    # Project / ProjectMeta / ProjectDrawing / ProjectSymbol
│  ├ project-store.ts            # Zustand store (Snapshot 型、immer なし)
│  └ dirty-tracker.ts            # isDirty() ユーティリティ
├ symbols/
│  ├ symbols.json                # シンボル定義 (Phase 1: ダウンライト 1 種)
│  └ symbol-registry.ts
├ pdf/pdf-loader.ts              # PDF.js v4 で 1 ページを canvas にレンダー
├ canvas/symbols-layer.tsx       # Konva 上のシンボル描画レイヤー
├ tauri/
│  ├ api.ts                      # selectPdfFile / readBinaryFile / ptToMm
│  └ close-handler.ts            # tauri://close-requested + 確認ダイアログ
├ components/
│  ├ menu-bar/MenuBar.tsx
│  ├ symbol-palette/SymbolPalette.tsx
│  ├ canvas-area/CanvasArea.tsx
│  └ dialogs/UnsavedChangesDialog.tsx
└ utils/
   ├ coordinate.ts               # px ↔ mm 変換 (集約点)
   └ id.ts                       # crypto.randomUUID() ラッパ
```

---

## 既知の Phase 2 引継事項

- Snapshot 型 store に `zundo` middleware を被せて Ctrl+Z / Ctrl+Y を実装
- 矩形選択(ドラッグ)、Shift+矢印キー移動 (REQUIREMENTS.md §3.2 F-06)
- グリッドスナップ (910mm/455mm 切替、F-13)
- レイヤー管理(F-08): 元図面 / 照明回路 / コンセント回路 / 弱電 / 換気 / 寸法・注記
- スケール設定(F-04): 図面上の 2 点クリックで実寸校正、現状は PDF メタの widthMm 直読み
- 自動保存(5 分間隔)とクラッシュ復旧(R-09 排他制御込み)
- bundle の manualChunks 分割(M0 build 時に 778KB 超の警告あり)
