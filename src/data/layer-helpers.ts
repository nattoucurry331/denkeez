// Phase 2-D3: レイヤーに対する純粋なクエリヘルパ。
// UI 層 (SymbolsLayer / CanvasArea / use-keyboard-shortcuts) で繰り返し使うため、
// 単体テスト可能な純粋関数として分離する。

import type { Layer, ProjectSymbol, Wire } from './types';

/** layers から「ロック中」のレイヤー ID 集合を返す */
export function lockedLayerIds(layers: readonly Layer[]): ReadonlySet<string> {
  return new Set(layers.filter((l) => l.locked).map((l) => l.id));
}

/** 指定 entity がロック中レイヤーに所属しているか */
export function isOnLockedLayer(
  entity: { layerId: string },
  layers: readonly Layer[],
): boolean {
  const target = layers.find((l) => l.id === entity.layerId);
  return target?.locked === true;
}

/** layerId → 配列 index のマップを構築 (z-index ソートで使用) */
function buildLayerOrderIndex(layers: readonly Layer[]): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < layers.length; i++) {
    m.set(layers[i]!.id, i);
  }
  return m;
}

/**
 * z-index 視覚順 (案 B): layers 配列内のインデックスが小さい順 (= 下層) に並べる。
 * 同一レイヤー内では元の順序を保つ (stable sort)。
 */
export function sortSymbolsByLayerOrder(
  symbols: readonly ProjectSymbol[],
  layers: readonly Layer[],
): ProjectSymbol[] {
  const orderIndex = buildLayerOrderIndex(layers);
  return [...symbols].sort((a, b) => {
    const ai = orderIndex.get(a.layerId) ?? -1;
    const bi = orderIndex.get(b.layerId) ?? -1;
    return ai - bi;
  });
}

export function sortWiresByLayerOrder(
  wires: readonly Wire[],
  layers: readonly Layer[],
): Wire[] {
  const orderIndex = buildLayerOrderIndex(layers);
  return [...wires].sort((a, b) => {
    const ai = orderIndex.get(a.layerId) ?? -1;
    const bi = orderIndex.get(b.layerId) ?? -1;
    return ai - bi;
  });
}

/** 与えられた id 配列のうち、ロック中レイヤーに所属するものを除外して返す。
 *  矢印キー移動・Delete 削除など、ロック中は無視したい操作で使う。 */
export function filterEditableSymbolIds(
  ids: readonly string[],
  symbols: readonly ProjectSymbol[],
  layers: readonly Layer[],
): string[] {
  const locked = lockedLayerIds(layers);
  if (locked.size === 0) return [...ids];
  const idSet = new Set(ids);
  return symbols
    .filter((s) => idSet.has(s.id) && !locked.has(s.layerId))
    .map((s) => s.id);
}

/** symbols + wires から ID を引いて編集可能なものだけ残す (Delete 用) */
export function filterEditableEntityIds(
  ids: readonly string[],
  symbols: readonly ProjectSymbol[],
  wires: readonly Wire[],
  layers: readonly Layer[],
): string[] {
  const locked = lockedLayerIds(layers);
  if (locked.size === 0) return [...ids];
  const idSet = new Set(ids);
  const result: string[] = [];
  for (const s of symbols) {
    if (idSet.has(s.id) && !locked.has(s.layerId)) result.push(s.id);
  }
  for (const w of wires) {
    if (idSet.has(w.id) && !locked.has(w.layerId)) result.push(w.id);
  }
  return result;
}
