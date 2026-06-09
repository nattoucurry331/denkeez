// UI改修2: 操作モードの日本語ラベル。StatusBar の恒常モードバッジ等で使う純粋関数。

import type { EditorMode } from '../data/project-store';

/** EditorMode の種別を職人向けの日本語ラベルにする(全種別を網羅)。 */
export function modeKindToLabel(kind: EditorMode['kind']): string {
  switch (kind) {
    case 'select':
      return '選択';
    case 'place':
      return '配置中';
    case 'scale':
      return 'スケール設定';
    case 'measure':
      return '寸法計測';
    case 'dimension':
      return '寸法線';
    case 'text':
      return '文字';
    case 'pdf-text-pick':
      return 'PDF文字選択';
    case 'wire':
      return '配線';
    default: {
      // 網羅漏れがあればコンパイルエラーにする
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}
