// Phase 2-K4 (F): 白背景透明化の純粋ロジックのテスト。
// canvas 依存の downscaleDataUrl は jsdom では再現できないため、ピクセル処理関数のみ検証。

import { describe, it, expect } from 'vitest';
import { removeWhiteBackgroundPixels, computeContainedRect } from '../src/utils/image-import';

/** w×h の RGBA バッファを作るヘルパ。fill(x,y) で各画素の色を決める。 */
function makeImage(
  w: number,
  h: number,
  fill: (x: number, y: number) => [number, number, number, number],
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const [r, g, b, a] = fill(x, y);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return data;
}

const WHITE: [number, number, number, number] = [255, 255, 255, 255];
const RED: [number, number, number, number] = [200, 20, 20, 255];

describe('removeWhiteBackgroundPixels', () => {
  it('四隅が白いとき近白ピクセルを透明化する', () => {
    // 中央 1px だけ赤、周囲は白
    const w = 3;
    const h = 3;
    const data = makeImage(w, h, (x, y) => (x === 1 && y === 1 ? RED : WHITE));
    const { changed } = removeWhiteBackgroundPixels(data, w, h);
    expect(changed).toBe(8); // 白 8px が透明化
    // 中央の赤は不透明のまま
    const center = (1 * w + 1) * 4;
    expect(data[center + 3]).toBe(255);
    // 角は RGB 据え置き・alpha だけ 0
    expect(data[0]).toBe(255); // 角の R は据え置き
    expect(data[3]).toBe(0); // 角の alpha=0
  });

  it('四隅が有色のときは何も変更しない (誤爆しない)', () => {
    const w = 3;
    const h = 3;
    // 全面赤 (角も赤)
    const data = makeImage(w, h, () => RED);
    const before = Uint8ClampedArray.from(data);
    const { changed } = removeWhiteBackgroundPixels(data, w, h);
    expect(changed).toBe(0);
    expect(data).toEqual(before);
  });

  it('中央の濃い色ピクセルは保持される', () => {
    const w = 4;
    const h = 4;
    const data = makeImage(w, h, (x, y) =>
      x >= 1 && x <= 2 && y >= 1 && y <= 2 ? RED : WHITE,
    );
    removeWhiteBackgroundPixels(data, w, h);
    const center = (1 * w + 1) * 4;
    expect(data[center]).toBe(200);
    expect(data[center + 3]).toBe(255);
  });

  it('しきい値が小さいと薄いグレーは白とみなさない', () => {
    const w = 2;
    const h = 2;
    // 角は純白、ただし全ピクセル白なので全部消える基準を確認するため 1px をグレーに
    const GRAY: [number, number, number, number] = [220, 220, 220, 255];
    const data = makeImage(w, h, (x, y) => (x === 0 && y === 0 ? WHITE : x === 1 && y === 1 ? GRAY : WHITE));
    // threshold=10 → cutoff=245。220 は白とみなさない
    const { changed } = removeWhiteBackgroundPixels(data, w, h, { threshold: 10 });
    // 角(0,0)が純白なので四隅判定は… 角は (0,0)=白,(1,0)=白,(0,1)=白,(1,1)=gray
    // 四隅の一つ(1,1)が gray で cutoff 未満 → 背景白と判定されず changed=0
    expect(changed).toBe(0);
  });

  it('幅高さが 0 や空データでも例外を投げない', () => {
    expect(removeWhiteBackgroundPixels(new Uint8ClampedArray(0), 0, 0).changed).toBe(0);
  });

  it('changed カウントは透明化した画素数と一致する', () => {
    const w = 2;
    const h = 2;
    const data = makeImage(w, h, () => WHITE); // 全白 (角も白)
    const { changed } = removeWhiteBackgroundPixels(data, w, h);
    expect(changed).toBe(4);
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i + 3]).toBe(0);
    }
  });
});

describe('computeContainedRect', () => {
  it('コンテナと同じ比率なら余白なしで埋める', () => {
    const r = computeContainedRect(200, 100, 2); // aspect 2 = 200/100
    expect(r).toEqual({ x: 0, y: 0, w: 200, h: 100 });
  });

  it('画像が横長なら上下にレターボックス (高さが縮む)', () => {
    const r = computeContainedRect(200, 200, 2); // 横長画像を正方コンテナへ
    expect(r.w).toBe(200);
    expect(r.h).toBe(100);
    expect(r.x).toBe(0);
    expect(r.y).toBe(50);
  });

  it('画像が縦長なら左右にレターボックス (幅が縮む)', () => {
    const r = computeContainedRect(200, 200, 0.5); // 縦長画像
    expect(r.h).toBe(200);
    expect(r.w).toBe(100);
    expect(r.y).toBe(0);
    expect(r.x).toBe(50);
  });

  it('aspectRatio <= 0 やコンテナ 0 はコンテナ全体を返す', () => {
    expect(computeContainedRect(120, 80, 0)).toEqual({ x: 0, y: 0, w: 120, h: 80 });
    expect(computeContainedRect(0, 0, 1)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});
