import { serializeIntelliSensePreferences, type IntelliSensePreferences, type IntelliSenseStorage } from './intelliSensePreferences';
import { exactKeys, hasUniqueJsonKeys, profileError, recordOf, strictIntelliSensePreferences, PROFILE_FORMAT_VERSION, diffIntelliSensePreferences, type ProfileResult } from './intelliSenseProfileTransfer';

export const PROFILE_STORAGE_KEY = 'studio.intelliSenseProfiles.v1';
export const MAX_SAVED_PROFILES = 16;
export const MAX_PROFILE_NAME_UNITS = 48;
export const MAX_PROFILE_STORAGE_UNITS = 65536;

export interface SavedIntelliSenseProfile {
  readonly name: string;
  readonly preferences: Readonly<IntelliSensePreferences>;
}
export interface SavedProfileState {
  readonly profiles: readonly SavedIntelliSenseProfile[];
  readonly persistence: 'available' | 'session-only' | 'blocked';
}
export type ProfileMutation =
  | { kind: 'create'; name: string; preferences: Readonly<IntelliSensePreferences> }
  | { kind: 'replace'; expected: SavedIntelliSenseProfile; preferences: Readonly<IntelliSensePreferences> }
  | { kind: 'rename'; expected: SavedIntelliSenseProfile; name: string }
  | { kind: 'delete'; expected: SavedIntelliSenseProfile };

export function normalizeProfileName(raw: string): string | null {
  if (raw.length > MAX_PROFILE_NAME_UNITS) return null;
  const name = raw.trim().replace(/ +/g, ' ').normalize('NFC');
  // Unicode letters, combining marks and numbers are useful for local names.
  // Reject control characters, markup, paths and visually hidden formatting.
  return name.length <= MAX_PROFILE_NAME_UNITS && /^[\p{L}\p{N}][\p{L}\p{M}\p{N} _-]*$/u.test(name) ? name : null;
}
export function profileIdentity(name: string): string { return name.normalize('NFC').toLowerCase(); }
export function sameSavedProfile(a: SavedIntelliSenseProfile, b: SavedIntelliSenseProfile): boolean {
  return a.name === b.name && serializeIntelliSensePreferences(a.preferences) === serializeIntelliSensePreferences(b.preferences);
}
function frozenProfile(name: string, preferences: Readonly<IntelliSensePreferences>): SavedIntelliSenseProfile {
  return Object.freeze({ name, preferences: Object.freeze({ ...preferences }) });
}

