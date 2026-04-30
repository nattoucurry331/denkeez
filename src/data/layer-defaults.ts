// Phase 2-D1: レイヤーのデフォルト構成 (新規プロジェクト時 / マイグレーション時に使用)。
// REQUIREMENTS.md §3.2 F-08 標準レイヤー記載順を踏襲。
//
// project-store.ts (新規プロジェクト) と project-io.ts (旧 v1 ファイルマイグレーション) の
// 両方から参照されるため、純粋な factory として分離する。

import { generateId } from '../utils/id';
import {
  BACKGROUND_LAYER_ID,
  STANDARD_USER_LAYER_PRESETS,
  type Layer,
} from './types';

export function createBackgroundLayer(): Layer {
  return {
    id: BACKGROUND_LAYER_ID,
    name: '元図面',
    color: '#888888',
    visible: true,
    locked: true,
    kind: 'background',
  };
}

export function createStandardUserLayers(): Layer[] {
  return STANDARD_USER_LAYER_PRESETS.map((p) => ({
    id: generateId(),
    name: p.name,
    color: p.color,
    visible: true,
    locked: false,
    kind: 'user',
  }));
}

/** 新規プロジェクトの初期レイヤー (背景 + 標準ユーザーレイヤー)。 */
export function createDefaultLayers(): Layer[] {
  return [createBackgroundLayer(), ...createStandardUserLayers()];
}

/** layers から「新規 symbol/wire の所属先候補」を算出する。
 *  - 最初の kind: 'user' (背景は不可)
 *  - フォールバック: 先頭レイヤー (想定外)
 *  - 完全な空: BACKGROUND_LAYER_ID (想定外、念のため) */
export function pickFirstUserLayerId(layers: readonly Layer[]): string {
  const u = layers.find((l) => l.kind === 'user');
  if (u) return u.id;
  return layers[0]?.id ?? BACKGROUND_LAYER_ID;
}
