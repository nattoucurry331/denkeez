// Phase 2-E1: F-09 拾い出し集計の純粋関数。
// BomPanel で表示する前に、symbols / wires を type / cable 単位で集計する。
// レイヤーフィルタ (visible のみ / 全レイヤー) に対応。
//
// REQUIREMENTS §3.2 F-09:
//   - シンボル種別ごとに自動集計
//   - 配線は線種別に総長を表示
//   - レイヤーフィルタ可能 (特定レイヤーのみ集計)
//
// MVP では type / cable 単位の単純集計のみ。「規格 × 回路番号」グループ化は
// F-15 CSV 出力時に詳細化する。

import type { Layer, ProjectSymbol, SymbolType, Wire, CableType } from './types';

export interface BomFilter {
  /** true なら visible: false のレイヤー所属を除外、false なら全レイヤー対象 */
  visibleOnly: boolean;
}

export interface SymbolCountRow {
  type: SymbolType;
  count: number;
}

export interface WireLengthRow {
  /** ケーブル種別 (cable === 'その他' のとき cableCustom があればそれを使う) */
  label: string;
  totalMm: number;
  /** 本数 (参考表示用) */
  count: number;
}

export interface BomReport {
  symbolRows: SymbolCountRow[];
  /** 全シンボル数 */
  symbolTotal: number;
  wireRows: WireLengthRow[];
  /** 全配線長 (mm) */
  wireTotalMm: number;
  /** 集計対象から除外されたレイヤー数 (UI でヒント表示) */
  hiddenLayerCount: number;
}

function applyLayerFilter(
  layers: readonly Layer[],
  filter: BomFilter,
): { allowed: ReadonlySet<string>; hiddenCount: number } {
  if (!filter.visibleOnly) {
    return { allowed: new Set(layers.map((l) => l.id)), hiddenCount: 0 };
  }
  const visible = layers.filter((l) => l.visible);
  return {
    allowed: new Set(visible.map((l) => l.id)),
    hiddenCount: layers.length - visible.length,
  };
}

export function aggregateSymbols(
  symbols: readonly ProjectSymbol[],
  layers: readonly Layer[],
  filter: BomFilter,
): { rows: SymbolCountRow[]; total: number } {
  const { allowed } = applyLayerFilter(layers, filter);
  const counts = new Map<SymbolType, number>();
  let total = 0;
  for (const s of symbols) {
    if (!allowed.has(s.layerId)) continue;
    counts.set(s.type, (counts.get(s.type) ?? 0) + 1);
    total += 1;
  }
  // SymbolType の登場順を保持しつつ、count 多い順 → 同数なら type 名
  const rows: SymbolCountRow[] = [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.type.localeCompare(b.type);
    });
  return { rows, total };
}

function wireLabel(cable: CableType, cableCustom: string | undefined): string {
  if (cable === 'その他') {
    const c = cableCustom?.trim();
    return c && c.length > 0 ? c : 'その他';
  }
  return cable;
}

export function aggregateWires(
  wires: readonly Wire[],
  symbols: readonly ProjectSymbol[],
  layers: readonly Layer[],
  filter: BomFilter,
): { rows: WireLengthRow[]; totalMm: number } {
  const { allowed } = applyLayerFilter(layers, filter);
  // 端点 symbol が除外レイヤーにいる wire も除外する (BomPanel は WireLayer の visible 条件と整合)
  const symbolLayer = new Map(symbols.map((s) => [s.id, s.layerId]));
  const acc = new Map<string, { totalMm: number; count: number }>();
  let totalMm = 0;
  for (const w of wires) {
    if (!allowed.has(w.layerId)) continue;
    const fromLayer = symbolLayer.get(w.fromSymbolId);
    const toLayer = symbolLayer.get(w.toSymbolId);
    if (fromLayer !== undefined && !allowed.has(fromLayer)) continue;
    if (toLayer !== undefined && !allowed.has(toLayer)) continue;
    const key = wireLabel(w.cable, w.cableCustom);
    const cur = acc.get(key) ?? { totalMm: 0, count: 0 };
    cur.totalMm += w.lengthMm;
    cur.count += 1;
    acc.set(key, cur);
    totalMm += w.lengthMm;
  }
  const rows: WireLengthRow[] = [...acc.entries()]
    .map(([label, v]) => ({ label, totalMm: v.totalMm, count: v.count }))
    .sort((a, b) => {
      if (b.totalMm !== a.totalMm) return b.totalMm - a.totalMm;
      return a.label.localeCompare(b.label);
    });
  return { rows, totalMm };
}

export function buildBomReport(
  symbols: readonly ProjectSymbol[],
  wires: readonly Wire[],
  layers: readonly Layer[],
  filter: BomFilter,
): BomReport {
  const { hiddenCount } = applyLayerFilter(layers, filter);
  const sym = aggregateSymbols(symbols, layers, filter);
  const wir = aggregateWires(wires, symbols, layers, filter);
  return {
    symbolRows: sym.rows,
    symbolTotal: sym.total,
    wireRows: wir.rows,
    wireTotalMm: wir.totalMm,
    hiddenLayerCount: hiddenCount,
  };
}