export function parseSavedProfiles(raw: string | null): ProfileResult<readonly SavedIntelliSenseProfile[]> {
  if (raw === null) return { ok: true, value: Object.freeze([]) };
  if (raw.length > MAX_PROFILE_STORAGE_UNITS) return profileError('Saved profiles record is too large.');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return profileError('Saved profiles contain invalid JSON.'); }
  if (!hasUniqueJsonKeys(raw)) return profileError('Saved profiles contain duplicate keys or unsupported nesting.');
  const root = recordOf(value);
  if (!root || !exactKeys(root, ['version', 'profiles']) || (root.version !== 1 && root.version !== 2 && root.version !== PROFILE_FORMAT_VERSION) || !Array.isArray(root.profiles)) {
    return profileError('Saved profiles format is unsupported.');
  }
  if (root.profiles.length > MAX_SAVED_PROFILES) return profileError('Too many saved profiles.');
  const names = new Set<string>();
  const profiles: SavedIntelliSenseProfile[] = [];
  for (const value of root.profiles) {
    const item = recordOf(value);
    if (!item || !exactKeys(item, ['name', 'preferences']) || typeof item.name !== 'string') return profileError('Invalid saved profile.');
    const name = normalizeProfileName(item.name);
    if (!name || name !== item.name || names.has(profileIdentity(name))) return profileError('Invalid or duplicate profile name.');
    const preferences = strictIntelliSensePreferences(item.preferences, root.version);
    if (!preferences.ok) return preferences;
    names.add(profileIdentity(name));
    profiles.push(frozenProfile(name, preferences.value));
  }
  return { ok: true, value: Object.freeze(profiles) };
}
export function serializeSavedProfiles(profiles: readonly SavedIntelliSenseProfile[]): string {
  return JSON.stringify({ version: PROFILE_FORMAT_VERSION, profiles: profiles.map(profile => ({
    name: profile.name, preferences: JSON.parse(serializeIntelliSensePreferences(profile.preferences)),
  })) });
}
export function mutateSavedProfiles(profiles: readonly SavedIntelliSenseProfile[], mutation: ProfileMutation):
  ProfileResult<readonly SavedIntelliSenseProfile[]> {
  if (mutation.kind === 'create') {
    const name = normalizeProfileName(mutation.name);
    if (!name) return profileError('Use 1–48 letters, numbers, spaces, hyphens or underscores, starting with a letter or number.');
    if (profiles.some(profile => profileIdentity(profile.name) === profileIdentity(name))) return profileError('A profile with that name already exists.');
    if (profiles.length >= MAX_SAVED_PROFILES) return profileError('Saved profile limit reached. Remove a profile first.');
    const validated = strictIntelliSensePreferences(mutation.preferences);
    if (!validated.ok) return validated;
    return { ok: true, value: Object.freeze([...profiles, frozenProfile(name, validated.value)]) };
  }
  const index = profiles.findIndex(profile => profileIdentity(profile.name) === profileIdentity(mutation.expected.name));
  if (index < 0 || !sameSavedProfile(profiles[index], mutation.expected)) return profileError('Saved profile changed. Review it again.');
  if (mutation.kind === 'delete') return { ok: true, value: Object.freeze(profiles.filter((_, i) => i !== index)) };
  if (mutation.kind === 'rename') {
    const name = normalizeProfileName(mutation.name);
    if (!name) return profileError('Enter a valid new profile name.');
    if (profiles.some((profile, i) => i !== index && profileIdentity(profile.name) === profileIdentity(name))) {
      return profileError('A profile with that name already exists.');
    }
    return { ok: true, value: Object.freeze(profiles.map((profile, i) =>
      i === index ? frozenProfile(name, profile.preferences) : profile)) };
  }
  const validated = strictIntelliSensePreferences(mutation.preferences);
  if (!validated.ok) return validated;
  return { ok: true, value: Object.freeze(profiles.map((profile, i) =>
    i === index ? frozenProfile(profile.name, validated.value) : profile)) };
}

export const PROFILE_BACKUP_FORMAT = 'scarp-studio.intellisense-profiles';
export const MAX_PROFILE_BACKUP_UNITS = MAX_PROFILE_STORAGE_UNITS;
export const BACKUP_CONFLICT_POLICIES = ['keep', 'replace', 'rename'] as const;
export type BackupConflictPolicy = (typeof BACKUP_CONFLICT_POLICIES)[number];

export function exportSavedProfileBackup(profiles: readonly SavedIntelliSenseProfile[]): string {
  const collection = JSON.parse(serializeSavedProfiles(profiles)) as { version: number; profiles: unknown[] };
  return JSON.stringify({ format: PROFILE_BACKUP_FORMAT, ...collection }, null, 2);
}
export function parseSavedProfileBackup(raw: string): ProfileResult<readonly SavedIntelliSenseProfile[]> {
  if (raw.length > MAX_PROFILE_BACKUP_UNITS) return profileError('Profile backup is too large.');
  if (!raw.trim()) return profileError('Paste a saved-profile backup first.');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return profileError('Profile backup is not valid JSON.'); }
  if (!hasUniqueJsonKeys(raw)) return profileError('Profile backup contains duplicate keys or unsupported nesting.');
  const root = recordOf(value);
  if (!root || !exactKeys(root, ['format', 'version', 'profiles']) || root.format !== PROFILE_BACKUP_FORMAT) {
    return profileError('This is not a supported IntelliSense saved-profile backup.');
  }
  return parseSavedProfiles(JSON.stringify({ version: root.version, profiles: root.profiles }));
}
export interface BackupAction {
  readonly name: string;
  readonly targetName: string;
  readonly kind: 'add' | 'same' | 'keep' | 'replace' | 'rename';
  readonly changedPreferences: number;
}
export interface BackupReview {
  readonly baseline: string;
  readonly incoming: readonly SavedIntelliSenseProfile[];
  readonly policy: BackupConflictPolicy;
  readonly actions: readonly BackupAction[];
  readonly result: readonly SavedIntelliSenseProfile[];
}

