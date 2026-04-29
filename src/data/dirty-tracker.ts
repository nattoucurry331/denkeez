// dirty フラグの読み取りユーティリティ。
// M3 でシンボル配置時に zustand subscribe 経由で自動 dirty 化する仕組みを追加予定 (Plan §5 R-11)。

import { useProjectStore } from './project-store';

/** 未保存変更があるかを同期的に取得 (close handler 等で使用) */
export function isDirty(): boolean {
  return useProjectStore.getState().dirty;
}
