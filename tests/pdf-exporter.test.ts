import { describe, it, expect } from 'vitest';
import {
  suggestedExportName,
  resolveAllowedLayers,
  filterRenderableEntities,
  getWirePdfStyle,
} from '../src/export/pdf-exporter';
import type {
  Layer,
  Project,
  ProjectSymbol,
  Wire,
  SymbolType,
  CableType,
} from '../src/data/types';
import { BACKGROUND_LAYER_ID } from '../src/data/types';
import { SCHEMA_VERSION } from '../src/shared/constants/app';

// exportProjectAsPdf 自体は HTMLCanvasElement (DOM) と jsPDF の DOM 依存があるため
// Node 環境の Vitest では完全にテストできない。
// Phase 2-E3a で純粋ロジックを抽出し、レイヤーフィルタ等は単体テスト可能にした。
// integration test は Phase 2 完了後 happy-dom 導入時に追加予定。

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

function makeBackgroundLayer(overrides?: Partial<Layer>): Layer {
  return {
    id: BACKGROUND_LAYER_ID,
    name: '元図面',
    color: '#888',
    visible: true,
    locked: true,
    kind: 'background',
    ...overrides,
  };
}

function makeSymbol(id: string, type: SymbolType, layerId: string): ProjectSymbol {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    rotation: 0,
    properties: {},
    layerId,
  };
}

function makeWire(opts: {
  id: string;
  layerId: string;
  cable?: CableType;
  fromSymbolId?: string;
  toSymbolId?: string;
}): Wire {
  return {
    id: opts.id,
    fromSymbolId: opts.fromSymbolId ?? 's1',
    toSymbolId: opts.toSymbolId ?? 's2',
    waypoints: [],
    type: 'ceiling',
    cable: opts.cable ?? 'VVF1.6×2C',
    circuit: '',
    lengthMm: 0,
    layerId: opts.layerId,
  };
}

function makeProject(name: string): Project {
  return {
    meta: {
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      name,
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
      appVersion: '0.1.0',
      schemaVersion: SCHEMA_VERSION,
    },
    drawing: null,
    layers: [makeBackgroundLayer()],
    symbols: [],
  };
}

describe('suggestedExportName', () => {
  it('プロジェクト名から PDF ファイル名を組み立てる', () => {
    expect(suggestedExportName(makeProject('現場A'))).toBe('現場A.pdf');
  });

  it('プロジェクト名が空ならフォールバック名', () => {
    expect(suggestedExportName(makeProject(''))).toBe('denkeez-export.pdf');
  });

  it('前後空白は trim する', () => {
    expect(suggestedExportName(makeProject('  古川邸  '))).toBe('古川邸.pdf');
  });
});

describe('resolveAllowedLayers (Phase 2-E3a)', () => {
  const layers = [
    makeBackgroundLayer({ visible: true }),
    makeLayer('a', { visible: true }),
    makeLayer('hidden', { visible: false }),
  ];

  it('layerIds 未指定 → visible: true のレイヤーのみ', () => {
    const allowed = resolveAllowedLayers(layers, undefined);
    expect(allowed.has(BACKGROUND_LAYER_ID)).toBe(true);
    expect(allowed.has('a')).toBe(true);
    expect(allowed.has('hidden')).toBe(false);
  });

  it('layerIds 明示指定 → そのまま採用 (visible 関係なし)', () => {
    const allowed = resolveAllowedLayers(layers, ['a', 'hidden']);
    expect(allowed.has('a')).toBe(true);
    expect(allowed.has('hidden')).toBe(true);
    expect(allowed.has(BACKGROUND_LAYER_ID)).toBe(false);
  });

  it('layerIds=[] (空配列) は「何も出力しない」と解釈', () => {
    const allowed = resolveAllowedLayers(layers, []);
    expect(allowed.size).toBe(0);
  });

  it('全レイヤーが visible: false で layerIds 未指定 → 何も出力しない', () => {
    const allHidden = layers.map((l) => ({ ...l, visible: false }));
    const allowed = resolveAllowedLayers(allHidden, undefined);
    expect(allowed.size).toBe(0);
  });
});

describe('filterRenderableEntities (Phase 2-E3a)', () => {
  it('シンボル: layerId が allowed でないと除外', () => {
    const symbols = [makeSymbol('s1', 'downlight', 'a'), makeSymbol('s2', 'downlight', 'hidden')];
    const { symbols: out } = filterRenderableEntities(symbols, [], new Set(['a']));
    expect(out.map((s) => s.id)).toEqual(['s1']);
  });

  it('配線: wire.layerId が allowed でないと除外', () => {
    const symbols = [makeSymbol('s1', 'downlight', 'a'), makeSymbol('s2', 'downlight', 'a')];
    const wires = [
      makeWire({ id: 'w1', layerId: 'a' }),
      makeWire({ id: 'w2', layerId: 'hidden' }),
    ];
    const { wires: out } = filterRenderableEntities(symbols, wires, new Set(['a']));
    expect(out.map((w) => w.id)).toEqual(['w1']);
  });

  it('配線: 端点 symbol が allowed 外なら除外 (WireLayer / BomPanel と整合)', () => {
    const symbols = [
      makeSymbol('s-vis', 'downlight', 'a'),
      makeSymbol('s-hid', 'downlight', 'hidden'),
    ];
    const wires = [
      makeWire({ id: 'w1', layerId: 'a', fromSymbolId: 's-vis', toSymbolId: 's-vis' }),
      makeWire({ id: 'w2', layerId: 'a', fromSymbolId: 's-vis', toSymbolId: 's-hid' }),
    ];
    const { wires: out } = filterRenderableEntities(symbols, wires, new Set(['a']));
    expect(out.map((w) => w.id)).toEqual(['w1']);
  });

  it('全レイヤー allowed なら全 entity が残る', () => {
    const symbols = [makeSymbol('s1', 'downlight', 'a'), makeSymbol('s2', 'downlight', 'b')];
    const wires = [makeWire({ id: 'w1', layerId: 'a', fromSymbolId: 's1', toSymbolId: 's2' })];
    const { symbols: outSym, wires: outWire } = filterRenderableEntities(
      symbols,
      wires,
      new Set(['a', 'b']),
    );
    expect(outSym).toHaveLength(2);
    expect(outWire).toHaveLength(1);
  });
});

describe('getWirePdfStyle (Phase 2-E3a)', () => {
  it('ceiling: 黒実線', () => {
    const s = getWirePdfStyle('ceiling');
    expect(s.color).toEqual([0, 0, 0]);
    expect(s.dash).toBeUndefined();
  });

  it('floor: 黒破線', () => {
    const s = getWirePdfStyle('floor');
    expect(s.color).toEqual([0, 0, 0]);
    expect(s.dash).toBeDefined();
    expect(s.dash!.length).toBe(2);
  });

  it('concealed: 黒点線 (dash パターンが floor より細かい)', () => {
    const concealed = getWirePdfStyle('concealed');
    const floor = getWirePdfStyle('floor');
    expect(concealed.dash).toBeDefined();
    expect(concealed.dash![0]).toBeLessThan(floor.dash![0]!);
  });

  it('exposed: 青実線', () => {
    const s = getWirePdfStyle('exposed');
    expect(s.color[2]).toBeGreaterThan(s.color[0]); // R < B
    expect(s.dash).toBeUndefined();
  });
});
