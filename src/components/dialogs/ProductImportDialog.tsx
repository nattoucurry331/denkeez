// Phase 2-I2: メーカー商品画像の取込ダイアログ。
// メーカー・品番・規格・表示名を入力し、画像を ファイル選択 / ドラッグ&ドロップ /
// クリップボード貼付 で取り込む。取込画像はダウンスケールして dataURL 化。
//
// 「この場に配置」= product-image シンボルの配置モードに入る (preset 経由)。
// 「プリセットに保存」= localStorage プリセットに登録し、パレットから再利用可能に。
//
// 公式ページへの deep-link ボタンは Phase 2-I3 (opener plugin) で追加する。

import { useState, useEffect, useCallback } from 'react';
import {
  importImageFile,
  importImageFromClipboard,
  formatBytes,
  type ImportedImage,
} from '../../utils/image-import';
import { openExternalUrl } from '../../tauri/api';

/**
 * メーカーと品番から公式検索ページの URL を組み立てる。
 * Panasonic は品番検索ページ、それ以外は Google で "メーカー 品番" 検索にフォールバック。
 * (正規 API は無いため、ユーザーが公式ページで画像を入手する導線を提供するのみ)
 */
function officialSearchUrl(maker: string, partNumber: string): string {
  const q = partNumber.trim();
  const isPana = maker.toLowerCase().includes('panasonic') || maker.includes('Panasonic');
  if (isPana) {
    // Panasonic 品番情報検索。品番が空ならカテゴリ検索トップを開く (カタログを見て品番を調べる導線)
    return q === ''
      ? 'https://www2.panasonic.biz/jp/products/category/search.html'
      : `https://www2.panasonic.biz/jp/products/category/search.html?q=${encodeURIComponent(q)}`;
  }
  // その他メーカー: Web 検索にフォールバック (品番が空ならメーカー名のみ)
  const term = q === '' ? maker : `${maker} ${q}`;
  return `https://www.google.com/search?q=${encodeURIComponent(term.trim())}`;
}

/** 配置時のデフォルト表示幅 (紙面 mm)。JIS 記号 (φ5mm 円) より少し大きめ */
export const PRODUCT_IMAGE_DEFAULT_WIDTH_MM = 12;

export interface ProductImportResult {
  maker: string;
  partNumber: string;
  spec: string;
  displayName: string;
  image: ImportedImage;
}

interface Props {
  readonly open: boolean;
  readonly onPlace: (result: ProductImportResult) => void;
  readonly onSavePreset: (result: ProductImportResult) => void;
  readonly onCancel: () => void;
}

const MAKER_OPTIONS = ['Panasonic', '大光電機 (DAIKO)', 'コイズミ', '遠藤照明', 'オーデリック', 'その他'];

