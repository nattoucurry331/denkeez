// プロジェクトファイル (拡張子 .dkz, 中身は JSON) のシリアライズ・パース。
// REQUIREMENTS.md §10.1-4 / Plan §1: PoC では単一 JSON 形式、
// Phase 2 で .dkz (ZIP) に拡張し元 PDF を同梱する。

import { ProjectSchema } from './project-schema';
import type { Project } from './types';
import { SCHEMA_VERSION } from '../shared/constants/app';

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

  return result.data as Project;
}
