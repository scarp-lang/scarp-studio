import { describe, expect, it } from 'vitest';
import { DEFAULT_STUDIO_PORTABLE as defaults, captureStudioPreferences } from './studioPreferenceTransfer';
import { STUDIO_PROFILES_KEY, MAX_STUDIO_PROFILES, MAX_STUDIO_PROFILES_UNITS, parseStudioProfiles,
  serializeStudioProfiles, mutateStudioProfiles, createStudioProfilesStore } from './studioSavedProfiles';
const custom = captureStudioPreferences('light', { ...defaults.editor, fontSize: 20 },
  defaults.intelliSense, defaults.layout, defaults.files.autoSaveDelay);
const a = { name: 'Learning', preferences: defaults };
const b = { name: 'Work', preferences: custom };
function memory(initial: string | null = null) {
  let value = initial, writes = 0, fail = false;
  return {
    storage: { getItem(key: string) { expect(key).toBe(STUDIO_PROFILES_KEY); return value; },
      setItem(key: string, raw: string) { expect(key).toBe(STUDIO_PROFILES_KEY); if (fail) throw Error('quota'); value = raw; writes++; } },
    external(raw: string | null) { value = raw; }, setFail(next: boolean) { fail = next; },
    raw: () => value, writes: () => writes,
  };
}
describe('named Studio configuration model', () => {
  it('round trips independent complete snapshots without external properties', () => {
    const raw = serializeStudioProfiles([a, b]);
    const parsed = parseStudioProfiles(raw);
    expect(parsed).toEqual({ ok: true, value: [a, b] });
    if (!parsed.ok) throw Error(parsed.error);
    expect(Object.isFrozen(parsed.value)).toBe(true);
    expect(Object.isFrozen(parsed.value[0].preferences.editor)).toBe(true);
    expect(raw).not.toContain('"enabled"');
  });
  it('rejects malformed records atomically', () => {
    const raw = serializeStudioProfiles([a, b]);
    for (const invalid of ['', '{', 'null', raw.replace('"version":1', '"version":9'),
      raw.replace('"version":1', '"version":1,"version":1'),
      serializeStudioProfiles([a, { ...b, name: 'learning' }]),
      serializeStudioProfiles([{ ...a, name: '../path' }]), ' '.repeat(MAX_STUDIO_PROFILES_UNITS + 1)]) {
      expect(parseStudioProfiles(invalid).ok).toBe(false);
    }
  });
  it('enforces normalized names, capacity and exact reviewed mutations', () => {
    expect(mutateStudioProfiles([a], { kind: 'create', name: 'learning', preferences: custom }).ok).toBe(false);
    const result = mutateStudioProfiles([a], { kind: 'create', name: '  Work  ', preferences: custom });
    expect(result).toEqual({ ok: true, value: [a, b] });
    const full = Array.from({ length: MAX_STUDIO_PROFILES }, (_, i) => ({ name: 'Profile ' + i, preferences: defaults }));
    expect(mutateStudioProfiles(full, { kind: 'create', name: 'Extra', preferences: custom }).ok).toBe(false);
    expect(mutateStudioProfiles([a], { kind: 'remove', expected: { ...a, preferences: custom } }).ok).toBe(false);
    expect(mutateStudioProfiles([a, b], { kind: 'rename', expected: a, name: 'work' }).ok).toBe(false);
    expect(mutateStudioProfiles([a, b], { kind: 'rename', expected: a, name: 'Learner' })).toEqual({
      ok: true, value: [{ ...a, name: 'Learner' }, b],
    });
    expect(mutateStudioProfiles([a, b], { kind: 'replace', expected: a, preferences: custom })).toEqual({
      ok: true, value: [{ ...a, preferences: custom }, b],
    });
    expect(mutateStudioProfiles([a, b], { kind: 'remove', expected: a })).toEqual({ ok: true, value: [b] });
  });
});
describe('saved Studio configuration storage', () => {
  it('persists independent snapshots and rejects stale revisions', () => {
    const m = memory(); const store = createStudioProfilesStore(m.storage);
    let updates = 0; const unsub = store.subscribe(() => updates++);
    const revision = store.getSnapshot().revision;
    expect(store.mutate({ kind: 'create', name: a.name, preferences: defaults }, revision).ok).toBe(true);
    expect(store.mutate({ kind: 'create', name: b.name, preferences: custom }, revision).ok).toBe(false);
    expect(m.writes()).toBe(1);
    expect(updates).toBe(1); unsub();
    expect(createStudioProfilesStore(m.storage).getSnapshot().entries).toEqual([a]);
  });
  it('handles storage failures honestly and retries when available', () => {
    const m = memory(); const store = createStudioProfilesStore(m.storage); m.setFail(true);
    expect(store.mutate({ kind: 'create', name: a.name, preferences: defaults }, 0).ok).toBe(true);
    expect(store.getSnapshot().persistence).toBe('session-only');
    expect(m.raw()).toBeNull(); m.setFail(false);
    expect(store.mutate({ kind: 'create', name: b.name, preferences: custom }, 1).ok).toBe(true);
    expect(store.getSnapshot().persistence).toBe('available');
    expect(createStudioProfilesStore(m.storage).getSnapshot().entries).toEqual([a, b]);
  });
  it('protects external updates and unreadable records', () => {
    const m = memory(); const store = createStudioProfilesStore(m.storage);
    m.external(serializeStudioProfiles([b]));
    expect(store.mutate({ kind: 'create', name: a.name, preferences: defaults }, 0).ok).toBe(false);
    expect(store.getSnapshot().persistence).toBe('blocked');
    expect(store.discardBlocked(store.getSnapshot().revision).ok).toBe(false);
    expect(store.reload().ok).toBe(true);
    expect(store.getSnapshot().entries).toEqual([b]);
    m.external('{'); expect(store.reload().ok).toBe(false);
    expect(store.getSnapshot().entries).toEqual([b]);
    const revision = store.getSnapshot().revision;
    m.external('invalid');
    expect(store.discardBlocked(revision).ok).toBe(false);
    expect(store.reload().ok).toBe(false);
    expect(store.discardBlocked(store.getSnapshot().revision).ok).toBe(true);
    expect(store.getSnapshot().entries).toEqual([]);
  });
  it('works in a session with no storage', () => {
    const store = createStudioProfilesStore(null);
    expect(store.mutate({ kind: 'create', name: a.name, preferences: defaults }, 0).ok).toBe(true);
    expect(store.getSnapshot().persistence).toBe('session-only');
    expect(store.reload().ok).toBe(false);
  });
});
