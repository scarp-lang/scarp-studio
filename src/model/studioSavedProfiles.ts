import type { IntelliSenseStorage } from './intelliSensePreferences';
import { exactKeys, hasUniqueJsonKeys, profileError, recordOf, type ProfileResult } from './intelliSenseProfileTransfer';
import { normalizeProfileName, profileIdentity } from './intelliSenseProfiles';
import { exportStudioPreferences, importStudioPreferences, sameStudioPreferences, type StudioPortablePreferences } from './studioPreferenceTransfer';

export const STUDIO_PROFILES_KEY = 'studio.portableProfiles.v1';
export const MAX_STUDIO_PROFILES = 12;
export const MAX_STUDIO_PROFILES_UNITS = 131072;
export interface StudioSavedProfile {
  readonly name: string;
  readonly preferences: StudioPortablePreferences;
}
export interface StudioProfilesState {
  readonly entries: readonly StudioSavedProfile[];
  readonly persistence: 'available' | 'session-only' | 'blocked';
  readonly revision: number;
}
export type StudioProfileMutation =
  | { kind: 'create'; name: string; preferences: StudioPortablePreferences }
  | { kind: 'rename'; expected: StudioSavedProfile; name: string }
  | { kind: 'replace'; expected: StudioSavedProfile; preferences: StudioPortablePreferences }
  | { kind: 'remove'; expected: StudioSavedProfile };

function profile(name: string, prefs: StudioPortablePreferences): ProfileResult<StudioSavedProfile> {
  // Roundtrip canonical allowlisted preferences, with no external object
  // references or unvalidated data stored alongside the snapshot.
  const result = importStudioPreferences(exportStudioPreferences(prefs));
  return result.ok ? { ok: true, value: Object.freeze({ name, preferences: result.value }) } : result;
}
export function sameStudioProfile(a: StudioSavedProfile, b: StudioSavedProfile): boolean {
  return a.name === b.name && sameStudioPreferences(a.preferences, b.preferences);
}
export function serializeStudioProfiles(entries: readonly StudioSavedProfile[]): string {
  return JSON.stringify({ version: 1, profiles: entries.map(entry => ({
    name: entry.name, configuration: JSON.parse(exportStudioPreferences(entry.preferences)),
  })) });
}
export function parseStudioProfiles(raw: string | null): ProfileResult<readonly StudioSavedProfile[]> {
  if (raw === null) return { ok: true, value: Object.freeze([]) };
  if (raw.length > MAX_STUDIO_PROFILES_UNITS) return profileError('Saved Studio configurations exceed the storage limit.');
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return profileError('Saved Studio configurations contain invalid JSON.'); }
  if (!hasUniqueJsonKeys(raw)) return profileError('Saved Studio configurations contain duplicate keys or unsupported nesting.');
  const root = recordOf(data);
  if (!root || !exactKeys(root, ['version', 'profiles']) || root.version !== 1 || !Array.isArray(root.profiles)) {
    return profileError('Unsupported Studio configuration collection.');
  }
  if (root.profiles.length > MAX_STUDIO_PROFILES) return profileError('Too many saved Studio configurations.');
  const entries: StudioSavedProfile[] = [];
  const names = new Set<string>();
  for (const data of root.profiles) {
    const item = recordOf(data);
    if (!item || !exactKeys(item, ['name', 'configuration']) || typeof item.name !== 'string') {
      return profileError('Invalid saved Studio configuration.');
    }
    const name = normalizeProfileName(item.name);
    if (!name || name !== item.name || names.has(profileIdentity(name))) return profileError('Invalid or duplicate configuration name.');
    const prefs = importStudioPreferences(JSON.stringify(item.configuration));
    if (!prefs.ok) return prefs;
    entries.push(Object.freeze({ name, preferences: prefs.value }));
    names.add(profileIdentity(name));
  }
  return { ok: true, value: Object.freeze(entries) };
}
export function mutateStudioProfiles(entries: readonly StudioSavedProfile[], action: StudioProfileMutation):
  ProfileResult<readonly StudioSavedProfile[]> {
  if (action.kind === 'create') {
    const name = normalizeProfileName(action.name);
    if (!name) return profileError('Enter a valid configuration name (letters, numbers, spaces, hyphens or underscores).');
    if (entries.some(entry => profileIdentity(entry.name) === profileIdentity(name))) return profileError('A configuration with this name exists.');
    if (entries.length >= MAX_STUDIO_PROFILES) return profileError('Saved Studio configuration limit reached.');
    const item = profile(name, action.preferences);
    return item.ok ? { ok: true, value: Object.freeze([...entries, item.value]) } : item;
  }
  const index = entries.findIndex(entry => profileIdentity(entry.name) === profileIdentity(action.expected.name));
  if (index < 0 || !sameStudioProfile(entries[index], action.expected)) return profileError('Saved configuration changed. Review again.');
  if (action.kind === 'remove') return { ok: true, value: Object.freeze(entries.filter((_, i) => i !== index)) };
  let name = entries[index].name;
  if (action.kind === 'rename') {
    const normalized = normalizeProfileName(action.name);
    if (!normalized) return profileError('Enter a valid new name.');
    if (entries.some((entry, i) => i !== index && profileIdentity(entry.name) === profileIdentity(normalized))) {
      return profileError('A configuration with this name exists.');
    }
    name = normalized;
  }
  const item = profile(name, action.kind === 'replace' ? action.preferences : entries[index].preferences);
  if (!item.ok) return item;
  return { ok: true, value: Object.freeze(entries.map((entry, i) => i === index ? item.value : entry)) };
}

