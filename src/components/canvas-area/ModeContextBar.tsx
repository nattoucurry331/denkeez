// UI改修4: モード/状態に応じた二次アクションをキャンバス直上に集約する文脈バー。
// 上部ツールバーから「条件付きで出入りしていたボタン」(PDF文字取込・スケール解除・
// pick 確定/キャンセル)を移設し、上部バーの密度と横ずれを解消する。
// 自己完結(store を直接読み書き)で、MenuBar とは独立に動く。

import { useProjectStore } from '../../data/project-store';
import { askConfirm } from '../../tauri/api';

export function ModeContextBar(): JSX.Element | null {
  const modeKind = useProjectStore((s) => s.mode.kind);
  const pdfTextItems = useProjectStore((s) => s.project.pdfTextItems);
  const selectedPdfTextIds = useProjectStore((s) => s.selectedPdfTextIds);
  const hasScale = useProjectStore((s) => s.project.drawing?.scale !== undefined);
  const enterPdfTextPickMode = useProjectStore((s) => s.enterPdfTextPickMode);
  const importPdfTextAsAnnotations = useProjectStore((s) => s.importPdfTextAsAnnotations);
  const exitMode = useProjectStore((s) => s.exitMode);
  const setScale = useProjectStore((s) => s.setScale);

  const pickMode = modeKind === 'pdf-text-pick';
  const textCount = pdfTextItems?.length ?? 0;
  const hasPdfText = textCount > 0;

  // 出すアクションが無ければ表示しない(キャンバスの縦を奪わない)
  if (!pickMode && !hasPdfText && !hasScale) return null;

  const releaseScale = (): void => {
    void (async () => {
      const ok = await askConfirm(
        'スケール校正を解除しますか? 紙面実寸モードに戻ります。',
        'スケール解除',
      );
      if (ok) setScale(undefined);
    })();
  };

  return (
    <div style={barStyle}>
      {pickMode ? (
        <>
          <span style={labelStyle}>PDF文字を選択中:</span>
          <button
            type="button"
            onClick={() => {
              importPdfTextAsAnnotations(selectedPdfTextIds);
              exitMode();
            }}
            disabled={selectedPdfTextIds.length === 0}
            style={primaryStyle}
            title="選択した PDF 文字を編集可能な注記として取り込む"
          >
            ✓ 選んだ文字を取込 ({selectedPdfTextIds.length})
          </button>
          <button type="button" onClick={() => exitMode()} title="選択取込をやめる (ESC)">
            キャンセル
          </button>
        </>
      ) : (
        hasPdfText && (
          <>
            <span style={labelStyle}>PDF文字 {textCount} 件:</span>
            <button
              type="button"
              onClick={() => importPdfTextAsAnnotations((pdfTextItems ?? []).map((t) => t.id))}
              title="PDF から抽出した文字を全件、編集できる注記として取り込む"
            >
              全部取り込む
            </button>
            <button
              type="button"
              onClick={() => enterPdfTextPickMode()}
              title="PDF の文字を 1 つずつクリックして選び、必要な分だけ取り込む"
            >
              選んで取り込む
            </button>
          </>
        )
      )}
      {hasScale && !pickMode && (
        <button
          type="button"
          onClick={releaseScale}
          style={rightStyle}
          title="スケール校正を解除して紙面実寸モードに戻す"
        >
          スケール解除
        </button>
      )}
    </div>
  );
}

const barStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 12px',
  background: '#eef6ff',
  borderBottom: '1px solid #cfe3ff',
  fontSize: '0.85rem',
  flexWrap: 'wrap',
};
const labelStyle: React.CSSProperties = { color: '#33475b', fontWeight: 'bold' };
const primaryStyle: React.CSSProperties = {
  background: '#0080ff',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  padding: '4px 12px',
  cursor: 'pointer',
  fontWeight: 'bold',
};
const rightStyle: React.CSSProperties = { marginLeft: 'auto' };
