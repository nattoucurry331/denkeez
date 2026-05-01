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

/** Phase 2-D1: レイヤー定義 (REQUIREMENTS.md §5.2 / F-08)。
 *  `layers` 配列の順序がそのまま z-index となる (index 0 が最下、末尾が最上)。
 *  layers[0] は常に kind: 'background' の元図面レイヤー (削除不可・固定 ID)。
 */
export interface Layer {
  id: string;
  name: string;
  /** HEX 色 (#RRGGBB) — レイヤーパネル表示や配線色のヒント */
  color: string;
  visible: boolean;
  locked: boolean;
  /**
   * 'background': 元 PDF 背景用の特別レイヤー。固定 ID = BACKGROUND_LAYER_ID、
   *   常に layers[0]、削除不可、初期状態で locked: true (REQUIREMENTS §3.2 F-08)
   * 'user': 通常のユーザー編集対象レイヤー
   */
  kind: 'background' | 'user';
}

/** 元図面レイヤーの固定 ID。Project 全体でこの ID を持つレイヤーは 1 個だけ。 */
export const BACKGROUND_LAYER_ID = 'layer-background';

/** schemaVersion 1 (Phase 2-C 以前) のファイルを読み込んだ際、
 *  layerId 未設定の symbol/wire を一旦受け止めるレイヤー名。 */
export const MIGRATED_LAYER_NAME = '未分類';

/** F-08 標準ユーザーレイヤープリセット。新規プロジェクト時に背景レイヤーの直上に生成される。
 *  REQUIREMENTS.md §3.2 F-08 「標準レイヤー」記載順を踏襲。色はパネル表示用ヒント。 */
export const STANDARD_USER_LAYER_PRESETS: ReadonlyArray<{ name: string; color: string }> = [
  { name: '照明回路', color: '#f0a000' },
  { name: 'コンセント回路', color: '#c04080' },
  { name: '弱電', color: '#3070c0' },
  { name: '換気・空調', color: '#40a060' },
  { name: '寸法・注記', color: '#666666' },
];

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
  /** Phase 2-D1: 所属レイヤー ID (REQUIREMENTS §4.3)。schemaVersion 2 で必須化。
   *  schemaVersion 1 ファイル読込時はマイグレーションで「未分類」レイヤーに割当。 */
  layerId: string;
  /**
   * Phase 2-G3a: 個別サイズ倍率 (REQUIREMENTS §4.3 既定の `scale: number`)。
   * 未指定なら 1.0 として扱う (後方互換のため optional)。
   * 描画時の最終倍率 = globalSizeScale × typeScales[type] × scale。
   * 範囲: 0.1〜10.0 を実用範囲とするが、UI 側で 0.5〜3.0 にクランプ。
   */
  scale?: number;
  /**
   * Phase 2-H: シンボル個別の表示テキスト上書き (preset 由来 or 個別編集)。
   * 設定されていれば shape.text の代わりにこの文字列を描画する。
   * 例: ダウンライト基本表示 "DL" を "100" (φ100mm) に上書きする等。
   * 未指定 (undefined) なら shape.text をそのまま使用 (後方互換)。
   */
  text?: string;
}

/**
 * Phase 2-H: ユーザー定義のシンボルプリセット。
 *
 * 「ダウンライト LED 7W φ100」のような既存 SymbolType のバリエーションを保存し、
 * シンボルパレットから一発配置できるようにする。配置すると baseType + properties +
 * scale + text が自動的に ProjectSymbol に反映される。
 *
 * 保存場所:
 *   - localStorage (Daisuke の好み、現場をまたいで使える)
 *   - Phase 3 で .dkz 同梱対応 (案件特有のプリセットを共有可能に)
 *
 * 集計ロジック (拾い出し / CSV) は formatSymbolSpec で properties 由来で行うため、
 * preset を使った場合も自動的に種別 × 規格 で分類される。
 */
export interface SymbolPreset {
  /** UUID */
  id: string;
  /** ベースとなる組み込みシンボル種別 */
  baseType: SymbolType;
  /** パレット表示名 (例: "ダウンライト LED 7W φ100") */
  displayName: string;
  /** 配置時に自動セットされるプロパティ (wattage, model, diameter 等) */
  defaultProperties: Record<string, PropertyValue>;
  /** 円/四角の中に表示する文字 (shape.text を上書き) */
  textOverride?: string;
  /** 個別サイズ倍率 (0.5〜3.0、未指定なら 1.0) */
  scaleOverride?: number;
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

/** Phase 2-C: 配線種別 (REQUIREMENTS.md §3.2 F-07) */
export type WireType = 'ceiling' | 'floor' | 'concealed' | 'exposed';

/** Phase 2-C: ケーブル種別 */
export type CableType = 'VVF1.6×2C' | 'VVF2.0×2C' | 'VVR' | 'CV' | 'IV' | 'その他';

export const WIRE_TYPE_OPTIONS: { value: WireType; label: string }[] = [
  { value: 'ceiling', label: '天井ふところ (実線)' },
  { value: 'floor', label: '床下 (破線)' },
  { value: 'concealed', label: '壁内隠蔽 (点線)' },
  { value: 'exposed', label: '露出 (青実線)' },
];

export const CABLE_TYPE_OPTIONS: CableType[] = [
  'VVF1.6×2C',
  'VVF2.0×2C',
  'VVR',
  'CV',
  'IV',
  'その他',
];

/** Phase 2-C: 配線データ (REQUIREMENTS.md §5.2) */
export interface Wire {
  id: string;
  fromSymbolId: string;
  toSymbolId: string;
  /** 中継点 (mm)、from/to の間の経路 */
  waypoints: { x: number; y: number }[];
  type: WireType;
  cable: CableType;
  cableCustom?: string | undefined;
  circuit: string;
  /** 自動算出される配線長 (mm) */
  lengthMm: number;
  /** Phase 2-D1: 所属レイヤー ID。schemaVersion 2 で必須化。 */
  layerId: string;
}

export interface Project {
  meta: ProjectMeta;
  /** PDF 未読込時は null */
  drawing: ProjectDrawing | null;
  /** Phase 2-D1 で追加 (schemaVersion 2 で必須化)。
   *  配列順 = z-index (0 が最下層)。layers[0] は常に kind: 'background' (元図面レイヤー、削除不可)。
   *  schemaVersion 1 ファイル読込時は project-io.ts のマイグレーションで自動生成される。 */
  layers: Layer[];
  symbols: ProjectSymbol[];
  /** Phase 2-C で追加。後方互換のため optional */
  wires?: Wire[] | undefined;
  /** Phase 2-A2 で追加。後方互換のため optional (未指定なら DEFAULT_GRID_CONFIG) */
  grid?: ProjectGridConfig;
}
