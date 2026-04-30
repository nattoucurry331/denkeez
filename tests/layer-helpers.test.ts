import { describe, it, expect } from 'vitest';
import {
  isOnLockedLayer,
  lockedLayerIds,
  sortSymbolsByLayerOrder,
  sortWiresByLayerOrder,
  filterEditableSymbolIds,
  filterEditableEntityIds,
} from '../src/data/layer-helpers';
import type { Layer, ProjectSymbol, Wire } from '../src/data/types';

// Phase 2-D3: ロック挙動・z-index 順ソートに使う純粋ヘルパの単体テスト。

function makeLayer(id: string, overrides?: Partial<Layer>): Layer {
  return {
    id,
    name: id,
    color: '#888',
    visible: true,
    locked: false,
    kind: 'user',
    ...overrides,
  };
}

function makeSymbol(id: string, layerId: string): ProjectSymbol {
  return {
    id,
    type: 'downlight',
    position: { x: 0, y: 0 },
    rotation: 0,
    properties: {},
    layerId,
  };
}

function makeWire(id: string, layerId: string, fromId = 'sa', toId = 'sb'): Wire {
  return {
    id,
    fromSymbolId: fromId,
    toSymbolId: toId,
    waypoints: [],
    type: 'ceiling',
    cable: 'VVF1.6×2C',
    circuit: '',
    lengthMm: 0,
    layerId,
  };
}

describe('lockedLayerIds', () => {
  it('locked: true のレイヤー ID だけを返す', () => {
    const layers = [
      makeLayer('a', { locked: true }),
      makeLayer('b'),
      makeLayer('c', { locked: true }),
    ];
    const ids = lockedLayerIds(layers);
    expect(ids.has('a')).toBe(true);
    expect(ids.has('b')).toBe(false);
    expect(ids.has('c')).toBe(true);
  });

  it('全レイヤー unlocked なら空 Set', () => {
    const layers = [makeLayer('a'), makeLayer('b')];
    expect(lockedLayerIds(layers).size).toBe(0);
  });
});

describe('isOnLockedLayer', () => {
  const layers = [makeLayer('a', { locked: true }), makeLayer('b')];

  it('ロック中レイヤー所属なら true', () => {
    expect(isOnLockedLayer({ layerId: 'a' }, layers)).toBe(true);
  });

  it('非ロックレイヤー所属なら false', () => {
    expect(isOnLockedLayer({ layerId: 'b' }, layers)).toBe(false);
  });

  it('存在しないレイヤー ID なら false', () => {
    expect(isOnLockedLayer({ layerId: 'nonexistent' }, layers)).toBe(false);
  });
});

describe('sortSymbolsByLayerOrder', () => {
  // layers[0] = 最下層、layers[N-1] = 最上層
  const layers = [makeLayer('bg'), makeLayer('mid'), makeLayer('top')];

  it('layers 配列のインデックス順に並び替える (下層 → 上層)', () => {
    const symbols = [
      makeSymbol('s-top', 'top'),
      makeSymbol('s-bg', 'bg'),
      makeSymbol('s-mid', 'mid'),
    ];
    const sorted = sortSymbolsByLayerOrder(symbols, layers);
    expect(sorted.map((s) => s.id)).toEqual(['s-bg', 's-mid', 's-top']);
  });

  it('同一レイヤー内では元の順序を保つ (stable sort)', () => {
    const symbols = [
      makeSymbol('s-1', 'bg'),
      makeSymbol('s-2', 'top'),
      makeSymbol('s-3', 'bg'),
      makeSymbol('s-4', 'top'),
    ];
    const sorted = sortSymbolsByLayerOrder(symbols, layers);
    expect(sorted.map((s) => s.id)).toEqual(['s-1', 's-3', 's-2', 's-4']);
  });

  it('元配列を変更しない', () => {
    const symbols = [makeSymbol('s-1', 'top'), makeSymbol('s-2', 'bg')];
    const before = [...symbols];
    sortSymbolsByLayerOrder(symbols, layers);
    expect(symbols).toEqual(before);
  });

  it('存在しないレイヤー ID は最下層扱い (index -1)', () => {
    const symbols = [
      makeSymbol('s-orphan', 'nonexistent'),
      makeSymbol('s-bg', 'bg'),
    ];
    const sorted = sortSymbolsByLayerOrder(symbols, layers);
    expect(sorted[0]?.id).toBe('s-orphan');
    expect(sorted[1]?.id).toBe('s-bg');
  });
});

describe('sortWiresByLayerOrder', () => {
  const layers = [makeLayer('bg'), makeLayer('top')];

  it('wire も layers index 順にソートされる', () => {
    const wires = [makeWire('w-top', 'top'), makeWire('w-bg', 'bg')];
    const sorted = sortWiresByLayerOrder(wires, layers);
    expect(sorted.map((w) => w.id)).toEqual(['w-bg', 'w-top']);
  });
});

describe('filterEditableSymbolIds', () => {
  const layers = [
    makeLayer('locked-l', { locked: true }),
    makeLayer('open-l'),
  ];
  const symbols = [
    makeSymbol('s-locked', 'locked-l'),
    makeSymbol('s-open', 'open-l'),
  ];

  it('ロック中レイヤー所属の id を除外する', () => {
    const result = filterEditableSymbolIds(['s-locked', 's-open'], symbols, layers);
    expect(result).toEqual(['s-open']);
  });

  it('全 layer が unlocked なら id 全部そのまま返す', () => {
    const allOpen = layers.map((l) => ({ ...l, locked: false }));
    const result = filterEditableSymbolIds(['s-locked', 's-open'], symbols, allOpen);
    expect(result.sort()).toEqual(['s-locked', 's-open'].sort());
  });

  it('空配列を渡しても空配列', () => {
    expect(filterEditableSymbolIds([], symbols, layers)).toEqual([]);
  });

  it('存在しない symbol id は無視される', () => {
    const result = filterEditableSymbolIds(['nonexistent', 's-open'], symbols, layers);
    expect(result).toEqual(['s-open']);
  });
});

describe('filterEditableEntityIds (symbol + wire 混在)', () => {
  const layers = [
    makeLayer('locked-l', { locked: true }),
    makeLayer('open-l'),
  ];
  const symbols = [
    makeSymbol('s-locked', 'locked-l'),
    makeSymbol('s-open', 'open-l'),
  ];
  const wires = [
    makeWire('w-locked', 'locked-l'),
    makeWire('w-open', 'open-l'),
  ];

  it('ロック中レイヤー所属の symbol / wire を除外', () => {
    const result = filterEditableEntityIds(
      ['s-locked', 's-open', 'w-locked', 'w-open'],
      symbols,
      wires,
      layers,
    );
    expect(result.sort()).toEqual(['s-open', 'w-open'].sort());
  });

  it('全 layer unlocked なら全部残る', () => {
    const allOpen = layers.map((l) => ({ ...l, locked: false }));
    const result = filterEditableEntityIds(
      ['s-locked', 's-open', 'w-locked', 'w-open'],
      symbols,
      wires,
      allOpen,
    );
    expect(result.sort()).toEqual(['s-locked', 's-open', 'w-locked', 'w-open'].sort());
  });
});
