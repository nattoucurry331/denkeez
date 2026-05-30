// プロジェクトファイル (拡張子 .dkz, 中身は JSON) のシリアライズ・パース。
// REQUIREMENTS.md §10.1-4 / Plan §1: PoC では単一 JSON 形式、
// Phase 2 で .dkz (ZIP) に拡張し元 PDF を同梱する。

import { ProjectSchema } from './project-schema';
import type { Layer, Project, ProjectSymbol, Wire } from './types';
import { MIGRATED_LAYER_NAME } from './types';
import { SCHEMA_VERSION } from '../shared/constants/app';
import { generateId } from '../utils/id';
import {
  createBackgroundLayer,
  createStandardUserLayers,
  pickFirstUserLayerId,
} from './layer-defaults';

export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}

export class ProjectFileError extends Error {
  constructor(message: string) {
    super(`[denkeez] ${message}`);
    this.name = 'ProjectFileError';
  }
}

export function deserializeProject(json: string): Project {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ProjectFileError('JSON の解析に失敗しました');
  }

  const result = ProjectSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new ProjectFileError(`プロジェクトファイルの形式が不正です (${issues})`);
  }

  if (result.data.meta.schemaVersion > SCHEMA_VERSION) {
    throw new ProjectFileError(
      `このファイルは新しいバージョンの Denkeez で作成されています (schemaVersion=${result.data.meta.schemaVersion} > ${SCHEMA_VERSION})。アプリを更新してください。`,
    );
  }

  return migrateAndCanonicalize(result.data);
}

type ParsedProject = ReturnType<typeof ProjectSchema.parse>;
type ParsedSymbol = ParsedProject['symbols'][number];
type ParsedWire = NonNullable<ParsedProject['wires']>[number];

// Phase 2-D1: レイヤー必須化に伴うマイグレーション。
//  v1: layers / layerId が無いため、標準レイヤー + 未分類を生成し、既存 symbol/wire を未分類に割当。
//  v2: layers が存在する前提だが、Zod では optional 扱いなので欠落時は v1 と同じ補完を行う。
//      symbol/wire の layerId 欠落時は最初のユーザーレイヤーへ寄せる (防御)。
function migrateAndCanonicalize(parsed: ParsedProject): Project {
  const v = parsed.meta.schemaVersion;

  if (v < 2 || !parsed.layers || parsed.layers.length === 0) {
    return runV1Migration(parsed);
  }

  const layers: Layer[] = ensureBackgroundLayer(parsed.layers);
  const fallbackLayerId = pickFirstUserLayerId(layers);
  return buildProject(parsed, layers, fallbackLayerId);
}

function runV1Migration(parsed: ParsedProject): Project {
  const standardUserLayers = createStandardUserLayers();
  const migratedLayer: Layer = {
    id: generateId(),
    name: MIGRATED_LAYER_NAME,
    color: '#888888',
    visible: true,
    locked: false,
    kind: 'user',
  };
  const layers: Layer[] = [createBackgroundLayer(), ...standardUserLayers, migratedLayer];
  return buildProject(parsed, layers, migratedLayer.id);
}

function ensureBackgroundLayer(layers: Layer[]): Layer[] {
  if (layers.some((l) => l.kind === 'background')) {
    return layers;
  }
  // 想定外の corrupted v2: 背景レイヤーが無い場合は補完
  return [createBackgroundLayer(), ...layers];
}

function buildProject(
  parsed: ParsedProject,
  layers: Layer[],
  fallbackLayerId: string,
): Project {
  const symbols: ProjectSymbol[] = parsed.symbols.map((s) =>
    canonicalizeSymbol(s, fallbackLayerId),
  );
  const result: Project = {
    meta: { ...parsed.meta, schemaVersion: SCHEMA_VERSION },
    drawing: parsed.drawing,
    layers,
    symbols,
  };
  if (parsed.wires !== undefined) {
    result.wires = parsed.wires.map((w) => canonicalizeWire(w, fallbackLayerId));
  }
  if (parsed.grid !== undefined) {
    result.grid = parsed.grid;
  }
  return result;
}

// exactOptionalPropertyTypes: true 環境のため、optional フィールドは
// 「キーごと省略 or 値ありで明示」の二択にする (undefined 値の代入は型エラー)。
function canonicalizeSymbol(s: ParsedSymbol, fallbackLayerId: string): ProjectSymbol {
  const result: ProjectSymbol = {
    id: s.id,
    type: s.type,
    position: s.position,
    rotation: s.rotation,
    properties: s.properties,
    layerId: s.layerId ?? fallbackLayerId,
  };
  // Phase 2-G3a / 2-H / 2-I: optional フィールドはキー省略 (exactOptionalPropertyTypes 対応)
  if (s.scale !== undefined) result.scale = s.scale;
  if (s.text !== undefined) result.text = s.text;
  if (s.image !== undefined) result.image = s.image;
  return result;
}

function canonicalizeWire(w: ParsedWire, fallbackLayerId: string): Wire {
  const wire: Wire = {
    id: w.id,
    fromSymbolId: w.fromSymbolId,
    toSymbolId: w.toSymbolId,
    waypoints: w.waypoints,
    type: w.type,
    cable: w.cable,
    circuit: w.circuit,
    lengthMm: w.lengthMm,
    layerId: w.layerId ?? fallbackLayerId,
  };
  if (w.cableCustom !== undefined) {
    wire.cableCustom = w.cableCustom;
  }
  return wire;
}