export function ProductImportDialog({
  open,
  onPlace,
  onSavePreset,
  onCancel,
}: Props): JSX.Element | null {
  const [maker, setMaker] = useState('Panasonic');
  const [partNumber, setPartNumber] = useState('');
  const [spec, setSpec] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [image, setImage] = useState<ImportedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // open のたびに初期化
  useEffect(() => {
    if (open) {
      setMaker('Panasonic');
      setPartNumber('');
      setSpec('');
      setDisplayName('');
      setImage(null);
      setError(null);
      setDragOver(false);
    }
  }, [open]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    try {
      const img = await importImageFile(file, { maxEdge: 512, quality: 0.82 });
      setImage(img);
    } catch (e) {
      setError(e instanceof Error ? e.message : '画像の取込に失敗しました');
    }
  }, []);

  // クリップボード貼付 (ダイアログ表示中のみ)
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent): void => {
      void importImageFromClipboard(e.clipboardData?.items ?? null, {
        maxEdge: 512,
        quality: 0.82,
      })
        .then((img) => {
          if (img) {
            setError(null);
            setImage(img);
          }
        })
        .catch(() => setError('クリップボードからの取込に失敗しました'));
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [open]);

  if (!open) return null;

  const effectiveName =
    displayName.trim() || [maker, partNumber].filter((s) => s.trim()).join(' ').trim();
  const canSubmit = image !== null && effectiveName !== '';

  const buildResult = (): ProductImportResult | null => {
    if (!image || effectiveName === '') return null;
    return {
      maker: maker.trim(),
      partNumber: partNumber.trim(),
      spec: spec.trim(),
      displayName: effectiveName,
      image,
    };
  };

  const handlePlace = (): void => {
    const r = buildResult();
    if (r) onPlace(r);
  };
  const handleSavePreset = (): void => {
    const r = buildResult();
    if (r) onSavePreset(r);
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="product-import-title" style={overlayStyle}>
      <div style={modalStyle}>
        <h2 id="product-import-title" style={headingStyle}>
          メーカー商品を取り込む
        </h2>

        <div style={twoColStyle}>
          {/* 左: 入力フォーム */}
          <div style={formColStyle}>
            <div style={fieldStyle}>
              <label htmlFor="pi-maker" style={labelStyle}>メーカー</label>
              <select
                id="pi-maker"
                value={MAKER_OPTIONS.includes(maker) ? maker : 'その他'}
                onChange={(e) => setMaker(e.target.value === 'その他' ? '' : e.target.value)}
                style={inputStyle}
              >
                {MAKER_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {!MAKER_OPTIONS.slice(0, -1).includes(maker) && (
                <input
                  type="text"
                  value={maker}
                  onChange={(e) => setMaker(e.target.value)}
                  placeholder="メーカー名を入力"
                  style={{ ...inputStyle, marginTop: 4 }}
                />
              )}
            </div>

            <div style={fieldStyle}>
              <label htmlFor="pi-part" style={labelStyle}>品番</label>
              <div style={partRowStyle}>
                <input
                  id="pi-part"
                  type="text"
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  placeholder="例: LGB12345"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    openExternalUrl(officialSearchUrl(maker, partNumber)).catch((e: unknown) => {
                      setError(
                        `公式ページを開けませんでした: ${e instanceof Error ? e.message : String(e)}`,
                      );
                    });
                  }}
                  style={officialBtnStyle}
                  title="公式サイトをブラウザで開く (品番を入れると検索、空ならカタログ検索トップ)"
                >
                  🔍 公式ページを開く
                </button>
              </div>
            </div>

            <div style={fieldStyle}>
              <label htmlFor="pi-spec" style={labelStyle}>規格 (任意)</label>
              <input
                id="pi-spec"
                type="text"
                value={spec}
                onChange={(e) => setSpec(e.target.value)}
                placeholder="例: LED 7W φ100 昼白色"
                style={inputStyle}
              />
            </div>

            <div style={fieldStyle}>
              <label htmlFor="pi-name" style={labelStyle}>表示名 (拾い出しの行名)</label>
              <input
                id="pi-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={effectiveName || 'メーカー + 品番から自動'}
                style={inputStyle}
              />
            </div>
          </div>

          {/* 右: 画像取込 + プレビュー */}
          <div style={imageColStyle}>
            <label style={labelStyle}>商品画像</label>
            <div
              style={{
                ...dropZoneStyle,
                ...(dragOver ? dropZoneActiveStyle : {}),
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) void handleFile(file);
              }}
            >
              {image ? (
                <img src={image.dataUrl} alt="プレビュー" style={previewImgStyle} />
              ) : (
                <div style={dropHintStyle}>
                  <p>ここに画像をドロップ</p>
                  <p style={dropHintSmallStyle}>または Ctrl+V で貼り付け</p>
                </div>
              )}
            </div>
            <label style={fileButtonStyle}>
              ファイルを選択
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                }}
                style={{ display: 'none' }}
              />
            </label>
            {image && (
              <p style={sizeHintStyle}>
                取込サイズ: 約 {formatBytes(image.approxBytes)}
                {' '}(縦横比 {image.aspectRatio.toFixed(2)})
              </p>
            )}
          </div>
        </div>

        {error && <p role="alert" style={errorStyle}>{error}</p>}

        <p style={noticeStyle}>
          ⚠️ 取り込む画像は、入手元 (メーカー公式サイト等) の利用規約に従ってご利用ください。
          自動取得は行わず、ご自身で保存した画像のみを取り込みます。
        </p>

        <div style={buttonsStyle}>
          <button
            type="button"
            onClick={handleSavePreset}
            disabled={!canSubmit}
            style={secondaryBtnStyle}
            title="パレットに登録して何度も使えるようにする"
          >
            プリセットに保存
          </button>
          <button
            type="button"
            onClick={handlePlace}
            disabled={!canSubmit}
            style={primaryBtnStyle}
            autoFocus
          >
            この場に配置
          </button>
          <button type="button" onClick={onCancel} style={cancelBtnStyle}>
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};
const modalStyle: React.CSSProperties = {
  background: '#fff',
  padding: '1.5rem 2rem',
  borderRadius: 8,
  minWidth: 560,
  maxWidth: 680,
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
};
const headingStyle: React.CSSProperties = { marginTop: 0, marginBottom: 16, fontSize: '1rem' };
const twoColStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 220px',
  gap: 20,
};
const formColStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
const imageColStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };
const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  marginBottom: 10,
};
const labelStyle: React.CSSProperties = { fontSize: '0.78rem', color: '#444', fontWeight: 'bold' };
const partRowStyle: React.CSSProperties = { display: 'flex', gap: 6, alignItems: 'stretch' };
const officialBtnStyle: React.CSSProperties = {
  flexShrink: 0,
  padding: '4px 10px',
  fontSize: '0.78rem',
  background: '#eef6ff',
  border: '1px solid #0080ff',
  borderRadius: 3,
  color: '#0066cc',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
const inputStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  padding: '5px 7px',
  border: '1px solid #ccc',
  borderRadius: 3,
};
const dropZoneStyle: React.CSSProperties = {
  width: '100%',
  height: 180,
  border: '2px dashed #bbb',
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#fafafa',
  overflow: 'hidden',
};
const dropZoneActiveStyle: React.CSSProperties = {
  borderColor: '#0080ff',
  background: '#eef6ff',
};
const dropHintStyle: React.CSSProperties = {
  textAlign: 'center',
  color: '#999',
  fontSize: '0.85rem',
};
const dropHintSmallStyle: React.CSSProperties = { fontSize: '0.72rem', marginTop: 4 };
const previewImgStyle: React.CSSProperties = {
  maxWidth: '100%',
  maxHeight: '100%',
  objectFit: 'contain',
};
const fileButtonStyle: React.CSSProperties = {
  display: 'inline-block',
  textAlign: 'center',
  padding: '6px 12px',
  background: '#f0f0f0',
  border: '1px solid #ccc',
  borderRadius: 4,
  fontSize: '0.82rem',
  cursor: 'pointer',
};
const sizeHintStyle: React.CSSProperties = { fontSize: '0.72rem', color: '#888' };
const errorStyle: React.CSSProperties = { color: '#c00', fontSize: '0.85rem', margin: '8px 0' };
const noticeStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#5a4400',
  background: '#fff8e0',
  borderLeft: '3px solid #f0a000',
  padding: '8px 12px',
  margin: '12px 0',
};
const buttonsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  justifyContent: 'flex-end',
  alignItems: 'center',
};
const primaryBtnStyle: React.CSSProperties = {
  background: '#0080ff',
  color: '#fff',
  border: 'none',
  padding: '6px 16px',
  borderRadius: 4,
  cursor: 'pointer',
};
const secondaryBtnStyle: React.CSSProperties = {
  background: '#fff',
  color: '#0080ff',
  border: '1px solid #0080ff',
  padding: '6px 14px',
  borderRadius: 4,
  cursor: 'pointer',
  marginRight: 'auto',
};
const cancelBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #ccc',
  padding: '6px 14px',
  borderRadius: 4,
  cursor: 'pointer',
};
