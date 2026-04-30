// プロパティパネル用の動的フィールド定義 (Phase 2-B2 / REQUIREMENTS.md F-10)。
// SymbolType ごとにフィールド構成を切り替える。Phase 2-B では category ごとに
// 共通フィールドを持たせ、type 別の細分化は Phase 2-D 以降で必要に応じて拡張する。

import type { SymbolType, SymbolCategory } from '../data/types';
import { getSymbolDefinition } from './symbol-registry';

export type PropertyFieldKind = 'text' | 'number' | 'select' | 'multiline';

export interface PropertyFieldDef {
  key: string;
  label: string;
  kind: PropertyFieldKind;
  unit?: string;
  placeholder?: string;
  options?: string[];
}

const CATEGORY_DEFAULTS: Record<SymbolCategory, PropertyFieldDef[]> = {
  lighting: [
    { key: 'circuit', label: '回路番号', kind: 'text', placeholder: 'L-1' },
    { key: 'wattage', label: 'W数', kind: 'number', unit: 'W' },
    { key: 'model', label: '型番', kind: 'text' },
    { key: 'note', label: 'メモ', kind: 'multiline' },
  ],
  switch: [
    { key: 'circuit', label: '回路番号', kind: 'text', placeholder: 'L-1' },
    { key: 'group', label: '連用個数', kind: 'number', unit: '個' },
    { key: 'note', label: 'メモ', kind: 'multiline' },
  ],
  outlet: [
    { key: 'circuit', label: '回路番号', kind: 'text', placeholder: 'P-1' },
    { key: 'capacity', label: '口数', kind: 'number', unit: '口' },
    { key: 'grounded', label: '接地', kind: 'select', options: ['なし', 'あり'] },
    { key: 'note', label: 'メモ', kind: 'multiline' },
  ],
  'low-voltage': [
    { key: 'category', label: '区分', kind: 'text', placeholder: '直列 / 末端 等' },
    { key: 'note', label: 'メモ', kind: 'multiline' },
  ],
  other: [
    { key: 'circuit', label: '回路番号', kind: 'text' },
    { key: 'model', label: '型番', kind: 'text' },
    { key: 'note', label: 'メモ', kind: 'multiline' },
  ],
};

/** ダウンライト固有: 径φ を追加 */
const DOWNLIGHT_OVERRIDE: PropertyFieldDef[] = [
  { key: 'circuit', label: '回路番号', kind: 'text', placeholder: 'L-1' },
  { key: 'wattage', label: 'W数', kind: 'number', unit: 'W' },
  { key: 'diameter', label: '径φ', kind: 'number', unit: 'mm' },
  { key: 'model', label: '型番', kind: 'text' },
  { key: 'note', label: 'メモ', kind: 'multiline' },
];

/** 200V コンセント: 容量を追加 */
const OUTLET_200V_OVERRIDE: PropertyFieldDef[] = [
  { key: 'circuit', label: '回路番号', kind: 'text', placeholder: 'P-1' },
  { key: 'amperage', label: '容量', kind: 'number', unit: 'A' },
  { key: 'note', label: 'メモ', kind: 'multiline' },
];

const TYPE_OVERRIDES: Partial<Record<SymbolType, PropertyFieldDef[]>> = {
  downlight: DOWNLIGHT_OVERRIDE,
  'outlet-200v': OUTLET_200V_OVERRIDE,
};

export function getPropertySchema(type: SymbolType): PropertyFieldDef[] {
  const override = TYPE_OVERRIDES[type];
  if (override) return override;
  const def = getSymbolDefinition(type);
  if (!def) return [];
  return CATEGORY_DEFAULTS[def.category] ?? [];
}
