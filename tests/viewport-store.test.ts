import { describe, it, expect, beforeEach } from 'vitest';
import { useViewportStore, VIEWPORT_LIMITS } from '../src/data/viewport-store';

describe('viewport-store', () => {
  beforeEach(() => {
    useViewportStore.getState().resetView();
    useViewportStore.getState().setSpaceDown(false);
  });

  describe('setScale', () => {
    it('範囲内の値はそのまま設定される', () => {
      useViewportStore.getState().setScale(2);
      expect(useViewportStore.getState().scale).toBe(2);
    });

    it('上限 (8.0) を超える値は clamp される', () => {
      useViewportStore.getState().setScale(20);
      expect(useViewportStore.getState().scale).toBe(VIEWPORT_LIMITS.MAX_SCALE);
    });

    it('下限 (0.1) を下回る値は clamp される', () => {
      useViewportStore.getState().setScale(0.001);
      expect(useViewportStore.getState().scale).toBe(VIEWPORT_LIMITS.MIN_SCALE);
    });
  });

  describe('zoomAt — カーソル位置中心ズーム', () => {
    it('原点で zoom してもカーソル下の論理座標が変わらない', () => {
      const cursor = { x: 100, y: 200 };
      useViewportStore.getState().zoomAt(cursor, 2); // 2倍
      const { scale, offsetX, offsetY } = useViewportStore.getState();
      // カーソル下のキャンバス座標 = (cursor - offset) / scale
      const cx = (cursor.x - offsetX) / scale;
      const cy = (cursor.y - offsetY) / scale;
      // 元 scale=1 / offset=0 のとき cursor の論理座標は (100, 200)
      expect(cx).toBeCloseTo(100);
      expect(cy).toBeCloseTo(200);
      expect(scale).toBe(2);
    });

    it('連続ズームでも論理座標が一致する', () => {
      const cursor = { x: 50, y: 75 };
      useViewportStore.getState().zoomAt(cursor, 1.5);
      useViewportStore.getState().zoomAt(cursor, 1.5);
      useViewportStore.getState().zoomAt(cursor, 1.5);
      const { scale, offsetX, offsetY } = useViewportStore.getState();
      const cx = (cursor.x - offsetX) / scale;
      const cy = (cursor.y - offsetY) / scale;
      expect(cx).toBeCloseTo(50, 5);
      expect(cy).toBeCloseTo(75, 5);
    });

    it('clamp に達したら scale 変化なし、offset も変わらない', () => {
      useViewportStore.getState().setScale(VIEWPORT_LIMITS.MAX_SCALE);
      const before = useViewportStore.getState();
      useViewportStore.getState().zoomAt({ x: 0, y: 0 }, 2); // これ以上拡大不可
      const after = useViewportStore.getState();
      expect(after.scale).toBe(before.scale);
      expect(after.offsetX).toBe(before.offsetX);
      expect(after.offsetY).toBe(before.offsetY);
    });
  });

  describe('resetView', () => {
    it('scale=1 / offset=(0,0) に戻る', () => {
      useViewportStore.getState().setScale(3);
      useViewportStore.getState().setOffset(100, 200);
      useViewportStore.getState().resetView();
      const { scale, offsetX, offsetY } = useViewportStore.getState();
      expect(scale).toBe(1);
      expect(offsetX).toBe(0);
      expect(offsetY).toBe(0);
    });
  });

  describe('fitToWindow', () => {
    it('縦長 viewport に横長 canvas を中央寄せでフィット', () => {
      useViewportStore.getState().fitToWindow({ w: 1000, h: 500 }, { w: 600, h: 800 });
      const { scale, offsetX } = useViewportStore.getState();
      // 600/1000 = 0.6, 800/500 = 1.6 → 小さい方 0.6 × 0.95
      expect(scale).toBeCloseTo(0.6 * 0.95, 5);
      // canvas を中央寄せ → offsetX = (600 - 1000*scale) / 2
      expect(offsetX).toBeCloseTo((600 - 1000 * scale) / 2, 5);
    });

    it('canvas/viewport が 0 以下なら何もしない', () => {
      useViewportStore.getState().setScale(2);
      useViewportStore.getState().fitToWindow({ w: 0, h: 100 }, { w: 100, h: 100 });
      expect(useViewportStore.getState().scale).toBe(2);
    });
  });

  describe('setSpaceDown', () => {
    it('true / false が反映される', () => {
      useViewportStore.getState().setSpaceDown(true);
      expect(useViewportStore.getState().spaceDown).toBe(true);
      useViewportStore.getState().setSpaceDown(false);
      expect(useViewportStore.getState().spaceDown).toBe(false);
    });
  });
});
