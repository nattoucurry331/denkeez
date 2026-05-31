# 見積管理アプリ連携 I/F 仕様 (F-21)

> 対象: Denkeez の拾い出し(BOM)を見積管理アプリへ渡す連携インターフェース。
> 方式: **ファイル受け渡し**(Denkeez が JSON/CSV を出力 → 見積アプリが取込)。
> 本書は `src/export/json-exporter.ts` が生成する JSON の正式仕様です。
> 最終更新: 2026-05-31 / formatVersion: 1

---

## 1. 連携方式と設計方針

- Denkeez は拾い出し結果を **ファイル(JSON または CSV)** として出力する。見積アプリ側が
  そのファイルを取り込んで見積明細の下書きを作る。
- **MCP / API による直結は当面行わない**(将来オプション)。理由: 金額の自動起票には
  顧客選択・誤起票防止・冪等性の設計が別途必要で、MVP の責務を超えるため。
- **機微情報は持ち込まない**(CLAUDE.md §1.6 / §3)。現場住所・元請け名・単価・顧客情報は
  Denkeez 側に保持せず、JSON にも出力しない。Denkeez が渡すのは「何が・いくつ・どの回路か」まで。
- **単価は見積アプリ側で付与**する前提(品目マスタ突合 or 手入力)。Denkeez の `spec`
  (規格・品番)が突合のヒントになる。

## 2. JSON フォーマット (formatVersion: 1)

```json
{
  "formatVersion": 1,
  "app": "Denkeez",
  "site": { "name": "○○邸 新築", "drawingScale": "1/100" },
  "generatedAt": "2026-05-31T01:23:45.000Z",
  "items": [
    { "category": "ダウンライト", "spec": "LED 7W φ100", "quantity": 14, "unit": "個", "circuits": ["L-1", "L-2", "L-3"] },
    { "category": "コンセント",   "spec": "接地極付",      "quantity": 8,  "unit": "個", "circuits": [] },
    { "category": "商品",         "spec": "Panasonic LGB12345", "quantity": 6, "unit": "個", "circuits": [] },
    { "category": "配線",         "spec": "VVF1.6×2C",     "quantity": 62.3, "unit": "m", "circuits": ["L-1", "L-2"] }
  ]
}
```

### フィールド定義

| パス | 型 | 説明 |
|---|---|---|
| `formatVersion` | number | I/F バージョン。破壊的変更で増やす。取込側は不一致を検出可能に。 |
| `app` | string | 生成アプリ名(定数 `APP_NAME`)。 |
| `site.name` | string | 現場名(プロジェクト名)。空文字あり得る。 |
| `site.drawingScale` | string \| null | 縮尺 "1/100"。**未校正なら null**。 |
| `generatedAt` | string(任意) | 出力日時(ISO 8601)。省略される場合がある。 |
| `items[].category` | string | 種別(例「ダウンライト」「配線」、メーカー商品は「商品」)。 |
| `items[].spec` | string | 規格。メーカー商品は「メーカー 品番」。空文字あり得る。 |
| `items[].quantity` | number | 数量。`unit:"個"` は整数、`unit:"m"` は小数1桁に丸めた総長。 |
| `items[].unit` | `"個"` \| `"m"` | 単位。 |
| `items[].circuits` | string[] | 回路番号(昇順・重複なし)。無ければ空配列。 |

### 並び順
1. 機器(`unit:"個"`)を個数の多い順、2. 配線(`unit:"m"`)を総長の多い順。
(CSV 出力と同一。集計は `src/export/bom-export-model.ts` の `buildBomLineItems` が単一の真実源。)

## 3. 見積側への項目マッピング(推奨)

| Denkeez | 見積明細(例) | 備考 |
|---|---|---|
| `category` + `spec` | 品目名 | 例「ダウンライト LED 7W φ100」。突合キーは見積側の運用に委ねる。 |
| `quantity` | 数量 | そのまま。 |
| `unit` | 単位 | 「個」「m」。 |
| (なし) | 単価 | **見積側で付与**(マスタ or 手入力)。Denkeez は単価を持たない。 |
| `circuits` | 備考 / 系統 | 任意。回路ごとの内訳が要るときに利用。 |
| `site.name` | 件名 | 任意。 |
| `site.drawingScale` | 参考情報 | 任意。 |

## 4. 配線の扱い

- 配線は **ケーブル種別ごとに 1 行**、`unit:"m"`・`quantity` = 総延長(m)で計上する。
  (電気工事実務に合わせた方針。材料拾い=ケーブル長で見積に乗せる。)
- 総延長は図面上の配線経路長を校正スケールで実寸換算した値。**余長・立上り等は含まない**ため、
  見積側で割増係数を掛ける運用を想定。

## 5. CSV(代替フォーマット)

`src/export/csv-exporter.ts` が UTF-8 BOM 付き・CRLF の CSV を出力する(列: 種別,規格,数量,単位,回路番号,備考)。
Excel での確認・手取込に向く。回路番号は **連番が3つ以上で "L-1〜L-3" に圧縮**(2連続以下は列挙)。

## 6. 将来拡張(formatVersion を上げる想定)

- MCP `create_quote_draft` 直結(顧客選択・確認・冪等性キー付き)。
- 現場住所・元請け名(`site` 拡張)— 機微情報のため採否は別途判断(既定は出力しない)。
- 単価ヒント(過去見積からの参考単価)— 見積アプリ側主導。

## 7. 互換性ポリシー

- `formatVersion` は後方互換を壊す変更でのみ増やす(項目追加は据え置き)。
- 取込側は未知フィールドを無視し、`formatVersion` 不一致時は警告すること。
