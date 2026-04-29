import { describe, it, expect } from 'vitest';
import { generateId } from '../src/utils/id';

describe('generateId', () => {
  it('UUID v4 形式の文字列を返す', () => {
    const id = generateId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('連続呼び出しで重複しない (1000 件)', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateId()));
    expect(ids.size).toBe(1000);
  });
});
