// Zod スキーマで JSON 入力を検証 (CLAUDE.md §1.3 入力検証必須)。
// REQUIREMENTS.md §11.4 / Plan §3: ファイル読込時にスキーマ検証して
// 不正なフィールドを内部に持ち込まないようにする。

import { z } from 'zod';

const ProjectMetaSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  appVersion: z.string(),
  schemaVersion: z.number().int().nonnegative(),
});

const ProjectDrawingScaleSchema = z.object({
  pixelDistanceCanvas: z.number().positive(),
  realDistanceMm: z.number().positive(),
});

const ProjectDrawingSchema = z.object({
  type: z.literal('pdf'),
  filename: z.string(),
  selectedPage: z.number().int().positive(),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  scale: ProjectDrawingScaleSchema.optional(),
});

const PointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

// Phase 2-B: 20 種の SymbolType + Phase 2-I: product-image を厳格に検証
const SymbolTypeSchema = z.enum([
  'general-light', 'downlight', 'fluorescent', 'ceiling-light',
  'pull-cord-ceiling', 'pendant-light',
  'switch-1pole', 'switch-3way', 'switch-4way', 'switch-dimmer', 'switch-auto',
  'outlet-general', 'outlet-waterproof', 'outlet-ground', 'outlet-200v',
  'tv-outlet', 'lan-outlet', 'phone-outlet',
  'ventilation-fan', 'smoke-detector',
  'product-image',
]);

// Phase 2-I: 画像シンボルのデータ。dataUrl は data: スキームの base64 のみ許可
// (外部 URL を弾いて CSP / セキュリティ前提を守る)。
const SymbolImageSchema = z.object({
  dataUrl: z.string().regex(/^data:image\//, 'dataUrl は data:image/ で始まる必要があります'),
  aspectRatio: z.number().positive().finite(),
  widthMm: z.number().positive().finite(),
});

const PropertyValueSchema = z.union([z.string(), z.number().finite(), z.boolean()]);

// Phase 2-D1: layerId は schemaVersion 2 で必須化したが、v1 ファイル後方互換のため
// スキーマレベルでは optional とし、project-io.ts のマイグレーションで補う。
// Phase 2-G3a: scale (個別サイズ倍率) を optional で追加 (未指定は 1.0 扱い)。
// Phase 2-H: text (個別テキスト上書き、preset 由来) を optional で追加。
const ProjectSymbolSchema = z.object({
  id: z.string().min(1),
  type: SymbolTypeSchema,
  position: PointSchema,
  rotation: z.number().finite(),
  properties: z.record(z.string(), PropertyValueSchema),
  layerId: z.string().min(1).optional(),
  scale: z.number().positive().finite().optional(),
  text: z.string().optional(),
  // Phase 2-I: 画像シンボル (product-image) のデータ
  image: SymbolImageSchema.optional(),
});

const ProjectGridConfigSchema = z.object({
  enabled: z.boolean(),
  spacingMm: z.union([z.literal(910), z.literal(455), z.literal(100), z.literal(50)]),
  color: z.string().min(1),
});

const WireTypeSchema = z.enum(['ceiling', 'floor', 'concealed', 'exposed']);
const CableTypeSchema = z.enum(['VVF1.6×2C', 'VVF2.0×2C', 'VVR', 'CV', 'IV', 'その他']);

// Phase 2-D1: layerId は schemaVersion 2 で必須化 (上の ProjectSymbolSchema と同方針)
const WireSchema = z.object({
  id: z.string().min(1),
  fromSymbolId: z.string().min(1),
  toSymbolId: z.string().min(1),
  waypoints: z.array(PointSchema),
  type: WireTypeSchema,
  cable: CableTypeSchema,
  cableCustom: z.string().optional(),
  circuit: z.string(),
  lengthMm: z.number().nonnegative(),
  layerId: z.string().min(1).optional(),
});

// Phase 3 F-16 Sub-3: 寸法注記 (schemaVersion 3)。layerId は後方互換のため optional とし
// project-io.ts のマイグレーションで補う (symbol/wire と同方針)。
const DimensionSchema = z.object({
  id: z.string().min(1),
  from: PointSchema,
  to: PointSchema,
  layerId: z.string().min(1).optional(),
});

// F-18: テキスト注記 (schemaVersion 4)。layerId は後方互換のため optional とし
// project-io.ts のマイグレーションで補う (dimension と同方針)。
const TextAnnotationSchema = z.object({
  id: z.string().min(1),
  position: PointSchema,
  text: z.string(),
  fontSizeMm: z.number().positive().finite(),
  color: z.string().min(1),
  layerId: z.string().min(1).optional(),
});

// PDF 文字抽出 (schemaVersion 4)。layerId は後方互換のため optional。
const PdfTextItemSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  position: PointSchema,
  fontSizeMm: z.number().positive().finite(),
  layerId: z.string().min(1).optional(),
});

// Phase 3 F-14: 表題欄設定
const TitleBlockSchema = z.object({
  enabled: z.boolean(),
  position: z.enum(['bottom-right', 'top-right', 'bottom-left', 'top-left']),
  projectName: z.string(),
  drawingName: z.string(),
  date: z.string(),
  author: z.string(),
  company: z.string(),
});

// Phase 2-D1: レイヤー (REQUIREMENTS §5.2 / F-08)
const LayerKindSchema = z.enum(['background', 'user']);
const LayerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().min(1),
  visible: z.boolean(),
  locked: z.boolean(),
  kind: LayerKindSchema,
});

// Phase 2-D1: layers も v1 ファイル互換のため optional。
// schemaVersion 2 の場合は project-io.ts の migrate で必須性を担保する。
export const ProjectSchema = z.object({
  meta: ProjectMetaSchema,
  drawing: ProjectDrawingSchema.nullable(),
  layers: z.array(LayerSchema).optional(),
  symbols: z.array(ProjectSymbolSchema),
  wires: z.array(WireSchema).optional(),
  grid: ProjectGridConfigSchema.optional(),
  // Phase 3 F-16 Sub-3
  dimensions: z.array(DimensionSchema).optional(),
  // F-18: テキスト注記 / PDF 文字抽出 (schemaVersion 4)
  textAnnotations: z.array(TextAnnotationSchema).optional(),
  pdfTextItems: z.array(PdfTextItemSchema).optional(),
  // Phase 3 F-14
  titleBlock: TitleBlockSchema.optional(),
});

export type ProjectSchemaInput = z.input<typeof ProjectSchema>;
export type ProjectSchemaOutput = z.output<typeof ProjectSchema>;
