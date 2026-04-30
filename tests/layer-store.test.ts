import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../src/data/project-store';
import { isDirty } from '../src/data/dirty-tracker';
import { BACKGROUND_LAYER_ID, STANDARD_USER_LAYER_PRESETS } from '../src/data/types';

// Phase 2-D1: F-08 レイヤー管理のデータモデル / store actions の単体テスト。
// 描画反映・UI 操作のテストは 2-D2 / 2-D3 で追加する。

describe('createEmptyProject の初期レイヤー', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject();
  });

  it('背景レイヤー (kind: background, locked) が layers[0] に存在する', () => {
    const layers = useProjectStore.getState().project.layers;
    expect(layers[0]?.kind).toBe('background');
    expect(layers[0]?.id).toBe(BACKGROUND_LAYER_ID);
    expect(layers[0]?.locked).toBe(true);
  });

  it('標準ユーザーレイヤー 5 種が背景の直上に生成される', () => {
    const layers = useProjectStore.getState().project.layers;
    const userLayers = layers.filter((l) => l.kind === 'user');
    expect(userLayers).toHaveLength(STANDARD_USER_LAYER_PRESETS.length);
    expect(userLayers.map((l) => l.name)).toEqual(
      STANDARD_USER_LAYER_PRESETS.map((p) => p.name),
    );
  });

  it('activeLayerId は最初のユーザーレイヤー (照明回路) を指す', () => {
    const { activeLayerId, project } = useProjectStore.getState();
    const firstUser = project.layers.find((l) => l.kind === 'user');
    expect(activeLayerId).toBe(firstUser?.id);
    expect(activeLayerId).not.toBe(BACKGROUND_LAYER_ID);
  });

  it('newProject() では dirty=false', () => {
    expect(isDirty()).toBe(false);
  });
});

describe('addSymbol / addWire の所属レイヤー', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject();
  });

  it('addSymbol で生成されるシンボルは activeLayerId に所属する', () => {
    const store = useProjectStore.getState();
    store.addSymbol('downlight', { x: 0, y: 0 });
    const sym = useProjectStore.getState().project.symbols[0];
    expect(sym?.layerId).toBe(store.activeLayerId);
  });

  it('setActiveLayer で別レイヤーに切替後、新しい symbol は新 active に所属する', () => {
    const store = useProjectStore.getState();
    const layers = store.project.layers.filter((l) => l.kind === 'user');
    const second = layers[1];
    expect(second).toBeDefined();
    store.setActiveLayer(second!.id);
    store.addSymbol('downlight', { x: 0, y: 0 });
    const sym = useProjectStore.getState().project.symbols[0];
    expect(sym?.layerId).toBe(second!.id);
  });

  it('setActiveLayer は存在しない ID を無視する', () => {
    const store = useProjectStore.getState();
    const before = store.activeLayerId;
    store.setActiveLayer('nonexistent-id');
    expect(useProjectStore.getState().activeLayerId).toBe(before);
  });

  it('addWire で生成される配線は activeLayerId に所属する', () => {
    const store = useProjectStore.getState();
    store.addSymbol('downlight', { x: 0, y: 0 });
    store.addSymbol('downlight', { x: 100, y: 0 });
    const ids = useProjectStore.getState().project.symbols.map((s) => s.id);
    const wireId = store.addWire(ids[0]!, ids[1]!, []);
    const wire = useProjectStore.getState().project.wires?.find((w) => w.id === wireId);
    expect(wire?.layerId).toBe(store.activeLayerId);
  });
});

describe('addLayer / updateLayer', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject();
  });

  it('addLayer で末尾にユーザーレイヤーが追加される + dirty=true', () => {
    const store = useProjectStore.getState();
    const beforeLen = store.project.layers.length;
    store.markSaved();
    const newId = store.addLayer('回路A', '#ff0000');
    const after = useProjectStore.getState().project.layers;
    expect(after).toHaveLength(beforeLen + 1);
    expect(after[after.length - 1]?.id).toBe(newId);
    expect(after[after.length - 1]?.name).toBe('回路A');
    expect(after[after.length - 1]?.color).toBe('#ff0000');
    expect(after[after.length - 1]?.kind).toBe('user');
    expect(isDirty()).toBe(true);
  });

  it('addLayer で生成された ID は重複しない', () => {
    const store = useProjectStore.getState();
    const id1 = store.addLayer('A', '#ff0000');
    const id2 = store.addLayer('B', '#00ff00');
    expect(id1).not.toBe(id2);
  });

  it('updateLayer で name / color / visible / locked を部分更新できる + dirty=true', () => {
    const store = useProjectStore.getState();
    const layers = store.project.layers.filter((l) => l.kind === 'user');
    const target = layers[0]!;
    store.markSaved();
    store.updateLayer(target.id, { name: '新名前', visible: false });
    const after = useProjectStore.getState().project.layers.find((l) => l.id === target.id);
    expect(after?.name).toBe('新名前');
    expect(after?.visible).toBe(false);
    // 更新していないフィールドは保持
    expect(after?.color).toBe(target.color);
    expect(after?.locked).toBe(target.locked);
    expect(isDirty()).toBe(true);
  });

  it('updateLayer は存在しない ID を無視する (dirty 変化なし)', () => {
    const store = useProjectStore.getState();
    store.markSaved();
    store.updateLayer('nonexistent', { name: 'x' });
    expect(isDirty()).toBe(false);
  });
});

