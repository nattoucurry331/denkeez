// Phase 2-I2: メーカー商品画像の取込ダイアログ。
// メーカー・品番・規格・表示名を入力し、画像を ファイル選択 / ドラッグ&ドロップ /
// クリップボード貼付 で取り込む。取込画像はダウンスケールして dataURL 化。
//
// 「この場に配置」= product-image シンボルの配置モードに入る (preset 経由)。
// 「プリセットに保存」= localStorage プリセットに登録し、パレットから再利用可能に。
//
// 公式ページへの deep-link ボタンは Phase 2-I3 (opener plugin) で追加する。

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fileToDataUrl,
  clipboardToDataUrl,
  downscaleDataUrl,
  formatBytes,
  type ImportedImage,
} from '../../utils/image-import';
import { openExternalUrl } from '../../tauri/api';
import {
  useRenderSettingsStore,
} from '../../data/render-settings-store';
import {
  PRODUCT_IMAGE_DEFAULT_WIDTH_MM,
  SIZE_WIDTH_MIN,
  SIZE_WIDTH_MAX,
  SIZE_PRESETS,
  PREVIEW_SCALE_BAR_MM,
  PRODUCT_PREVIEW_PX_PER_MM,
  clampWidthMm,
  computeProductPreviewPx,
} from '../../utils/product-size';

// 後方互換: 既存 import 元 (CanvasArea 等) のためここからも再エクスポート。
export { PRODUCT_IMAGE_DEFAULT_WIDTH_MM } from '../../utils/product-size';

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

/**
 * A: 取込手順ガイド。職人さんが「公式ページを開いた後どうするか」で迷わないよう、
 * ブラウザで画像をコピー → アプリで Ctrl+V という最短ルートを明示する。
 */
const IMPORT_STEPS: readonly string[] = [
  '「🔍 公式ページを開く」で商品を探す',
  '商品画像を右クリック →「画像をコピー」',
  'この画面で Ctrl+V を押して貼り付け',
];

export interface ProductImportResult {
  maker: string;
  partNumber: string;
  spec: string;
  displayName: string;
  image: ImportedImage;
  /** Phase 2-K2: 図面上の表示幅 (紙面 mm)。常に clampWidthMm 済みの値が入る。 */
  widthMm: number;
}

interface Props {
  readonly open: boolean;
  /** 配置のみ (プリセット保存しない) */
  readonly onPlace: (result: ProductImportResult) => void;
  /** 保存のみ (プリセットに登録、配置はしない)。mode='overwrite' なら既存を上書き。 */
  readonly onSavePreset: (result: ProductImportResult, mode: SaveMode) => void;
  /** 保存して配置 (主アクション)。プリセット登録 + そのまま配置モードへ */
  readonly onSaveAndPlace: (result: ProductImportResult, mode: SaveMode) => void;
  readonly onCancel: () => void;
  /** Phase 2-K2: 図面の縮尺が校正済みか (プレビューの補足バッジ用)。 */
  readonly scaleConfigured?: boolean;
  /** Phase 2-K3: 同一メーカー+品番のプリセットを探す (重複警告用)。 */
  readonly findDuplicate?: (maker: string, partNumber: string) => { displayName: string } | null;
}

/** Phase 2-K3: プリセット保存の種別。新規 or 既存上書き。 */
export type SaveMode = 'new' | 'overwrite';

/** どの保存アクションから重複確認が出たか。 */
type SaveIntent = 'save' | 'saveAndPlace';

const MAKER_OPTIONS = ['Panasonic', '大光電機 (DAIKO)', 'コイズミ', '遠藤照明', 'オーデリック', 'その他'];

