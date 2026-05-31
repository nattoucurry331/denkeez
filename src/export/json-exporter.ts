// Phase 3 (F-21) 3-I2: 拾い出し(BOM)の JSON 出力。
// 見積管理アプリへ「ファイル受け渡し」で連携するための正式 I/F。
// 形式仕様は docs/estimate-link-interface.md を参照(本ファイルが唯一の生成元)。
//
// 設計方針:
//  - 機微情報(住所・元請け名・単価)は持ち込まない。現場名と縮尺のみ。
//  - 単価は見積アプリ側で付与する前提(数量と規格まで提供)。
//  - 中間表現 buildBomLineItems を共有し、CSV と同じ集計結果を保証。

import type { Layer, ProjectSymbol, Wire } from '../data/types';
import type { BomFilter } from '../data/bom-aggregator';
import { buildBomLineItems } from './bom-export-model';
import { APP_NAME } from '../shared/constants/app';

/** JSON I/F のフォーマットバージョン。破壊的変更時に上げる。 */
export const BOM_JSON_FORMAT_VERSION = 1;

export interface BomJsonMeta {
  /** 現場名 (project.meta.name)。空可。 */
  siteName: string;
  /** 縮尺 "1/100"。未校正は null。 */
  drawingScale: string | null;
  /** 出力日時 (ISO 8601)。省略時はキーを出力しない(テスト容易性のため)。 */
  generatedAt?: string;
}

export interface BomJsonItem {
  /** 種別 (例 "ダウンライト" / "配線") */
  category: string;
  /** 規格 (メーカー商品は "メーカー 品番") */
  spec: string;
  /** 数量。個数(整数)または総長メートル(小数1桁に丸め)。 */
  quantity: number;
  /** 単位 */
  unit: '個' | 'm';
  /** 回路番号(生配列・昇順)。見積側でのグルーピング用。 */
  circuits: string[];
}

export interface BomJsonPayload {
  formatVersion: number;
  app: string;
  site: { name: string; drawingScale: string | null };
  generatedAt?: string;
  items: BomJsonItem[];
}

/** 中間表現から見積連携 JSON ペイロード(オブジェクト)を組み立てる。 */
export function buildBomJsonPayload(
  symbols: readonly ProjectSymbol[],
  wires: readonly Wire[],
  layers: readonly Layer[],
  filter: BomFilter,
  meta: BomJsonMeta,
): BomJsonPayload {
  const items: BomJsonItem[] = buildBomLineItems(symbols, wires, layers, filter).map((i) => ({
    category: i.type,
    spec: i.spec,
    quantity: i.unit === 'm' ? Math.round(i.quantity * 10) / 10 : i.quantity,
    unit: i.unit,
    circuits: i.circuits,
  }));
  return {
    formatVersion: BOM_JSON_FORMAT_VERSION,
    app: APP_NAME,
    site: { name: meta.siteName, drawingScale: meta.drawingScale },
    ...(meta.generatedAt !== undefined ? { generatedAt: meta.generatedAt } : {}),
    items,
  };
}

/** 見積連携 JSON 文字列(整形済み・末尾改行付き)を生成する。 */
export function generateBomJson(
  symbols: readonly ProjectSymbol[],
  wires: readonly Wire[],
  layers: readonly Layer[],
  filter: BomFilter,
  meta: BomJsonMeta,
): string {
  return JSON.stringify(buildBomJsonPayload(symbols, wires, layers, filter, meta), null, 2) + '\n';
}

/** プロジェクト名から JSON ファイル名候補を作る。 */
export function suggestedBomJsonName(projectName: string): string {
  const safe = projectName.trim() === '' ? 'denkeez-bom' : `${projectName.trim()}-bom`;
  return `${safe}.json`;
}
