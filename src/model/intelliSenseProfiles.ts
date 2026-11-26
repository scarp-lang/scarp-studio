import { serializeIntelliSensePreferences, type IntelliSensePreferences, type IntelliSenseStorage } from './intelliSensePreferences';
import { exactKeys, hasUniqueJsonKeys, profileError, recordOf, strictIntelliSensePreferences, type ProfileResult } from './intelliSenseProfileTransfer';

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
  if (!root || !exactKeys(root, ['version', 'profiles']) || (root.version !== 1 && root.version !== 2) || !Array.isArray(root.profiles)) {
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
  return JSON.stringify({ version: 2, profiles: profiles.map(profile => ({
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
  return { getSnapshot, subscribe, mutate, reload, discardBlocked };
}
function storageOrNull(): IntelliSenseStorage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; }
  catch { return null; }
}
export const savedProfilesStore = createSavedProfilesStore(storageOrNull());
