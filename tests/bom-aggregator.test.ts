import { describe, it, expect } from 'vitest';
import {
  aggregateSymbols,
  aggregateWires,
  buildBomReport,
} from '../src/data/bom-aggregator';
import type {
  Layer,
  ProjectSymbol,
  Wire,
  SymbolType,
  CableType,
} from '../src/data/types';

// Phase 2-E1: F-09 拾い出し集計の単体テスト。

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
  cableCustom?: string;
  lengthMm?: number;
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
    ...(opts.cableCustom !== undefined ? { cableCustom: opts.cableCustom } : {}),
    circuit: '',
    lengthMm: opts.lengthMm ?? 0,
    layerId: opts.layerId,
  };
}

describe('aggregateSymbols', () => {
  const layers = [makeLayer('a'), makeLayer('b'), makeLayer('hidden', { visible: false })];

  it('種別ごとに count を集計する', () => {
    const symbols = [
      makeSymbol('1', 'downlight', 'a'),
      makeSymbol('2', 'downlight', 'a'),
      makeSymbol('3', 'outlet-general', 'a'),
    ];
    const { rows, total } = aggregateSymbols(symbols, layers, { visibleOnly: true });
    expect(total).toBe(3);
    const downlight = rows.find((r) => r.type === 'downlight');
    expect(downlight?.count).toBe(2);
    const outlet = rows.find((r) => r.type === 'outlet-general');
    expect(outlet?.count).toBe(1);
  });

  it('count 多い順 → 同数なら type 名でソート', () => {
    const symbols = [
      makeSymbol('1', 'switch-1pole', 'a'),
      makeSymbol('2', 'downlight', 'a'),
      makeSymbol('3', 'downlight', 'a'),
      makeSymbol('4', 'downlight', 'a'),
      makeSymbol('5', 'outlet-general', 'a'),
      makeSymbol('6', 'outlet-general', 'a'),
    ];
    const { rows } = aggregateSymbols(symbols, layers, { visibleOnly: true });
    expect(rows.map((r) => r.type)).toEqual([
      'downlight', // 3
      'outlet-general', // 2
      'switch-1pole', // 1
    ]);
  });

  it('visibleOnly=true なら hidden レイヤー所属を除外', () => {
    const symbols = [
      makeSymbol('1', 'downlight', 'a'),
      makeSymbol('2', 'downlight', 'hidden'),
      makeSymbol('3', 'downlight', 'b'),
    ];
    const { total } = aggregateSymbols(symbols, layers, { visibleOnly: true });
    expect(total).toBe(2);
  });

  it('visibleOnly=false なら全レイヤー対象', () => {
    const symbols = [
      makeSymbol('1', 'downlight', 'a'),
      makeSymbol('2', 'downlight', 'hidden'),
    ];
    const { total } = aggregateSymbols(symbols, layers, { visibleOnly: false });
    expect(total).toBe(2);
  });

  it('シンボル 0 個なら空 + total 0', () => {
    const { rows, total } = aggregateSymbols([], layers, { visibleOnly: true });
    expect(rows).toEqual([]);
    expect(total).toBe(0);
  });
});

