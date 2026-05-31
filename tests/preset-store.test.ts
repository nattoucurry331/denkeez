// Phase 2-K3 (G): 商品プリセットの重複判定キーのテスト。

import { describe, it, expect, beforeEach } from 'vitest';
import { productPresetKey, usePresetStore } from '../src/data/preset-store';

describe('productPresetKey', () => {
  it('メーカーと品番を正規化して結合する', () => {
    expect(productPresetKey('Panasonic', 'LGB12345')).toBe('panasonic lgb12345');
  });

  it('大文字小文字・前後空白を無視して同一キーになる', () => {
    expect(productPresetKey('  Panasonic ', ' lgb12345 ')).toBe(
      productPresetKey('panasonic', 'LGB12345'),
    );
  });

  it('全角空白を含む連続空白を 1 つに圧縮する', () => {
    expect(productPresetKey('大光　電機', 'DD　001')).toBe('大光 電機 dd 001');
  });

  it('品番が空なら null を返す (重複判定しない)', () => {
    expect(productPresetKey('Panasonic', '')).toBeNull();
    expect(productPresetKey('Panasonic', '   ')).toBeNull();
  });

  it('別メーカー同一品番は別キーになる', () => {
    expect(productPresetKey('Panasonic', 'X1')).not.toBe(productPresetKey('DAIKO', 'X1'));
  });
});

describe('findProductPresetByKey', () => {
  beforeEach(() => {
    // 各テスト前にプリセットを空にする
    usePresetStore.setState({ presets: [] });
  });

  it('同一メーカー+品番の product-image プリセットを見つける', () => {
    const id = usePresetStore.getState().addPreset({
      baseType: 'product-image',
      displayName: 'ダウンライト LGB12345',
      defaultProperties: { maker: 'Panasonic', partNumber: 'LGB12345' },
      image: { dataUrl: 'data:image/png;base64,AAAA', aspectRatio: 1, widthMm: 12 },
    });
    const hit = usePresetStore.getState().findProductPresetByKey('panasonic', ' lgb12345 ');
    expect(hit?.id).toBe(id);
  });

  it('品番が空欄なら undefined (重複判定しない)', () => {
    usePresetStore.getState().addPreset({
      baseType: 'product-image',
      displayName: '品番なし',
      defaultProperties: { maker: 'Panasonic', partNumber: '' },
      image: { dataUrl: 'data:image/png;base64,AAAA', aspectRatio: 1 },
    });
    expect(usePresetStore.getState().findProductPresetByKey('Panasonic', '')).toBeUndefined();
  });

  it('product-image 以外の同名プリセットはヒットしない', () => {
    usePresetStore.getState().addPreset({
      baseType: 'outlet-general',
      displayName: 'コンセント',
      defaultProperties: { maker: 'Panasonic', partNumber: 'LGB12345' },
    });
    expect(
      usePresetStore.getState().findProductPresetByKey('Panasonic', 'LGB12345'),
    ).toBeUndefined();
  });

  it('別メーカー同一品番はヒットしない', () => {
    usePresetStore.getState().addPreset({
      baseType: 'product-image',
      displayName: 'A社品',
      defaultProperties: { maker: 'A社', partNumber: 'X1' },
      image: { dataUrl: 'data:image/png;base64,AAAA', aspectRatio: 1 },
    });
    expect(usePresetStore.getState().findProductPresetByKey('B社', 'X1')).toBeUndefined();
  });
});
