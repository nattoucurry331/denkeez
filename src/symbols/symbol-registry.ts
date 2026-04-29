// シンボル定義レジストリ。
// REQUIREMENTS.md §4.4 / Plan §3: シンボル定義は外部 JSON で管理。
// Phase 2-B: 20 種、5 つの shape kind、5 つの category。

import data from './symbols.json';
import type { SymbolType, SymbolCategory } from '../data/types';

export type ShapeKind =
  | 'circle-with-text'
  | 'circle-with-cross'
  | 'square-with-text'
  | 'solid-circle-with-text'
  | 'half-circle-with-text';

interface CircleWithText {
  kind: 'circle-with-text';
  radiusMm: number;
  strokeWidthMm: number;
  text: string;
  fontSizeMm: number;
}

interface CircleWithCross {
  kind: 'circle-with-cross';
  radiusMm: number;
  strokeWidthMm: number;
}

interface SquareWithText {
  kind: 'square-with-text';
  widthMm: number;
  heightMm: number;
  strokeWidthMm: number;
  text: string;
  fontSizeMm: number;
}

interface SolidCircleWithText {
  kind: 'solid-circle-with-text';
  radiusMm: number;
  text: string;
  fontSizeMm: number;
}

interface HalfCircleWithText {
  kind: 'half-circle-with-text';
  radiusMm: number;
  strokeWidthMm: number;
  text: string;
  fontSizeMm: number;
}

export type SymbolShape =
  | CircleWithText
  | CircleWithCross
  | SquareWithText
  | SolidCircleWithText
  | HalfCircleWithText;

export interface SymbolDefinition {
  id: SymbolType;
  name: string;
  category: SymbolCategory;
  description: string;
  shape: SymbolShape;
}

const definitions = data as SymbolDefinition[];
const definitionMap = new Map<string, SymbolDefinition>(
  definitions.map((d) => [d.id, d]),
);

export function getSymbolDefinition(id: string): SymbolDefinition | undefined {
  return definitionMap.get(id);
}

export function listSymbolDefinitions(): readonly SymbolDefinition[] {
  return definitions;
}

export function listByCategory(category: SymbolCategory): readonly SymbolDefinition[] {
  return definitions.filter((d) => d.category === category);
}

export function isKnownSymbolType(id: string): boolean {
  return definitionMap.has(id);
}

/** カテゴリ表示順と日本語ラベル */
export const CATEGORY_ORDER: { id: SymbolCategory; label: string }[] = [
  { id: 'lighting', label: '照明' },
  { id: 'switch', label: 'スイッチ' },
  { id: 'outlet', label: 'コンセント' },
  { id: 'low-voltage', label: '弱電・通信' },
  { id: 'other', label: 'その他' },
];
