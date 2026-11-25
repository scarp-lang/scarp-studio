import { isDirty, isScarpPath, sameFilePath, type StudioDocument } from './documents';
import { MAX_DISPLAYED_SCARP_FILES, safeRelativeScarpSourceName } from './folderListing';
import { assertWellFormedUtf16 } from './utf8Text';

export const WORKSPACE_SESSIONS_KEY = 'studio.workspaceSessions.v1';
export const MAX_REMEMBERED_WORKSPACES = 8;
export const MAX_WORKSPACE_SESSION_TABS = 24;
export const MAX_WORKSPACE_SESSION_JSON_UNITS = 256 * 1024;
export const MAX_WORKSPACE_ROOT_UNITS = 4096;
export const MAX_WORKSPACE_RESTORE_BYTES = 4 * 1024 * 1024;

export interface WorkspaceListedSource {
  name: string;
  path: string;
}
export interface WorkspaceSession {
  root: string;
  savedAt: number;
  names: string[];
  active: string | null;
}
export interface WorkspaceSessionRecord {
  version: 1;
  sessions: WorkspaceSession[];
}
export type WorkspaceSessionResult<T> = { ok: true; value: T } | { ok: false; error: string };

function fail(error: string): WorkspaceSessionResult<never> {
  return { ok: false, error };
}
function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function wellFormed(value: string): boolean {
  try {
    assertWellFormedUtf16(value, 'Workspace metadata');
    return true;
  } catch {
    return false;
  }
}

/** Root strings are opaque matching keys only. They must never be joined to
 * stored filenames or passed to native APIs as an authorization. */
export function validWorkspaceRoot(root: unknown): root is string {
  if (typeof root !== 'string' || !root.length || root.length > MAX_WORKSPACE_ROOT_UNITS ||
      /[\x00-\x1f\x7f]/.test(root) || !wellFormed(root)) return false;
  const windows = root.replace(/\//g, '\\');
  if (/^\\\\[?.]\\/.test(windows)) {
    return /^\\\\\?\\(?:[A-Za-z]:\\|UNC\\[^\\]+\\[^\\]+)/i.test(windows);
  }
  if (/^[A-Za-z]:\\/.test(windows) || /^\\\\[^\\]+\\[^\\]+/.test(windows)) return true;
  return root.startsWith('/') && !root.startsWith('//');
}
function validRelativeName(name: unknown): name is string {
  return typeof name === 'string' && safeRelativeScarpSourceName(name) &&
    !/[\x7f]/.test(name) && wellFormed(name);
}
function validTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 &&
    value <= 8640000000000000;
}

export function validateWorkspaceSession(raw: unknown): WorkspaceSessionResult<WorkspaceSession> {
  const item = object(raw);
  if (!item || !exactKeys(item, ['root', 'savedAt', 'names', 'active']) ||
      !validWorkspaceRoot(item.root) || !validTimestamp(item.savedAt) ||
      !Array.isArray(item.names) || !item.names.length ||
      item.names.length > MAX_WORKSPACE_SESSION_TABS) {
    return fail('Invalid remembered workspace metadata.');
  }
  const names: string[] = [];
  const seen = new Set<string>();
  for (const name of item.names) {
    if (!validRelativeName(name) || seen.has(name)) return fail('Invalid or repeated workspace source name.');
    seen.add(name);
    names.push(name);
  }
  if (item.active !== null && (typeof item.active !== 'string' || !seen.has(item.active))) {
    return fail('The remembered active source is not in the session.');
  }
  return { ok: true, value: { root: item.root, savedAt: item.savedAt, names, active: item.active } };
}

export function parseWorkspaceSessions(raw: string | null): WorkspaceSessionResult<WorkspaceSessionRecord> {
  if (raw === null) return { ok: true, value: { version: 1, sessions: [] } };
  if (raw.length > MAX_WORKSPACE_SESSION_JSON_UNITS) return fail('Remembered workspace metadata exceeds its limit.');
  try {
    const value = object(JSON.parse(raw));
    if (!value || !exactKeys(value, ['version', 'sessions']) ||
        value.version !== 1 || !Array.isArray(value.sessions) ||
        value.sessions.length > MAX_REMEMBERED_WORKSPACES) {
      return fail('Unrecognized remembered workspace record.');
    }
    const sessions: WorkspaceSession[] = [];
    for (const item of value.sessions) {
      const parsed = validateWorkspaceSession(item);
      if (!parsed.ok) return parsed;
      if (sessions.some(session => sameFilePath(session.root, parsed.value.root))) {
        return fail('Duplicate remembered workspace roots.');
      }
      sessions.push(parsed.value);
    }
    return { ok: true, value: { version: 1, sessions } };
  } catch {
    return fail('Remembered workspace metadata could not be parsed.');
  }
}

export function encodeWorkspaceSessions(value: WorkspaceSessionRecord): WorkspaceSessionResult<string> {
  const raw = JSON.stringify(value);
  if (raw.length > MAX_WORKSPACE_SESSION_JSON_UNITS) return fail('Remembered workspace metadata exceeds its storage budget.');
  const parsed = parseWorkspaceSessions(raw);
  if (!parsed.ok) return parsed;
  return { ok: true, value: raw };
}

function eligibleListing(files: readonly WorkspaceListedSource[]): WorkspaceListedSource[] {
  return files.slice(0, MAX_DISPLAYED_SCARP_FILES).filter(file =>
    validRelativeName(file.name) && typeof file.path === 'string' &&
    validWorkspaceRoot(file.path) && isScarpPath(file.path));
}
function unambiguousSource(
  files: readonly WorkspaceListedSource[], candidate: WorkspaceListedSource,
): boolean {
  return files.filter(file => file.name === candidate.name).length === 1 &&
    files.filter(file => sameFilePath(file.path, candidate.path)).length === 1;
}

