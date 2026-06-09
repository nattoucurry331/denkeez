// tauri://close-requested ハンドラ (CLAUDE.md L196 担保)。
// Plan §1 「PoC 保存保護: 未保存終了確認ダイアログ」を実装する。
//
// React 側でユーザー判断 (保存して閉じる / 保存せず閉じる / キャンセル) を解決する
// async ハンドラを registerCloseConfirmHandler で登録し、close-requested 発火時に呼び出す。

import { getCurrentWindow } from '@tauri-apps/api/window';
import { isDirty } from '../data/dirty-tracker';
import { useProjectStore } from '../data/project-store';
import { performSave } from '../components/menu-bar/save-actions';

export type CloseDecision = 'save' | 'discard' | 'cancel';
export type CloseConfirmHandler = () => Promise<CloseDecision>;

let confirmHandler: CloseConfirmHandler | null = null;

/** React 側のダイアログ表示関数を登録する。 */
export function registerCloseConfirmHandler(handler: CloseConfirmHandler): void {
  confirmHandler = handler;
}

/**
 * tauri://close-requested イベントを購読する。
 * 戻り値はリスナ解除関数 (useEffect の cleanup で呼ぶ)。
 */
export async function setupCloseHandler(): Promise<() => void> {
  // 非 Tauri (ブラウザで dev URL を直接開いた場合) は IPC が無く getCurrentWindow が
  // 失敗するので no-op を返す (Chrome プレビュー時の uncaught エラーを防ぐ)。
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
    return () => {};
  }
  const appWindow = getCurrentWindow();
  return appWindow.onCloseRequested(async (event) => {
    if (!isDirty()) {
      return; // 未変更なら通常閉じる
    }
    if (!confirmHandler) {
      console.warn('[denkeez] close confirm handler 未登録のため確認なしで閉じます');
      return;
    }
    event.preventDefault();
    const decision = await confirmHandler();
    if (decision === 'save') {
      // 「保存して閉じる」: 実際に保存してから閉じる(データ消失防止)。
      // 新規未保存で「名前を付けて保存」をキャンセルした場合は閉じない(ウィンドウを残す)。
      const state = useProjectStore.getState();
      try {
        const result = await performSave({
          currentFilePath: state.currentFilePath,
          project: state.project,
          markSaved: state.markSaved,
        });
        if (result.saved) await appWindow.destroy();
      } catch (e) {
        // 保存に失敗したらウィンドウは閉じない(データを守る)
        console.error('[denkeez] 保存して閉じるに失敗しました', e);
      }
    } else if (decision === 'discard') {
      await appWindow.destroy();
    }
    // 'cancel' なら preventDefault のままウィンドウを残す。
  });
}
