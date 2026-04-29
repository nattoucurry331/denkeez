// シンプルな自前 debounce 関数。
// 連続呼び出しを最後の 1 回にまとめる (trailing edge)。
// zundo の handleSet で利用 (ドラッグ中の updateSymbolPosition が 60 件/秒の履歴を作るのを防ぐ)。

export function debounce<F extends (...args: never[]) => unknown>(
  fn: F,
  delayMs: number,
): F {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const wrapped = (...args: Parameters<F>): void => {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delayMs);
  };
  return wrapped as unknown as F;
}
