import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { APP_NAME_DISPLAY } from './shared/constants/app';

// CLAUDE.md L102: アプリ名表示は必ず定数経由で。
// ウィンドウタイトルは tauri.conf.json で仮置きし、ここで動的に上書きする。
document.title = APP_NAME_DISPLAY;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('[denkeez] #root element not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
