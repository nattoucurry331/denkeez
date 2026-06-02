import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../src/data/project-store';
import { isDirty } from '../src/data/dirty-tracker';
import { serializeProject, deserializeProject } from '../src/data/project-io';
import { PDF_TEXT_LAYER_NAME } from '../src/data/types';
import { SCHEMA_VERSION } from '../src/shared/constants/app';

// F-18: テキスト注記 / PDF 文字抽出の store・永続化テスト。

describe('project-store テキスト注記 CRUD (F-18)', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject();
  });

  it('addTextAnnotation は注記を追加し既定値・dirty をセットする', () => {
    const id = useProjectStore.getState().addTextAnnotation({ x: 100, y: 200 }, '分電盤');
    const list = useProjectStore.getState().project.textAnnotations ?? [];
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(id);
    expect(list[0]?.text).toBe('分電盤');
    expect(list[0]?.position).toEqual({ x: 100, y: 200 });
    expect(list[0]?.fontSizeMm).toBeGreaterThan(0);
    expect(list[0]?.color).toMatch(/^#/);
    expect(list[0]?.layerId).toBeTruthy();
    expect(isDirty()).toBe(true);
  });

  it('addTextAnnotation はテキスト省略時は空文字で作る', () => {
    useProjectStore.getState().addTextAnnotation({ x: 0, y: 0 });
    expect(useProjectStore.getState().project.textAnnotations?.[0]?.text).toBe('');
  });

  it('updateTextAnnotation は内容を更新する', () => {
    const id = useProjectStore.getState().addTextAnnotation({ x: 0, y: 0 }, 'a');
    useProjectStore.getState().updateTextAnnotation(id, { text: 'b', fontSizeMm: 8, color: '#ff0000' });
    const a = useProjectStore.getState().project.textAnnotations![0]!;
    expect(a.text).toBe('b');
    expect(a.fontSizeMm).toBe(8);
    expect(a.color).toBe('#ff0000');
  });

  it('removeTextAnnotations は削除し選択からも外す', () => {
    const store = useProjectStore.getState();
    const id = store.addTextAnnotation({ x: 0, y: 0 }, 'x');
    store.selectSymbols([id]);
    store.removeTextAnnotations([id]);
    expect(useProjectStore.getState().project.textAnnotations).toHaveLength(0);
    expect(useProjectStore.getState().selectedIds).not.toContain(id);
  });

  it('enterTextMode で文字モードに入り選択を解除する', () => {
    useProjectStore.getState().selectSymbols(['dummy']);
    useProjectStore.getState().enterTextMode();
    expect(useProjectStore.getState().mode.kind).toBe('text');
    expect(useProjectStore.getState().selectedIds).toEqual([]);
  });
});

describe('project-store PDF 文字抽出 (F-18)', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject();
  });

  it('setPdfTextItems は専用レイヤー(locked)を作り項目を割り当てる', () => {
    useProjectStore.getState().setPdfTextItems([
      { id: 'p1', text: '玄関', position: { x: 10, y: 20 }, fontSizeMm: 3 },
      { id: 'p2', text: '居室', position: { x: 30, y: 40 }, fontSizeMm: 3 },
    ]);
    const project = useProjectStore.getState().project;
    const pdfLayer = project.layers.find((l) => l.name === PDF_TEXT_LAYER_NAME);
    expect(pdfLayer).toBeDefined();
    expect(pdfLayer?.locked).toBe(true);
    expect(pdfLayer?.kind).toBe('user');
    expect(project.pdfTextItems).toHaveLength(2);
    expect(project.pdfTextItems?.every((t) => t.layerId === pdfLayer?.id)).toBe(true);
    // 背景レイヤーの直上に挿入される
    expect(project.layers[1]?.name).toBe(PDF_TEXT_LAYER_NAME);
  });

  it('setPdfTextItems([]) は PDF 文字レイヤーと項目を除去する', () => {
    const store = useProjectStore.getState();
    store.setPdfTextItems([{ id: 'p1', text: 'a', position: { x: 0, y: 0 }, fontSizeMm: 3 }]);
    store.setPdfTextItems([]);
    const project = useProjectStore.getState().project;
    expect(project.layers.find((l) => l.name === PDF_TEXT_LAYER_NAME)).toBeUndefined();
    expect(project.pdfTextItems).toEqual([]);
  });

  it('importPdfTextAsAnnotations は PDF 文字を編集可能な注記に複製する', () => {
    const store = useProjectStore.getState();
    store.setPdfTextItems([
      { id: 'p1', text: '玄関', position: { x: 10, y: 20 }, fontSizeMm: 4 },
    ]);
    store.importPdfTextAsAnnotations(['p1']);
    const project = useProjectStore.getState().project;
    expect(project.textAnnotations).toHaveLength(1);
    const a = project.textAnnotations![0]!;
    expect(a.text).toBe('玄関');
    expect(a.position).toEqual({ x: 10, y: 20 });
    expect(a.fontSizeMm).toBe(4);
    // アクティブ(ユーザー)レイヤーに置かれ、PDF 文字レイヤーとは別
    const pdfLayerId = project.layers.find((l) => l.name === PDF_TEXT_LAYER_NAME)?.id;
    expect(a.layerId).not.toBe(pdfLayerId);
    // 元の PDF 文字は残る (参照用)
    expect(project.pdfTextItems).toHaveLength(1);
  });
});

describe('project-io テキスト注記 / PDF 文字の往復・後方互換 (schemaVersion 4)', () => {
  it('textAnnotations と pdfTextItems を往復で保持する', () => {
    useProjectStore.getState().newProject();
    useProjectStore.getState().addTextAnnotation({ x: 1, y: 2 }, 'ラベル');
    useProjectStore.getState().setPdfTextItems([
      { id: 'p1', text: 'PDF文字', position: { x: 5, y: 6 }, fontSizeMm: 3 },
    ]);
    const project = useProjectStore.getState().project;
    const restored = deserializeProject(serializeProject(project));
    expect(restored.textAnnotations).toEqual(project.textAnnotations);
    expect(restored.pdfTextItems).toEqual(project.pdfTextItems);
  });

  it('v3 (textAnnotations/pdfTextItems 欠落) を読み込めて schemaVersion を 4 に正規化する', () => {
    useProjectStore.getState().newProject();
    const project = useProjectStore.getState().project;
    const obj = JSON.parse(serializeProject(project)) as Record<string, unknown>;
    (obj.meta as Record<string, unknown>).schemaVersion = 3;
    delete obj.textAnnotations;
    delete obj.pdfTextItems;
    const restored = deserializeProject(JSON.stringify(obj));
    expect(restored.meta.schemaVersion).toBe(SCHEMA_VERSION);
    expect(restored.textAnnotations).toBeUndefined();
    expect(restored.pdfTextItems).toBeUndefined();
  });
});
