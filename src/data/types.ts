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

export interface ProjectDrawing {
  type: 'pdf';
  filename: string;
  selectedPage: number;
  /** PDF ページの実寸 (mm) — 内部の座標系はすべて mm で統一 (REQUIREMENTS.md §9.1.1) */
  widthMm: number;
  heightMm: number;
}

export interface ProjectSymbol {
  id: string;
  type: 'downlight';
  position: { x: number; y: number };
  rotation: number;
  properties: Record<string, unknown>;
}

export interface Project {
  meta: ProjectMeta;
  /** PDF 未読込時は null */
  drawing: ProjectDrawing | null;
  symbols: ProjectSymbol[];
}