export function ProductImportDialog({
  open,
  onPlace,
  onSavePreset,
  onSaveAndPlace,
  onCancel,
  scaleConfigured = false,
  findDuplicate,
}: Props): JSX.Element | null {
  const [maker, setMaker] = useState('Panasonic');
  const [partNumber, setPartNumber] = useState('');
  const [spec, setSpec] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [image, setImage] = useState<ImportedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // F: 取込元の生 dataURL を保持し、透過 ON/OFF を元画像から処理し直す (高品質)
  const [srcDataUrl, setSrcDataUrl] = useState<string | null>(null);
  const [transparentBg, setTransparentBg] = useState(false);
  // E: 図面上の表示幅 (紙面 mm)
  const [widthMm, setWidthMm] = useState(PRODUCT_IMAGE_DEFAULT_WIDTH_MM);
  // G: 重複確認の保留状態 (既存プリセットと同一メーカー+品番のとき)
  const [pendingSave, setPendingSave] = useState<{
    displayName: string;
    intent: SaveIntent;
  } | null>(null);

  // プレビューは canvas/zoom 非依存。描画設定の倍率だけ反映して、実際の図面での
  // 相対的な大小を正しく見せる (globalSizeScale × typeScales['product-image'])。
  const globalSizeScale = useRenderSettingsStore((s) => s.globalSizeScale);
  const typeScales = useRenderSettingsStore((s) => s.typeScales);
  const previewScaleFactor = globalSizeScale * (typeScales['product-image'] ?? 1);

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
      setWidthMm(PRODUCT_IMAGE_DEFAULT_WIDTH_MM);
      setPendingSave(null);
      setSrcDataUrl(null);
      setTransparentBg(false);
    }
  }, [open]);

  // 取込元 (file) を生 dataURL として保持。実際の縮小/透過は下の effect で行う。
  const handleFile = useCallback(async (file: File) => {
    setError(null);
    try {
      const src = await fileToDataUrl(file);
      setSrcDataUrl(src);
    } catch (e) {
      setError(e instanceof Error ? e.message : '画像の取込に失敗しました');
    }
  }, []);

  // クリップボード貼付 (ダイアログ表示中のみ)
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent): void => {
      void clipboardToDataUrl(e.clipboardData?.items ?? null)
        .then((src) => {
          if (src) {
            setError(null);
            setSrcDataUrl(src);
          }
        })
        .catch(() => setError('クリップボードからの取込に失敗しました'));
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [open]);

  // F: 取込元 or 透過設定が変わったら、元画像から縮小/透過し直して image を更新する。
  useEffect(() => {
    if (!open || !srcDataUrl) return;
    let cancelled = false;
    void downscaleDataUrl(srcDataUrl, {
      maxEdge: 512,
      quality: 0.82,
      removeWhiteBg: transparentBg,
    })
      .then((img) => {
        if (!cancelled) setImage(img);
      })
      .catch(() => {
        if (!cancelled) setError('画像の処理に失敗しました');
      });
    return () => {
      cancelled = true;
    };
  }, [open, srcDataUrl, transparentBg]);

  const effectiveName =
    displayName.trim() || [maker, partNumber].filter((s) => s.trim()).join(' ').trim();
  const canSubmit = image !== null && effectiveName !== '';

  // E: プレビュー用の寸法計算 (canvas/zoom 非依存の固定倍率)
  const clampedWidth = clampWidthMm(widthMm);
  const previewPx = image
    ? computeProductPreviewPx(clampedWidth, image.aspectRatio, previewScaleFactor)
    : { wPx: 0, hPx: 0 };
  const scaleBarPx = PREVIEW_SCALE_BAR_MM * PRODUCT_PREVIEW_PX_PER_MM * previewScaleFactor;
  const previewHeightMm =
    image && image.aspectRatio > 0 ? clampedWidth / image.aspectRatio : 0;

  const buildResult = (): ProductImportResult | null => {
    if (!image || effectiveName === '') return null;
    return {
      maker: maker.trim(),
      partNumber: partNumber.trim(),
      spec: spec.trim(),
      displayName: effectiveName,
      image,
      widthMm: clampWidthMm(widthMm),
    };
  };

  const handlePlace = (): void => {
    const r = buildResult();
    if (r) onPlace(r);
  };

  // G: 保存系は、同一メーカー+品番が既にあれば確認バナーを出してから確定する。
  const commitSave = (intent: SaveIntent, mode: SaveMode): void => {
    const r = buildResult();
    if (!r) return;
    setPendingSave(null);
    if (intent === 'save') onSavePreset(r, mode);
    else onSaveAndPlace(r, mode);
  };
  const requestSave = (intent: SaveIntent): void => {
    const r = buildResult();
    if (!r) return;
    const dup = findDuplicate?.(r.maker, r.partNumber) ?? null;
    if (dup) {
      setPendingSave({ displayName: dup.displayName, intent });
    } else {
      commitSave(intent, 'new');
    }
  };
  const handleSavePreset = (): void => requestSave('save');
  const handleSaveAndPlace = (): void => requestSave('saveAndPlace');

  // D: キーボード操作 (Windows 標準)。Esc=キャンセル / Ctrl+Enter=保存して配置。
  // 素の Enter は入力欄での誤発火を避けるため扱わない。
  // 最新の canSubmit / ハンドラを ref 経由で読み、open のたびにのみ購読し直す。
  const hotkeyRef = useRef({ onCancel, handleSaveAndPlace, canSubmit });
  hotkeyRef.current = { onCancel, handleSaveAndPlace, canSubmit };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        hotkeyRef.current.onCancel();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (hotkeyRef.current.canSubmit) hotkeyRef.current.handleSaveAndPlace();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="product-import-title" style={overlayStyle}>
      <div style={modalStyle}>
        <h2 id="product-import-title" style={headingStyle}>
          メーカー商品を取り込む
        </h2>

        {/* A: 取込手順ガイド */}
        <ol style={stepGuideStyle}>
          {IMPORT_STEPS.map((step, i) => (
            <li key={i} style={stepItemStyle}>
              <span style={stepNumStyle}>{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

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
                ...(image && transparentBg ? checkerBgStyle : {}),
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
                  <p style={dropHintIconStyle}>📋</p>
                  <p style={dropHintMainStyle}>Ctrl+V で貼り付け</p>
                  <p style={dropHintSmallStyle}>ドラッグ&amp;ドロップでも取り込めます</p>
                </div>
              )}
            </div>
            <label style={fileLinkStyle}>
              または画像ファイルを選ぶ
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

            {/* F: 白背景の透明化トグル */}
            {image && (
              <label style={transparentToggleStyle}>
                <input
                  type="checkbox"
                  checked={transparentBg}
                  onChange={(e) => setTransparentBg(e.target.checked)}
                />
                <span>白い背景を透明にする</span>
              </label>
            )}
            {image && transparentBg && (
              <p style={transparentNoteStyle}>
                ※透明化すると PNG 形式になり、ファイルがやや大きくなります。
              </p>
            )}

            {/* E: 図面上の表示幅 設定 + 実寸プレビュー */}
            {image && (
              <div style={sizeSectionStyle}>
                <label style={labelStyle}>図面上の表示幅</label>
                <div style={sizePresetRowStyle}>
                  {SIZE_PRESETS.map((p) => (
                    <button
                      type="button"
                      key={p.label}
                      onClick={() => setWidthMm(p.widthMm)}
                      style={{
                        ...sizePresetBtnStyle,
                        ...(Math.round(clampedWidth) === p.widthMm ? sizePresetBtnActiveStyle : {}),
                      }}
                      title={`図面上の表示幅 ${p.widthMm}mm`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div style={sizeSliderRowStyle}>
                  <input
                    type="range"
                    aria-label="表示幅スライダー"
                    min={SIZE_WIDTH_MIN}
                    max={SIZE_WIDTH_MAX}
                    step={1}
                    value={Math.round(clampedWidth)}
                    onChange={(e) => setWidthMm(Number(e.target.value))}
                    style={sizeRangeStyle}
                  />
                  <input
                    type="number"
                    aria-label="表示幅 (mm)"
                    min={SIZE_WIDTH_MIN}
                    max={SIZE_WIDTH_MAX}
                    value={Math.round(clampedWidth)}
                    onChange={(e) => setWidthMm(clampWidthMm(Number(e.target.value)))}
                    style={sizeNumberStyle}
                  />
                  <span style={sizeUnitStyle}>mm</span>
                </div>
                <div style={scalePreviewBoxStyle}>
                  <img
                    src={image.dataUrl}
                    alt="サイズプレビュー"
                    style={{ width: previewPx.wPx, height: previewPx.hPx, display: 'block' }}
                  />
                </div>
                <div style={scaleBarRowStyle}>
                  <span style={{ ...scaleBarStyle, width: scaleBarPx }} />
                  <span style={scaleBarLabelStyle}>{PREVIEW_SCALE_BAR_MM}mm</span>
                </div>
                <p style={sizeNoteStyle}>
                  幅 約 {Math.round(clampedWidth)}mm / 高さ 約 {Math.round(previewHeightMm)}mm
                </p>
                {!scaleConfigured && (
                  <p style={scaleBadgeStyle}>
                    ※図面の縮尺は未設定です。記号との大小は正確に表示されます。
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {error && <p role="alert" style={errorStyle}>{error}</p>}

        <p style={noticeStyle}>
          ⚠️ 取り込む画像は、入手元 (メーカー公式サイト等) の利用規約に従ってご利用ください。
          自動取得は行わず、ご自身で保存した画像のみを取り込みます。
        </p>

        {/* G: 重複確認バナー */}
        {pendingSave && (
          <div role="alertdialog" aria-label="重複確認" style={dupBannerStyle}>
            <p style={dupBannerTextStyle}>
              同じ品番のプリセット「{pendingSave.displayName}」が既に登録されています。
              どうしますか?
            </p>
            <div style={dupBannerBtnsStyle}>
              <button
                type="button"
                onClick={() => commitSave(pendingSave.intent, 'overwrite')}
                style={primaryBtnStyle}
                title="既存のプリセットを今回の内容で更新する"
              >
                上書き保存
              </button>
              <button
                type="button"
                onClick={() => commitSave(pendingSave.intent, 'new')}
                style={secondaryBtnStyle}
                title="別のプリセットとして新しく登録する"
              >
                別に登録
              </button>
              <button
                type="button"
                onClick={() => setPendingSave(null)}
                style={cancelBtnStyle}
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        <div style={buttonsStyle}>
          <button type="button" onClick={onCancel} style={cancelBtnStyle}>
            キャンセル
          </button>
          <span style={spacerStyle} />
          <button
            type="button"
            onClick={handleSavePreset}
            disabled={!canSubmit}
            style={secondaryBtnStyle}
            title="パレットに登録だけする (今は配置しない)"
          >
            保存のみ
          </button>
          <button
            type="button"
            onClick={handlePlace}
            disabled={!canSubmit}
            style={secondaryBtnStyle}
            title="パレットに登録せず、今回だけ図面に配置する"
          >
            配置のみ
          </button>
          <button
            type="button"
            onClick={handleSaveAndPlace}
            disabled={!canSubmit}
            style={primaryBtnStyle}
            autoFocus
            title="パレットに登録して、そのまま図面に配置する (Ctrl+Enter)"
          >
            保存して配置
          </button>
        </div>
        <p style={hotkeyHintStyle}>Esc で閉じる / Ctrl+Enter で「保存して配置」</p>
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
const headingStyle: React.CSSProperties = { marginTop: 0, marginBottom: 12, fontSize: '1rem' };
const stepGuideStyle: React.CSSProperties = {
  listStyle: 'none',
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  margin: '0 0 16px',
  padding: '10px 12px',
  background: '#f3f8ff',
  border: '1px solid #cfe3ff',
  borderRadius: 6,
  fontSize: '0.78rem',
  color: '#33475b',
};
const stepItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};
const stepNumStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 18,
  height: 18,
  borderRadius: '50%',
  background: '#0080ff',
  color: '#fff',
  fontSize: '0.7rem',
  fontWeight: 'bold',
  flexShrink: 0,
};
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
  color: '#888',
  fontSize: '0.85rem',
};
const dropHintIconStyle: React.CSSProperties = { fontSize: '1.6rem', margin: 0 };
const dropHintMainStyle: React.CSSProperties = {
  fontSize: '0.92rem',
  fontWeight: 'bold',
  color: '#0066cc',
  margin: '6px 0 0',
};
const dropHintSmallStyle: React.CSSProperties = { fontSize: '0.72rem', marginTop: 4 };
const previewImgStyle: React.CSSProperties = {
  maxWidth: '100%',
  maxHeight: '100%',
  objectFit: 'contain',
};
const fileLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  textAlign: 'center',
  fontSize: '0.78rem',
  color: '#0066cc',
  textDecoration: 'underline',
  cursor: 'pointer',
};
const sizeHintStyle: React.CSSProperties = { fontSize: '0.72rem', color: '#888' };
const transparentToggleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: '0.78rem',
  color: '#444',
  cursor: 'pointer',
};
const transparentNoteStyle: React.CSSProperties = {
  fontSize: '0.68rem',
  color: '#888',
  margin: 0,
};
const checkerBgStyle: React.CSSProperties = {
  background:
    'repeating-conic-gradient(#e8e8e8 0% 25%, #fff 0% 50%) 50% / 16px 16px',
};
const sizeSectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  marginTop: 6,
  paddingTop: 8,
  borderTop: '1px solid #eee',
};
const sizePresetRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
};
const sizePresetBtnStyle: React.CSSProperties = {
  fontSize: '0.68rem',
  padding: '3px 6px',
  border: '1px solid #ccc',
  borderRadius: 3,
  background: '#fff',
  color: '#444',
  cursor: 'pointer',
};
const sizePresetBtnActiveStyle: React.CSSProperties = {
  borderColor: '#0080ff',
  background: '#eef6ff',
  color: '#0066cc',
  fontWeight: 'bold',
};
const sizeSliderRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};
const sizeRangeStyle: React.CSSProperties = { flex: 1, minWidth: 0 };
const sizeNumberStyle: React.CSSProperties = {
  width: 52,
  fontSize: '0.8rem',
  padding: '3px 4px',
  border: '1px solid #ccc',
  borderRadius: 3,
};
const sizeUnitStyle: React.CSSProperties = { fontSize: '0.72rem', color: '#888' };
const scalePreviewBoxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'flex-start',
  minHeight: 48,
  maxHeight: 160,
  padding: 6,
  border: '1px solid #eee',
  borderRadius: 4,
  background:
    'repeating-conic-gradient(#f3f3f3 0% 25%, #fff 0% 50%) 50% / 14px 14px',
  overflow: 'hidden',
};
const scaleBarRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};
const scaleBarStyle: React.CSSProperties = {
  height: 6,
  borderLeft: '1px solid #555',
  borderRight: '1px solid #555',
  borderBottom: '1px solid #555',
  flexShrink: 0,
};
const scaleBarLabelStyle: React.CSSProperties = { fontSize: '0.68rem', color: '#666' };
const sizeNoteStyle: React.CSSProperties = { fontSize: '0.7rem', color: '#666', margin: 0 };
const scaleBadgeStyle: React.CSSProperties = {
  fontSize: '0.68rem',
  color: '#8a6d00',
  background: '#fff8e0',
  padding: '3px 6px',
  borderRadius: 3,
  margin: 0,
};
const errorStyle: React.CSSProperties = { color: '#c00', fontSize: '0.85rem', margin: '8px 0' };
const noticeStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#5a4400',
  background: '#fff8e0',
  borderLeft: '3px solid #f0a000',
  padding: '8px 12px',
  margin: '12px 0',
};
const dupBannerStyle: React.CSSProperties = {
  background: '#fff4f4',
  border: '1px solid #f0b0b0',
  borderRadius: 6,
  padding: '10px 12px',
  margin: '0 0 12px',
};
const dupBannerTextStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: '#a33',
  margin: '0 0 8px',
};
const dupBannerBtnsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  justifyContent: 'flex-end',
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
};
const spacerStyle: React.CSSProperties = { flex: 1 };
const hotkeyHintStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: '#999',
  textAlign: 'right',
  margin: '6px 0 0',
};
const cancelBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #ccc',
  padding: '6px 14px',
  borderRadius: 4,
  cursor: 'pointer',
};
