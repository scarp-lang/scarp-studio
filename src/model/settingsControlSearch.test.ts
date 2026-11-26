import { describe, expect, it } from 'vitest';
import { SETTINGS_CONTROL_INDEX, searchSettingsControls, settingsVisibleGroups, MAX_SETTINGS_RESULTS } from './settingsControlSearch';
import { SETTINGS_GROUPS } from './settingsSearch';
import { EDITOR_EXPERIENCE_LABELS } from './editorExperience';
import { INTELLISENSE_CONTROL_INDEX } from './intelliSenseSettingsIndex';
import { SHORTCUT_COMMANDS } from './studioShortcuts';
describe('global Settings control search', () => {
  it('indexes distinct stable IDs and every advanced/editor/shortcut preference', () => {
    expect(new Set(SETTINGS_CONTROL_INDEX.map(entry => entry.id)).size).toBe(SETTINGS_CONTROL_INDEX.length);
    expect(SETTINGS_CONTROL_INDEX.filter(entry => entry.id.startsWith('experience:'))).toHaveLength(Object.keys(EDITOR_EXPERIENCE_LABELS).length);
    expect(SETTINGS_CONTROL_INDEX.filter(entry => entry.id.startsWith('intellisense:'))).toHaveLength(Object.keys(INTELLISENSE_CONTROL_INDEX).length);
    expect(SETTINGS_CONTROL_INDEX.filter(entry => entry.id.startsWith('shortcut:'))).toHaveLength(SHORTCUT_COMMANDS.length);
    expect(SETTINGS_CONTROL_INDEX.every(entry => /^[A-Za-z0-9_-]+$/.test(entry.target))).toBe(true);
  });
  it('ranks exact control labels and maps nested controls correctly', () => {
    expect(searchSettingsControls('LINE HEIGHT').entries[0]).toMatchObject({ group: 'editor', target: 'editor-experience-lineHeight' });
    expect(searchSettingsControls('inline parameter labels').entries[0]).toMatchObject({ group: 'intellisense', target: 'intellisense-inlay-mode' });
    expect(searchSettingsControls('auto save delay').entries[0]).toMatchObject({ group: 'files', target: 'studio-auto-save-delay' });
    expect(searchSettingsControls('Ctrl+Shift+S').entries.some(entry => entry.target === 'studio-shortcut-save-as')).toBe(true);
  });
  it('bounds and ranks search results deterministically', () => {
    expect(searchSettingsControls('').entries).toEqual([]);
    expect(searchSettingsControls('z'.repeat(9000)).total).toBe(0);
    expect(searchSettingsControls('a').entries.length).toBeLessThanOrEqual(MAX_SETTINGS_RESULTS);
    expect(searchSettingsControls('editor')).toEqual(searchSettingsControls('  EDITOR  '));
  });
  it('supports category focus and preserves forced recovery in all modes', () => {
    expect(settingsVisibleGroups('', 'all', false)).toEqual(SETTINGS_GROUPS.map(group => group.id));
    expect(settingsVisibleGroups('', 'editor', false)).toEqual(['editor']);
    expect(settingsVisibleGroups('', 'editor', true)).toEqual(['editor', 'recovery']);
    expect(settingsVisibleGroups('line height', 'files', false)).toContain('editor');
    expect(settingsVisibleGroups('notfound', 'all', true)).toEqual(['recovery']);
  });
});
