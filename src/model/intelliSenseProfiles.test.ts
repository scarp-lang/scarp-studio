import { describe, expect, it } from 'vitest';
import { DEFAULT_INTELLISENSE_PREFERENCES as defaults, type IntelliSenseStorage } from './intelliSensePreferences';
import {
  MAX_PROFILE_NAME_UNITS, MAX_PROFILE_STORAGE_UNITS, MAX_SAVED_PROFILES, PROFILE_STORAGE_KEY,
  normalizeProfileName, profileIdentity, mutateSavedProfiles, parseSavedProfiles,
  serializeSavedProfiles, createSavedProfilesStore,
} from './intelliSenseProfiles';

function storage(initial: string | null = null) {
  let raw = initial;
  let fail = false;
  let writes = 0;
  const backend: IntelliSenseStorage = {
    getItem(key) { expect(key).toBe(PROFILE_STORAGE_KEY); return raw; },
    setItem(key, value) { expect(key).toBe(PROFILE_STORAGE_KEY); if (fail) throw Error('quota'); raw = value; writes++; },
  };
  return { backend, raw: () => raw, writes: () => writes,
    external: (value: string | null) => { raw = value; }, fail: (value: boolean) => { fail = value; } };
}
function saved(name: string, preferences = defaults) { return { name, preferences }; }
describe('named IntelliSense profile validation', () => {
  it('normalizes bounded Unicode names and rejects markup, paths and hidden controls', () => {
    expect(normalizeProfileName('  My   profile  ')).toBe('My profile');
    expect(normalizeProfileName('हिन्दी प्रोफ़ाइल')).toBe('हिन्दी प्रोफ़ाइल');
    expect(profileIdentity('CAFÉ')).toBe(profileIdentity('cafe\u0301'));
    for (const name of ['', ' ', '../name', '<name>', 'a/b', 'a\\b', 'a\nb', 'a\u202eb',
      'a'.repeat(MAX_PROFILE_NAME_UNITS + 1), '-name']) expect(normalizeProfileName(name)).toBeNull();
  });
  it('round-trips immutable complete profiles and rejects entire invalid records', () => {
    const raw = serializeSavedProfiles([saved('One'), saved('Two', { ...defaults, hover: false })]);
    const loaded = parseSavedProfiles(raw);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) throw Error(loaded.error);
    expect(loaded.value).toHaveLength(2);
    expect(Object.isFrozen(loaded.value)).toBe(true);
    expect(Object.isFrozen(loaded.value[0].preferences)).toBe(true);
    for (const invalid of ['', '{', 'null', '{"version":3,"profiles":[]}',
      JSON.stringify({ version: 2, profiles: [saved('One'), saved('one')] }),
      JSON.stringify({ version: 2, profiles: [saved('One'), { name: 'Bad', preferences: { hover: false } }] }),
      JSON.stringify({ version: 2, profiles: [saved('One')], extra: true }),
      ' '.repeat(MAX_PROFILE_STORAGE_UNITS + 1)]) expect(parseSavedProfiles(invalid).ok).toBe(false);
  });
  it('enforces capacity, duplicate names, and exact expected profile on mutations', () => {
    const one = saved('One');
    const initial = Object.freeze([one]);
    expect(mutateSavedProfiles(initial, { kind: 'create', name: 'one', preferences: defaults }).ok).toBe(false);
    const full = Array.from({ length: MAX_SAVED_PROFILES }, (_, i) => saved('Profile ' + i));
    expect(mutateSavedProfiles(full, { kind: 'create', name: 'Extra', preferences: defaults }).ok).toBe(false);
    const next = mutateSavedProfiles(initial, { kind: 'replace', expected: one, preferences: { ...defaults, hover: false } });
    expect(next.ok).toBe(true);
    if (!next.ok) throw Error(next.error);
    expect(next.value[0].preferences.hover).toBe(false);
    expect(initial[0].preferences.hover).toBe(true);
    expect(mutateSavedProfiles(next.value, { kind: 'delete', expected: one }).ok).toBe(false);
    expect(mutateSavedProfiles(next.value, { kind: 'delete', expected: next.value[0] })).toEqual({ ok: true, value: [] });
  });
});
describe('saved profile persistence', () => {
  it('persists isolated snapshots, subscribes and reloads across instances', () => {
    const m = storage();
    const store = createSavedProfilesStore(m.backend);
    let calls = 0;
    const off = store.subscribe(() => calls++);
    const source = { ...defaults };
    expect(store.mutate({ kind: 'create', name: 'One', preferences: source }).ok).toBe(true);
    source.hover = false;
    expect(store.getSnapshot().profiles[0].preferences.hover).toBe(true);
    expect(m.writes()).toBe(1);
    expect(calls).toBe(1);
    off();
    expect(createSavedProfilesStore(m.backend).getSnapshot().profiles[0].name).toBe('One');
    expect(store.mutate({ kind: 'delete', expected: store.getSnapshot().profiles[0] }).ok).toBe(true);
    expect(calls).toBe(1);
  });
  it('keeps session changes when storage writes fail', () => {
    const m = storage(); m.fail(true);
    const store = createSavedProfilesStore(m.backend);
    expect(store.mutate({ kind: 'create', name: 'Local', preferences: defaults }).ok).toBe(true);
    expect(store.getSnapshot().persistence).toBe('session-only');
    expect(store.getSnapshot().profiles).toHaveLength(1);
    expect(m.raw()).toBeNull();
    m.fail(false);
    expect(store.mutate({ kind: 'create', name: 'Another', preferences: defaults }).ok).toBe(true);
    expect(store.getSnapshot().persistence).toBe('available');
    expect(createSavedProfilesStore(m.backend).getSnapshot().profiles).toHaveLength(2);
  });
  it('does not overwrite malformed data until explicit discard', () => {
    const m = storage('{');
    const store = createSavedProfilesStore(m.backend);
    expect(store.getSnapshot().persistence).toBe('blocked');
    expect(store.mutate({ kind: 'create', name: 'One', preferences: defaults }).ok).toBe(false);
    expect(m.writes()).toBe(0);
    expect(store.discardBlocked().ok).toBe(true);
    expect(store.getSnapshot().persistence).toBe('available');
    expect(m.writes()).toBe(1);
  });
  it('detects external changes and refuses to discard a valid replacement', () => {
    const m = storage();
    const a = createSavedProfilesStore(m.backend);
    const b = createSavedProfilesStore(m.backend);
    expect(a.mutate({ kind: 'create', name: 'External', preferences: defaults }).ok).toBe(true);
    expect(b.mutate({ kind: 'create', name: 'Local', preferences: defaults }).ok).toBe(false);
    expect(b.getSnapshot().persistence).toBe('blocked');
    expect(b.discardBlocked().ok).toBe(false);
    expect(b.reload().ok).toBe(true);
    expect(b.getSnapshot().profiles.map(profile => profile.name)).toEqual(['External']);
    expect(b.mutate({ kind: 'create', name: 'Local', preferences: defaults }).ok).toBe(true);
    expect(createSavedProfilesStore(m.backend).getSnapshot().profiles.map(profile => profile.name)).toEqual(['External', 'Local']);
  });
  it('rejects discard of a changed unreadable record and supports unavailable storage', () => {
    const m = storage('{'); const store = createSavedProfilesStore(m.backend);
    m.external('invalid');
    expect(store.discardBlocked().ok).toBe(false);
    expect(m.raw()).toBe('invalid');
    expect(store.reload().ok).toBe(false);
    expect(store.discardBlocked().ok).toBe(true);
    const session = createSavedProfilesStore(null);
    expect(session.mutate({ kind: 'create', name: 'Temporary', preferences: defaults }).ok).toBe(true);
    expect(session.getSnapshot().persistence).toBe('session-only');
    expect(session.reload().ok).toBe(false);
  });
});


