import { describe, expect, it } from 'vitest';
import { DEFAULT_STUDIO_PORTABLE as defaults, captureStudioPreferences } from './studioPreferenceTransfer';
import { MAX_WORKSPACE_PREFERENCES, MAX_WORKSPACE_PREFERENCES_UNITS, WORKSPACE_PREFERENCES_KEY,
  captureWorkspacePreference, findWorkspacePreference, serializeWorkspacePreferences, parseWorkspacePreferences,
  mutateWorkspacePreferences, createWorkspacePreferenceStore, reviewWorkspacePreference, workspacePreferenceReviewIsCurrent,
  type WorkspacePreferenceEntry } from './workspacePreferences';
const custom = captureStudioPreferences('light', { ...defaults.editor, fontSize: 20 }, defaults.intelliSense, defaults.layout, 5000);
const root = 'C:/Work/Scarp';
function entry(path = root): WorkspacePreferenceEntry {
  const result = captureWorkspacePreference(path, custom, ['appearance', 'editor']);
  if (!result.ok) throw Error(result.error);
  return result.value;
}
describe('workspace preference metadata', () => {
  it('captures only selected categories and validates native root-shaped keys', () => {
    const value = entry();
    expect(value.preferences.appearance.theme).toBe('light');
    expect(value.preferences.editor.fontSize).toBe(20);
    expect(value.preferences.files.autoSaveDelay).toBe(defaults.files.autoSaveDelay);
    expect(value.groups).toEqual(['appearance', 'editor']);
    for (const path of [null, '', 'relative/path', 'C:relative', 'C:/bad\0']) {
      expect(captureWorkspacePreference(path, custom, ['editor']).ok).toBe(false);
    }
    expect(captureWorkspacePreference(root, custom, []).ok).toBe(false);
    expect(Object.isFrozen(value.preferences.editor)).toBe(true);
  });
  it('matches Windows path aliases but not different POSIX case or sibling projects', () => {
    expect(findWorkspacePreference([entry()], 'c:\\work\\SCARP')).not.toBeNull();
    expect(findWorkspacePreference([entry()], 'C:/Work/Scarp/Child')).toBeNull();
    expect(findWorkspacePreference([entry('/tmp/Scarp')], '/tmp/scarp')).toBeNull();
    expect(findWorkspacePreference([entry()], null)).toBeNull();
  });
  it('round trips strict bounded associations without exporting authorization', () => {
    const raw = serializeWorkspacePreferences([entry()]);
    expect(parseWorkspacePreferences(raw)).toEqual({ ok: true, value: [entry()] });
    expect(raw).not.toContain('"enabled"');
    for (const invalid of ['{}', '{', 'null', ' '.repeat(MAX_WORKSPACE_PREFERENCES_UNITS + 1),
      raw.replace('"version":1', '"version":1,"version":1'), serializeWorkspacePreferences([entry(), entry('c:/work/scarp')])]) {
      expect(parseWorkspacePreferences(invalid).ok).toBe(false);
    }
  });
  it('enforces exact review and capacity for replacements and removals', () => {
    const value = entry();
    expect(mutateWorkspacePreferences([value], { kind: 'remember', entry: value, expected: null }).ok).toBe(false);
    expect(mutateWorkspacePreferences([value], { kind: 'forget', expected: entry('C:/different') }).ok).toBe(false);
    expect(mutateWorkspacePreferences([value], { kind: 'forget', expected: value })).toEqual({ ok: true, value: [] });
    const full = Array.from({ length: MAX_WORKSPACE_PREFERENCES }, (_, i) => entry('C:/Work/Folder' + i));
    expect(mutateWorkspacePreferences(full, { kind: 'remember', entry: value, expected: null }).ok).toBe(false);
  });
});
describe('reviewed workspace association apply', () => {
  it('applies selected categories only and invalidates root, baseline and store revisions', () => {
    const store = createWorkspacePreferenceStore(null);
    store.mutate({ kind: 'remember', entry: entry(), expected: null }, 0);
    const state = store.getSnapshot();
    const review = reviewWorkspacePreference(state, root, defaults);
    if (!review.ok) throw Error(review.error);
    expect(review.value.review.target.appearance.theme).toBe('light');
    expect(review.value.review.target.files.autoSaveDelay).toBe(defaults.files.autoSaveDelay);
    expect(workspacePreferenceReviewIsCurrent(review.value, state, root, defaults)).toBe(true);
    expect(workspacePreferenceReviewIsCurrent(review.value, state, 'C:/other', defaults)).toBe(false);
    expect(workspacePreferenceReviewIsCurrent(review.value, state, root, custom)).toBe(false);
    store.mutate({ kind: 'forget', expected: entry() }, state.revision);
    expect(store.canApply(review.value, root, defaults)).toBe(false);
  });
  it('detects external storage changes before applying or mutating', () => {
    let raw: string | null = serializeWorkspacePreferences([entry()]);
    let writes = 0;
    const store = createWorkspacePreferenceStore({
      getItem: key => { expect(key).toBe(WORKSPACE_PREFERENCES_KEY); return raw; },
      setItem: (key, value) => { expect(key).toBe(WORKSPACE_PREFERENCES_KEY); writes++; raw = value; },
    });
    const review = reviewWorkspacePreference(store.getSnapshot(), root, defaults);
    if (!review.ok) throw Error(review.error);
    raw = serializeWorkspacePreferences([entry('C:/different')]);
    expect(store.canApply(review.value, root, defaults)).toBe(false);
    expect(store.getSnapshot().status).toBe('blocked');
    expect(store.discardUnreadable(store.getSnapshot().revision).ok).toBe(false);
    expect(writes).toBe(0);
    expect(store.reload().ok).toBe(true);
    expect(store.getSnapshot().entries[0].root).toBe('C:/different');
  });
  it('allows explicit recovery only for the exact unreadable record', () => {
    let raw = '{';
    const store = createWorkspacePreferenceStore({ getItem: () => raw, setItem: (_, value) => { raw = value; } });
    expect(store.getSnapshot().status).toBe('blocked');
    raw = 'invalid';
    expect(store.discardUnreadable(0).ok).toBe(false);
    expect(store.reload().ok).toBe(false);
    expect(store.discardUnreadable(store.getSnapshot().revision).ok).toBe(true);
    expect(store.getSnapshot().entries).toEqual([]);
  });
});
