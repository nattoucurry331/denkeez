// レイヤー一覧の 1 行 (Phase 2-D2)。
// 表示順は最上層 → background の順に並ぶ。
// 行クリック → activeLayerId 切替、子要素 (toggle / rename) は cancelBubble 扱い。

import { useState } from 'react';
import type { Layer } from '../../data/types';

interface Props {
  layer: Layer;
  active: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDelete: boolean;
  onActivate: () => void;
  onToggleVisible: () => void;
  onToggleLocked: () => void;
  onRename: (name: string) => void;
  onChangeColor: (color: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRequestDelete: () => void;
}

export function LayerRow({
  layer,
  active,
  canMoveUp,
  canMoveDown,
  canDelete,
  onActivate,
  onToggleVisible,
  onToggleLocked,
  onRename,
  onChangeColor,
  onMoveUp,
  onMoveDown,
  onRequestDelete,
}: Props): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(layer.name);

  const isBackground = layer.kind === 'background';

  const commitRename = (): void => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== layer.name) {
      onRename(trimmed);
    } else {
      setDraftName(layer.name);
    }
    setEditing(false);
  };

  return (
    <div
      style={{
        ...rowStyle,
        background: active ? '#dceeff' : 'transparent',
        borderLeft: active ? '3px solid #0080ff' : '3px solid transparent',
        opacity: layer.visible ? 1 : 0.5,
      }}
      onClick={onActivate}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate();
        }
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisible();
        }}
        title={layer.visible ? '表示中 (クリックで非表示)' : '非表示 (クリックで表示)'}
        style={iconButtonStyle}
        aria-pressed={layer.visible}
      >
        {layer.visible ? '👁' : '✕'}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleLocked();
        }}
        title={
          isBackground
            ? layer.locked
              ? 'ロック中 (元図面は元々編集対象外なので、現状の Phase では装飾的)'
              : '未ロック (元図面は元々編集対象外なので、現状の Phase では装飾的)'
            : layer.locked
              ? 'ロック中 (クリックで解除)'
              : '未ロック (クリックでロック)'
        }
        style={iconButtonStyle}
        aria-pressed={layer.locked}
      >
        {layer.locked ? '🔒' : '🔓'}
      </button>
      <input
        type="color"
        value={layer.color}
        onChange={(e) => onChangeColor(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        title="レイヤー色"
        style={colorInputStyle}
        disabled={isBackground}
      />
      {editing ? (
        <input
          type="text"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') {
              setDraftName(layer.name);
              setEditing(false);
            }
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
          autoFocus
          style={nameInputStyle}
        />
      ) : (
        <span
          style={nameStyle}
          onDoubleClick={(e) => {
            if (isBackground) return;
            e.stopPropagation();
            setDraftName(layer.name);
            setEditing(true);
          }}
          title={isBackground ? '元図面レイヤー (リネーム不可)' : 'ダブルクリックで名前変更'}
        >
          {layer.name}
          {isBackground && <span style={kindBadgeStyle}> [背景]</span>}
        </span>
      )}
      <div style={actionsStyle}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp();
          }}
          disabled={!canMoveUp}
          title="上へ (z-index 上げ)"
          style={smallButtonStyle}
        >
          ↑
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown();
          }}
          disabled={!canMoveDown}
          title="下へ (z-index 下げ)"
          style={smallButtonStyle}
        >
          ↓
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRequestDelete();
          }}
          disabled={!canDelete}
          title={
            isBackground
              ? '元図面レイヤーは削除できません'
              : !canDelete
                ? 'ユーザーレイヤーは少なくとも 1 つ必要です'
                : 'レイヤーを削除'
          }
          style={smallButtonStyle}
        >
          🗑
        </button>
      </div>
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 8px',
  cursor: 'pointer',
  fontSize: '0.85rem',
  borderBottom: '1px solid #eee',
};
const iconButtonStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  padding: 0,
  fontSize: '0.85rem',
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: 3,
  cursor: 'pointer',
};
const colorInputStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  padding: 0,
  border: '1px solid #ccc',
  borderRadius: 3,
  cursor: 'pointer',
  flexShrink: 0,
};
const nameStyle: React.CSSProperties = {
  flex: 1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  userSelect: 'none',
};
const nameInputStyle: React.CSSProperties = {
  flex: 1,
  fontSize: '0.85rem',
  padding: '2px 4px',
  border: '1px solid #0080ff',
  borderRadius: 3,
};
const kindBadgeStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: '#888',
  marginLeft: 4,
};
const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 2,
  flexShrink: 0,
};
const smallButtonStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  padding: 0,
  fontSize: '0.75rem',
  border: '1px solid #ccc',
  borderRadius: 3,
  cursor: 'pointer',
  background: '#fff',
};
