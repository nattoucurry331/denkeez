// Phase 2-J1: 初回 / PDF 未読込時のウェルカム空状態。
// 「メニューバーを探す」のではなく、画面中央の大きなボタンから直接開始できる。
// 非IT職人でも迷わないよう、3 ステップの流れを図示する。

import { useState } from 'react';
import { APP_NAME, APP_NAME_KANA } from '../../shared/constants/app';
import { openPdfIntoStore, openProjectIntoStore } from '../../tauri/open-actions';

const STEPS: { num: string; title: string; body: string }[] = [
  { num: '1', title: 'PDF を開く', body: '元請けからの平面図 PDF を取り込みます' },
  { num: '2', title: '縮尺を合わせる', body: '図面上の 2 点で実寸を入力 (拾い出しが正確に)' },
  { num: '3', title: 'シンボル配置', body: '照明・スイッチ・配線を置いて数量を自動集計' },
];

export function WelcomeScreen(): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={wrapStyle}>
      <div style={cardStyle}>
        <p style={eyebrowStyle}>⚡ 電気工事の平面図エディタ</p>
        <h1 style={titleStyle}>
          {APP_NAME}
          <span style={kanaStyle}>（{APP_NAME_KANA}）</span> へようこそ
        </h1>
        <p style={leadStyle}>
          平面図 PDF にシンボルと配線を描いて、拾い出し（数量集計）まで。
        </p>

        <div style={ctaRowStyle}>
          <button
            type="button"
            onClick={() => void run(openPdfIntoStore)}
            disabled={busy}
            style={primaryBtnStyle}
          >
            📄 PDF を開いて始める
          </button>
          <button
            type="button"
            onClick={() => void run(() => openProjectIntoStore(false))}
            disabled={busy}
            style={secondaryBtnStyle}
          >
            📂 保存したプロジェクトを開く
          </button>
        </div>

        {busy && <p style={busyStyle}>読み込み中…</p>}
        {error && (
          <p role="alert" style={errorStyle}>
            エラー: {error}
          </p>
        )}

        <div style={stepsStyle}>
          {STEPS.map((s, i) => (
            <div key={s.num} style={stepWrapStyle}>
              <div style={stepCardStyle}>
                <span style={stepNumStyle}>{s.num}</span>
                <span style={stepTitleStyle}>{s.title}</span>
                <span style={stepBodyStyle}>{s.body}</span>
              </div>
              {i < STEPS.length - 1 && <span style={stepArrowStyle} aria-hidden="true">→</span>}
            </div>
          ))}
        </div>

        <p style={hintStyle}>
          メニューバーの「ヘルプ」からバージョン情報・使い方・お問い合わせを確認できます。
        </p>
      </div>
    </div>
  );
}

const wrapStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  background: '#f7f8fa',
  overflowY: 'auto',
};
const cardStyle: React.CSSProperties = {
  maxWidth: 640,
  width: '100%',
  textAlign: 'center',
  background: '#fff',
  border: '1px solid #e3e6ec',
  borderRadius: 16,
  padding: '40px 32px',
  boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
};
const eyebrowStyle: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '0.78rem',
  color: '#0080ff',
  background: '#eaf4ff',
  border: '1px solid #cce6ff',
  borderRadius: 999,
  padding: '4px 12px',
  marginBottom: 16,
};
const titleStyle: React.CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 800,
  color: '#1a2233',
  margin: 0,
};
const kanaStyle: React.CSSProperties = { fontSize: '1rem', color: '#8a96aa', fontWeight: 400 };
const leadStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  color: '#5a6678',
  margin: '12px 0 28px',
};
const ctaRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  justifyContent: 'center',
  flexWrap: 'wrap',
};
const primaryBtnStyle: React.CSSProperties = {
  padding: '14px 28px',
  background: 'linear-gradient(135deg, #2b8aff, #0064e0)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  fontSize: '1.02rem',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 2px 12px rgba(0,128,255,0.3)',
};
const secondaryBtnStyle: React.CSSProperties = {
  padding: '14px 22px',
  background: '#fff',
  color: '#33425a',
  border: '1px solid #ccd3de',
  borderRadius: 10,
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
};
const busyStyle: React.CSSProperties = { color: '#5a6678', fontSize: '0.85rem', marginTop: 14 };
const errorStyle: React.CSSProperties = { color: '#c00', fontSize: '0.85rem', marginTop: 14 };
const stepsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'stretch',
  justifyContent: 'center',
  gap: 4,
  flexWrap: 'wrap',
  marginTop: 36,
};
const stepWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};
const stepCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  width: 150,
  padding: '14px 10px',
  background: '#f7f9fc',
  border: '1px solid #e3e6ec',
  borderRadius: 10,
};
const stepNumStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: '50%',
  background: '#0080ff',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.85rem',
  fontWeight: 700,
};
const stepTitleStyle: React.CSSProperties = {
  fontSize: '0.88rem',
  fontWeight: 700,
  color: '#1a2233',
};
const stepBodyStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  color: '#7a8699',
  lineHeight: 1.5,
};
const stepArrowStyle: React.CSSProperties = { color: '#bcc4d0', fontSize: '1.1rem' };
const hintStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#9aa5b5',
  marginTop: 28,
};