/** Local profile storage is deliberately independent of active preferences.
 * A write first checks the previously observed exact record. Read/write
 * errors retain an honest session-only state. No silent corruption repair. */
export function createStudioProfilesStore(storage: IntelliSenseStorage | null) {
  let raw: string | null = null;
  let entries: readonly StudioSavedProfile[] = Object.freeze([]);
  let persistence: StudioProfilesState['persistence'] = storage ? 'available' : 'session-only';
  try {
    if (storage) {
      raw = storage.getItem(STUDIO_PROFILES_KEY);
      const result = parseStudioProfiles(raw);
      if (result.ok) entries = result.value;
      else persistence = 'blocked';
    }
  } catch { persistence = 'session-only'; }
  let state: StudioProfilesState = Object.freeze({ entries, persistence, revision: 0 });
  const listeners = new Set<() => void>();
  const getSnapshot = () => state;
  function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  function publish(next: readonly StudioSavedProfile[], status: StudioProfilesState['persistence']) {
    state = Object.freeze({ entries: next, persistence: status, revision: state.revision + 1 });
    for (const listener of [...listeners]) listener();
  }
  function mutate(action: StudioProfileMutation, expectedRevision: number): ProfileResult<readonly StudioSavedProfile[]> {
    if (state.persistence === 'blocked') return profileError('Saved configuration storage is blocked. Reload before editing.');
    if (state.revision !== expectedRevision) return profileError('Saved configuration collection changed. Review again.');
    const next = mutateStudioProfiles(state.entries, action);
    if (!next.ok) return next;
    const encoded = serializeStudioProfiles(next.value);
    if (encoded.length > MAX_STUDIO_PROFILES_UNITS) return profileError('Configuration collection exceeds storage limit.');
    let status: StudioProfilesState['persistence'] = 'session-only';
    try {
      if (storage) {
        const observed = storage.getItem(STUDIO_PROFILES_KEY);
        if (observed !== raw) {
          publish(state.entries, 'blocked');
          return profileError('Saved configurations changed outside this session. Reload before editing.');
        }
        storage.setItem(STUDIO_PROFILES_KEY, encoded);
        raw = encoded;
        status = 'available';
      }
    } catch { /* explicit session-only fallback */ }
    publish(next.value, status);
    return next;
  }
  function reload(): ProfileResult<readonly StudioSavedProfile[]> {
    if (!storage) return profileError('Local configuration storage is unavailable.');
    try {
      const observed = storage.getItem(STUDIO_PROFILES_KEY);
      const result = parseStudioProfiles(observed);
      raw = observed;
      if (!result.ok) { publish(state.entries, 'blocked'); return result; }
      publish(result.value, 'available');
      return result;
    } catch { return profileError('Could not read saved Studio configurations.'); }
  }
  function discardBlocked(expectedRevision: number): ProfileResult<readonly StudioSavedProfile[]> {
    if (!storage || state.persistence !== 'blocked' || state.revision !== expectedRevision) {
      return profileError('The blocked configuration record changed. Review again.');
    }
    try {
      const observed = storage.getItem(STUDIO_PROFILES_KEY);
      if (observed !== raw || parseStudioProfiles(observed).ok) return profileError('Record changed or is readable. Reload instead.');
      const empty = Object.freeze([]) as readonly StudioSavedProfile[];
      const encoded = serializeStudioProfiles(empty);
      storage.setItem(STUDIO_PROFILES_KEY, encoded);
      raw = encoded;
      publish(empty, 'available');
      return { ok: true, value: empty };
    } catch { return profileError('Could not discard the unreadable configuration record.'); }
  }
  return { getSnapshot, subscribe, mutate, reload, discardBlocked };
}
function storageOrNull(): IntelliSenseStorage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
export const studioProfilesStore = createStudioProfilesStore(storageOrNull());
