import { describe, it, expect } from 'vitest';
import { suggestedExportName } from '../src/export/pdf-exporter';
import type { Project } from '../src/data/types';
import { SCHEMA_VERSION } from '../src/shared/constants/app';

// exportProjectAsPdf 自体は HTMLCanvasElement (DOM) と jsPDF の DOM 依存があるため
// Node 環境の Vitest では完全にテストできない。
// Phase 2 で happy-dom 環境を入れた上で integration test を追加する予定。
// M5 では純粋ロジックのみ単体テストする。

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
    layers: [
      {
        id: 'layer-background',
        name: '元図面',
        color: '#888888',
        visible: true,
        locked: true,
        kind: 'background',
      },
    ],
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
