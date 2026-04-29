import { describe, it, expect } from 'vitest';
import {
  serializeProject,
  deserializeProject,
  ProjectFileError,
} from '../src/data/project-io';
import type { Project } from '../src/data/types';
import { SCHEMA_VERSION } from '../src/shared/constants/app';

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
    symbols: [
      {
        id: 's-1',
        type: 'downlight',
        position: { x: 100, y: 200 },
        rotation: 0,
        properties: {},
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
