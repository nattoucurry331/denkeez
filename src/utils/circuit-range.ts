// Phase 3 (F-21) 3-I2: 回路番号の範囲表記。
// 同一接頭辞で連続する番号が 3 つ以上並ぶときだけ "L-1〜L-3" に圧縮する。
// 2 連続 (L-1, L-2) はそのまま列挙したほうが読みやすいので圧縮しない
// (既存 CSV 出力との互換も保つ)。

const RANGE_MIN_RUN = 3;

interface Parsed {
  raw: string;
  prefix: string;
  num: number | null;
}

function parse(label: string): Parsed {
  const m = /^(.*?)(\d+)$/.exec(label);
  if (!m) return { raw: label, prefix: label, num: null };
  return { raw: label, prefix: m[1] ?? '', num: Number(m[2]) };
}

/**
 * 回路番号配列を表示用文字列にする。
 * - 同一接頭辞で連番が 3 つ以上 → "L-1〜L-3"
 * - それ未満や非数値 → ", " 区切りで列挙
 * 並びは接頭辞→番号の自然順。重複は呼び出し側で除去済みを想定するが念のため除く。
 */
export function formatCircuitRange(circuits: readonly string[]): string {
  const uniq = [...new Set(circuits.map((c) => c.trim()).filter((c) => c !== ''))];
  if (uniq.length === 0) return '';

  const parsed = uniq.map(parse);
  // 接頭辞 → 番号(数値なしは末尾) の自然順にソート
  parsed.sort((a, b) => {
    if (a.prefix !== b.prefix) return a.prefix.localeCompare(b.prefix);
    if (a.num === null && b.num === null) return a.raw.localeCompare(b.raw);
    if (a.num === null) return 1;
    if (b.num === null) return -1;
    return a.num - b.num;
  });

  const tokens: string[] = [];
  let i = 0;
  while (i < parsed.length) {
    const cur = parsed[i]!;
    if (cur.num === null) {
      tokens.push(cur.raw);
      i += 1;
      continue;
    }
    // 同一接頭辞の連番ランを伸ばす
    let j = i;
    while (
      j + 1 < parsed.length &&
      parsed[j + 1]!.prefix === cur.prefix &&
      parsed[j + 1]!.num !== null &&
      parsed[j + 1]!.num === parsed[j]!.num! + 1
    ) {
      j += 1;
    }
    const runLen = j - i + 1;
    if (runLen >= RANGE_MIN_RUN) {
      tokens.push(`${cur.raw}〜${parsed[j]!.raw}`);
    } else {
      for (let k = i; k <= j; k++) tokens.push(parsed[k]!.raw);
    }
    i = j + 1;
  }
  return tokens.join(', ');
}