describe('removeLayer', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject();
  });

  it('元図面レイヤー (background) は削除不可 → throw', () => {
    const store = useProjectStore.getState();
    expect(() =>
      store.removeLayer(BACKGROUND_LAYER_ID, { mode: 'delete-contents' }),
    ).toThrow(/元図面/);
  });

  it('ユーザーレイヤーが 1 つしか残っていないと削除不可 → throw', () => {
    const store = useProjectStore.getState();
    const userLayers = store.project.layers.filter((l) => l.kind === 'user');
    // 最後の 1 つになるまで削除
    for (let i = 0; i < userLayers.length - 1; i++) {
      const id = useProjectStore.getState().project.layers
        .filter((l) => l.kind === 'user')[0]!.id;
      useProjectStore.getState().removeLayer(id, { mode: 'delete-contents' });
    }
    const lastUserId = useProjectStore.getState().project.layers
      .filter((l) => l.kind === 'user')[0]!.id;
    expect(() =>
      useProjectStore.getState().removeLayer(lastUserId, { mode: 'delete-contents' }),
    ).toThrow(/少なくとも 1 つ/);
  });

  it("mode='delete-contents': 該当レイヤーの symbol も一緒に削除される", () => {
    const store = useProjectStore.getState();
    const targetLayer = store.project.layers.filter((l) => l.kind === 'user')[1]!;
    store.setActiveLayer(targetLayer.id);
    store.addSymbol('downlight', { x: 0, y: 0 });
    store.addSymbol('downlight', { x: 100, y: 0 });
    // 別レイヤーにも 1 個置く (削除されないことを確認)
    const otherLayer = store.project.layers.filter((l) => l.kind === 'user')[0]!;
    store.setActiveLayer(otherLayer.id);
    store.addSymbol('downlight', { x: 200, y: 0 });

    expect(useProjectStore.getState().project.symbols).toHaveLength(3);
    useProjectStore.getState().removeLayer(targetLayer.id, { mode: 'delete-contents' });
    const after = useProjectStore.getState().project;
    expect(after.symbols).toHaveLength(1);
    expect(after.symbols[0]?.layerId).toBe(otherLayer.id);
    expect(after.layers.find((l) => l.id === targetLayer.id)).toBeUndefined();
  });

  it("mode='delete-contents': 削除 symbol を参照する wire は連鎖削除される (Phase 2-C4 と同じ規約)", () => {
    const store = useProjectStore.getState();
    const layerA = store.project.layers.filter((l) => l.kind === 'user')[0]!;
    const layerB = store.project.layers.filter((l) => l.kind === 'user')[1]!;
    store.setActiveLayer(layerA.id);
    store.addSymbol('downlight', { x: 0, y: 0 });
    store.addSymbol('downlight', { x: 100, y: 0 });
    const ids = useProjectStore.getState().project.symbols.map((s) => s.id);
    // wire は layerB に置く (layer 自体は B だが from/to が layerA の symbol)
    store.setActiveLayer(layerB.id);
    store.addWire(ids[0]!, ids[1]!, []);
    expect(useProjectStore.getState().project.wires).toHaveLength(1);
    // layerA を削除 → 中の symbol が消えるので、layerB に乗っていた wire も連鎖削除
    useProjectStore.getState().removeLayer(layerA.id, { mode: 'delete-contents' });
    expect(useProjectStore.getState().project.wires).toEqual([]);
  });

  it("mode='move-to-fallback': symbol/wire が指定 fallback レイヤーに移動する", () => {
    const store = useProjectStore.getState();
    const target = store.project.layers.filter((l) => l.kind === 'user')[1]!;
    const fallback = store.project.layers.filter((l) => l.kind === 'user')[0]!;
    store.setActiveLayer(target.id);
    store.addSymbol('downlight', { x: 0, y: 0 });
    store.addSymbol('downlight', { x: 100, y: 0 });
    const ids = useProjectStore.getState().project.symbols.map((s) => s.id);
    store.addWire(ids[0]!, ids[1]!, []);

    useProjectStore.getState().removeLayer(target.id, {
      mode: 'move-to-fallback',
      fallbackLayerId: fallback.id,
    });
    const after = useProjectStore.getState().project;
    expect(after.layers.find((l) => l.id === target.id)).toBeUndefined();
    for (const s of after.symbols) expect(s.layerId).toBe(fallback.id);
    for (const w of after.wires ?? []) expect(w.layerId).toBe(fallback.id);
  });

  it("mode='move-to-fallback': fallbackLayerId 省略時は残ったユーザーレイヤーの先頭に寄せる", () => {
    const store = useProjectStore.getState();
    const target = store.project.layers.filter((l) => l.kind === 'user')[2]!;
    store.setActiveLayer(target.id);
    store.addSymbol('downlight', { x: 0, y: 0 });
    useProjectStore.getState().removeLayer(target.id, { mode: 'move-to-fallback' });
    const after = useProjectStore.getState().project;
    const firstUser = after.layers.find((l) => l.kind === 'user');
    expect(after.symbols[0]?.layerId).toBe(firstUser?.id);
  });

  it('activeLayerId が削除対象なら新しいユーザーレイヤーに切り替わる', () => {
    const store = useProjectStore.getState();
    const target = store.project.layers.filter((l) => l.kind === 'user')[1]!;
    store.setActiveLayer(target.id);
    expect(useProjectStore.getState().activeLayerId).toBe(target.id);
    useProjectStore.getState().removeLayer(target.id, { mode: 'delete-contents' });
    const after = useProjectStore.getState();
    expect(after.activeLayerId).not.toBe(target.id);
    expect(after.project.layers.some((l) => l.id === after.activeLayerId)).toBe(true);
  });
});

