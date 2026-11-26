import { sameFilePath } from './documents';
import { validWorkspaceRoot } from './workspaceSessions';
import type { IntelliSenseStorage } from './intelliSensePreferences';
import { exactKeys, hasUniqueJsonKeys, profileError, recordOf, type ProfileResult } from './intelliSenseProfileTransfer';
import { exportStudioPreferences, importStudioPreferences, reviewStudioPreferences, sameStudioPreferences,
  studioReviewIsCurrent, PORTABLE_GROUPS, type PortableGroup, type StudioPortablePreferences, type StudioTransferReview } from './studioPreferenceTransfer';

export const WORKSPACE_PREFERENCES_KEY = 'studio.workspacePreferences.v1';
export const MAX_WORKSPACE_PREFERENCES = 12;
export const MAX_WORKSPACE_PREFERENCES_UNITS = 196608;
export interface WorkspacePreferenceEntry {
  readonly root: string;
  readonly preferences: StudioPortablePreferences;
  readonly groups: readonly PortableGroup[];
}
export interface WorkspacePreferenceState {
  readonly entries: readonly WorkspacePreferenceEntry[];
  readonly revision: number;
  readonly status: 'available' | 'session-only' | 'blocked';
}
function parseGroups(value: unknown): readonly PortableGroup[] | null {
  if (!Array.isArray(value) || !value.length || value.length > PORTABLE_GROUPS.length ||
      value.some(item => !PORTABLE_GROUPS.includes(item as PortableGroup)) ||
      new Set(value).size !== value.length) return null;
  return Object.freeze(PORTABLE_GROUPS.filter(group => value.includes(group)));
}
export function sameWorkspacePreference(a: WorkspacePreferenceEntry, b: WorkspacePreferenceEntry): boolean {
  return sameFilePath(a.root, b.root) && a.groups.join(',') === b.groups.join(',') &&
    sameStudioPreferences(a.preferences, b.preferences);
}
export function findWorkspacePreference(entries: readonly WorkspacePreferenceEntry[], root: string | null): WorkspacePreferenceEntry | null {
  return root !== null && validWorkspaceRoot(root) ? entries.find(entry => sameFilePath(entry.root, root)) ?? null : null;
}
export function captureWorkspacePreference(root: unknown, prefs: StudioPortablePreferences, groups: readonly PortableGroup[]):
  ProfileResult<WorkspacePreferenceEntry> {
  if (!validWorkspaceRoot(root)) return profileError('Choose a native workspace before saving preferences.');
  const selected = parseGroups(groups);
  if (!selected) return profileError('Choose at least one supported preference category.');
  const normalized = importStudioPreferences(exportStudioPreferences(prefs));
  if (!normalized.ok) return normalized;
  // Persist only selected categories; unselected fields have defaults rather
  // than capturing unrelated active settings.
  const defaults = defaultPortable();
  const selectedPreferences = reviewStudioPreferences(defaults, normalized.value, selected).target;
  return { ok: true, value: Object.freeze({ root, preferences: selectedPreferences, groups: selected }) };
}
import { DEFAULT_STUDIO_PORTABLE } from './studioPreferenceTransfer';
const defaultPortable = () => DEFAULT_STUDIO_PORTABLE;