describe('profile rename and ambiguous storage', () => {
  it('renames only the exact reviewed profile and preserves its preferences', () => {
    const initial = [saved('Learning', { ...defaults, hover: false }), saved('Other')];
    const renamed = mutateSavedProfiles(initial, { kind: 'rename', expected: initial[0], name: 'Learning Hindi' });
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) throw Error(renamed.error);
    expect(renamed.value[0]).toEqual(saved('Learning Hindi', { ...defaults, hover: false }));
    expect(renamed.value[1]).toBe(initial[1]);
    expect(initial[0].name).toBe('Learning');
    expect(mutateSavedProfiles(renamed.value, { kind: 'rename', expected: initial[0], name: 'Stale' }).ok).toBe(false);
    expect(mutateSavedProfiles(initial, { kind: 'rename', expected: initial[0], name: 'other' }).ok).toBe(false);
    expect(mutateSavedProfiles(initial, { kind: 'rename', expected: initial[0], name: '../bad' }).ok).toBe(false);
    expect(mutateSavedProfiles(initial, { kind: 'rename', expected: initial[0], name: 'LEARNING' }).ok).toBe(true);
  });
  it('rejects duplicate stored keys rather than silently choosing a value', () => {
    const raw = serializeSavedProfiles([saved('One')]);
    expect(parseSavedProfiles(raw.replace('"version":2', '"version":2,"version":2')).ok).toBe(false);
    expect(parseSavedProfiles(raw.replace('"name":"One"', '"name":"One","name":"Two"')).ok).toBe(false);
  });
});


describe('saved profile schema migration', () => {
  it('loads v1 snapshots without overwriting storage, upgrades on next explicit mutation', () => {
    const { matchingMode: _matching, conservativeCatalog: _context, ...legacy } = { ...defaults, hover: false };
    const raw = JSON.stringify({ version: 1, profiles: [{ name: 'Old', preferences: legacy }] });
    const m = storage(raw);
    const store = createSavedProfilesStore(m.backend);
    expect(store.getSnapshot().profiles[0].preferences).toEqual({ ...defaults, hover: false });
    expect(m.writes()).toBe(0);
    expect(store.mutate({ kind: 'create', name: 'New', preferences: { ...defaults, matchingMode: 'subsequence' } }).ok).toBe(true);
    expect(JSON.parse(m.raw()!).version).toBe(2);
    expect(createSavedProfilesStore(m.backend).getSnapshot().profiles[0].preferences.hover).toBe(false);
  });
});
