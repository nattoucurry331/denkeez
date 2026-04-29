// シンボル定義レジストリ。
// REQUIREMENTS.md §4.4 / Plan §3: シンボル定義は外部 JSON で管理し、
// コード変更なしで追加できる仕組みを将来的に持たせる。
//
// Phase 1 PoC ではダウンライト 1 種類のみ。Phase 2 で 20 種類程度に拡張予定。

import data from './symbols.json';

export interface CircleWithTextShape {
  kind: 'circle-with-text';
  radiusMm: number;
  strokeWidthMm: number;
  text: string;
  fontSizeMm: number;
}

export type SymbolShape = CircleWithTextShape;

export interface SymbolDefinition {
  id: string;
  name: string;
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

/** type guard: 既知の SymbolDefinition.id か */
export function isKnownSymbolType(id: string): boolean {
  return definitionMap.has(id);
}
