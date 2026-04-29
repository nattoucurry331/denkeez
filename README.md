# Denkeez(デンキーズ・仮称)

> **Denkeez** — 電気工事の平面図エディタ
>
> 元請けから来る平面図(PDF)に照明・スイッチ・コンセントなどを書き込み、拾い出し(数量集計)から見積連携までを支援する Windows デスクトップアプリ。

---

## このリポジトリは何か

北海道の建設会社・有限会社 北嶺建設の協力業者である電気工事職人からの「平面図に器具位置を書き込めるツールが欲しい」という相談を発端に、**事務所/自宅の Windows PC** で使える図面エディタを開発するプロジェクトです。

最終的には、別プロジェクトで開発中の **見積管理アプリ** と連携し、図面 → 拾い出し → 見積の流れを一気通貫で行える環境を目指しています。

> **注意**: 「Denkeez」はあくまで仮称です。Phase 2 着手前に正式名称を確定する予定です。

## 現在のステータス

| 項目 | 状態 |
|---|---|
| 要件定義 | ✅ 完了(`REQUIREMENTS.md`) |
| 技術スタック選定 | ✅ 確定(Tauri 2 + React 18 + Vite 6 + Zustand 5 + Konva + PDF.js + jsPDF) |
| **Phase 1: PoC** | **✅ 完了**(`docs/phase1-completion.md` 参照) |
| Phase 2: MVP | ⬜ 計画中 |
| Phase 3: 実用版 | ⬜ 未着手 |

Phase 1 PoC は **REQUIREMENTS.md §10.1 の達成条件をすべてクリア**:
- アプリ起動 / PDF 表示 / ダウンライト 10 個以上の配置・移動・削除 / 保存・再読込 / PDF 出力

## できること(Phase 1 PoC 時点)

- PDF 図面の取り込みと表示(PDF.js)
- 90° 単位の回転(向き調整)
- ダウンライトシンボル(JIS C 0303 準拠の DL 円)の配置・選択・ドラッグ移動・複数選択・削除
- プロジェクトファイル `.dkz` (JSON) としての保存・読込
- 配置済み図面の PDF 出力(背景ラスター + シンボルベクターのハイブリッド)
- 未保存終了確認ダイアログ
- 座標は内部で mm 単位、PDF 実寸に基づく

## できないこと(Phase 2 以降)

- スケール設定(2 点クリックで実寸校正、F-04)
- 配線描画(F-07)
- レイヤー管理(F-08)
- 拾い出し集計パネル(F-09)
- アンドゥ・リドゥ(F-11)
- 自動保存(5 分間隔)
- シンボル種別の追加(現状ダウンライトのみ、Phase 2 で 20 種類)
- 見積管理アプリとの連携(F-21、Phase 3)

詳細は `docs/phase1-completion.md` の「Phase 2 引継メモ」を参照。

## ドキュメント構成

```
denkeez/
├── README.md                           ← このファイル
├── REQUIREMENTS.md                     ← 要件定義書(プロジェクトの中心文書)
├── CLAUDE.md                           ← Claude Code 用設定・ルール
├── docs/
│   ├── architecture.md                 ← レイヤー構成 + 設計判断
│   ├── m0-verification.md              ← M0 検証ログ
│   └── phase1-completion.md            ← Phase 1 完了レポート
├── src/                                ← React アプリ本体
├── src-tauri/                          ← Rust バックエンド
├── tests/                              ← Vitest 単体テスト
└── public/
```

---

## 開発環境のセットアップ

### 必要なもの (Windows 11)

| ツール | バージョン | 入手方法 |
|---|---|---|
| Node.js | 20+ (推奨 24) | https://nodejs.org/ または `winget install OpenJS.NodeJS.LTS` |
| Git | 2.40+ | https://git-scm.com/ |
| Rust toolchain | 1.77+ (MSVC) | https://rustup.rs/ |
| Microsoft C++ Build Tools | 2022 (Desktop development with C++) | `winget install Microsoft.VisualStudio.2022.BuildTools --override "--passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"` |
| WebView2 Runtime | (Windows 11 標準) | 通常プリインストール済み |

PowerShell の場合は初回のみ Execution Policy を設定:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### セットアップ

```powershell
git clone <このリポジトリ>
cd denkeez
npm install
rustup default stable
```

### 開発起動

```powershell
npm run tauri dev
```

初回は Rust 依存のコンパイルで 1〜2 分。2 回目以降は数秒で起動。

### 本番ビルド (Windows NSIS インストーラ)

```powershell
npm run tauri build
```

→ `src-tauri/target/release/bundle/` に成果物が出力される。

### テスト

```powershell
npm test          # Vitest 単体テスト (62 件)
npx tsc -b        # TypeScript 型チェック
npm run lint      # ESLint
```

---

## 開発の進め方

### ブランチ運用

- `main` ブランチには直接 push しない
- 機能ごとに `feature/xxx` ブランチを切って作業
- ドキュメント更新のみは `docs/xxx` ブランチでも可
- 完成したら Pull Request を出してレビューを受ける
- レビュー後にマージ、ブランチは削除可

### コミットメッセージ

日本語可。プレフィックスを目安に:

| 接頭辞 | 用途 |
|---|---|
| `追加:` | 新機能 |
| `修正:` | バグ修正 |
| `改善:` | リファクタや軽微な改良 |
| `文書:` | ドキュメントのみの変更 |
| `設定:` | ビルド設定など |
| `テスト:` | テストコードの追加・修正 |

### Issue とディスカッション

- 技術選定や仕様の議論は **Issue** で行う(LINE などでは流れて消えるため)
- 1 機能 = 1 Issue を目安にタスク化

---

## このプロジェクトに関わる人

| 役割 | 担当 |
|---|---|
| プロジェクトオーナー / 仕様策定 | Daisuke (有限会社 北嶺建設) |
| 開発(技術相談・レビュー) | (検討中) |
| 試用協力 | 誠一氏(電気工事職人) |
| AI ペアプロ | Claude Code |

## ライセンス

検討中(社内ツールとして始めるため、当面は非公開)。

## 連絡先

有限会社 北嶺建設 / 担当: Daisuke
ご質問・ご提案は GitHub Issue または直接ご連絡ください。
