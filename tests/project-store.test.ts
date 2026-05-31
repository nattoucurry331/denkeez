import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../src/data/project-store';
import { isDirty } from '../src/data/dirty-tracker';

// zundo の undo/redo は handleSet で 100ms debounce している。
// テストでは debounce を待つ helper を用意する。
function flushDebounce(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 150));
}

// Plan §5 R-11: dirty フラグ管理の漏れを単体テストで網羅する。
// すべての mutation で dirty=true 化されるかを検証。

describe('project-store dimension CRUD (F-16 Sub-3)', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject();
  });

  it('addDimension は寸法を追加し dirty にする', () => {
    useProjectStore.getState().addDimension({ x: 0, y: 0 }, { x: 1000, y: 0 });
    const dims = useProjectStore.getState().project.dimensions ?? [];
    expect(dims).toHaveLength(1);
    expect(dims[0]?.from).toEqual({ x: 0, y: 0 });
    expect(dims[0]?.to).toEqual({ x: 1000, y: 0 });
    expect(dims[0]?.layerId).toBeTruthy();
    expect(isDirty()).toBe(true);
  });

  it('updateDimensionPoints は端点を更新する', () => {
    useProjectStore.getState().addDimension({ x: 0, y: 0 }, { x: 10, y: 0 });
    const id = useProjectStore.getState().project.dimensions![0]!.id;
    useProjectStore.getState().updateDimensionPoints(id, { x: 5, y: 5 }, { x: 20, y: 5 });
    const d = useProjectStore.getState().project.dimensions![0]!;
    expect(d.from).toEqual({ x: 5, y: 5 });
    expect(d.to).toEqual({ x: 20, y: 5 });
  });

  it('removeDimensions は指定 id を削除し選択からも外す', () => {
    const store = useProjectStore.getState();
    store.addDimension({ x: 0, y: 0 }, { x: 10, y: 0 });
    const id = useProjectStore.getState().project.dimensions![0]!.id;
    store.selectSymbols([id]);
    store.removeDimensions([id]);
    expect(useProjectStore.getState().project.dimensions).toHaveLength(0);
    expect(useProjectStore.getState().selectedIds).not.toContain(id);
  });

  it('enterDimensionMode で寸法線モードに入る', () => {
    useProjectStore.getState().enterDimensionMode();
    expect(useProjectStore.getState().mode.kind).toBe('dimension');
  });
});

