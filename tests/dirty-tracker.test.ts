import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../src/data/project-store';
import { isDirty } from '../src/data/dirty-tracker';

// Plan §5 R-11: dirty フラグ管理の漏れを単体テストで網羅する。
// M1 では setDirty / markSaved / loadPdf の dirty 挙動のみテスト。
// M3 でシンボル配置・移動・削除の自動 dirty 化を追加した後、対応するケースを増やす。

describe('project-store dirty flag', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject();
  });

  it('初期状態は dirty=false', () => {
    expect(isDirty()).toBe(false);
  });

  it('setDirty(true) で true になる', () => {
    useProjectStore.getState().setDirty(true);
    expect(isDirty()).toBe(true);
  });

  it('markSaved() で false に戻る', () => {
    useProjectStore.getState().setDirty(true);
    useProjectStore.getState().markSaved();
    expect(isDirty()).toBe(false);
  });

  it('newProject() は dirty=false にリセットする', () => {
    useProjectStore.getState().setDirty(true);
    useProjectStore.getState().newProject();
    expect(isDirty()).toBe(false);
  });

  it('loadPdf は dirty を変更しない (PDF を開いただけでは未保存変更にならない)', () => {
    const dummyCanvas = { width: 100, height: 100 } as unknown as HTMLCanvasElement;
    const dummyBuffer = new ArrayBuffer(0);
    useProjectStore.getState().setDirty(true);
    useProjectStore.getState().loadPdf(
      'sample.pdf',
      { selectedPage: 1, widthMm: 297, heightMm: 420 },
      dummyCanvas,
      dummyBuffer,
    );
    // loadPdf は PDF 取込なので、ユーザーの編集差分はまだ無い → dirty は false にリセット
    expect(isDirty()).toBe(false);
  });
});