export function serializeWorkspacePreferences(entries: readonly WorkspacePreferenceEntry[]): string {
  return JSON.stringify({ version: 1, entries: entries.map(entry => ({
    root: entry.root, groups: [...entry.groups], configuration: JSON.parse(exportStudioPreferences(entry.preferences)),
  })) });
}
export function parseWorkspacePreferences(raw: string | null): ProfileResult<readonly WorkspacePreferenceEntry[]> {
  if (raw === null) return { ok: true, value: Object.freeze([]) };
  if (raw.length > MAX_WORKSPACE_PREFERENCES_UNITS) return profileError('Workspace preference records exceed the storage limit.');
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return profileError('Workspace preferences contain invalid JSON.'); }
  if (!hasUniqueJsonKeys(raw)) return profileError('Workspace preference records contain duplicate keys or unsupported nesting.');
  const root = recordOf(data);
  if (!root || !exactKeys(root, ['version', 'entries']) || root.version !== 1 ||
      !Array.isArray(root.entries) || root.entries.length > MAX_WORKSPACE_PREFERENCES) {
    return profileError('Unsupported workspace preference record.');
  }
  const entries: WorkspacePreferenceEntry[] = [];
  for (const value of root.entries) {
    const item = recordOf(value);
    if (!item || !exactKeys(item, ['root', 'groups', 'configuration']) || !validWorkspaceRoot(item.root)) {
      return profileError('Invalid workspace preference association.');
    }
    if (findWorkspacePreference(entries, item.root)) return profileError('Duplicate workspace preference roots.');
    const groups = parseGroups(item.groups);
    if (!groups) return profileError('Invalid workspace preference categories.');
    const configuration = importStudioPreferences(JSON.stringify(item.configuration));
    if (!configuration.ok) return configuration;
    const entry = captureWorkspacePreference(item.root, configuration.value, groups);
    if (!entry.ok) return entry;
    entries.push(entry.value);
  }
  return { ok: true, value: Object.freeze(entries) };
}
export type WorkspacePreferenceMutation =
  | { kind: 'remember'; entry: WorkspacePreferenceEntry; expected: WorkspacePreferenceEntry | null }
  | { kind: 'forget'; expected: WorkspacePreferenceEntry };
export function mutateWorkspacePreferences(entries: readonly WorkspacePreferenceEntry[], action: WorkspacePreferenceMutation):
  ProfileResult<readonly WorkspacePreferenceEntry[]> {
  const root = action.kind === 'remember' ? action.entry.root : action.expected.root;
  const found = findWorkspacePreference(entries, root);
  if (action.expected === null ? found !== null : !found || !sameWorkspacePreference(found, action.expected)) {
    return profileError('Workspace preference association changed. Review it again.');
  }
  if (action.kind === 'forget') return { ok: true, value: Object.freeze(entries.filter(entry => entry !== found)) };
  if (!found && entries.length >= MAX_WORKSPACE_PREFERENCES) return profileError('Workspace preference capacity reached. Forget an association before saving another.');
  const valid = captureWorkspacePreference(action.entry.root, action.entry.preferences, action.entry.groups);
  if (!valid.ok) return valid;
  return { ok: true, value: Object.freeze(found ? entries.map(entry => entry === found ? valid.value : entry) : [...entries, valid.value]) };
}

export interface WorkspacePreferenceReview {
  readonly root: string;
  readonly revision: number;
  readonly entry: WorkspacePreferenceEntry;
  readonly review: StudioTransferReview;
}
export function reviewWorkspacePreference(state: WorkspacePreferenceState, root: string | null, current: StudioPortablePreferences):
  ProfileResult<WorkspacePreferenceReview> {
  if (state.status === 'blocked') return profileError('Workspace preference storage is blocked.');
  const entry = findWorkspacePreference(state.entries, root);
  if (!entry || !root) return profileError('No saved preferences for the selected workspace.');
  return { ok: true, value: Object.freeze({ root, revision: state.revision, entry,
    review: reviewStudioPreferences(current, entry.preferences, entry.groups) }) };
}
export function workspacePreferenceReviewIsCurrent(review: WorkspacePreferenceReview, state: WorkspacePreferenceState,
  root: string | null, current: StudioPortablePreferences): boolean {
  if (!root || state.status === 'blocked' || state.revision !== review.revision || !sameFilePath(root, review.root)) return false;
  const entry = findWorkspacePreference(state.entries, root);
  return !!entry && sameWorkspacePreference(entry, review.entry) && studioReviewIsCurrent(review.review, current);
}

/** A remembered root is an opaque local association key, not a path to open.
 * Only explicit save/forget actions write storage. No automatic application,
 * native file API calls, eviction or source/permission data. */
