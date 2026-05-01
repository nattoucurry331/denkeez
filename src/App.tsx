import { useEffect, useRef, useState } from 'react';
import { MenuBar } from './components/menu-bar/MenuBar';
import { CanvasArea } from './components/canvas-area/CanvasArea';
import { SymbolPalette } from './components/symbol-palette/SymbolPalette';
import { RightPanel } from './components/right-panel/RightPanel';
import { UnsavedChangesDialog } from './components/dialogs/UnsavedChangesDialog';
import { UpdateDialog } from './components/dialogs/UpdateDialog';
import { StatusBar } from './components/status-bar/StatusBar';
import {
  registerCloseConfirmHandler,
  setupCloseHandler,
  type CloseDecision,
} from './tauri/close-handler';
import { checkForUpdate } from './tauri/updater';
import { useUpdaterStore } from './data/updater-store';

export function App(): JSX.Element {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const resolverRef = useRef<((decision: CloseDecision) => void) | null>(null);

  const updateInfo = useUpdaterStore((s) => s.info);
  const updateDialogOpen = useUpdaterStore((s) => s.dialogOpen);
  const setUpdateAvailable = useUpdaterStore((s) => s.setUpdateAvailable);
  const closeUpdateDialog = useUpdaterStore((s) => s.closeDialog);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    registerCloseConfirmHandler(
      () =>
        new Promise<CloseDecision>((resolve) => {
          resolverRef.current = resolve;
          setConfirmOpen(true);
        }),
    );
    setupCloseHandler().then((u) => {
      if (cancelled) {
        u();
      } else {
        unlisten = u;
      }
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  // Phase 2-F3: 起動から数秒後に更新チェック (起動を妨げないよう delayed background)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void checkForUpdate().then((result) => {
        if (result.available && result.info) {
          setUpdateAvailable(result.info);
        }
      });
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [setUpdateAvailable]);

  const decide = (decision: CloseDecision): void => {
    setConfirmOpen(false);
    resolverRef.current?.(decision);
    resolverRef.current = null;
  };

  return (
    <div style={appStyle}>
      <MenuBar />
      <div style={mainStyle}>
        <SymbolPalette />
        <CanvasArea />
        <RightPanel />
      </div>
      <StatusBar />
      <UnsavedChangesDialog
        open={confirmOpen}
        onSave={() => decide('save')}
        onDiscard={() => decide('discard')}
        onCancel={() => decide('cancel')}
      />
      <UpdateDialog
        open={updateDialogOpen}
        info={updateInfo}
        onCancel={closeUpdateDialog}
      />
    </div>
  );
}

const appStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  fontFamily: 'system-ui, sans-serif',
};
const mainStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
};
