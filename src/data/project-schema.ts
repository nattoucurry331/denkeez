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

const ProjectDrawingSchema = z.object({
  type: z.literal('pdf'),
  filename: z.string(),
  selectedPage: z.number().int().positive(),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
});

const PointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

const ProjectSymbolSchema = z.object({
  id: z.string().min(1),
  // PoC では downlight のみだが、Phase 2 で追加するため string で受ける
  type: z.string().min(1),
  position: PointSchema,
  rotation: z.number().finite(),
  properties: z.record(z.string(), z.unknown()),
});

export const ProjectSchema = z.object({
  meta: ProjectMetaSchema,
  drawing: ProjectDrawingSchema.nullable(),
  symbols: z.array(ProjectSymbolSchema),
});

export type ProjectSchemaInput = z.input<typeof ProjectSchema>;
export type ProjectSchemaOutput = z.output<typeof ProjectSchema>;
