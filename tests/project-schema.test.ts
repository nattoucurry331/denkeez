import { describe, it, expect } from 'vitest';
import { ProjectSchema } from '../src/data/project-schema';

const validProject = {
  meta: {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    name: '',
    createdAt: '2026-04-29T00:00:00.000Z',
    updatedAt: '2026-04-29T00:00:00.000Z',
    appVersion: '0.1.0',
    schemaVersion: 1,
  },
  drawing: {
    type: 'pdf',
    filename: 'sample.pdf',
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
};

describe('ProjectSchema', () => {
  it('正常な Project を pass する', () => {
    const result = ProjectSchema.safeParse(validProject);
    expect(result.success).toBe(true);
  });

  it('drawing が null の Project (新規・PDF 未取込) を pass する', () => {
    const result = ProjectSchema.safeParse({ ...validProject, drawing: null });
    expect(result.success).toBe(true);
  });

  it('symbols が空配列を pass する', () => {
    const result = ProjectSchema.safeParse({ ...validProject, symbols: [] });
    expect(result.success).toBe(true);
  });

  it('meta.schemaVersion が文字列だと弾く', () => {
    const result = ProjectSchema.safeParse({
      ...validProject,
      meta: { ...validProject.meta, schemaVersion: '1' },
    });
    expect(result.success).toBe(false);
  });

  it('drawing.widthMm が 0 以下だと弾く', () => {
    const result = ProjectSchema.safeParse({
      ...validProject,
      drawing: { ...validProject.drawing, widthMm: 0 },
    });
    expect(result.success).toBe(false);
  });

  it('symbols[].position.x が NaN だと弾く', () => {
    const result = ProjectSchema.safeParse({
      ...validProject,
      symbols: [
        {
          ...validProject.symbols[0],
          position: { x: NaN, y: 0 },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('未知の余剰フィールドは無視される (strict ではない)', () => {
    const result = ProjectSchema.safeParse({ ...validProject, futureField: 'ignored' });
    expect(result.success).toBe(true);
  });
});
