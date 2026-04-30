// Phase 2-F3: 自動更新の UI state。
// App 起動時に checkForUpdate を呼んで結果を格納し、MenuBar が「🔔 更新」ボタンを出す。
// project-store とは独立 (永続化対象外、アンドゥ対象外)。

import { create } from 'zustand';
import type { UpdateInfo } from '../tauri/updater';

interface UpdaterState {
  /** 新版が存在するか */
  available: boolean;
  /** 新版の情報 (available=true のときのみ非 null) */
  info: UpdateInfo | null;
  /** UpdateDialog を開いているか */
  dialogOpen: boolean;
  setUpdateAvailable: (info: UpdateInfo) => void;
  setUpdateUnavailable: () => void;
  openDialog: () => void;
  closeDialog: () => void;
}

export const useUpdaterStore = create<UpdaterState>((set) => ({
  available: false,
  info: null,
  dialogOpen: false,
  setUpdateAvailable: (info) => set({ available: true, info }),
  setUpdateUnavailable: () => set({ available: false, info: null, dialogOpen: false }),
  openDialog: () => set({ dialogOpen: true }),
  closeDialog: () => set({ dialogOpen: false }),
}));
