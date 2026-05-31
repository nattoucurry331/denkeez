// Phase 3 F-14: 表題欄の純粋ロジックのテスト (canvas 描画は jsdom 非対応のため対象外)。

import { describe, it, expect } from 'vitest';
import { computeTitleRows, titleBlockOrigin } from '../src/export/title-block';
import type { TitleBlockConfig } from '../src/data/types';

const config: TitleBlockConfig = {
  enabled: true,
  position: 'bottom-right',
  projectName: '○○邸 新築工事',
  drawingName: '1階 電気設備図',
  date: '2026-05-31',
  author: '山田太郎',
  company: '有限会社 北嶺建設',
};

describe('computeTitleRows', () => {
  it('標準6項目をラベル付きで返す', () => {
    const rows = computeTitleRows(config, '1/100');
    expect(rows.map((r) => r.label)).toEqual(['工事名', '図面名', '縮尺', '日付', '作成者', '会社名']);
  });

  it('縮尺は引数の文字列が入る', () => {
    expect(computeTitleRows(config, '1/50')[2]).toEqual({ label: '縮尺', value: '1/50' });
  });

  it('各値が設定どおり入る', () => {
    const rows = computeTitleRows(config, '1/100');
    expect(rows[0]?.value).toBe('○○邸 新築工事');
    expect(rows[5]?.value).toBe('有限会社 北嶺建設');
  });
});

describe('titleBlockOrigin', () => {
  const PAGE_W = 297;
  const PAGE_H = 210;
  const BW = 85;
  const BH = 42;
  const INSET = 3;

  it('右下は右下寄せ', () => {
    expect(titleBlockOrigin('bottom-right', PAGE_W, PAGE_H, BW, BH, INSET)).toEqual({
      x: PAGE_W - BW - INSET,
      y: PAGE_H - BH - INSET,
    });
  });

  it('左上は inset 位置', () => {
    expect(titleBlockOrigin('top-left', PAGE_W, PAGE_H, BW, BH, INSET)).toEqual({ x: INSET, y: INSET });
  });

  it('右上は右寄せ・上 inset', () => {
    expect(titleBlockOrigin('top-right', PAGE_W, PAGE_H, BW, BH, INSET)).toEqual({
      x: PAGE_W - BW - INSET,
      y: INSET,
    });
  });

  it('左下は左 inset・下寄せ', () => {
    expect(titleBlockOrigin('bottom-left', PAGE_W, PAGE_H, BW, BH, INSET)).toEqual({
      x: INSET,
      y: PAGE_H - BH - INSET,
    });
  });

  it('ブロックがページより大きいと inset にクランプ (負座標を避ける)', () => {
    expect(titleBlockOrigin('bottom-right', 50, 30, 85, 42, 3)).toEqual({ x: 3, y: 3 });
  });
});