describe('aggregateWires', () => {
  const layers = [
    makeLayer('a'),
    makeLayer('b'),
    makeLayer('hidden', { visible: false }),
  ];
  const symbols: ProjectSymbol[] = [
    makeSymbol('s1', 'downlight', 'a'),
    makeSymbol('s2', 'downlight', 'a'),
    makeSymbol('s-hidden', 'downlight', 'hidden'),
  ];

  it('cable 種別ごとに totalMm を集計', () => {
    const wires = [
      makeWire({ id: 'w1', layerId: 'a', cable: 'VVF1.6×2C', lengthMm: 1000 }),
      makeWire({ id: 'w2', layerId: 'a', cable: 'VVF1.6×2C', lengthMm: 500 }),
      makeWire({ id: 'w3', layerId: 'a', cable: 'CV', lengthMm: 200 }),
    ];
    const { rows, totalMm } = aggregateWires(wires, symbols, layers, {
      visibleOnly: true,
    });
    expect(totalMm).toBe(1700);
    const vvf = rows.find((r) => r.label === 'VVF1.6×2C');
    expect(vvf?.totalMm).toBe(1500);
    expect(vvf?.count).toBe(2);
    const cv = rows.find((r) => r.label === 'CV');
    expect(cv?.totalMm).toBe(200);
    expect(cv?.count).toBe(1);
  });

  it("cable='その他' + cableCustom があれば label に custom を使う", () => {
    const wires = [
      makeWire({
        id: 'w1',
        layerId: 'a',
        cable: 'その他',
        cableCustom: 'VVF1.6×3C',
        lengthMm: 100,
      }),
    ];
    const { rows } = aggregateWires(wires, symbols, layers, { visibleOnly: true });
    expect(rows[0]?.label).toBe('VVF1.6×3C');
  });

  it("cable='その他' + cableCustom 空文字 / undefined はラベル「その他」", () => {
    const wires = [
      makeWire({ id: 'w1', layerId: 'a', cable: 'その他', lengthMm: 50 }),
      makeWire({
        id: 'w2',
        layerId: 'a',
        cable: 'その他',
        cableCustom: '   ',
        lengthMm: 50,
      }),
    ];
    const { rows } = aggregateWires(wires, symbols, layers, { visibleOnly: true });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.label).toBe('その他');
    expect(rows[0]?.totalMm).toBe(100);
  });

  it('hidden レイヤー所属の wire は visibleOnly=true で除外', () => {
    const wires = [
      makeWire({ id: 'w1', layerId: 'a', lengthMm: 100 }),
      makeWire({ id: 'w2', layerId: 'hidden', lengthMm: 999 }),
    ];
    const { totalMm } = aggregateWires(wires, symbols, layers, {
      visibleOnly: true,
    });
    expect(totalMm).toBe(100);
  });

  it('端点 symbol が hidden レイヤー所属なら wire 自体も除外 (WireLayer 描画と整合)', () => {
    const wires = [
      makeWire({
        id: 'w1',
        layerId: 'a',
        lengthMm: 200,
        fromSymbolId: 's1',
        toSymbolId: 's-hidden',
      }),
      makeWire({
        id: 'w2',
        layerId: 'a',
        lengthMm: 100,
        fromSymbolId: 's1',
        toSymbolId: 's2',
      }),
    ];
    const { totalMm } = aggregateWires(wires, symbols, layers, {
      visibleOnly: true,
    });
    expect(totalMm).toBe(100); // w2 のみ
  });

  it('totalMm 多い順 → 同数なら label でソート', () => {
    const wires = [
      makeWire({ id: 'w1', layerId: 'a', cable: 'CV', lengthMm: 50 }),
      makeWire({ id: 'w2', layerId: 'a', cable: 'VVF1.6×2C', lengthMm: 200 }),
      makeWire({ id: 'w3', layerId: 'a', cable: 'IV', lengthMm: 100 }),
    ];
    const { rows } = aggregateWires(wires, symbols, layers, { visibleOnly: true });
    expect(rows.map((r) => r.label)).toEqual(['VVF1.6×2C', 'IV', 'CV']);
  });
});

describe('buildBomReport', () => {
  const layers = [
    makeLayer('a'),
    makeLayer('hidden', { visible: false }),
  ];

  it('全体のサマリと hiddenLayerCount を返す', () => {
    const symbols = [
      makeSymbol('s1', 'downlight', 'a'),
      makeSymbol('s2', 'downlight', 'a'),
      makeSymbol('s3', 'downlight', 'hidden'),
    ];
    const wires = [
      // 端点が両方とも visible レイヤー所属 → 集計対象
      makeWire({
        id: 'w1',
        layerId: 'a',
        lengthMm: 1000,
        fromSymbolId: 's1',
        toSymbolId: 's2',
      }),
    ];
    const report = buildBomReport(symbols, wires, layers, { visibleOnly: true });
    expect(report.symbolTotal).toBe(2);
    expect(report.wireTotalMm).toBe(1000);
    expect(report.hiddenLayerCount).toBe(1);
  });

  it('visibleOnly=false なら hiddenLayerCount=0 + 全レイヤー対象', () => {
    const symbols = [
      makeSymbol('s1', 'downlight', 'a'),
      makeSymbol('s2', 'downlight', 'hidden'),
    ];
    const report = buildBomReport(symbols, [], layers, { visibleOnly: false });
    expect(report.symbolTotal).toBe(2);
    expect(report.hiddenLayerCount).toBe(0);
  });

  it('空状態 (symbol も wire も 0) でも安全に動作', () => {
    const report = buildBomReport([], [], layers, { visibleOnly: true });
    expect(report.symbolTotal).toBe(0);
    expect(report.wireTotalMm).toBe(0);
    expect(report.symbolRows).toEqual([]);
    expect(report.wireRows).toEqual([]);
  });
});
