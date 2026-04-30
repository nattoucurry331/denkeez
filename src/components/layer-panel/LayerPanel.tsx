// レイヤーパネル (Phase 2-D2 / REQUIREMENTS.md F-08)。
// 一覧表示・追加・削除・表示/ロック切替・色/名前変更・並び替えを提供する。
//
// 表示順は z-index と逆 (UI 上は最上層が一番上、background が一番下)。
// 並び替えは上下ボタン。drag-drop 対応は需要が出たら追加 (Phase 3)。
//
// 削除時は LayerDeleteDialog で「中身も削除」/「他レイヤーに移動」を選択させる。

import { useState } from 'react';
import { useProjectStore } from '../../data/project-store';
import { LayerRow } from './LayerRow';
import { LayerDeleteDialog } from './LayerDeleteDialog';
import type { Layer } from '../../data/types';

export function LayerPanel(): JSX.Element {
  const layers = useProjectStore((s) => s.project.layers);
  const symbols = useProjectStore((s) => s.project.symbols);
  const wires = useProjectStore((s) => s.project.wires);
  const activeLayerId = useProjectStore((s) => s.activeLayerId);
  const addLayer = useProjectStore((s) => s.addLayer);
  const updateLayer = useProjectStore((s) => s.updateLayer);
  const removeLayer = useProjectStore((s) => s.removeLayer);
  const reorderLayers = useProjectStore((s) => s.reorderLayers);
  const setActiveLayer = useProjectStore((s) => s.setActiveLayer);

  const [pendingDelete, setPendingDelete] = useState<Layer | null>(null);

  // UI 上は最上層 → 最下層 (background) の順で表示するため、配列を逆順にする。
  const displayed = [...layers].reverse();

  const userLayerCount = layers.filter((l) => l.kind === 'user').length;

  const handleAdd = (): void => {
    const presetColors = ['#dd5544', '#44aaee', '#88aa44', '#aa44aa', '#cc8844'];
    const usedColors = new Set(layers.map((l) => l.color));
    const color = presetColors.find((c) => !usedColors.has(c)) ?? '#888888';
    const id = addLayer(`新規レイヤー ${userLayerCount + 1}`, color);
    setActiveLayer(id);
  };

  const handleMove = (layerId: string, direction: 'up' | 'down'): void => {
    // UI の "上" = z-index 高い (= 配列末尾方向)、"下" = z-index 低い (= 配列先頭方向)
    const idx = layers.findIndex((l) => l.id === layerId);
    if (idx < 0) return;
    const target = direction === 'up' ? idx + 1 : idx - 1;
    if (target < 0 || target >= layers.length) return;
    // background (常に index 0) との swap は禁止
    if (layers[target]?.kind === 'background' || layers[idx]?.kind === 'background') return;
    const newOrder = layers.map((l) => l.id);
    const tmp = newOrder[idx]!;
    newOrder[idx] = newOrder[target]!;
    newOrder[target] = tmp;
    reorderLayers(newOrder);
  };

  const handleConfirmDelete = (
    mode: 'delete-contents' | 'move-to-fallback',
    fallbackLayerId?: string,
  ): void => {
    if (!pendingDelete) return;
    try {
      if (mode === 'delete-contents') {
        removeLayer(pendingDelete.id, { mode });
      } else {
        removeLayer(pendingDelete.id, { mode, fallbackLayerId });
      }
    } finally {
      setPendingDelete(null);
    }
  };

  // 削除対象に含まれる symbol/wire 数 (ダイアログで表示)
  const pendingCounts = pendingDelete
    ? {
        symbols: symbols.filter((s) => s.layerId === pendingDelete.id).length,
        wires: (wires ?? []).filter((w) => w.layerId === pendingDelete.id).length,
      }
    : null;

  // 移動先候補 (削除対象を除く)
  const fallbackCandidates = pendingDelete
    ? layers.filter((l) => l.id !== pendingDelete.id && l.kind === 'user')
    : [];

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <button type="button" onClick={handleAdd} style={addButtonStyle}>
          + レイヤー追加
        </button>
      </div>
      <div style={listStyle}>
        {displayed.map((layer) => {
          const idx = layers.findIndex((l) => l.id === layer.id);
          const canMoveUp = layer.kind !== 'background' && idx < layers.length - 1;
          const canMoveDown =
            layer.kind !== 'background' && idx > 0 && layers[idx - 1]?.kind !== 'background';
          const canDelete = layer.kind === 'user' && userLayerCount > 1;
          return (
            <LayerRow
              key={layer.id}
              layer={layer}
              active={layer.id === activeLayerId}
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
              canDelete={canDelete}
              onActivate={() => setActiveLayer(layer.id)}
              onToggleVisible={() =>
                updateLayer(layer.id, { visible: !layer.visible })
              }
              onToggleLocked={() =>
                updateLayer(layer.id, { locked: !layer.locked })
              }
              onRename={(name) => updateLayer(layer.id, { name })}
              onChangeColor={(color) => updateLayer(layer.id, { color })}
              onMoveUp={() => handleMove(layer.id, 'up')}
              onMoveDown={() => handleMove(layer.id, 'down')}
              onRequestDelete={() => setPendingDelete(layer)}
            />
          );
        })}
      </div>
      <LayerDeleteDialog
        open={pendingDelete !== null}
        layerName={pendingDelete?.name ?? ''}
        symbolCount={pendingCounts?.symbols ?? 0}
        wireCount={pendingCounts?.wires ?? 0}
        fallbackCandidates={fallbackCandidates}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  background: '#fafafa',
  overflow: 'hidden',
};
const headerStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid #ddd',
};
const addButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  fontSize: '0.85rem',
  cursor: 'pointer',
  background: '#fff',
  border: '1px solid #ccc',
  borderRadius: 3,
};
const listStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '4px 0',
};