export function createWorkspacePreferenceStore(storage: IntelliSenseStorage | null) {
  let raw: string | null = null;
  let entries: readonly WorkspacePreferenceEntry[] = Object.freeze([]);
  let status: WorkspacePreferenceState['status'] = storage ? 'available' : 'session-only';
  try {
    if (storage) {
      raw = storage.getItem(WORKSPACE_PREFERENCES_KEY);
      const loaded = parseWorkspacePreferences(raw);
      if (loaded.ok) entries = loaded.value;
      else status = 'blocked';
    }
  } catch { status = 'session-only'; }
  let state: WorkspacePreferenceState = Object.freeze({ entries, status, revision: 0 });
  const listeners = new Set<() => void>();
  const getSnapshot = () => state;
  function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  function publish(next: readonly WorkspacePreferenceEntry[], nextStatus: WorkspacePreferenceState['status']) {
    state = Object.freeze({ entries: next, status: nextStatus, revision: state.revision + 1 });
    for (const listener of [...listeners]) listener();
  }
  function checkStorage(): boolean {
    if (!storage) return true;
    try {
      if (storage.getItem(WORKSPACE_PREFERENCES_KEY) === raw) return true;
      publish(state.entries, 'blocked'); return false;
    } catch { return state.status === 'session-only'; }
  }
  function mutate(action: WorkspacePreferenceMutation, revision: number): ProfileResult<readonly WorkspacePreferenceEntry[]> {
    if (state.status === 'blocked' || state.revision !== revision) return profileError('Workspace preferences changed or storage is blocked. Review again.');
    const next = mutateWorkspacePreferences(state.entries, action);
    if (!next.ok) return next;
    const encoded = serializeWorkspacePreferences(next.value);
    if (encoded.length > MAX_WORKSPACE_PREFERENCES_UNITS) return profileError('Workspace preference storage limit exceeded.');
    if (!checkStorage()) return profileError('Workspace preferences changed externally or could not be checked. Reload before editing.');
    let persistence: WorkspacePreferenceState['status'] = 'session-only';
    try {
      if (storage) { storage.setItem(WORKSPACE_PREFERENCES_KEY, encoded); raw = encoded; persistence = 'available'; }
    } catch { /* explicitly session only */ }
    publish(next.value, persistence);
    return next;
  }
  function reload(): ProfileResult<readonly WorkspacePreferenceEntry[]> {
    if (!storage) return profileError('Workspace preference storage unavailable.');
    try {
      const observed = storage.getItem(WORKSPACE_PREFERENCES_KEY);
      const parsed = parseWorkspacePreferences(observed);
      raw = observed;
      if (!parsed.ok) { publish(state.entries, 'blocked'); return parsed; }
      publish(parsed.value, 'available'); return parsed;
    } catch { return profileError('Could not reload workspace preferences.'); }
  }
  function discardUnreadable(revision: number): ProfileResult<readonly WorkspacePreferenceEntry[]> {
    if (!storage || state.status !== 'blocked' || revision !== state.revision) return profileError('Blocked workspace preference record changed.');
    try {
      const observed = storage.getItem(WORKSPACE_PREFERENCES_KEY);
      if (observed !== raw || parseWorkspacePreferences(observed).ok) return profileError('Record changed or is readable. Reload instead.');
      const empty = Object.freeze([]) as readonly WorkspacePreferenceEntry[];
      const encoded = serializeWorkspacePreferences(empty);
      storage.setItem(WORKSPACE_PREFERENCES_KEY, encoded); raw = encoded;
      publish(empty, 'available'); return { ok: true, value: empty };
    } catch { return profileError('Could not discard unreadable workspace preferences.'); }
  }
  function canApply(review: WorkspacePreferenceReview, root: string | null, current: StudioPortablePreferences): boolean {
    return workspacePreferenceReviewIsCurrent(review, state, root, current) && checkStorage();
  }
  return { getSnapshot, subscribe, mutate, reload, discardUnreadable, canApply };
}
function storageOrNull(): IntelliSenseStorage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
export const workspacePreferenceStore = createWorkspacePreferenceStore(storageOrNull());