export interface CapturedWorkspaceSession {
  session: WorkspaceSession | null;
  rememberedCount: number;
  omittedDirty: number;
  omittedUntitled: number;
  omittedUnlisted: number;
  omittedAmbiguous: number;
  omittedLimit: number;
}

/** Record only clean source names from the current native listing, never
 * source contents, unsaved snapshots, absolute source paths or permissions. */
export function captureWorkspaceSession(
  root: string, files: readonly WorkspaceListedSource[],
  documents: readonly StudioDocument[], activeId: string | null, savedAt: number,
): CapturedWorkspaceSession {
  const listing = eligibleListing(files);
  const names: string[] = [];
  let active: string | null = null;
  const result: CapturedWorkspaceSession = {
    session: null, rememberedCount: 0, omittedDirty: 0, omittedUntitled: 0,
    omittedUnlisted: 0, omittedAmbiguous: 0, omittedLimit: 0,
  };
  if (!validWorkspaceRoot(root) || !validTimestamp(savedAt)) return result;
  for (const doc of documents) {
    if (!doc.path) {
      result.omittedUntitled++;
      continue;
    }
    const matches = listing.filter(file => sameFilePath(file.path, doc.path!));
    if (!matches.length) {
      result.omittedUnlisted++;
      continue;
    }
    if (isDirty(doc)) {
      result.omittedDirty++;
      continue;
    }
    const file = matches[0];
    if (matches.length !== 1 || !unambiguousSource(listing, file) || names.includes(file.name)) {
      result.omittedAmbiguous++;
      continue;
    }
    if (names.length >= MAX_WORKSPACE_SESSION_TABS) {
      result.omittedLimit++;
      continue;
    }
    names.push(file.name);
    if (doc.id === activeId) active = file.name;
  }
  result.rememberedCount = names.length;
  result.session = names.length ? { root, savedAt, names, active } : null;
  return result;
}

export type WorkspaceSessionRow =
  | { name: string; kind: 'available'; path: string }
  | { name: string; kind: 'open'; path: string; documentId: string; modified: boolean }
  | { name: string; kind: 'missing' | 'ambiguous' };
export interface WorkspaceRestorePlan {
  rows: WorkspaceSessionRow[];
  activePath: string | null;
  newCount: number;
  openCount: number;
  missingCount: number;
  ambiguousCount: number;
}

/** Resolve stored names solely against the currently selected listing. A
 * persisted root/name is never a native path, even if it looks absolute. */
export function planWorkspaceRestore(
  session: WorkspaceSession, selectedRoot: string,
  files: readonly WorkspaceListedSource[], documents: readonly StudioDocument[],
): WorkspaceSessionResult<WorkspaceRestorePlan> {
  const checked = validateWorkspaceSession(session);
  if (!checked.ok) return checked;
  if (!validWorkspaceRoot(selectedRoot) || !sameFilePath(session.root, selectedRoot)) {
    return fail('Choose the remembered workspace through the native folder picker first.');
  }
  const listing = eligibleListing(files);
  const rows: WorkspaceSessionRow[] = [];
  let activePath: string | null = null;
  for (const name of checked.value.names) {
    const matches = listing.filter(file => file.name === name);
    if (!matches.length) {
      rows.push({ name, kind: 'missing' });
      continue;
    }
    const file = matches[0];
    const open = documents.filter(doc => doc.path !== null && sameFilePath(doc.path, file.path));
    if (matches.length !== 1 || !unambiguousSource(listing, file) || open.length > 1) {
      rows.push({ name, kind: 'ambiguous' });
      continue;
    }
    rows.push(open.length === 1
      ? { name, kind: 'open', path: file.path, documentId: open[0].id, modified: isDirty(open[0]) }
      : { name, kind: 'available', path: file.path });
    if (name === checked.value.active) activePath = file.path;
  }
  return { ok: true, value: {
    rows, activePath,
    newCount: rows.filter(row => row.kind === 'available').length,
    openCount: rows.filter(row => row.kind === 'open').length,
    missingCount: rows.filter(row => row.kind === 'missing').length,
    ambiguousCount: rows.filter(row => row.kind === 'ambiguous').length,
  } };
}

export function sameWorkspaceRestorePlan(a: WorkspaceRestorePlan, b: WorkspaceRestorePlan): boolean {
  if (a.activePath !== b.activePath || a.rows.length !== b.rows.length) return false;
  return a.rows.every((row, index) => {
    const other = b.rows[index];
    if (row.name !== other.name || row.kind !== other.kind) return false;
    if (row.kind === 'available') return other.kind === 'available' && row.path === other.path;
    if (row.kind === 'open') return other.kind === 'open' && row.path === other.path &&
      row.documentId === other.documentId && row.modified === other.modified;
    return true;
  });
}

/** Revalidate the exact reviewed capture before a manual remember/replace.
 * Timestamp changes are intentional; no other change is silently accepted. */
export function sameWorkspaceCapture(a: CapturedWorkspaceSession, b: CapturedWorkspaceSession): boolean {
  if (a.rememberedCount !== b.rememberedCount || a.omittedDirty !== b.omittedDirty ||
      a.omittedUntitled !== b.omittedUntitled || a.omittedUnlisted !== b.omittedUnlisted ||
      a.omittedAmbiguous !== b.omittedAmbiguous || a.omittedLimit !== b.omittedLimit) return false;
  if (a.session === null || b.session === null) return a.session === b.session;
  return sameFilePath(a.session.root, b.session.root) && a.session.active === b.session.active &&
    a.session.names.length === b.session.names.length &&
    a.session.names.every((name, index) => name === b.session!.names[index]);
}
