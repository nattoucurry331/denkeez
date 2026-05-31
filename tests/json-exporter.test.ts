// Phase 3 (F-21) 3-I2: 見積連携 JSON 出力のテスト。

import { describe, it, expect } from 'vitest';
import { buildBomJsonPayload, generateBomJson, BOM_JSON_FORMAT_VERSION } from '../src/export/json-exporter';
import { APP_NAME } from '../src/shared/constants/app';
import type { Layer, ProjectSymbol, Wire } from '../src/data/types';

const layer = (id: string, visible = true): Layer => ({
  id, name: id, visible, locked: false, color: '#000', kind: 'user',
});
const sym = (id: string, type: ProjectSymbol['type'], layerId: string, properties: Record<string, string> = {}): ProjectSymbol => ({
  id, type, position: { x: 0, y: 0 }, rotation: 0, properties, layerId,
});
const wire = (id: string, layerId: string, cable: Wire['cable'], lengthMm: number): Wire => ({
  id, fromSymbolId: 'a', toSymbolId: 'b', layerId, cable, lengthMm, type: 'concealed', circuit: '', waypoints: [],
});
const ALL = { visibleOnly: false };

describe('buildBomJsonPayload', () => {
  it('formatVersion と app(定数)と site を含む', () => {
    const p = buildBomJsonPayload([], [], [layer('L1')], ALL, {
      siteName: 'テスト現場',
      drawingScale: '1/100',
    });
    expect(p.formatVersion).toBe(BOM_JSON_FORMAT_VERSION);
    expect(p.app).toBe(APP_NAME);
    expect(p.site).toEqual({ name: 'テスト現場', drawingScale: '1/100' });
  });

  it('未校正は drawingScale=null', () => {
    const p = buildBomJsonPayload([], [], [layer('L1')], ALL, { siteName: 'x', drawingScale: null });
    expect(p.site.drawingScale).toBeNull();
  });

  it('generatedAt は与えたときだけキーが出る', () => {
    const without = buildBomJsonPayload([], [], [layer('L1')], ALL, { siteName: 'x', drawingScale: null });
    expect('generatedAt' in without).toBe(false);
    const withTs = buildBomJsonPayload([], [], [layer('L1')], ALL, {
      siteName: 'x', drawingScale: null, generatedAt: '2026-05-31T00:00:00Z',
    });
    expect(withTs.generatedAt).toBe('2026-05-31T00:00:00Z');
  });

  it('シンボルは個数(整数)、配線は総長メートルを小数1桁に丸める', () => {
    const layers = [layer('L1')];
    const symbols = [sym('1', 'downlight', 'L1'), sym('2', 'downlight', 'L1')];
    const wires = [wire('w1', 'L1', 'VVF1.6×2C', 1234)]; // 1.234m → 1.2
    const p = buildBomJsonPayload(symbols, wires, layers, ALL, { siteName: '', drawingScale: null });
    const dl = p.items.find((i) => i.category === 'ダウンライト');
    const w = p.items.find((i) => i.category === '配線');
    expect(dl?.quantity).toBe(2);
    expect(dl?.unit).toBe('個');
    expect(w?.quantity).toBe(1.2);
    expect(w?.unit).toBe('m');
  });

  it('回路番号は生配列(昇順)で入る', () => {
    const layers = [layer('L1')];
    const symbols = [
      sym('1', 'downlight', 'L1', { circuit: 'L-2' }),
      sym('2', 'downlight', 'L1', { circuit: 'L-1' }),
    ];
    const p = buildBomJsonPayload(symbols, [], layers, ALL, { siteName: '', drawingScale: null });
    expect(p.items[0]?.circuits).toEqual(['L-1', 'L-2']);
  });
});

describe('generateBomJson', () => {
  it('整形済み JSON 文字列で末尾改行つき・パース可能', () => {
    const json = generateBomJson([], [], [layer('L1')], ALL, { siteName: 's', drawingScale: '1/50' });
    expect(json.endsWith('\n')).toBe(true);
    const parsed = JSON.parse(json);
    expect(parsed.site.name).toBe('s');
    expect(Array.isArray(parsed.items)).toBe(true);
  });
});
