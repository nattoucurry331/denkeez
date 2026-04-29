import { useEffect, useRef, useState } from 'react';
import { MenuBar } from './components/menu-bar/MenuBar';
import { CanvasArea } from './components/canvas-area/CanvasArea';
import { SymbolPalette } from './components/symbol-palette/SymbolPalette';
import { UnsavedChangesDialog } from './components/dialogs/UnsavedChangesDialog';
import { StatusBar } from './components/status-bar/StatusBar';
import {
  registerCloseConfirmHandler,
  setupCloseHandler,
  type CloseDecision,
} from './tauri/close-handler';

export function App(): JSX.Element {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const resolverRef = useRef<((decision: CloseDecision) => void) | null>(null);

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
      </div>
      <StatusBar />
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
const mainStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
};
