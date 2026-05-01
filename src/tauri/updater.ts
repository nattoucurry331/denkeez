// Phase 2-F3: 自動更新クライアント (tauri-plugin-updater のラッパ)。
// 起動時に GitHub Releases の latest.json をチェックし、新版があれば
// MenuBar に通知バッジを出す → クリックでダウンロード+インストール → 再起動。
//
// REQUIREMENTS §10.2 / Q5: 自動 popup ではなく「メニューバー右端に🔔 表示」方式。
// 作業中に邪魔しないが、見落とされない位置に置く。

import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export interface UpdateInfo {
  version: string;
  notes?: string | undefined;
  date?: string | undefined;
}

export interface UpdateCheckResult {
  available: boolean;
  info: UpdateInfo | null;
}

/**
 * 起動時に呼ぶ。GitHub Releases から最新版情報を取得し、
 * 現在のバージョンより新しければ available=true を返す。
 *
 * - dev モード (Tauri ランタイムなし) では check() が例外を投げるので、安全に返す
 * - ネット未接続でも例外を投げる → false 扱い (起動を妨げない)
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  try {
    const update = await check();
    if (update?.available) {
      _pendingUpdate = update;
      return {
        available: true,
        info: {
          version: update.version,
          notes: update.body ?? undefined,
          date: update.date ?? undefined,
        },
      };
    }
    return { available: false, info: null };
  } catch (e) {
    // dev サーバ (Tauri ランタイムなし) / ネット未接続 / 公開鍵検証失敗など
    // 起動を妨げない (静かに無効扱い)
    if (typeof console !== 'undefined') {
      console.warn('[denkeez] 更新チェック skip:', e instanceof Error ? e.message : String(e));
    }
    return { available: false, info: null };
  }
}

// checkForUpdate で取得した Update オブジェクト。downloadAndInstall で使用。
// グローバルに保持するのは、UpdateDialog から再度参照するため。
let _pendingUpdate: Update | null = null;

export interface DownloadProgress {
  /** ダウンロード済みバイト数 */
  downloaded: number;
  /** 総バイト数 (不明な場合 0) */
  total: number;
}

/**
 * ダウンロード + インストール → アプリ再起動。
 * onProgress でダウンロード進捗をコールバック。
 */
export async function applyUpdateAndRelaunch(
  onProgress?: (progress: DownloadProgress) => void,
): Promise<void> {
  if (!_pendingUpdate) {
    throw new Error('保留中の更新がありません (先に checkForUpdate を呼んでください)');
  }
  let total = 0;
  let downloaded = 0;
  await _pendingUpdate.downloadAndInstall((event) => {
    if (event.event === 'Started') {
      total = event.data.contentLength ?? 0;
      onProgress?.({ downloaded: 0, total });
    } else if (event.event === 'Progress') {
      downloaded += event.data.chunkLength;
      onProgress?.({ downloaded, total });
    } else if (event.event === 'Finished') {
      onProgress?.({ downloaded: total, total });
    }
  });
  // インストール後に手動で再起動 (Windows MSI はインストーラ実行後の再起動が必要)
  await relaunch();
}