describe('reorderLayers', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject();
  });

  it('全レイヤー ID が揃った正しい順序で並び替えできる', () => {
    const store = useProjectStore.getState();
    const layers = store.project.layers;
    const bg = layers[0]!;
    const userLayers = layers.filter((l) => l.kind === 'user');
    // ユーザーレイヤーを逆順にする
    const newOrder = [bg.id, ...userLayers.map((l) => l.id).reverse()];
    store.reorderLayers(newOrder);
    const after = useProjectStore.getState().project.layers.map((l) => l.id);
    expect(after).toEqual(newOrder);
  });

  it('元図面レイヤーが index 0 でないと throw', () => {
    const store = useProjectStore.getState();
    const userLayers = store.project.layers.filter((l) => l.kind === 'user');
    const wrongOrder = [
      userLayers[0]!.id,
      BACKGROUND_LAYER_ID,
      ...userLayers.slice(1).map((l) => l.id),
    ];
    expect(() => store.reorderLayers(wrongOrder)).toThrow(/最下層/);
  });

  it('既存レイヤー集合と一致しない ID リストは throw', () => {
    const store = useProjectStore.getState();
    expect(() => store.reorderLayers([BACKGROUND_LAYER_ID])).toThrow(/ID 数/);
  });

  it('重複した ID リストは throw', () => {
    const store = useProjectStore.getState();
    const layers = store.project.layers;
    const dup = [BACKGROUND_LAYER_ID, ...layers.slice(1).map(() => layers[1]!.id)];
    expect(() => store.reorderLayers(dup)).toThrow(/重複/);
  });
});

describe('moveSymbolsToLayer / moveWiresToLayer', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject();
  });

  it('moveSymbolsToLayer で指定 symbol が別レイヤーへ移動する + dirty=true', () => {
    const store = useProjectStore.getState();
    const userLayers = store.project.layers.filter((l) => l.kind === 'user');
    const layerA = userLayers[0]!;
    const layerB = userLayers[1]!;
    store.setActiveLayer(layerA.id);
    store.addSymbol('downlight', { x: 0, y: 0 });
    store.addSymbol('downlight', { x: 100, y: 0 });
    const ids = useProjectStore.getState().project.symbols.map((s) => s.id);
    store.markSaved();
    store.moveSymbolsToLayer([ids[0]!], layerB.id);
    const after = useProjectStore.getState().project.symbols;
    expect(after.find((s) => s.id === ids[0])?.layerId).toBe(layerB.id);
    expect(after.find((s) => s.id === ids[1])?.layerId).toBe(layerA.id);
    expect(isDirty()).toBe(true);
  });

  it('moveSymbolsToLayer は存在しないレイヤー ID で throw', () => {
    const store = useProjectStore.getState();
    store.addSymbol('downlight', { x: 0, y: 0 });
    const id = useProjectStore.getState().project.symbols[0]!.id;
    expect(() => store.moveSymbolsToLayer([id], 'nonexistent')).toThrow(/存在しません/);
  });

  it('moveWiresToLayer で指定 wire が別レイヤーへ移動する', () => {
    const store = useProjectStore.getState();
    const userLayers = store.project.layers.filter((l) => l.kind === 'user');
    const layerA = userLayers[0]!;
    const layerB = userLayers[1]!;
    store.setActiveLayer(layerA.id);
    store.addSymbol('downlight', { x: 0, y: 0 });
    store.addSymbol('downlight', { x: 100, y: 0 });
    const sids = useProjectStore.getState().project.symbols.map((s) => s.id);
    const wireId = store.addWire(sids[0]!, sids[1]!, []);
    store.moveWiresToLayer([wireId], layerB.id);
    const w = useProjectStore.getState().project.wires?.[0];
    expect(w?.layerId).toBe(layerB.id);
  });

  it('空配列の moveSymbolsToLayer は dirty を変えない', () => {
    const store = useProjectStore.getState();
    const layerB = store.project.layers.filter((l) => l.kind === 'user')[1]!;
    store.markSaved();
    store.moveSymbolsToLayer([], layerB.id);
    expect(isDirty()).toBe(false);
  });
});
