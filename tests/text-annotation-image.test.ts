// F-18 PDF: splitTextLines の単体テスト (canvas 描画は jsdom 非対応のため対象外)。

import { describe, it, expect } from 'vitest';
import { splitTextLines } from '../src/export/text-annotation-image';

describe('splitTextLines', () => {
  it('単一行はそのまま 1 要素', () => {
    expect(splitTextLines('分電盤')).toEqual(['分電盤']);
  });

  it('改行で複数行に分割する', () => {
    expect(splitTextLines('1階\n分電盤\nL-1')).toEqual(['1階', '分電盤', 'L-1']);
  });

  it('全体が空白だけなら空配列 (描画スキップ)', () => {
    expect(splitTextLines('')).toEqual([]);
    expect(splitTextLines('   ')).toEqual([]);
    expect(splitTextLines('\n\n')).toEqual([]);
  });

  it('途中の空行は保持する', () => {
    expect(splitTextLines('上\n\n下')).toEqual(['上', '', '下']);
  });
});
