import { describe, expect, it } from 'vitest';
import { DEFAULT_STUDIO_PORTABLE as defaults, captureStudioPreferences } from './studioPreferenceTransfer';
import { createPreferenceHistory, MAX_PREFERENCE_HISTORY_ENTRIES, PREFERENCE_HISTORY_COALESCE_MS } from './preferenceHistory';
function font(size: 12 | 14 | 16 | 18 | 20 | 22 | 24) {
  return captureStudioPreferences('dark', { ...defaults.editor, fontSize: size }, defaults.intelliSense, defaults.layout, defaults.files.autoSaveDelay);
}
describe('bounded session preference history', () => {
  it('ignores no-ops and stores immutable portable snapshots only', () => {
    const history = createPreferenceHistory(defaults);
    expect(history.record(defaults, 0)).toBe(false);
    expect(history.record(font(18), 100)).toBe(true);
    const item = history.getSnapshot().entries[0];
    expect(item.changes).toMatchObject([{ key: 'fontSize', before: '14 px', after: '18 px' }]);
    expect(Object.isFrozen(item.before.editor)).toBe(true);
    expect(JSON.stringify(item)).not.toContain('compilerPath');
    expect(JSON.stringify(item)).not.toContain('"enabled"');
  });
  it('coalesces consecutive same-field changes and invalidates old IDs', () => {
    const history = createPreferenceHistory(defaults);
    history.record(font(16), 100);
    const old = history.getSnapshot().entries[0].id;
    history.record(font(18), 100 + PREFERENCE_HISTORY_COALESCE_MS);
    expect(history.getSnapshot().entries).toHaveLength(1);
    const merged = history.getSnapshot().entries[0];
    expect(merged.id).not.toBe(old);
    expect(merged.before.editor.fontSize).toBe(14);
    expect(merged.after.editor.fontSize).toBe(18);
    expect(history.review(old, 'before', font(18)).ok).toBe(false);
    history.record(font(14), 200 + PREFERENCE_HISTORY_COALESCE_MS);
    expect(history.getSnapshot().entries).toEqual([]);
  });
  it('does not merge separated changes, multiple fields or backwards clocks', () => {
    const history = createPreferenceHistory(defaults);
    history.record(font(16), 1000);
    history.record(font(18), 999);
    history.record(font(20), 999 + PREFERENCE_HISTORY_COALESCE_MS + 1);
    const other = { ...font(20), appearance: { ...defaults.appearance, theme: 'light' as const } };
    history.record(other, 2000);
    expect(history.getSnapshot().entries).toHaveLength(4);
  });
  it('bounds history size, keeps monotonic IDs after clear and notifies subscribers', () => {
    const history = createPreferenceHistory(defaults);
    let updates = 0; const off = history.subscribe(() => updates++);
    for (let i = 0; i < MAX_PREFERENCE_HISTORY_ENTRIES + 5; i++) history.record(font(i % 2 ? 16 : 18), i * 1000);
    const state = history.getSnapshot();
    expect(state.entries).toHaveLength(MAX_PREFERENCE_HISTORY_ENTRIES);
    const last = state.entries.at(-1)!.id;
    expect(history.clear(state.revision - 1, state.current)).toBe(false);
    expect(history.clear(state.revision, state.current)).toBe(true);
    expect(history.getSnapshot().entries).toEqual([]);
    expect(history.record(font(22), 50000)).toBe(true);
    expect(history.getSnapshot().entries[0].id).toBeGreaterThan(last);
    expect(updates).toBe(MAX_PREFERENCE_HISTORY_ENTRIES + 7);
    off();
  });
});
describe('reviewed history restore', () => {
  it('selectively restores historical groups and rejects stale active settings', () => {
    const history = createPreferenceHistory(defaults);
    const current = { ...font(18), appearance: { ...defaults.appearance, theme: 'light' as const } };
    history.record(current, 1000);
    const entry = history.getSnapshot().entries[0];
    const plan = history.review(entry.id, 'before', current, ['editor']);
    if (!plan.ok) throw Error(plan.error);
    expect(plan.value.review.target.editor.fontSize).toBe(14);
    expect(plan.value.review.target.appearance.theme).toBe('light');
    expect(history.canRestore(plan.value, current)).toBe(true);
    expect(history.canRestore(plan.value, defaults)).toBe(false);
    expect(history.review(entry.id, 'before', current, []).ok).toBe(false);
    history.clear(history.getSnapshot().revision, current);
    expect(history.canRestore(plan.value, current)).toBe(false);
  });
  it('does not trust a modified proposed target', () => {
    const history = createPreferenceHistory(defaults);
    history.record(font(18), 10);
    const current = history.getSnapshot().current;
    const result = history.review(history.getSnapshot().entries[0].id, 'before', current);
    if (!result.ok) throw Error(result.error);
    expect(history.canRestore({ ...result.value, review: { ...result.value.review, target: font(24) } }, current)).toBe(false);
  });
});