describe('project-store symbol CRUD', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject();
  });

  describe('addSymbol', () => {
    it('シンボルを末尾に追加する', () => {
      useProjectStore.getState().addSymbol('downlight', { x: 100, y: 200 });
      const symbols = useProjectStore.getState().project.symbols;
      expect(symbols).toHaveLength(1);
      expect(symbols[0]?.type).toBe('downlight');
      expect(symbols[0]?.position).toEqual({ x: 100, y: 200 });
    });

    it('UUID を自動採番する (重複なし)', () => {
      const store = useProjectStore.getState();
      store.addSymbol('downlight', { x: 0, y: 0 });
      store.addSymbol('downlight', { x: 100, y: 0 });
      const symbols = useProjectStore.getState().project.symbols;
      expect(symbols[0]?.id).not.toBe(symbols[1]?.id);
    });

    it('追加で dirty=true になる (R-11)', () => {
      expect(isDirty()).toBe(false);
      useProjectStore.getState().addSymbol('downlight', { x: 0, y: 0 });
      expect(isDirty()).toBe(true);
    });

    it('rotation の初期値は 0', () => {
      useProjectStore.getState().addSymbol('downlight', { x: 0, y: 0 });
      expect(useProjectStore.getState().project.symbols[0]?.rotation).toBe(0);
    });
  });

  describe('updateSymbolPosition', () => {
    it('指定 ID のシンボル位置を更新する', () => {
      useProjectStore.getState().addSymbol('downlight', { x: 0, y: 0 });
      const id = useProjectStore.getState().project.symbols[0]!.id;
      useProjectStore.getState().updateSymbolPosition(id, { x: 50, y: 75 });
      const updated = useProjectStore.getState().project.symbols[0];
      expect(updated?.position).toEqual({ x: 50, y: 75 });
    });

    it('他のシンボルには影響しない', () => {
      const store = useProjectStore.getState();
      store.addSymbol('downlight', { x: 0, y: 0 });
      store.addSymbol('downlight', { x: 100, y: 0 });
      const [a, b] = useProjectStore.getState().project.symbols;
      store.updateSymbolPosition(a!.id, { x: 999, y: 999 });
      const after = useProjectStore.getState().project.symbols;
      expect(after[1]?.position).toEqual(b?.position);
    });

    it('移動で dirty=true になる (R-11)', () => {
      useProjectStore.getState().addSymbol('downlight', { x: 0, y: 0 });
      const id = useProjectStore.getState().project.symbols[0]!.id;
      useProjectStore.getState().markSaved();
      expect(isDirty()).toBe(false);
      useProjectStore.getState().updateSymbolPosition(id, { x: 1, y: 1 });
      expect(isDirty()).toBe(true);
    });
  });

  describe('removeSymbols', () => {
    it('指定 ID のシンボルを削除する', () => {
      const store = useProjectStore.getState();
      store.addSymbol('downlight', { x: 0, y: 0 });
      store.addSymbol('downlight', { x: 100, y: 0 });
      const ids = useProjectStore.getState().project.symbols.map((s) => s.id);
      store.removeSymbols([ids[0]!]);
      const remaining = useProjectStore.getState().project.symbols;
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.id).toBe(ids[1]);
    });

    it('削除されたシンボルが selectedIds から外れる', () => {
      const store = useProjectStore.getState();
      store.addSymbol('downlight', { x: 0, y: 0 });
      const id = useProjectStore.getState().project.symbols[0]!.id;
      store.selectSymbols([id]);
      store.removeSymbols([id]);
      expect(useProjectStore.getState().selectedIds).toEqual([]);
    });

    it('削除で dirty=true になる (R-11)', () => {
      const store = useProjectStore.getState();
      store.addSymbol('downlight', { x: 0, y: 0 });
      store.markSaved();
      const id = useProjectStore.getState().project.symbols[0]!.id;
      expect(isDirty()).toBe(false);
      store.removeSymbols([id]);
      expect(isDirty()).toBe(true);
    });

    it('空配列を渡しても何も起きない (dirty 変化なし)', () => {
      const store = useProjectStore.getState();
      store.markSaved();
      store.removeSymbols([]);
      expect(isDirty()).toBe(false);
    });
  });

  describe('selection', () => {
    it('selectSymbols で複数選択できる', () => {
      const store = useProjectStore.getState();
      store.addSymbol('downlight', { x: 0, y: 0 });
      store.addSymbol('downlight', { x: 100, y: 0 });
      const ids = useProjectStore.getState().project.symbols.map((s) => s.id);
      store.selectSymbols(ids);
      expect(useProjectStore.getState().selectedIds).toEqual(ids);
    });

    it('toggleSelectSymbol は選択をトグルする', () => {
      const store = useProjectStore.getState();
      store.toggleSelectSymbol('a');
      expect(useProjectStore.getState().selectedIds).toEqual(['a']);
      store.toggleSelectSymbol('b');
      expect(useProjectStore.getState().selectedIds).toEqual(['a', 'b']);
      store.toggleSelectSymbol('a');
      expect(useProjectStore.getState().selectedIds).toEqual(['b']);
    });

    it('clearSelection で選択を空にする', () => {
      const store = useProjectStore.getState();
      store.selectSymbols(['a', 'b']);
      store.clearSelection();
      expect(useProjectStore.getState().selectedIds).toEqual([]);
    });

    it('選択操作は dirty を変えない', () => {
      const store = useProjectStore.getState();
      store.markSaved();
      store.selectSymbols(['a']);
      store.toggleSelectSymbol('b');
      store.clearSelection();
      expect(isDirty()).toBe(false);
    });
  });

  describe('updateSymbolRotation / moveSymbols / updateSymbolProperties (Phase 2-B)', () => {
    it('updateSymbolRotation で rotation 更新 + dirty=true', () => {
      useProjectStore.getState().addSymbol('downlight', { x: 0, y: 0 });
      useProjectStore.getState().markSaved();
      const id = useProjectStore.getState().project.symbols[0]!.id;
      useProjectStore.getState().updateSymbolRotation(id, 90);
      expect(useProjectStore.getState().project.symbols[0]?.rotation).toBe(90);
      expect(isDirty()).toBe(true);
    });

    it('moveSymbols で複数 ID の position に delta 加算 + dirty=true', () => {
      useProjectStore.getState().addSymbol('downlight', { x: 0, y: 0 });
      useProjectStore.getState().addSymbol('downlight', { x: 100, y: 100 });
      const ids = useProjectStore.getState().project.symbols.map((s) => s.id);
      useProjectStore.getState().markSaved();
      useProjectStore.getState().moveSymbols(ids, { x: 5, y: -3 });
      const after = useProjectStore.getState().project.symbols;
      expect(after[0]?.position).toEqual({ x: 5, y: -3 });
      expect(after[1]?.position).toEqual({ x: 105, y: 97 });
      expect(isDirty()).toBe(true);
    });

    it('updateSymbolProperties で properties 更新 + dirty=true', () => {
      useProjectStore.getState().addSymbol('downlight', { x: 0, y: 0 });
      const id = useProjectStore.getState().project.symbols[0]!.id;
      useProjectStore.getState().markSaved();
      useProjectStore.getState().updateSymbolProperties(id, { circuit: 'L-1', wattage: 60 });
      const sym = useProjectStore.getState().project.symbols[0];
      expect(sym?.properties.circuit).toBe('L-1');
      expect(sym?.properties.wattage).toBe(60);
      expect(isDirty()).toBe(true);
    });

    it('moveSymbols 空配列は何もしない', () => {
      useProjectStore.getState().markSaved();
      useProjectStore.getState().moveSymbols([], { x: 5, y: 0 });
      expect(isDirty()).toBe(false);
    });
  });

  describe('Phase 2-C: スケール / 配線', () => {
    it('setScale で drawing.scale が保存される + dirty=true', () => {
      const store = useProjectStore.getState();
      store.loadPdf(
        'test.pdf',
        { selectedPage: 1, widthMm: 297, heightMm: 420 },
        { width: 100, height: 100 } as unknown as HTMLCanvasElement,
        new ArrayBuffer(0),
      );
      store.markSaved();
      store.setScale({ pixelDistanceCanvas: 200, realDistanceMm: 5000 });
      expect(useProjectStore.getState().project.drawing?.scale).toEqual({
        pixelDistanceCanvas: 200,
        realDistanceMm: 5000,
      });
      expect(isDirty()).toBe(true);
    });

    it('addWire で wires に追加 + lengthMm 自動計算', () => {
      const store = useProjectStore.getState();
      store.addSymbol('downlight', { x: 0, y: 0 });
      store.addSymbol('downlight', { x: 100, y: 0 });
      const ids = useProjectStore.getState().project.symbols.map((s) => s.id);
      store.markSaved();
      const wireId = store.addWire(ids[0]!, ids[1]!, []);
      const wires = useProjectStore.getState().project.wires ?? [];
      expect(wires).toHaveLength(1);
      expect(wires[0]?.id).toBe(wireId);
      expect(wires[0]?.lengthMm).toBe(100);
      expect(isDirty()).toBe(true);
    });

    it('addWire の waypoints 経由で lengthMm が距離合計', () => {
      const store = useProjectStore.getState();
      store.addSymbol('downlight', { x: 0, y: 0 });
      store.addSymbol('downlight', { x: 100, y: 100 });
      const ids = useProjectStore.getState().project.symbols.map((s) => s.id);
      store.addWire(ids[0]!, ids[1]!, [{ x: 100, y: 0 }]);
      const wire = useProjectStore.getState().project.wires?.[0];
      // (0,0)→(100,0)=100, (100,0)→(100,100)=100、合計 200
      expect(wire?.lengthMm).toBe(200);
    });

    it('updateWire で type / cable / circuit を変更可能', () => {
      const store = useProjectStore.getState();
      store.addSymbol('downlight', { x: 0, y: 0 });
      store.addSymbol('downlight', { x: 100, y: 0 });
      const ids = useProjectStore.getState().project.symbols.map((s) => s.id);
      const wireId = store.addWire(ids[0]!, ids[1]!, []);
      store.markSaved();
      store.updateWire(wireId, { type: 'floor', cable: 'CV', circuit: 'L-1' });
      const wire = useProjectStore.getState().project.wires?.[0];
      expect(wire?.type).toBe('floor');
      expect(wire?.cable).toBe('CV');
      expect(wire?.circuit).toBe('L-1');
      expect(isDirty()).toBe(true);
    });

    it('removeSymbols で参照 Wire が同期削除される (R-09.1.4)', () => {
      const store = useProjectStore.getState();
      store.addSymbol('downlight', { x: 0, y: 0 });
      store.addSymbol('downlight', { x: 100, y: 0 });
      store.addSymbol('downlight', { x: 200, y: 0 });
      const ids = useProjectStore.getState().project.symbols.map((s) => s.id);
      store.addWire(ids[0]!, ids[1]!, []);
      store.addWire(ids[1]!, ids[2]!, []);
      store.removeSymbols([ids[1]!]); // 中央のシンボル削除 → 両方の wire が削除
      const after = useProjectStore.getState().project;
      expect(after.symbols).toHaveLength(2);
      expect(after.wires).toHaveLength(0);
    });

    it('updateSymbolPosition で参照 Wire の lengthMm が再計算される', () => {
      const store = useProjectStore.getState();
      store.addSymbol('downlight', { x: 0, y: 0 });
      store.addSymbol('downlight', { x: 100, y: 0 });
      const ids = useProjectStore.getState().project.symbols.map((s) => s.id);
      store.addWire(ids[0]!, ids[1]!, []);
      // 100mm の配線
      expect(useProjectStore.getState().project.wires?.[0]?.lengthMm).toBe(100);
      // ID0 を (200,0) に移動 → (200→100) = 100mm から (200→100) = 100mm... ↑ 待て
      // (0,0) → (100,0) = 100、(0,0) を (200,0) に移動すると (200,0)→(100,0) = 100、変わらず
      // 別パターン: ID0 を (0,300) に移動 → (0,300)→(100,0) = sqrt(100²+300²) = sqrt(100000) ≈ 316.23
      store.updateSymbolPosition(ids[0]!, { x: 0, y: 300 });
      const newLength = useProjectStore.getState().project.wires?.[0]?.lengthMm;
      expect(newLength).toBeCloseTo(Math.sqrt(100 * 100 + 300 * 300), 1);
    });

    it('moveSymbols で参照 Wire の lengthMm が再計算される', () => {
      const store = useProjectStore.getState();
      store.addSymbol('downlight', { x: 0, y: 0 });
      store.addSymbol('downlight', { x: 100, y: 0 });
      const ids = useProjectStore.getState().project.symbols.map((s) => s.id);
      store.addWire(ids[0]!, ids[1]!, []);
      // 両方を (50, 50) ずらす → 距離 100 のまま
      store.moveSymbols(ids, { x: 50, y: 50 });
      const length = useProjectStore.getState().project.wires?.[0]?.lengthMm;
      expect(length).toBeCloseTo(100, 1);
    });

    it('removeWires で wires が削除 + dirty=true', () => {
      const store = useProjectStore.getState();
      store.addSymbol('downlight', { x: 0, y: 0 });
      store.addSymbol('downlight', { x: 100, y: 0 });
      const ids = useProjectStore.getState().project.symbols.map((s) => s.id);
      const wireId = store.addWire(ids[0]!, ids[1]!, []);
      store.markSaved();
      store.removeWires([wireId]);
      expect(useProjectStore.getState().project.wires).toEqual([]);
      expect(isDirty()).toBe(true);
    });
  });

  describe('zundo undo / redo (Phase 2-A4)', () => {
    beforeEach(() => {
      useProjectStore.temporal.getState().clear();
    });

    it('addSymbol → undo で symbols が空に戻る', async () => {
      useProjectStore.getState().addSymbol('downlight', { x: 100, y: 200 });
      await flushDebounce();
      expect(useProjectStore.getState().project.symbols).toHaveLength(1);
      useProjectStore.temporal.getState().undo();
      expect(useProjectStore.getState().project.symbols).toHaveLength(0);
    });

    it('undo → redo で symbols が復元される', async () => {
      useProjectStore.getState().addSymbol('downlight', { x: 50, y: 75 });
      await flushDebounce();
      const before = useProjectStore.getState().project.symbols;
      useProjectStore.temporal.getState().undo();
      expect(useProjectStore.getState().project.symbols).toHaveLength(0);
      useProjectStore.temporal.getState().redo();
      expect(useProjectStore.getState().project.symbols).toEqual(before);
    });

    it('partialize: pdfCanvas や mode は履歴に含まれない (undo で巻き戻らない)', async () => {
      const dummyCanvas = { width: 100, height: 100 } as unknown as HTMLCanvasElement;
      useProjectStore.getState().loadPdf(
        'test.pdf',
        { selectedPage: 1, widthMm: 297, heightMm: 420 },
        dummyCanvas,
        new ArrayBuffer(0),
      );
      useProjectStore.getState().enterPlaceMode('downlight');
      useProjectStore.getState().addSymbol('downlight', { x: 0, y: 0 });
      await flushDebounce();
      // undo してもモードや pdfCanvas は維持される (project.symbols のみ巻き戻る)
      useProjectStore.temporal.getState().undo();
      expect(useProjectStore.getState().project.symbols).toHaveLength(0);
      expect(useProjectStore.getState().pdfCanvas).toBe(dummyCanvas);
      expect(useProjectStore.getState().mode.kind).toBe('place');
    });
  });

  describe('mode', () => {
    it('enterPlaceMode で配置モードになる', () => {
      useProjectStore.getState().enterPlaceMode('downlight');
      const mode = useProjectStore.getState().mode;
      expect(mode).toEqual({ kind: 'place', symbolType: 'downlight' });
    });

    it('enterPlaceMode は selectedIds をクリアする', () => {
      const store = useProjectStore.getState();
      store.selectSymbols(['a']);
      store.enterPlaceMode('downlight');
      expect(useProjectStore.getState().selectedIds).toEqual([]);
    });

    it('exitMode で選択モードに戻る', () => {
      const store = useProjectStore.getState();
      store.enterPlaceMode('downlight');
      store.exitMode();
      expect(useProjectStore.getState().mode).toEqual({ kind: 'select' });
    });

    it('モード切替は dirty を変えない', () => {
      const store = useProjectStore.getState();
      store.markSaved();
      store.enterPlaceMode('downlight');
      store.exitMode();
      expect(isDirty()).toBe(false);
    });
  });
});
