import { fileName, isDirty, isScarpPath, type StudioDocument } from './documents';
import { assertWellFormedUtf16 } from './utf8Text';
import { assertScarpSourceText } from './sourceLimits';

export const DRAFT_RECOVERY_KEY = 'studio.draftRecovery.v1';
export const MAX_RECOVERY_DRAFTS = 16;
export const MAX_RECOVERY_SOURCE_UNITS = 512 * 1024;
export const MAX_RECOVERY_JSON_UNITS = 2 * 1024 * 1024;
export const MAX_RECOVERY_NAME_UNITS = 120;

export interface RecoveryDraft {
  name: string;
  content: string;
}
export interface RecoveryCheckpoint {
  version: 1;
  createdAt: number;
  drafts: RecoveryDraft[];
}
export interface RecoveryRecord {
  version: 1;
  enabled: true;
  checkpoint: RecoveryCheckpoint | null;
}
export type RecoveryResult<T> = { ok: true; value: T } | { ok: false; error: string };

function failure(error: string): RecoveryResult<never> {
  return { ok: false, error };
}
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length &&
    keys.every(key => Object.hasOwn(value, key));
}
function validName(name: unknown): name is string {
  if (typeof name !== 'string' || name.length > MAX_RECOVERY_NAME_UNITS ||
      !isScarpPath(name) || /[<>:"/\\|?*\x00-\x1f\x7f]/.test(name) ||
      name.trim() !== name || name.startsWith('.')) return false;
  try {
    assertWellFormedUtf16(name, 'Draft name');
    return true;
  } catch {
    return false;
  }
}

/** Keep only a display basename, never an original path or native scope.
 * Unusual/oversized names receive a generic safe label without altering text. */
export function recoveryDraftName(name: string): string {
  const basename = fileName(name);
  return validName(basename) ? basename : 'Recovered.srp';
}

function validateDrafts(raw: unknown): RecoveryResult<RecoveryDraft[]> {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_RECOVERY_DRAFTS) {
    return failure('Recovery requires between 1 and 16 drafts.');
  }
  const drafts: RecoveryDraft[] = [];
  let units = 0;
  for (const value of raw) {
    const item = record(value);
    if (!item || !exactKeys(item, ['name', 'content']) ||
        !validName(item.name) || typeof item.content !== 'string') {
      return failure('Invalid recovery draft metadata.');
    }
    units += item.content.length;
    if (units > MAX_RECOVERY_SOURCE_UNITS) {
      return failure('Draft recovery is limited to 512 Ki UTF-16 source units.');
    }
    try {
      assertScarpSourceText(item.content);
    } catch {
      return failure('A recovery draft contains invalid source text.');
    }
    drafts.push({ name: item.name, content: item.content });
  }
  return { ok: true, value: drafts };
}
export function validateRecoveryDrafts(raw: unknown): RecoveryResult<RecoveryDraft[]> {
  return validateDrafts(raw);
}

function validTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) &&
    value >= 0 && value <= 8640000000000000;
}

/** No truncation, partial overwrite, automatic file read, or external upload.
 * If the entire dirty inventory cannot fit, keep the previous checkpoint. */
export function captureRecoveryCheckpoint(
  documents: readonly StudioDocument[], createdAt: number,
): RecoveryResult<RecoveryCheckpoint | null> {
  if (!validTimestamp(createdAt)) return failure('Invalid recovery timestamp.');
  const drafts: RecoveryDraft[] = [];
  let units = 0;
  for (const document of documents) {
    if (!isDirty(document)) continue;
    if (drafts.length === MAX_RECOVERY_DRAFTS) {
      return failure('More than 16 unsaved tabs; save some before updating recovery.');
    }
    units += document.content.length;
    if (units > MAX_RECOVERY_SOURCE_UNITS) {
      return failure('Unsaved source exceeds the 512 Ki recovery budget; save some work first.');
    }
    try {
      assertScarpSourceText(document.content);
    } catch {
      return failure('An unsaved tab contains invalid or oversized source text.');
    }
    drafts.push({ name: recoveryDraftName(document.name), content: document.content });
  }
  return { ok: true, value: drafts.length ? { version: 1, createdAt, drafts } : null };
}

/** Strictly versioned parsing: malformed/unknown records are not interpreted
 * as new empty sessions and must never be overwritten automatically. */
export function parseRecoveryRecord(raw: string | null): RecoveryResult<RecoveryRecord | null> {
  if (raw === null) return { ok: true, value: null };
  if (raw.length > MAX_RECOVERY_JSON_UNITS) return failure('Stored recovery record exceeds its size limit.');
  try {
    const value = record(JSON.parse(raw));
    if (!value || !exactKeys(value, ['version', 'enabled', 'checkpoint']) ||
        value.version !== 1 || value.enabled !== true) {
      return failure('Unrecognized local recovery record.');
    }
    if (value.checkpoint === null) {
      return { ok: true, value: { version: 1, enabled: true, checkpoint: null } };
    }
    const checkpoint = record(value.checkpoint);
    if (!checkpoint || !exactKeys(checkpoint, ['version', 'createdAt', 'drafts']) ||
        checkpoint.version !== 1 || !validTimestamp(checkpoint.createdAt)) {
      return failure('Invalid local recovery checkpoint.');
    }
    const drafts = validateDrafts(checkpoint.drafts);
    if (!drafts.ok) return drafts;
    return { ok: true, value: { version: 1, enabled: true, checkpoint: {
      version: 1, createdAt: checkpoint.createdAt, drafts: drafts.value,
    } } };
  } catch {
    return failure('Local recovery data could not be parsed.');
  }
}

export function encodeRecoveryRecord(value: RecoveryRecord): RecoveryResult<string> {
  const raw = JSON.stringify(value);
  if (raw.length > MAX_RECOVERY_JSON_UNITS) {
    return failure('Encoded recovery checkpoint exceeds its storage budget.');
  }
  const validation = parseRecoveryRecord(raw);
  if (!validation.ok) return validation;
  return { ok: true, value: raw };
}

export function sameRecoveryDrafts(
  left: RecoveryCheckpoint | null, right: RecoveryCheckpoint | null,
): boolean {
  if (left === null || right === null) return left === right;
  return left.drafts.length === right.drafts.length && left.drafts.every((item, i) =>
    item.name === right.drafts[i].name && item.content === right.drafts[i].content);
}