/** Names use the same validator as manually created profiles. Reserve every
 * imported name up front so a generated suffix cannot steal a later entry. */
function alternateBackupName(name: string, used: ReadonlySet<string>): string | null {
  for (let i = 1; i <= MAX_SAVED_PROFILES * 2; i++) {
    const suffix = i === 1 ? ' - imported' : ' - imported ' + i;
    let base = '';
    for (const char of name) {
      if (base.length + char.length + suffix.length > MAX_PROFILE_NAME_UNITS) break;
      base += char;
    }
    const candidate = normalizeProfileName(base.trimEnd() + suffix);
    if (candidate && !used.has(profileIdentity(candidate))) return candidate;
  }
  return null;
}

/** Pure all-or-nothing merge planning. Existing profiles are never removed;
 * a conflicting replacement affects only its saved preferences, not the
 * currently active editor configuration or name. */
export function reviewSavedProfileBackup(current: readonly SavedIntelliSenseProfile[], raw: string,
  policy: BackupConflictPolicy): ProfileResult<BackupReview> {
  if (!BACKUP_CONFLICT_POLICIES.includes(policy)) return profileError('Unsupported backup conflict policy.');
  const parsed = parseSavedProfileBackup(raw);
  if (!parsed.ok) return parsed;
  const incoming = parsed.value;
  const result = [...current];
  const actions: BackupAction[] = [];
  const used = new Set([...current, ...incoming].map(profile => profileIdentity(profile.name)));
  for (const profile of incoming) {
    const identity = profileIdentity(profile.name);
    const index = result.findIndex(existing => profileIdentity(existing.name) === identity);
    if (index < 0) {
      result.push(profile);
      actions.push({ name: profile.name, targetName: profile.name, kind: 'add', changedPreferences: 0 });
      continue;
    }
    const existing = result[index];
    const changes = diffIntelliSensePreferences(existing.preferences, profile.preferences).length;
    if (!changes) {
      actions.push({ name: profile.name, targetName: existing.name, kind: 'same', changedPreferences: 0 });
    } else if (policy === 'keep') {
      actions.push({ name: profile.name, targetName: existing.name, kind: 'keep', changedPreferences: changes });
    } else if (policy === 'replace') {
      result[index] = frozenProfile(existing.name, profile.preferences);
      actions.push({ name: profile.name, targetName: existing.name, kind: 'replace', changedPreferences: changes });
    } else {
      const name = alternateBackupName(profile.name, used);
      if (!name) return profileError('No available name for imported profile. Choose another conflict policy.');
      used.add(profileIdentity(name));
      result.push(frozenProfile(name, profile.preferences));
      actions.push({ name: profile.name, targetName: name, kind: 'rename', changedPreferences: changes });
    }
  }
  if (result.length > MAX_SAVED_PROFILES) {
    return profileError('Backup merge would exceed the ' + MAX_SAVED_PROFILES + '-profile limit (' + result.length + ' total). No profiles were changed.');
  }
  return { ok: true, value: Object.freeze({
    baseline: serializeSavedProfiles(current), incoming, policy,
    actions: Object.freeze(actions.map(action => Object.freeze(action))),
    result: Object.freeze(result),
  }) };
}
export function backupReviewIsCurrent(review: BackupReview, current: readonly SavedIntelliSenseProfile[]): boolean {
  return review.baseline === serializeSavedProfiles(current);
}

/** Independent profile storage: active preference reset never touches this
 * collection. Invalid storage is blocked until an explicit discard action. */
