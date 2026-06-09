// UI改修2: modeKindToLabel の網羅テスト。

import { describe, it, expect } from 'vitest';
import { modeKindToLabel } from '../src/utils/mode-label';
import type { EditorMode } from '../src/data/project-store';

describe('modeKindToLabel', () => {
  const cases: Array<[EditorMode['kind'], string]> = [
    ['select', '選択'],
    ['place', '配置中'],
    ['scale', 'スケール設定'],
    ['measure', '寸法計測'],
    ['dimension', '寸法線'],
    ['text', '文字'],
    ['pdf-text-pick', 'PDF文字選択'],
    ['wire', '配線'],
  ];

  it.each(cases)('%s は「%s」', (kind, label) => {
    expect(modeKindToLabel(kind)).toBe(label);
  });

  it('全8種別に空文字を返さない', () => {
    for (const [kind] of cases) {
      expect(modeKindToLabel(kind).length).toBeGreaterThan(0);
    }
  });
});
