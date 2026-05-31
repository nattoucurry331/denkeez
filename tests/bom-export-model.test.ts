// Phase 3 (F-21) 3-I1: BOM 中間表現 buildBomLineItems の単体テスト。

import { describe, it, expect } from 'vitest';
import { buildBomLineItems } from '../src/export/bom-export-model';
import type { Layer, ProjectSymbol, Wire } from '../src/data/types';

const layer = (id: string, visible = true): Layer => ({
  id,
  name: id,
  visible,
  locked: false,
  color: '#000000',
  kind: 'user',
});

const sym = (
  id: string,
  type: ProjectSymbol['type'],
  layerId: string,
  properties: Record<string, string> = {},
): ProjectSymbol => ({
  id,
  type,
  position: { x: 0, y: 0 },
  rotation: 0,
  properties,
  layerId,
});

const wire = (
  id: string,
  layerId: string,
  cable: Wire['cable'],
  lengthMm: number,
  extra: Partial<Wire> = {},
): Wire => ({
  id,
  fromSymbolId: 'a',
  toSymbolId: 'b',
  layerId,
  cable,
  lengthMm,
  type: 'concealed',
  circuit: '',
  waypoints: [],
  ...extra,
});

const ALL: { visibleOnly: boolean } = { visibleOnly: false };

describe('buildBomLineItems', () => {
  it('同種別・同規格のシンボルを個数集計する', () => {
    const layers = [layer('L1')];
    const symbols = [
      sym('1', 'downlight', 'L1'),
      sym('2', 'downlight', 'L1'),
      sym('3', 'downlight', 'L1'),
    ];
    const items = buildBomLineItems(symbols, [], layers, ALL);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'symbol', quantity: 3, unit: '個' });
  });

  it('回路番号を重複なし昇順で集める', () => {
    const layers = [layer('L1')];
    const symbols = [
      sym('1', 'downlight', 'L1', { circuit: 'L-2' }),
      sym('2', 'downlight', 'L1', { circuit: 'L-1' }),
      sym('3', 'downlight', 'L1', { circuit: 'L-1' }),
    ];
    const items = buildBomLineItems(symbols, [], layers, ALL);
    expect(items[0]?.circuits).toEqual(['L-1', 'L-2']);
  });

  it('配線は種別ごとに総長(メートル・未丸め)を集計する', () => {
    const layers = [layer('L1')];
    const wires = [
      wire('w1', 'L1', 'VVF1.6×2C', 1500),
      wire('w2', 'L1', 'VVF1.6×2C', 2000),
    ];
    const items = buildBomLineItems([], wires, layers, ALL);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'wire', type: '配線', unit: 'm' });
    expect(items[0]?.quantity).toBeCloseTo(3.5, 5);
  });

  it('シンボル明細(個数多い順) → 配線明細 の順に並ぶ', () => {
    const layers = [layer('L1')];
    const symbols = [sym('1', 'downlight', 'L1'), sym('2', 'outlet-general', 'L1'), sym('3', 'downlight', 'L1')];
    const wires = [wire('w1', 'L1', 'VVF1.6×2C', 1000)];
    const items = buildBomLineItems(symbols, wires, layers, ALL);
    expect(items.map((i) => i.kind)).toEqual(['symbol', 'symbol', 'wire']);
    // 個数多い downlight(2) が先頭
    expect(items[0]?.quantity).toBe(2);
  });

  it('visibleOnly=true は非表示レイヤーのシンボルを除外する', () => {
    const layers = [layer('L1', true), layer('L2', false)];
    const symbols = [sym('1', 'downlight', 'L1'), sym('2', 'downlight', 'L2')];
    const items = buildBomLineItems(symbols, [], layers, { visibleOnly: true });
    expect(items).toHaveLength(1);
    expect(items[0]?.quantity).toBe(1);
  });

  it('端点シンボルが非表示レイヤーの配線は除外する', () => {
    const layers = [layer('WL', true), layer('SL', false)];
    const symbols = [sym('a', 'downlight', 'SL'), sym('b', 'downlight', 'SL')];
    const wires = [wire('w1', 'WL', 'VVF1.6×2C', 1000)];
    const items = buildBomLineItems(symbols, wires, layers, { visibleOnly: true });
    expect(items).toHaveLength(0);
  });

  it('ケーブル「その他」は cableCustom をラベルにする', () => {
    const layers = [layer('L1')];
    const wires = [wire('w1', 'L1', 'その他', 1000, { cableCustom: 'CVV 2C' })];
    const items = buildBomLineItems([], wires, layers, ALL);
    expect(items[0]?.spec).toBe('CVV 2C');
  });
});
