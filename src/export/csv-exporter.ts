// Phase 2-E2: F-15 拾い出し CSV 出力 (REQUIREMENTS §5.3)。
// 集計は共通の中間表現 (bom-export-model.buildBomLineItems) を経由し、
// 本ファイルは「明細 → CSV 行」の整形とエスケープだけを担当する (Phase 3 3-I1)。
//
// フォーマット例 (REQUIREMENTS §5.3):
//   種別,規格,数量,単位,回路番号,備考
//   ダウンライト,LED 7W φ100,14,個,L-1, L-2, L-3,
//   配線,VVF1.6×2C,62.3,m,,
//
// 文字エンコード: UTF-8 BOM 付き / 改行: CRLF (Excel 互換)
// エスケープ: RFC 4180 (ダブルクォート・カンマ・改行を含む値はクォートで囲む)

import type { Layer, ProjectSymbol, Wire } from '../data/types';
import type { BomFilter } from '../data/bom-aggregator';
import { buildBomLineItems, type BomLineItem } from './bom-export-model';
import { formatCircuitRange } from '../utils/circuit-range';

const HEADER = ['種別', '規格', '数量', '単位', '回路番号', '備考'] as const;
const BOM = '﻿';
const CRLF = '\r\n';

interface CsvRow {
  type: string;
  spec: string;
  quantity: string;
  unit: string;
  circuit: string;
  note: string;
}

/**
 * Project から拾い出し CSV (UTF-8 BOM 付き、CRLF 改行) を生成する。
 * フィルタは BomPanel と同じく visibleOnly オプション。
 */
export function generateBomCsv(
  symbols: readonly ProjectSymbol[],
  wires: readonly Wire[],
  layers: readonly Layer[],
  filter: BomFilter,
): string {
  const items = buildBomLineItems(symbols, wires, layers, filter);
  const lines = [HEADER.join(','), ...items.map((item) => formatRow(toCsvRow(item)))];
  return BOM + lines.join(CRLF) + CRLF;
}

/** 中間表現 1 行を CSV 行へ整形する。数量の丸め・回路番号の連結は CSV の責務。 */
function toCsvRow(item: BomLineItem): CsvRow {
  const quantity = item.unit === 'm' ? item.quantity.toFixed(1) : String(item.quantity);
  return {
    type: item.type,
    spec: item.spec,
    quantity,
    unit: item.unit,
    // 連番が 3 つ以上なら "L-1〜L-3" に圧縮 (2 連続以下はそのまま列挙)
    circuit: formatCircuitRange(item.circuits),
    note: '',
  };
}

function formatRow(row: CsvRow): string {
  return [row.type, row.spec, row.quantity, row.unit, row.circuit, row.note]
    .map(escapeCsvCell)
    .join(',');
}

/** RFC 4180 エスケープ: ダブルクォート / カンマ / 改行を含むセルはクォートで囲み、
 *  内部のダブルクォートは "" に置換。 */
export function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** プロジェクト名から CSV ファイル名候補を作る (MenuBar から使用)。 */
export function suggestedBomCsvName(projectName: string): string {
  const safe = projectName.trim() === '' ? 'denkeez-bom' : `${projectName.trim()}-bom`;
  return `${safe}.csv`;
}
