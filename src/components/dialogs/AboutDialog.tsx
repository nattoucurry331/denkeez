// Phase 2-G2: About / 免責事項ダイアログ。
// メニューバー右端の「ヘルプ」ボタンから開く。
// β 版である旨、業務上の最終確認は人間で行う旨、ライセンス・連絡先・ポリシーへのリンクを集約。

import { APP_NAME, APP_NAME_KANA, APP_VERSION } from '../../shared/constants/app';

interface Props {
  readonly open: boolean;
  readonly onClose: () => void;
}

const REPO_URL = 'https://github.com/nattoucurry331/denkeez';

export function AboutDialog({ open, onClose }: Props): JSX.Element | null {
  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="about-title" style={overlayStyle}>
      <div style={modalStyle}>
        <h2 id="about-title" style={headingStyle}>
          {APP_NAME}({APP_NAME_KANA}・仮称)について
        </h2>

        <div style={versionBoxStyle}>
          <span style={versionLabelStyle}>バージョン</span>
          <strong style={versionValueStyle}>v{APP_VERSION}</strong>
          <span style={betaBadgeStyle}>β 版</span>
        </div>

        <section style={sectionStyle}>
          <h3 style={sectionHeadingStyle}>このアプリについて</h3>
          <p style={paragraphStyle}>
            {APP_NAME} は、有限会社 北嶺建設が電気工事の現場改善を目的に開発しているデスクトップアプリです。
            元請けからの平面図 PDF 上に電気記号を配置し、拾い出し集計から PDF / CSV 出力までを支援します。
          </p>
        </section>

        <section style={warnSectionStyle}>
          <h3 style={warnHeadingStyle}>⚠️ 業務でご利用の方へ</h3>
          <ul style={ulStyle}>
            <li>
              本アプリは <strong>β 版</strong> であり、不具合や計算誤差を含む可能性があります。
            </li>
            <li>
              拾い出し数量・配線長・PDF 出力結果は、<strong>必ずご自身の目で最終確認</strong>のうえ、見積・施工にご利用ください。
            </li>
            <li>
              本アプリの結果に起因する損害(見積額の誤り、施工上の不具合、業務逸失利益等)について、開発者・北嶺建設は<strong>一切の責任を負いません</strong>。
            </li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h3 style={sectionHeadingStyle}>ライセンス</h3>
          <p style={paragraphStyle}>
            Denkeez License v1.0(独自ライセンス)
            <br />
            エンドユーザーとしての無償利用は OK ですが、再配布・改変・商用組込には事前同意が必要です。
          </p>
          <p style={linkLineStyle}>
            <a href={`${REPO_URL}/blob/main/LICENSE`} target="_blank" rel="noreferrer" style={linkStyle}>
              LICENSE 全文 →
            </a>
          </p>
        </section>

        <section style={sectionStyle}>
          <h3 style={sectionHeadingStyle}>プライバシーポリシー</h3>
          <p style={paragraphStyle}>
            本アプリで作成したプロジェクトファイル(.dkz)や図面データを開発者のサーバーに送信することはありません。
            登録いただいたメールアドレスは、サポート連絡・更新通知・当社が提供する関連サービスのご案内に利用します。
          </p>
          <p style={linkLineStyle}>
            <a
              href={`${REPO_URL}/blob/main/docs/privacy-policy.md`}
              target="_blank"
              rel="noreferrer"
              style={linkStyle}
            >
              プライバシーポリシー全文 →
            </a>
          </p>
        </section>

        <section style={sectionStyle}>
          <h3 style={sectionHeadingStyle}>不具合報告・機能要望</h3>
          <p style={paragraphStyle}>職人さんからのフィードバックがアプリ改善の原動力です。お気軽にどうぞ。</p>
          <ul style={ulStyle}>
            <li>
              <a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer" style={linkStyle}>
                GitHub Issue
              </a>
            </li>
            <li>登録メールアドレス宛てのご返信</li>
            <li>北嶺建設まで直接連絡</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h3 style={sectionHeadingStyle}>開発・著作権</h3>
          <p style={paragraphStyle}>
            © 2026 有限会社 北嶺建設(代表: Daisuke)
            <br />
            ソースコード:{' '}
            <a href={REPO_URL} target="_blank" rel="noreferrer" style={linkStyle}>
              {REPO_URL}
            </a>
          </p>
        </section>

        <div style={buttonsStyle}>
          <button type="button" onClick={onClose} autoFocus style={primaryButtonStyle}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};
const modalStyle: React.CSSProperties = {
  background: '#fff',
  padding: '1.5rem 2rem',
  borderRadius: 8,
  minWidth: 480,
  maxWidth: 600,
  maxHeight: '85vh',
  overflowY: 'auto',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
};
const headingStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 12,
  fontSize: '1.05rem',
  color: '#222',
};
const versionBoxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  background: '#f0f7ff',
  borderRadius: 4,
  marginBottom: 16,
};
const versionLabelStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  color: '#0066aa',
};
const versionValueStyle: React.CSSProperties = {
  fontSize: '1rem',
  color: '#003070',
  fontVariantNumeric: 'tabular-nums',
};
const betaBadgeStyle: React.CSSProperties = {
  marginLeft: 'auto',
  padding: '2px 10px',
  background: '#fff8e0',
  border: '1px solid #f0a000',
  borderRadius: 12,
  fontSize: '0.75rem',
  color: '#5a4400',
  fontWeight: 'bold',
};
const sectionStyle: React.CSSProperties = {
  marginBottom: 14,
};
const warnSectionStyle: React.CSSProperties = {
  marginBottom: 14,
  padding: '10px 14px',
  background: '#fff5f0',
  border: '1px solid #f0a070',
  borderRadius: 4,
};
const sectionHeadingStyle: React.CSSProperties = {
  fontSize: '0.88rem',
  marginTop: 0,
  marginBottom: 6,
  color: '#444',
};
const warnHeadingStyle: React.CSSProperties = {
  ...sectionHeadingStyle,
  color: '#a04000',
};
const paragraphStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#333',
  margin: '4px 0',
  lineHeight: 1.6,
};
const ulStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#333',
  margin: '4px 0',
  paddingLeft: 20,
  lineHeight: 1.7,
};
const linkLineStyle: React.CSSProperties = {
  fontSize: '0.82rem',
  margin: '4px 0',
};
const linkStyle: React.CSSProperties = {
  color: '#0080ff',
  textDecoration: 'underline',
};
const buttonsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginTop: 16,
  justifyContent: 'flex-end',
};
const primaryButtonStyle: React.CSSProperties = {
  background: '#0080ff',
  color: '#fff',
  border: 'none',
  padding: '6px 16px',
  borderRadius: 4,
  cursor: 'pointer',
};
