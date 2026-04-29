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
