// Phase 1 PoC のデータモデル (Plan §4)。
// REQUIREMENTS.md §5.2 を踏まえ、Phase 1 で扱う最小フィールドのみ定義する。
// 配線・レイヤー・テキスト注記は Phase 2 で追加。
//
// readonly は付けない方針:
// - Zustand store の API レベルでフィールドを直接 mutate せず、
//   set() による replace で immutable 更新を保つ
// - HTMLCanvasElement を含む state を扱う関係で、immer の WritableDraft 変換が
//   readonly + DOM 型と衝突するため、型側は素直な mutable で保持する
// 外部に渡す関数の引数は読み取り専用前提として扱う (CLAUDE.md L82 と整合)。

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  appVersion: string;
  schemaVersion: number;
}

/** Phase 2-C1: スケール校正データ (F-04)。
 * 2 点クリックで「canvas px 距離 ↔ 実寸 mm」のマッピングを保存する。
 * 設定時は pxPerMm の計算式が「実寸ベース」に切り替わる。
 */
export interface ProjectDrawingScale {
  /** 校正に使った 2 点の canvas px 距離 */
  pixelDistanceCanvas: number;
  /** 校正に使った実寸 (mm) */
  realDistanceMm: number;
}

export interface ProjectDrawing {
  type: 'pdf';
  filename: string;
  selectedPage: number;
  /** PDF ページの実寸 (mm) — 内部の座標系はすべて mm で統一 (REQUIREMENTS.md §9.1.1) */
  widthMm: number;
  heightMm: number;
  /** Phase 2-C: スケール校正 (未設定時は紙面実寸モード) */
  scale?: ProjectDrawingScale | undefined;
}

/** Phase 2-B: 主要 20 種の JIS C 0303 シンボル種別 */
export type SymbolType =
  // 照明 (6)
  | 'general-light' | 'downlight' | 'fluorescent' | 'ceiling-light'
  | 'pull-cord-ceiling' | 'pendant-light'
  // スイッチ (5)
  | 'switch-1pole' | 'switch-3way' | 'switch-4way' | 'switch-dimmer' | 'switch-auto'
  // コンセント (4)
  | 'outlet-general' | 'outlet-waterproof' | 'outlet-ground' | 'outlet-200v'
  // 弱電・通信 (3)
  | 'tv-outlet' | 'lan-outlet' | 'phone-outlet'
  // その他 (2)
  | 'ventilation-fan' | 'smoke-detector';

export type SymbolCategory = 'lighting' | 'switch' | 'outlet' | 'low-voltage' | 'other';

export type PropertyValue = string | number | boolean;

export interface ProjectSymbol {
  id: string;
  type: SymbolType;
  position: { x: number; y: number };
  rotation: number;
  properties: Record<string, PropertyValue>;
}

/** Phase 2-A2 / 2-C 拡張: グリッド表示設定 (Project に永続化) */
export interface ProjectGridConfig {
  enabled: boolean;
  /**
   * グリッド間隔 (mm)。
   * Phase 2-C で和室基準 910/455mm を実装。スケール未設定時は 100/50mm が画面上で
   * 視認しやすいので候補に残す。spacingMm 自体は 4 値の union。
   */
  spacingMm: 910 | 455 | 100 | 50;
  /** 線色 (HEX) */
  color: string;
}

/** UI で選択可能な spacing 候補 */
export const GRID_SPACING_OPTIONS: ProjectGridConfig['spacingMm'][] = [910, 455, 100, 50];

export const DEFAULT_GRID_CONFIG: ProjectGridConfig = {
  enabled: false,
  spacingMm: 910,
  color: '#cccccc',
};

export interface Project {
  meta: ProjectMeta;
  /** PDF 未読込時は null */
  drawing: ProjectDrawing | null;
  symbols: ProjectSymbol[];
  /** Phase 2-A2 で追加。後方互換のため optional (未指定なら DEFAULT_GRID_CONFIG) */
  grid?: ProjectGridConfig;
}
