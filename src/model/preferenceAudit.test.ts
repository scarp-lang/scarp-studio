import { describe, expect, it } from 'vitest';
import { DEFAULT_STUDIO_PORTABLE as defaults, PORTABLE_GROUPS, type StudioPortablePreferences } from './studioPreferenceTransfer';
import { buildPreferenceAudit, filterPreferenceAudit, auditTextReport, reviewSelectiveReset, selectiveResetIsCurrent } from './preferenceAudit';
const customized: StudioPortablePreferences = {
  ...defaults, appearance: { ...defaults.appearance, theme: 'light', contrast: 'high' },
  editor: { ...defaults.editor, fontSize: 20, lineHeight: 28 },
  intelliSense: { ...defaults.intelliSense, completionMode: 'manual', hover: false },
  files: { autoSaveDelay: 5000 },
};
describe('complete portable preference audit', () => {
  it('covers every portable field once, including unchanged advanced settings', () => {
    const audit = buildPreferenceAudit(defaults);
    expect(audit.total).toBe(PORTABLE_GROUPS.reduce((count, group) => count + Object.keys(defaults[group]).length, 0));
    expect(new Set(audit.rows.map(row => row.id)).size).toBe(audit.total);
    expect(audit.modified).toBe(0);
    expect(audit.groups.map(group => group.group)).toEqual(PORTABLE_GROUPS);
    expect(audit.rows.every(row => row.defaultValue === row.currentValue)).toBe(true);
    expect(Object.isFrozen(audit.rows)).toBe(true);
    expect(Object.isFrozen(audit.rows[0])).toBe(true);
  });
  it('counts modifications and filters by search, category and status', () => {
    const audit = buildPreferenceAudit(customized);
    expect(audit.modified).toBe(7);
    expect(audit.groups.find(group => group.group === 'editor')?.modified).toBe(2);
    expect(filterPreferenceAudit(audit, 'line height', 'editor', true).map(row => row.id)).toEqual(['editor:lineHeight']);
    expect(filterPreferenceAudit(audit, '20 px', 'all', true).map(row => row.id)).toEqual(['editor:fontSize']);
    expect(filterPreferenceAudit(audit, '', 'layout', true)).toEqual([]);
    expect(filterPreferenceAudit(audit, '', 'all', true)).toHaveLength(7);
    expect(filterPreferenceAudit(audit, 'dark light', 'appearance', false).map(row => row.id)).toEqual(['appearance:theme']);
  });
  it('generates deterministic copyable reports without nonportable data', () => {
    const audit = buildPreferenceAudit(customized);
    const report = auditTextReport(audit, true);
    expect(report).toContain('Modified: 7 / ');
    expect(report).toContain('Color theme: light (default: dark)');
    expect(report).not.toContain('Explorer width:');
    expect(auditTextReport(audit, false)).toContain('Explorer width:');
    expect(report).not.toContain('studio.shortcuts.v1');
    expect(report).not.toContain('compilerPath');
  });
});
describe('reviewed individual portable setting resets', () => {
  it('resets precise fields across categories and preserves other changes', () => {
    const result = reviewSelectiveReset(customized, ['editor:lineHeight', 'appearance:contrast', 'intelliSense:hover']);
    if (!result.ok) throw Error(result.error);
    const target = result.value.target;
    expect(target.appearance.theme).toBe('light');
    expect(target.appearance.contrast).toBe(defaults.appearance.contrast);
    expect(target.editor.lineHeight).toBe(defaults.editor.lineHeight);
    expect(target.editor.fontSize).toBe(20);
    expect(target.intelliSense.hover).toBe(defaults.intelliSense.hover);
    expect(target.intelliSense.completionMode).toBe('manual');
    expect(target.files.autoSaveDelay).toBe(5000);
    expect(result.value.changes).toHaveLength(3);
    expect(selectiveResetIsCurrent(result.value, customized)).toBe(true);
    expect(selectiveResetIsCurrent(result.value, target)).toBe(false);
  });
  it('rejects unknown IDs, duplicate selections and requests affecting local trust', () => {
    for (const ids of [[], ['appearance:theme', 'appearance:theme'], ['files:enabled'],
      ['compiler:path'], ['shortcuts:save'], ['editor:__proto__'], ['layout:explorerWidth']]) {
      expect(reviewSelectiveReset(customized, ids).ok).toBe(false);
    }
  });
  it('does not accept a tampered target even if the baseline is current', () => {
    const result = reviewSelectiveReset(customized, ['editor:fontSize']);
    if (!result.ok) throw Error(result.error);
    expect(selectiveResetIsCurrent({ ...result.value, target: defaults }, customized)).toBe(false);
    expect(selectiveResetIsCurrent({ ...result.value, selected: ['files:enabled'] }, customized)).toBe(false);
    expect(selectiveResetIsCurrent(result.value, { ...customized, files: { autoSaveDelay: 1000 } })).toBe(false);
  });
});
