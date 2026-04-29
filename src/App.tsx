import { APP_NAME_DISPLAY } from './shared/constants/app';
import { PdfSpike } from './canvas/pdf-spike';

export function App(): JSX.Element {
  return (
    <main style={{ padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>{APP_NAME_DISPLAY}</h1>
      <p>Phase 1 (PoC) スキャフォールド — M0 進行中</p>
      <PdfSpike />
    </main>
  );
}
