import { describe, it, expect } from 'vitest';
import {
  generateBomCsv,
  escapeCsvCell,
  suggestedBomCsvName,
} from '../src/export/csv-exporter';
import { formatSymbolSpec } from '../src/symbols/symbol-spec';
import type {
  Layer,
  ProjectSymbol,
  Wire,
  SymbolType,
  CableType,
  PropertyValue,
} from '../src/data/types';

// Phase 2-E2: F-15 拾い出し CSV 出力の単体テスト。

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

function makeSymbol(
  id: string,
  type: SymbolType,
  layerId: string,
  properties: Record<string, PropertyValue> = {},
): ProjectSymbol {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    rotation: 0,
    properties,
    layerId,
  };
}

function makeWire(opts: {
  id: string;
  layerId: string;
  cable?: CableType;
  cableCustom?: string;
  lengthMm?: number;
  circuit?: string;
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
    circuit: opts.circuit ?? '',
    lengthMm: opts.lengthMm ?? 0,
    layerId: opts.layerId,
  };
}

describe('escapeCsvCell (RFC 4180)', () => {
  it('特殊文字を含まないセルはそのまま返す', () => {
    expect(escapeCsvCell('普通')).toBe('普通');
  });

  it('カンマを含むセルはダブルクォートで囲む', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
  });

  it('改行を含むセルはダブルクォートで囲む', () => {
    expect(escapeCsvCell('a\nb')).toBe('"a\nb"');
    expect(escapeCsvCell('a\r\nb')).toBe('"a\r\nb"');
  });

  it('ダブルクォートを含むセルは "" にエスケープして全体をクォート', () => {
    expect(escapeCsvCell('a"b')).toBe('"a""b"');
  });
});

describe('formatSymbolSpec', () => {
  it('lighting: wattage + model + diameter を結合', () => {
    const sym = makeSymbol('s1', 'downlight', 'L', {
      wattage: 7,
      model: 'LED',
      diameter: 100,
    });
    expect(formatSymbolSpec(sym)).toBe('7W LED φ100');
  });

  it('lighting: 部分指定でも順序を保つ', () => {
    expect(
      formatSymbolSpec(makeSymbol('s', 'downlight', 'L', { wattage: 60 })),
    ).toBe('60W');
    expect(
      formatSymbolSpec(makeSymbol('s', 'downlight', 'L', { model: 'パナソニック' })),
    ).toBe('パナソニック');
  });

  it('switch: group → 「連用N個」', () => {
    expect(
      formatSymbolSpec(makeSymbol('s', 'switch-1pole', 'L', { group: 1 })),
    ).toBe('連用1個');
    expect(
      formatSymbolSpec(makeSymbol('s', 'switch-3way', 'L', { group: 3 })),
    ).toBe('連用3個');
  });

  it('switch: group 未指定なら空文字 (規格不明)', () => {
    expect(formatSymbolSpec(makeSymbol('s', 'switch-1pole', 'L'))).toBe('');
  });

  it('outlet: capacity + grounded で「N口接地付」', () => {
    expect(
      formatSymbolSpec(makeSymbol('s', 'outlet-general', 'L', { capacity: 2, grounded: 'あり' })),
    ).toBe('2口接地付');
    expect(
      formatSymbolSpec(makeSymbol('s', 'outlet-general', 'L', { capacity: 1, grounded: 'なし' })),
    ).toBe('1口');
  });

  it('outlet-200v: amperage で「200V NA」', () => {
    expect(
      formatSymbolSpec(makeSymbol('s', 'outlet-200v', 'L', { amperage: 20 })),
    ).toBe('200V 20A');
  });

  it('outlet-200v: amperage 未指定で「200V」のみ', () => {
    expect(formatSymbolSpec(makeSymbol('s', 'outlet-200v', 'L'))).toBe('200V');
  });

  it('low-voltage: category プロパティを返す', () => {
    expect(
      formatSymbolSpec(makeSymbol('s', 'tv-outlet', 'L', { category: '直列' })),
    ).toBe('直列');
  });

  // Phase 2-I: 画像シンボル (product-image) の規格 = メーカー + 品番
  it('product-image: メーカー + 品番 を返す', () => {
    expect(
      formatSymbolSpec(
        makeSymbol('s', 'product-image', 'L', { maker: 'Panasonic', partNumber: 'LGB12345' }),
      ),
    ).toBe('Panasonic LGB12345');
  });

  it('product-image: 品番のみ / メーカーのみでも結合', () => {
    expect(
      formatSymbolSpec(makeSymbol('s', 'product-image', 'L', { partNumber: 'LGB99' })),
    ).toBe('LGB99');
    expect(
      formatSymbolSpec(makeSymbol('s', 'product-image', 'L', { maker: 'Panasonic' })),
    ).toBe('Panasonic');
  });

  it('product-image: メーカー/品番なしなら spec にフォールバック', () => {
    expect(
      formatSymbolSpec(makeSymbol('s', 'product-image', 'L', { spec: 'LED 7W' })),
    ).toBe('LED 7W');
  });

  it('整数でない数値は小数 1 桁に整形', () => {
    expect(
      formatSymbolSpec(makeSymbol('s', 'downlight', 'L', { wattage: 7.5 })),
    ).toBe('7.5W');
  });

  it('0 や負の数は無視される', () => {
    expect(
      formatSymbolSpec(makeSymbol('s', 'downlight', 'L', { wattage: 0, model: 'X' })),
    ).toBe('X');
  });
});

