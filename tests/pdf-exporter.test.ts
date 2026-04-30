import { describe, it, expect } from 'vitest';
import {
  suggestedExportName,
  resolveAllowedLayers,
  filterRenderableEntities,
  getWirePdfStyle,
  computePageLayout,
  computePaperPerRealRatio,
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

describe('computePageLayout (Phase 2-E3b)', () => {
  it("paperSize='auto' + orientation='auto': 図面実寸そのまま、scale=1、offset=0", () => {
    const layout = computePageLayout(297, 420, 'auto', 'auto');
    expect(layout.pageWidthMm).toBe(297);
    expect(layout.pageHeightMm).toBe(420);
    expect(layout.scale).toBeCloseTo(1, 6);
    expect(layout.offsetX).toBeCloseTo(0, 6);
    expect(layout.offsetY).toBeCloseTo(0, 6);
    expect(layout.pageOrientation).toBe('portrait');
  });

  it("paperSize='auto' で横長図面 → orientation='auto' は landscape", () => {
    const layout = computePageLayout(420, 297, 'auto', 'auto');
    expect(layout.pageOrientation).toBe('landscape');
    expect(layout.pageWidthMm).toBe(420);
    expect(layout.pageHeightMm).toBe(297);
  });

  it("paperSize='A4' portrait + 図面 A3 → A4 にフィットする scale", () => {
    // A3 図面 (297×420) を A4 portrait (210×297) に収める
    const layout = computePageLayout(297, 420, 'A4', 'portrait');
    expect(layout.pageWidthMm).toBe(210);
    expect(layout.pageHeightMm).toBe(297);
    // scale = min(210/297, 297/420) = min(0.70707, 0.70714) = 210/297
    expect(layout.scale).toBeCloseTo(210 / 297, 4);
  });

  it("paperSize='A1' landscape + 図面 A4 → 拡大 (scale > 1)", () => {
    // A4 図面 (210×297) を A1 landscape (841×594) に収める
    const layout = computePageLayout(210, 297, 'A1', 'landscape');
    expect(layout.pageWidthMm).toBe(841);
    expect(layout.pageHeightMm).toBe(594);
    // scale = min(841/210, 594/297) = min(4.0, 2.0) = 2.0
    expect(layout.scale).toBeCloseTo(2.0, 4);
  });

  it('縦横比違いで中央寄せ offset が発生', () => {
    // 200×100 の図面 (アスペクト 2:1) を 100×100 の用紙に
    // scale = min(100/200, 100/100) = 0.5
    // 図面実寸 100×50、用紙 100×100、offsetY = (100 - 50) / 2 = 25
    const layout = computePageLayout(200, 100, 'auto', 'portrait');
    // auto + portrait なら paperShort=100, paperLong=200 で portrait → 100x200
    expect(layout.pageWidthMm).toBe(100);
    expect(layout.pageHeightMm).toBe(200);
    expect(layout.scale).toBeCloseTo(0.5, 4);
    expect(layout.offsetX).toBeCloseTo(0, 4);
    expect(layout.offsetY).toBeCloseTo((200 - 100 * 0.5) / 2, 4);
  });

  it("orientation='auto' は drawing 比で判断 (正方形は landscape 扱い)", () => {
    expect(computePageLayout(100, 100, 'A4', 'auto').pageOrientation).toBe('landscape');
    expect(computePageLayout(100, 200, 'A4', 'auto').pageOrientation).toBe('portrait');
    expect(computePageLayout(200, 100, 'A4', 'auto').pageOrientation).toBe('landscape');
  });

  it('A 系サイズの正規化: 短辺・長辺は固定値', () => {
    expect(computePageLayout(100, 100, 'A4', 'portrait').pageShortMm).toBe(210);
    expect(computePageLayout(100, 100, 'A4', 'portrait').pageLongMm).toBe(297);
    expect(computePageLayout(100, 100, 'A1', 'portrait').pageShortMm).toBe(594);
    expect(computePageLayout(100, 100, 'A1', 'portrait').pageLongMm).toBe(841);
  });
});

describe('computePaperPerRealRatio (Phase 2-E5)', () => {
  it('未校正なら 1.0 (恒等)', () => {
    expect(computePaperPerRealRatio({ widthMm: 297 }, 1684)).toBe(1);
  });

  it('校正値の realDistanceMm が 0 以下なら 1.0', () => {
    expect(
      computePaperPerRealRatio(
        { widthMm: 297, scale: { pixelDistanceCanvas: 100, realDistanceMm: 0 } },
        1684,
      ),
    ).toBe(1);
  });

  it('1/100 縮尺の校正で約 0.0095 (paper_mm / real_mm)', () => {
    // A3 (297mm 紙面) の canvas 1684 px、200 px ≈ 3700 mm 実寸
    const r = computePaperPerRealRatio(
      {
        widthMm: 297,
        scale: { pixelDistanceCanvas: 200, realDistanceMm: 3700 },
      },
      1684,
    );
    // paperPxPerMm = 1684/297 ≈ 5.67
    // pxPerMmReal  = 200/3700  ≈ 0.054
    // paper_mm/real_mm = pxPerMmReal / paperPxPerMm ≈ 0.0095 (≈ 1/105)
    expect(r).toBeCloseTo(0.0095, 3);
  });

  it('5000 mm の実寸位置を変換すると約 47.6 mm の紙面位置になる (1/100 縮尺)', () => {
    const r = computePaperPerRealRatio(
      {
        widthMm: 297,
        scale: { pixelDistanceCanvas: 200, realDistanceMm: 3700 },
      },
      1684,
    );
    expect(5000 * r).toBeCloseTo(47.7, 0); // ±0.5mm 程度
  });
});

describe('getWirePdfStyle (Phase 2-E3a / Phase 2-E4)', () => {
  it('ceiling: 実線 (dash なし)', () => {
    const s = getWirePdfStyle('ceiling');
    expect(s.dash).toBeUndefined();
  });

  it('floor: 破線', () => {
    const s = getWirePdfStyle('floor');
    expect(s.dash).toBeDefined();
    expect(s.dash!.length).toBe(2);
  });

  it('concealed: 点線 (floor より細かい dash)', () => {
    const concealed = getWirePdfStyle('concealed');
    const floor = getWirePdfStyle('floor');
    expect(concealed.dash).toBeDefined();
    expect(concealed.dash![0]).toBeLessThan(floor.dash![0]!);
  });

  it('exposed: 実線 (Phase 2-E4 で青固定廃止、色はレイヤー由来)', () => {
    const s = getWirePdfStyle('exposed');
    expect(s.dash).toBeUndefined();
  });
});
