// Phase 3 F-16 Sub-1: 寸法計測の表示整形(純粋関数)。
//
// 校正済みなら実寸 mm。未校正は紙面上の mm なので「(紙面)」を明示して
// 実距離と誤認させない (REQUIREMENTS §9 座標系二重管理の事故防止)。

/** 3 桁区切りの整数 mm 文字列 (例 3640 → "3,640")。 */
function groupedMm(mm: number): string {
  return Math.round(mm).toLocaleString('en-US');
}

/**
 * 計測距離を表示用文字列にする。
 * - 校正済み: "3,640 mm / 3.64 m"
 * - 未校正:  "(紙面) 3,640 mm"
 */
export function formatDistanceMm(mm: number, calibrated: boolean): string {
  const safe = Number.isFinite(mm) && mm > 0 ? mm : 0;
  if (!calibrated) {
    return `(紙面) ${groupedMm(safe)} mm`;
  }
  return `${groupedMm(safe)} mm / ${(safe / 1000).toFixed(2)} m`;
}

/**
 * PDF 出力用の ASCII 専用ラベル。jsPDF の既定フォントは日本語を描画できないため、
 * 「(紙面)」の代わりに "(paper)" を使う (Q-D 日本語フォント未対応の回避)。
 */
export function formatDistanceMmAscii(mm: number, calibrated: boolean): string {
  const safe = Number.isFinite(mm) && mm > 0 ? mm : 0;
  if (!calibrated) {
    return `${groupedMm(safe)} mm (paper)`;
  }
  return `${groupedMm(safe)} mm / ${(safe / 1000).toFixed(2)} m`;
}
