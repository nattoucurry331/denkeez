// UUID v4 生成。
// REQUIREMENTS.md §9.1.4: シンボル ID は再生成しない (= 一度生成した ID は永続)。
//
// Tauri WebView2 (Edge Chromium) は安全コンテキスト相当で動作するため
// `globalThis.crypto.randomUUID` がそのまま利用可能 (Plan §1 / R-12)。
// 不在環境では明示的にエラーを投げ、サイレント代替を避ける。

export function generateId(): string {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi || typeof cryptoApi.randomUUID !== 'function') {
    throw new Error(
      '[denkeez] crypto.randomUUID is not available. Tauri WebView2 や Node 19+ では標準提供されています。',
    );
  }
  return cryptoApi.randomUUID();
}
