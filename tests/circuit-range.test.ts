// Phase 3 (F-21) 3-I2: 回路範囲表記のテスト。

import { describe, it, expect } from 'vitest';
import { formatCircuitRange } from '../src/utils/circuit-range';

describe('formatCircuitRange', () => {
  it('空配列は空文字', () => {
    expect(formatCircuitRange([])).toBe('');
  });

  it('単一はそのまま', () => {
    expect(formatCircuitRange(['L-1'])).toBe('L-1');
  });

  it('2 連続は列挙(圧縮しない・既存CSV互換)', () => {
    expect(formatCircuitRange(['L-1', 'L-2'])).toBe('L-1, L-2');
  });

  it('3 連続以上は範囲に圧縮する', () => {
    expect(formatCircuitRange(['L-1', 'L-2', 'L-3'])).toBe('L-1〜L-3');
  });

  it('連番と単発が混在しても正しく区切る', () => {
    expect(formatCircuitRange(['L-1', 'L-2', 'L-3', 'L-5'])).toBe('L-1〜L-3, L-5');
  });

  it('多桁を数値順にソートして圧縮する(辞書順では崩れるケース)', () => {
    expect(formatCircuitRange(['L-2', 'L-10', 'L-1', 'L-3'])).toBe('L-1〜L-3, L-10');
  });

  it('接頭辞が違えば別グループ', () => {
    expect(formatCircuitRange(['L-1', 'L-2', 'L-3', 'H-1', 'H-2', 'H-3'])).toBe(
      'H-1〜H-3, L-1〜L-3',
    );
  });

  it('非数値ラベルはそのまま末尾に列挙', () => {
    expect(formatCircuitRange(['L-1', 'L-2', 'L-3', '予備'])).toBe('L-1〜L-3, 予備');
  });

  it('重複・空白を除去する', () => {
    expect(formatCircuitRange([' L-1 ', 'L-1', 'L-2', '  '])).toBe('L-1, L-2');
  });
});
