// Phase 2-H 後追い: シンボルの「規格 (spec)」文字列を組み立てる純粋関数。
// 元々は csv-exporter.ts の内部実装だったが、bom-aggregator (BomPanel 集計) からも
// 同じロジックを使うため共有モジュールへ抽出。
//
// REQUIREMENTS §5.3 サンプルの「LED 7W φ100」「連用1個」「2口接地付」等を再現。
// CSV 出力 / 拾い出しパネル 両方で同じ文字列を生成 → 集計が一致する。

import type { ProjectSymbol, PropertyValue } from '../data/types';
import { getSymbolDefinition } from './symbol-registry';

/**
 * 1 つの ProjectSymbol から規格表記を生成する。
 * 戻り値が空文字なら「規格未指定」(プリセット未使用 + 個別プロパティ未入力)。
 */
export function formatSymbolSpec(sym: ProjectSymbol): string {
  // Phase 2-I: 画像シンボルは「メーカー 品番」(無ければ規格 or 表示名) で集計
  if (sym.type === 'product-image') {
    return formatProduct(sym.properties);
  }
  const def = getSymbolDefinition(sym.type);
  if (!def) return formatGeneric(sym.properties);
  const p = sym.properties;
  switch (def.category) {
    case 'lighting':
      return formatLighting(p);
    case 'switch':
      return formatSwitch(p);
    case 'outlet':
      return sym.type === 'outlet-200v' ? formatOutlet200V(p) : formatOutlet(p);
    case 'low-voltage':
      return readString(p.category) ?? '';
    case 'other':
      return readString(p.model) ?? '';
  }
}

function formatLighting(p: Readonly<Record<string, PropertyValue>>): string {
  const parts: string[] = [];
  const w = readNumber(p.wattage);
  const model = readString(p.model);
  const dia = readNumber(p.diameter);
  if (w !== null && w > 0) parts.push(`${formatNumber(w)}W`);
  if (model) parts.push(model);
  if (dia !== null && dia > 0) parts.push(`φ${formatNumber(dia)}`);
  return parts.join(' ');
}

function formatSwitch(p: Readonly<Record<string, PropertyValue>>): string {
  const group = readNumber(p.group);
  if (group !== null && group > 0) return `連用${formatNumber(group)}個`;
  return '';
}

function formatOutlet(p: Readonly<Record<string, PropertyValue>>): string {
  const cap = readNumber(p.capacity);
  const grounded = readString(p.grounded) === 'あり';
  const parts: string[] = [];
  if (cap !== null && cap > 0) parts.push(`${formatNumber(cap)}口`);
  if (grounded) parts.push('接地付');
  return parts.join('');
}

function formatOutlet200V(p: Readonly<Record<string, PropertyValue>>): string {
  const a = readNumber(p.amperage);
  if (a !== null && a > 0) return `200V ${formatNumber(a)}A`;
  return '200V';
}

function formatGeneric(p: Readonly<Record<string, PropertyValue>>): string {
  const model = readString(p.model);
  return model ?? '';
}

/** Phase 2-I: 画像シンボルの規格 = 「メーカー 品番」(無ければ規格)。 */
function formatProduct(p: Readonly<Record<string, PropertyValue>>): string {
  const maker = readString(p.maker);
  const part = readString(p.partNumber);
  const joined = [maker, part].filter((s): s is string => s !== null).join(' ');
  if (joined) return joined;
  return readString(p.spec) ?? '';
}

function readString(v: PropertyValue | undefined): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

function readNumber(v: PropertyValue | undefined): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
