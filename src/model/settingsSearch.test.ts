import { describe, expect, it } from 'vitest';
import { matchingSettingsGroups, MAX_SETTINGS_QUERY_UNITS, SETTINGS_GROUPS } from './settingsSearch';

describe('settings search', () => {
  it('shows all groups for empty or whitespace-only queries', () => {
    expect(matchingSettingsGroups('')).toEqual(SETTINGS_GROUPS.map(group => group.id));
    expect(matchingSettingsGroups(' \t ')).toHaveLength(7);
  });
  it('matches case-insensitive words across group labels and aliases', () => {
    expect(matchingSettingsGroups('FONT family')).toEqual(['editor']);
    expect(matchingSettingsGroups('indentation guides')).toEqual(['editor']);
    expect(matchingSettingsGroups('autosave')).toEqual(['files']);
    expect(matchingSettingsGroups('output height')).toEqual(['layout']);
    expect(matchingSettingsGroups('dark')).toEqual(['appearance']);
    expect(matchingSettingsGroups('checkpoint')).toEqual(['recovery']);
    expect(matchingSettingsGroups('compiler path')).toEqual(['compiler']);
    expect(matchingSettingsGroups('startup discovery')).toEqual(['compiler']);
    expect(matchingSettingsGroups('parameter hints')).toEqual(['intellisense']);
    expect(matchingSettingsGroups('autocomplete')).toEqual(['intellisense']);
    expect(matchingSettingsGroups('export profiles')).toEqual(['intellisense']);
  });
  it('has no fuzzy guesses and always retains pending recovery review', () => {
    expect(matchingSettingsGroups('unmatched')).toEqual([]);
    expect(matchingSettingsGroups('font', true)).toEqual(['editor', 'recovery']);
    expect(matchingSettingsGroups('unmatched', true)).toEqual(['recovery']);
  });
  it('bounds the query before matching and never interprets regex input', () => {
    expect(matchingSettingsGroups('font' + ' '.repeat(MAX_SETTINGS_QUERY_UNITS) + 'unknown')).toEqual(['editor']);
    expect(matchingSettingsGroups('.*')).toEqual([]);
  });
});
