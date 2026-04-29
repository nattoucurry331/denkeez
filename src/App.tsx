import { useEffect, useRef, useState } from 'react';
import { MenuBar } from './components/menu-bar/MenuBar';
import { CanvasArea } from './components/canvas-area/CanvasArea';
import { UnsavedChangesDialog } from './components/dialogs/UnsavedChangesDialog';
import {
  registerCloseConfirmHandler,
  setupCloseHandler,
  type CloseDecision,
} from './tauri/close-handler';

export function App(): JSX.Element {
  const [confirmOpen, setConfirmOpen] = useState(false);
  // ダイアログの結果を Promise の resolver 経由で close-handler に返すため、ref で保持
  const resolverRef = useRef<((decision: CloseDecision) => void) | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    registerCloseConfirmHandler(
      () =>
        new Promise<CloseDecision>((resolve) => {
          resolverRef.current = resolve;
          setConfirmOpen(true);
        }),
    );
    void setupCloseHandler().then((u) => {
      unlisten = u;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  const decide = (decision: CloseDecision): void => {
    setConfirmOpen(false);
    resolverRef.current?.(decision);
    resolverRef.current = null;
  };

  return (
    <div style={appStyle}>
      <MenuBar />
      <CanvasArea />
      <UnsavedChangesDialog
        open={confirmOpen}
        onSave={() => decide('save')}
        onDiscard={() => decide('discard')}
        onCancel={() => decide('cancel')}
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
