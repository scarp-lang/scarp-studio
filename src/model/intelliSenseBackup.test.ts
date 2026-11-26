import { describe, expect, it } from 'vitest';
import { DEFAULT_INTELLISENSE_PREFERENCES as defaults, createIntelliSenseStore } from './intelliSensePreferences';
import {
  MAX_PROFILE_BACKUP_UNITS, MAX_SAVED_PROFILES, PROFILE_BACKUP_FORMAT, PROFILE_STORAGE_KEY,
  exportSavedProfileBackup, parseSavedProfileBackup, reviewSavedProfileBackup,
  backupReviewIsCurrent, createSavedProfilesStore, serializeSavedProfiles,
  type SavedIntelliSenseProfile,
} from './intelliSenseProfiles';

const profile = (name: string, preferences = defaults): SavedIntelliSenseProfile => ({ name, preferences });
const current = [profile('Learning'), profile('Other')];
const incoming = [profile('learning', { ...defaults, hover: false }), profile('New')];
const backup = exportSavedProfileBackup(incoming);

describe('profile collection backup envelope', () => {
  it('round-trips named snapshots and excludes unexpected fields', () => {
    const raw = exportSavedProfileBackup([{ ...profile('Learning'), secret: 'private' } as SavedIntelliSenseProfile]);
    expect(raw).not.toContain('private');
    expect(parseSavedProfileBackup(raw)).toEqual({ ok: true, value: [profile('Learning')] });
    expect(parseSavedProfileBackup(backup)).toEqual({ ok: true, value: incoming });
  });
  it('rejects wrong envelope, unsupported versions, duplicates and oversized input', () => {
    for (const raw of ['', '{', '{}', serializeSavedProfiles(incoming), backup.replace(PROFILE_BACKUP_FORMAT, 'other'),
      backup.replace('"version": 3', '"version": 999'), backup.replace('"version": 3', '"version": 3, "version": 3'),
      ' '.repeat(MAX_PROFILE_BACKUP_UNITS + 1), exportSavedProfileBackup([profile('A'), profile('a')])]) {
      expect(parseSavedProfileBackup(raw).ok).toBe(false);
    }
  });
  it('migrates previous versions using the same strict preference parser', () => {
    const { inlayHintMode: _mode, inlayBuiltins: _builtins, ...legacy } = defaults;
    const raw = JSON.stringify({ format: PROFILE_BACKUP_FORMAT, version: 2, profiles: [{ name: 'Old', preferences: legacy }] });
    expect(parseSavedProfileBackup(raw)).toEqual({ ok: true, value: [profile('Old')] });
  });
});
describe('reviewed merge policies', () => {
  it('keeps existing preferences by default and detects identical case-insensitive names', () => {
    const review = reviewSavedProfileBackup(current, backup, 'keep');
    if (!review.ok) throw Error(review.error);
    expect(review.value.actions.map(item => item.kind)).toEqual(['keep', 'add']);
    expect(review.value.result.map(item => item.name)).toEqual(['Learning', 'Other', 'New']);
    expect(review.value.result[0].preferences.hover).toBe(true);
    const identical = reviewSavedProfileBackup(current, exportSavedProfileBackup([profile('learning')]), 'replace');
    if (!identical.ok) throw Error(identical.error);
    expect(identical.value.actions[0].kind).toBe('same');
  });
  it('replaces only conflicting saved preferences without renaming or deleting', () => {
    const review = reviewSavedProfileBackup(current, backup, 'replace');
    if (!review.ok) throw Error(review.error);
    expect(review.value.actions[0]).toMatchObject({ kind: 'replace', targetName: 'Learning', changedPreferences: 1 });
    expect(review.value.result[0]).toEqual(profile('Learning', { ...defaults, hover: false }));
    expect(review.value.result[1]).toBe(current[1]);
    expect(current[0].preferences.hover).toBe(true);
  });
  it('renames conflicts deterministically without stealing existing or incoming names', () => {
    const raw = exportSavedProfileBackup([...incoming, profile('learning - imported')]);
    const review = reviewSavedProfileBackup(current, raw, 'rename');
    if (!review.ok) throw Error(review.error);
    expect(review.value.actions[0]).toMatchObject({ kind: 'rename', targetName: 'learning - imported 2' });
    expect(review.value.result.map(item => item.name)).toEqual(['Learning', 'Other', 'learning - imported 2', 'New', 'learning - imported']);
    expect(Object.isFrozen(review.value.actions[0])).toBe(true);
    expect(Object.isFrozen(review.value.result)).toBe(true);
  });
  it('enforces the capacity before mutation and rejects stale plans', () => {
    const full = Array.from({ length: MAX_SAVED_PROFILES }, (_, i) => profile('Profile ' + i));
    expect(reviewSavedProfileBackup(full, backup, 'keep').ok).toBe(false);
    const review = reviewSavedProfileBackup(current, backup, 'keep');
    if (!review.ok) throw Error(review.error);
    expect(backupReviewIsCurrent(review.value, current)).toBe(true);
    expect(backupReviewIsCurrent(review.value, [profile('Changed')])).toBe(false);
  });
});
describe('atomic reviewed collection updates', () => {
  it('writes once, leaves active settings untouched and rejects replay of changed baseline', () => {
    let raw: string | null = serializeSavedProfiles(current);
    let writes = 0;
    const store = createSavedProfilesStore({
      getItem: key => { expect(key).toBe(PROFILE_STORAGE_KEY); return raw; },
      setItem: (key, next) => { expect(key).toBe(PROFILE_STORAGE_KEY); raw = next; writes++; },
    });
    const active = createIntelliSenseStore(null);
    active.update({ completionMode: 'manual' });
    const review = reviewSavedProfileBackup(store.getSnapshot().profiles, backup, 'replace');
    if (!review.ok) throw Error(review.error);
    expect(store.applyBackup(review.value).ok).toBe(true);
    expect(writes).toBe(1);
    expect(store.getSnapshot().profiles).toHaveLength(3);
    expect(active.getSnapshot().preferences.completionMode).toBe('manual');
    expect(store.applyBackup(review.value).ok).toBe(false);
    expect(writes).toBe(1);
  });
  it('does not write for a no-op or trust a caller-supplied altered result', () => {
    let writes = 0;
    const store = createSavedProfilesStore({ getItem: () => serializeSavedProfiles(current), setItem: () => { writes++; } });
    const same = reviewSavedProfileBackup(store.getSnapshot().profiles, exportSavedProfileBackup(current), 'keep');
    if (!same.ok) throw Error(same.error);
    expect(store.applyBackup(same.value).ok).toBe(true);
    expect(writes).toBe(0);
    const review = reviewSavedProfileBackup(store.getSnapshot().profiles, backup, 'keep');
    if (!review.ok) throw Error(review.error);
    expect(store.applyBackup({ ...review.value, result: [] }).ok).toBe(false);
    expect(writes).toBe(0);
  });
  it('protects external updates and works with session-only storage', () => {
    let raw = serializeSavedProfiles(current);
    const store = createSavedProfilesStore({ getItem: () => raw, setItem: () => { throw Error('must not overwrite'); } });
    const review = reviewSavedProfileBackup(store.getSnapshot().profiles, backup, 'keep');
    if (!review.ok) throw Error(review.error);
    raw = serializeSavedProfiles([profile('External')]);
    expect(store.applyBackup(review.value).ok).toBe(false);
    expect(store.getSnapshot().persistence).toBe('blocked');
    const session = createSavedProfilesStore(null);
    const plan = reviewSavedProfileBackup([], backup, 'keep');
    if (!plan.ok) throw Error(plan.error);
    expect(session.applyBackup(plan.value).ok).toBe(true);
    expect(session.getSnapshot().persistence).toBe('session-only');
  });
});
