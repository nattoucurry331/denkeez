import { describe, it, expect } from 'vitest';
import {
  serializeProject,
  deserializeProject,
  ProjectFileError,
} from '../src/data/project-io';
import type { Project } from '../src/data/types';
import { SCHEMA_VERSION } from '../src/shared/constants/app';

const TEST_LAYER_ID = 'layer-test-user-1';

function makeProject(overrides?: Partial<Project>): Project {
  return {
    meta: {
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      name: 'テスト現場',
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
      appVersion: '0.1.0',
      schemaVersion: SCHEMA_VERSION,
    },
    drawing: {
      type: 'pdf',
      filename: 'plan.pdf',
      selectedPage: 1,
      widthMm: 297,
      heightMm: 420,
    },
    layers: [
      {
        id: 'layer-background',
        name: '元図面',
        color: '#888888',
        visible: true,
        locked: true,
        kind: 'background',
      },
      {
        id: TEST_LAYER_ID,
        name: '照明回路',
        color: '#f0a000',
        visible: true,
        locked: false,
        kind: 'user',
      },
    ],
    symbols: [
      {
        id: 's-1',
        type: 'downlight',
        position: { x: 100, y: 200 },
        rotation: 0,
        properties: {},
        layerId: TEST_LAYER_ID,
      },
    ],
    ...overrides,
  };
}

describe('serializeProject / deserializeProject 往復', () => {
  it('正常 Project を往復で復元する', () => {
    const project = makeProject();
    const json = serializeProject(project);
    const restored = deserializeProject(json);
    expect(restored).toEqual(project);
  });

  it('drawing=null を往復で保持する', () => {
    const project = makeProject({ drawing: null });
    const restored = deserializeProject(serializeProject(project));
    expect(restored.drawing).toBeNull();
  });

  it('symbols=[] を往復で保持する', () => {
    const project = makeProject({ symbols: [] });
    const restored = deserializeProject(serializeProject(project));
    expect(restored.symbols).toEqual([]);
  });
});

describe('deserializeProject エラー処理', () => {
  it('不正 JSON で ProjectFileError を投げる', () => {
    expect(() => deserializeProject('{ invalid json }')).toThrow(ProjectFileError);
  });

  it('空文字列で ProjectFileError を投げる', () => {
    expect(() => deserializeProject('')).toThrow(ProjectFileError);
  });

  it('必須フィールド欠落で ProjectFileError を投げる', () => {
    const broken = JSON.stringify({ meta: {}, drawing: null, symbols: [] });
    expect(() => deserializeProject(broken)).toThrow(ProjectFileError);
  });

  it('schemaVersion が現行より大きいと ProjectFileError を投げる', () => {
    const future = makeProject();
    future.meta.schemaVersion = SCHEMA_VERSION + 1;
    const json = serializeProject(future);
    expect(() => deserializeProject(json)).toThrow(/新しいバージョン/);
  });

  it('symbols が配列でないと ProjectFileError を投げる', () => {
    const obj = JSON.parse(serializeProject(makeProject())) as Record<string, unknown>;
    obj.symbols = 'not-an-array';
    expect(() => deserializeProject(JSON.stringify(obj))).toThrow(ProjectFileError);
  });
});

// Phase 2-D1: schemaVersion 1 → 2 マイグレーション (F-08)
describe('schemaVersion 1 → 2 のマイグレーション', () => {
  // Phase 2-C 時点で保存されたファイル (layers / layerId なし、wires は optional)
  const v1Project = {
    meta: {
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      name: '旧プロジェクト',
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
      appVersion: '0.1.0',
      schemaVersion: 1,
    },
    drawing: null,
    symbols: [
      {
        id: 's-old-1',
        type: 'downlight',
        position: { x: 100, y: 200 },
        rotation: 0,
        properties: {},
      },
      {
        id: 's-old-2',
        type: 'outlet-general',
        position: { x: 300, y: 400 },
        rotation: 0,
        properties: {},
      },
    ],
    wires: [
      {
        id: 'w-old-1',
        fromSymbolId: 's-old-1',
        toSymbolId: 's-old-2',
        waypoints: [],
        type: 'ceiling',
        cable: 'VVF1.6×2C',
        circuit: 'L-1',
        lengthMm: 0,
      },
    ],
  };

  it('旧 v1 ファイルが読み込めて schemaVersion が 2 に更新される', () => {
    const restored = deserializeProject(JSON.stringify(v1Project));
    expect(restored.meta.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('layers が自動生成される (背景 + 標準 5 種 + 未分類 = 7 個)', () => {
    const restored = deserializeProject(JSON.stringify(v1Project));
    expect(restored.layers).toHaveLength(7);
    expect(restored.layers[0]?.kind).toBe('background');
    expect(restored.layers[0]?.locked).toBe(true);
    expect(restored.layers.filter((l) => l.kind === 'user')).toHaveLength(6);
    // 未分類レイヤーが存在する
    const unsorted = restored.layers.find((l) => l.name === '未分類');
    expect(unsorted).toBeDefined();
    expect(unsorted?.kind).toBe('user');
    expect(unsorted?.locked).toBe(false);
  });

  it('既存 symbol は全て「未分類」レイヤーに割り当てられる', () => {
    const restored = deserializeProject(JSON.stringify(v1Project));
    const unsorted = restored.layers.find((l) => l.name === '未分類')!;
    for (const s of restored.symbols) {
      expect(s.layerId).toBe(unsorted.id);
    }
  });

  it('既存 wire も「未分類」レイヤーに割り当てられる', () => {
    const restored = deserializeProject(JSON.stringify(v1Project));
    const unsorted = restored.layers.find((l) => l.name === '未分類')!;
    for (const w of restored.wires ?? []) {
      expect(w.layerId).toBe(unsorted.id);
    }
  });

  it('symbols のフィールドはマイグレーションで保持される (id / position / type など)', () => {
    const restored = deserializeProject(JSON.stringify(v1Project));
    expect(restored.symbols).toHaveLength(2);
    expect(restored.symbols[0]?.id).toBe('s-old-1');
    expect(restored.symbols[0]?.type).toBe('downlight');
    expect(restored.symbols[0]?.position).toEqual({ x: 100, y: 200 });
    expect(restored.symbols[1]?.id).toBe('s-old-2');
    expect(restored.symbols[1]?.type).toBe('outlet-general');
  });

  it('wires が無い v1 ファイル (Phase 2-B 以前) でもマイグレーション可能', () => {
    const v1NoWires = { ...v1Project };
    // wires フィールド自体を消す
    const obj = JSON.parse(JSON.stringify(v1NoWires)) as Record<string, unknown>;
    delete obj.wires;
    const restored = deserializeProject(JSON.stringify(obj));
    expect(restored.wires).toBeUndefined();
    expect(restored.layers.length).toBeGreaterThan(0);
  });

  it('schemaVersion 2 ファイルは layers をそのまま保持する (再マイグレーションしない)', () => {
    const v2 = makeProject();
    const restored = deserializeProject(serializeProject(v2));
    expect(restored.layers).toEqual(v2.layers);
  });
});
