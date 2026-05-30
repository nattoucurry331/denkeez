// tauri://close-requested ハンドラ (CLAUDE.md L196 担保)。
// Plan §1 「PoC 保存保護: 未保存終了確認ダイアログ」を実装する。
//
// React 側でユーザー判断 (保存して閉じる / 保存せず閉じる / キャンセル) を解決する
// async ハンドラを registerCloseConfirmHandler で登録し、close-requested 発火時に呼び出す。

import { getCurrentWindow } from '@tauri-apps/api/window';
import { isDirty } from '../data/dirty-tracker';

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
      // M4 で保存処理を組み込む。M1 では未対応なので警告のみで閉じる。
      console.warn('[denkeez] save-on-close は M4 で実装予定。今回は保存せず閉じます。');
      await appWindow.destroy();
    } else if (decision === 'discard') {
      await appWindow.destroy();
    }
    // 'cancel' なら preventDefault のままウィンドウを残す。
  });
}
