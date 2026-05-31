// Phase 3 (F-21) 3-I1: 拾い出し(BOM)の中間表現。
//
// CSV / JSON など複数の出力形式が同じ集計結果を共有するための、形式非依存の
// 明細行モデル。csv-exporter / json-exporter はこの BomLineItem[] を整形するだけにし、
// 集計ロジック(レイヤーフィルタ・グループ化・並び順)を一箇所に集約する (DRY)。
//
// 振る舞いは従来 csv-exporter の buildSymbolRows / buildWireRows と完全一致させる:
//   - シンボル: (種別名, 規格) でグループ化、個数を集計、回路番号を収集
//   - 配線: ケーブルラベル単位で総長(mm)を集計、回路番号を収集
//   - 並び順: 数量(配線は総長)の多い順 → 同数は種別名/ラベル → 規格 で安定化

import type { Layer, ProjectSymbol, PropertyValue, Wire } from '../data/types';
import { getSymbolDefinition } from '../symbols/symbol-registry';
import { formatSymbolSpec } from '../symbols/symbol-spec';
import type { BomFilter } from '../data/bom-aggregator';

/** 出力形式に依存しない拾い出し明細 1 行。 */
export interface BomLineItem {
  /** 'symbol' = 機器(個数), 'wire' = 配線(総長) */
  kind: 'symbol' | 'wire';
  /** 種別名 (シンボルは登録名 or type、配線は '配線') */
  type: string;
  /** 規格 (シンボルは formatSymbolSpec、配線はケーブルラベル) */
  spec: string;
  /**
   * 数量。kind='symbol' は個数(整数)、kind='wire' は総長(メートル、未丸め)。
   * 表示時の丸め(配線の小数1桁等)は各 exporter の責務。
   */
  quantity: number;
  /** 数量の単位 */
  unit: '個' | 'm';
  /** 回路番号(重複なし・昇順ソート済み)。未指定なら空配列。 */
  circuits: string[];
}

function allowedLayerIds(layers: readonly Layer[], filter: BomFilter): ReadonlySet<string> {
  if (!filter.visibleOnly) return new Set(layers.map((l) => l.id));
  return new Set(layers.filter((l) => l.visible).map((l) => l.id));
}

function readNonEmptyString(v: PropertyValue | undefined): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

function wireLabel(w: Wire): string {
  if (w.cable === 'その他') {
    const c = w.cableCustom?.trim();
    return c && c.length > 0 ? c : 'その他';
  }
  return w.cable;
}

function buildSymbolItems(
  symbols: readonly ProjectSymbol[],
  layers: readonly Layer[],
  filter: BomFilter,
): BomLineItem[] {
  const allowed = allowedLayerIds(layers, filter);
  const groups = new Map<
    string,
    { typeName: string; spec: string; count: number; circuits: Set<string> }
  >();
  for (const sym of symbols) {
    if (!allowed.has(sym.layerId)) continue;
    const def = getSymbolDefinition(sym.type);
    const typeName = def?.name ?? sym.type;
    const spec = formatSymbolSpec(sym);
    const key = `${typeName} ${spec}`;
    let group = groups.get(key);
    if (!group) {
      group = { typeName, spec, count: 0, circuits: new Set<string>() };
      groups.set(key, group);
    }
    group.count += 1;
    const circuit = readNonEmptyString(sym.properties.circuit);
    if (circuit) group.circuits.add(circuit);
  }
  const ordered = [...groups.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.typeName !== b.typeName) return a.typeName.localeCompare(b.typeName);
    return a.spec.localeCompare(b.spec);
  });
  return ordered.map((g) => ({
    kind: 'symbol' as const,
    type: g.typeName,
    spec: g.spec,
    quantity: g.count,
    unit: '個' as const,
    circuits: [...g.circuits].sort(),
  }));
}

function buildWireItems(
  wires: readonly Wire[],
  symbols: readonly ProjectSymbol[],
  layers: readonly Layer[],
  filter: BomFilter,
): BomLineItem[] {
  const allowed = allowedLayerIds(layers, filter);
  const symbolLayer = new Map(symbols.map((s) => [s.id, s.layerId]));
  const groups = new Map<string, { label: string; totalMm: number; circuits: Set<string> }>();
  for (const w of wires) {
    if (!allowed.has(w.layerId)) continue;
    const fromLayer = symbolLayer.get(w.fromSymbolId);
    const toLayer = symbolLayer.get(w.toSymbolId);
    if (fromLayer !== undefined && !allowed.has(fromLayer)) continue;
    if (toLayer !== undefined && !allowed.has(toLayer)) continue;
    const label = wireLabel(w);
    let group = groups.get(label);
    if (!group) {
      group = { label, totalMm: 0, circuits: new Set<string>() };
      groups.set(label, group);
    }
    group.totalMm += w.lengthMm;
    if (w.circuit && w.circuit.trim().length > 0) {
      group.circuits.add(w.circuit.trim());
    }
  }
  const ordered = [...groups.values()].sort((a, b) => {
    if (b.totalMm !== a.totalMm) return b.totalMm - a.totalMm;
    return a.label.localeCompare(b.label);
  });
  return ordered.map((g) => ({
    kind: 'wire' as const,
    type: '配線',
    spec: g.label,
    // 総長はメートル(未丸め)で保持。表示丸めは exporter 側。
    quantity: g.totalMm / 1000,
    unit: 'm' as const,
    circuits: [...g.circuits].sort(),
  }));
}

/**
 * Project から拾い出し明細(中間表現)を生成する。
 * シンボル明細(個数多い順) → 配線明細(総長多い順) の順で並ぶ。
 */
export function buildBomLineItems(
  symbols: readonly ProjectSymbol[],
  wires: readonly Wire[],
  layers: readonly Layer[],
  filter: BomFilter,
): BomLineItem[] {
  return [
    ...buildSymbolItems(symbols, layers, filter),
    ...buildWireItems(wires, symbols, layers, filter),
  ];
}
