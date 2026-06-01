// F-18 / 発見性改善: 選択中オブジェクトの削除を 1 か所に集約する (DRY)。
//
// CanvasArea の Delete キーハンドラと、メニューバーの「削除」ボタンの両方から呼ぶ。
// - ロック中レイヤー所属のオブジェクトは削除対象から除外する。
// - シンボル削除で連鎖削除される配線がある場合のみ確認ダイアログを出す。
// - symbol / wire / dimension / textAnnotation を横断して削除する。

import { useProjectStore } from '../data/project-store';
import { lockedLayerIds } from '../data/layer-helpers';
import { askConfirm } from '../tauri/api';

/**
 * 現在の選択を削除する。確認が必要なケース (配線の連鎖削除) では askConfirm を出す。
 * 何も削除対象が無ければ何もしない。
 */
export async function deleteSelection(): Promise<void> {
  const state = useProjectStore.getState();
  const selectedIds = state.selectedIds;
  if (selectedIds.length === 0) return;

  const { symbols, layers } = state.project;
  const wires = state.project.wires ?? [];
  const dims = state.project.dimensions ?? [];
  const texts = state.project.textAnnotations ?? [];

  const locked = lockedLayerIds(layers);
  const selSet = new Set(selectedIds);

  const symbolIds = symbols
    .filter((s) => selSet.has(s.id) && !locked.has(s.layerId))
    .map((s) => s.id);
  const directWireIds = wires
    .filter((w) => selSet.has(w.id) && !locked.has(w.layerId))
    .map((w) => w.id);
  const dimIds = dims
    .filter((d) => selSet.has(d.id) && !locked.has(d.layerId))
    .map((d) => d.id);
  const textIds = texts
    .filter((t) => selSet.has(t.id) && !locked.has(t.layerId))
    .map((t) => t.id);

  if (
    symbolIds.length === 0 &&
    directWireIds.length === 0 &&
    dimIds.length === 0 &&
    textIds.length === 0
  ) {
    return;
  }

  // シンボル削除で端点参照により連鎖削除される配線 (直接選択分は除く)
  const symbolIdSet = new Set(symbolIds);
  const directWireSet = new Set(directWireIds);
  const cascadingWires = wires.filter(
    (w) =>
      !directWireSet.has(w.id) &&
      (symbolIdSet.has(w.fromSymbolId) || symbolIdSet.has(w.toSymbolId)),
  );
  if (cascadingWires.length > 0) {
    const ok = await askConfirm(
      `選択中のシンボルに接続された ${cascadingWires.length} 本の配線も一緒に削除されます。続行しますか?`,
      'シンボル削除',
    );
    if (!ok) return;
  }

  // 直接選択された配線を先に削除 → シンボル削除 (内部で端点参照の配線も連鎖削除)
  if (directWireIds.length > 0) state.removeWires(directWireIds);
  if (symbolIds.length > 0) state.removeSymbols(symbolIds);
  if (dimIds.length > 0) state.removeDimensions(dimIds);
  if (textIds.length > 0) state.removeTextAnnotations(textIds);
}