export function createSavedProfilesStore(storage: IntelliSenseStorage | null) {
  let initial: readonly SavedIntelliSenseProfile[] = Object.freeze([]);
  let persistence: SavedProfileState['persistence'] = storage ? 'available' : 'session-only';
  let persistedRaw: string | null = null;
  try {
    if (storage) {
      persistedRaw = storage.getItem(PROFILE_STORAGE_KEY);
      const loaded = parseSavedProfiles(persistedRaw);
      if (loaded.ok) initial = loaded.value;
      else persistence = 'blocked';
    }
  } catch { persistence = 'session-only'; }
  let state: SavedProfileState = Object.freeze({ profiles: initial, persistence });
  const listeners = new Set<() => void>();
  const getSnapshot = () => state;
  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }
  function publish(profiles: readonly SavedIntelliSenseProfile[], status: SavedProfileState['persistence']) {
    state = Object.freeze({ profiles, persistence: status });
    for (const listener of [...listeners]) listener();
  }
  function save(profiles: readonly SavedIntelliSenseProfile[]): ProfileResult<readonly SavedIntelliSenseProfile[]> {
    const encoded = serializeSavedProfiles(profiles);
    let status: SavedProfileState['persistence'] = 'session-only';
    if (storage) {
      try {
        // Prevent overwriting data changed in another Studio window since load.
        const currentRaw = storage.getItem(PROFILE_STORAGE_KEY);
        if (currentRaw !== persistedRaw) {
          publish(state.profiles, 'blocked');
          return profileError('Saved profiles changed outside this session. Reload saved profiles before editing.');
        }
        storage.setItem(PROFILE_STORAGE_KEY, encoded);
        persistedRaw = encoded;
        status = 'available';
      } catch { /* Keep the requested in-memory changes, without claiming persistence. */ }
    }
    publish(profiles, status);
    return { ok: true, value: profiles };
  }
  function mutate(mutation: ProfileMutation): ProfileResult<readonly SavedIntelliSenseProfile[]> {
    if (state.persistence === 'blocked') return profileError('Saved profile storage is blocked. Reload or explicitly discard the unreadable record.');
    const next = mutateSavedProfiles(state.profiles, mutation);
    return next.ok ? save(next.value) : next;
  }
  function applyBackup(review: BackupReview): ProfileResult<readonly SavedIntelliSenseProfile[]> {
    if (state.persistence === 'blocked') return profileError('Saved profile storage is blocked. Reload before importing.');
    if (!backupReviewIsCurrent(review, state.profiles)) return profileError('Saved profiles changed since review. Review the backup again.');
    // Recompute from validated input; never accept a caller-supplied result
    // array as an unchecked storage mutation.
    const fresh = reviewSavedProfileBackup(state.profiles, exportSavedProfileBackup(review.incoming), review.policy);
    if (!fresh.ok) return fresh;
    if (serializeSavedProfiles(fresh.value.result) !== serializeSavedProfiles(review.result)) {
      return profileError('Backup review no longer matches the proposed merge.');
    }
    if (serializeSavedProfiles(fresh.value.result) === review.baseline) return { ok: true, value: state.profiles };
    return save(fresh.value.result);
  }
  function reload(): ProfileResult<readonly SavedIntelliSenseProfile[]> {
    if (!storage) return profileError('Local storage is unavailable.');
    try {
      const raw = storage.getItem(PROFILE_STORAGE_KEY);
      const parsed = parseSavedProfiles(raw);
      if (!parsed.ok) { persistedRaw = raw; publish(state.profiles, 'blocked'); return parsed; }
      persistedRaw = raw;
      publish(parsed.value, 'available');
      return parsed;
    } catch { return profileError('Could not read saved profiles.'); }
  }
  function discardBlocked(): ProfileResult<readonly SavedIntelliSenseProfile[]> {
    if (!storage || state.persistence !== 'blocked') return profileError('There is no blocked profile record to discard.');
    try {
      const raw = storage.getItem(PROFILE_STORAGE_KEY);
      // Only discard the specific unreadable record that was reviewed; a valid
      // external update is never discarded, even if this window was blocked.
      if (raw !== persistedRaw || parseSavedProfiles(raw).ok) return profileError('The stored record changed or is valid. Reload it instead.');
      const encoded = serializeSavedProfiles([]);
      storage.setItem(PROFILE_STORAGE_KEY, encoded);
      persistedRaw = encoded;
      const empty = Object.freeze([]) as readonly SavedIntelliSenseProfile[];
      publish(empty, 'available');
      return { ok: true, value: empty };
    } catch { return profileError('Could not discard the unreadable profile record.'); }
  }
  return { getSnapshot, subscribe, mutate, applyBackup, reload, discardBlocked };
}
function storageOrNull(): IntelliSenseStorage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; }
  catch { return null; }
}
export const savedProfilesStore = createSavedProfilesStore(storageOrNull());