describe('generateBomCsv', () => {
  const layers = [makeLayer('L1'), makeLayer('hidden', { visible: false })];

  it('UTF-8 BOM とヘッダ行を含む', () => {
    const csv = generateBomCsv([], [], layers, { visibleOnly: true });
    expect(csv.startsWith(String.fromCharCode(0xFEFF))).toBe(true); // U+FEFF BOM
    expect(csv).toContain('種別,規格,数量,単位,回路番号,備考');
  });

  it('改行は CRLF', () => {
    const sym = makeSymbol('s1', 'downlight', 'L1', { wattage: 7 });
    const csv = generateBomCsv([sym], [], layers, { visibleOnly: true });
    const lines = csv.split('\r\n');
    expect(lines.length).toBeGreaterThan(2);
  });

  it('シンボル: 同じ (type, 規格) は数量集約 + circuit 連結', () => {
    const symbols = [
      makeSymbol('s1', 'downlight', 'L1', { wattage: 7, circuit: 'L-1' }),
      makeSymbol('s2', 'downlight', 'L1', { wattage: 7, circuit: 'L-2' }),
      makeSymbol('s3', 'downlight', 'L1', { wattage: 7, circuit: 'L-1' }), // 重複
    ];
    const csv = generateBomCsv(symbols, [], layers, { visibleOnly: true });
    const lines = csv.split('\r\n');
    const downlight = lines.find((l) => l.startsWith('ダウンライト'));
    expect(downlight).toBeDefined();
    expect(downlight).toContain('7W');
    expect(downlight).toContain(',3,個,'); // 数量 3
    expect(downlight).toContain('"L-1, L-2"'); // unique circuits, sorted, joined
  });

  it('シンボル: 異なる規格は別行', () => {
    const symbols = [
      makeSymbol('s1', 'downlight', 'L1', { wattage: 7 }),
      makeSymbol('s2', 'downlight', 'L1', { wattage: 9 }),
    ];
    const csv = generateBomCsv(symbols, [], layers, { visibleOnly: true });
    const lines = csv.split('\r\n').filter((l) => l.startsWith('ダウンライト'));
    expect(lines).toHaveLength(2);
  });

  it('配線: cable 種別ごとに totalMm を集計し m 単位 (小数 1 桁)', () => {
    const symbols = [makeSymbol('s1', 'downlight', 'L1'), makeSymbol('s2', 'downlight', 'L1')];
    const wires = [
      makeWire({ id: 'w1', layerId: 'L1', cable: 'VVF1.6×2C', lengthMm: 1000 }),
      makeWire({ id: 'w2', layerId: 'L1', cable: 'VVF1.6×2C', lengthMm: 500 }),
    ];
    const csv = generateBomCsv(symbols, wires, layers, { visibleOnly: true });
    const wireLine = csv.split('\r\n').find((l) => l.startsWith('配線'));
    expect(wireLine).toBe('配線,VVF1.6×2C,1.5,m,,');
  });

  it("配線: cable='その他' + cableCustom は label に custom を使う", () => {
    const symbols = [makeSymbol('s1', 'downlight', 'L1'), makeSymbol('s2', 'downlight', 'L1')];
    const wires = [
      makeWire({
        id: 'w1',
        layerId: 'L1',
        cable: 'その他',
        cableCustom: 'VVF1.6×3C',
        lengthMm: 800,
      }),
    ];
    const csv = generateBomCsv(symbols, wires, layers, { visibleOnly: true });
    const wireLine = csv.split('\r\n').find((l) => l.startsWith('配線'));
    expect(wireLine).toBe('配線,VVF1.6×3C,0.8,m,,');
  });

  it('配線: circuit がある場合 CSV に出力される', () => {
    const symbols = [makeSymbol('s1', 'downlight', 'L1'), makeSymbol('s2', 'downlight', 'L1')];
    const wires = [
      makeWire({ id: 'w1', layerId: 'L1', lengthMm: 1000, circuit: 'L-1' }),
      makeWire({ id: 'w2', layerId: 'L1', lengthMm: 500, circuit: 'L-2' }),
    ];
    const csv = generateBomCsv(symbols, wires, layers, { visibleOnly: true });
    const wireLine = csv.split('\r\n').find((l) => l.startsWith('配線'));
    expect(wireLine).toContain('"L-1, L-2"');
  });

  it('hidden レイヤーの内容は visibleOnly=true で除外', () => {
    const symbols = [
      makeSymbol('s1', 'downlight', 'L1'),
      makeSymbol('s2', 'downlight', 'hidden'),
    ];
    const csv = generateBomCsv(symbols, [], layers, { visibleOnly: true });
    const downlight = csv.split('\r\n').find((l) => l.startsWith('ダウンライト'));
    expect(downlight).toContain(',1,個,'); // s1 のみ
  });

  it('visibleOnly=false なら全レイヤー対象', () => {
    const symbols = [
      makeSymbol('s1', 'downlight', 'L1'),
      makeSymbol('s2', 'downlight', 'hidden'),
    ];
    const csv = generateBomCsv(symbols, [], layers, { visibleOnly: false });
    const downlight = csv.split('\r\n').find((l) => l.startsWith('ダウンライト'));
    expect(downlight).toContain(',2,個,');
  });

  it('端点シンボルが hidden レイヤーの wire は除外 (BomPanel と整合)', () => {
    const symbols = [
      makeSymbol('s-vis', 'downlight', 'L1'),
      makeSymbol('s-hid', 'downlight', 'hidden'),
    ];
    const wires = [
      makeWire({
        id: 'w1',
        layerId: 'L1',
        lengthMm: 200,
        fromSymbolId: 's-vis',
        toSymbolId: 's-hid',
      }),
    ];
    const csv = generateBomCsv(symbols, wires, layers, { visibleOnly: true });
    expect(csv.split('\r\n').some((l) => l.startsWith('配線'))).toBe(false);
  });

  it('カンマを含む規格はクォートでエスケープされる', () => {
    const sym = makeSymbol('s1', 'downlight', 'L1', { model: 'A,B' });
    const csv = generateBomCsv([sym], [], layers, { visibleOnly: true });
    expect(csv).toContain('"A,B"');
  });

  it('空状態でもヘッダは生成される', () => {
    const csv = generateBomCsv([], [], layers, { visibleOnly: true });
    const lines = csv.replace(/^\uFEFF/, '').split('\r\n').filter((l) => l.length > 0);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('種別,規格,数量,単位,回路番号,備考');
  });
});

describe('suggestedBomCsvName', () => {
  it('プロジェクト名に -bom.csv を付ける', () => {
    expect(suggestedBomCsvName('現場A')).toBe('現場A-bom.csv');
  });

  it('プロジェクト名が空ならフォールバック', () => {
    expect(suggestedBomCsvName('')).toBe('denkeez-bom.csv');
    expect(suggestedBomCsvName('   ')).toBe('denkeez-bom.csv');
  });

  it('前後空白は trim される', () => {
    expect(suggestedBomCsvName('  古川邸  ')).toBe('古川邸-bom.csv');
  });
});
