import { describe, expect, it } from 'vitest';
import { DEFAULT_INTELLISENSE_PREFERENCES as defaults, createIntelliSenseStore } from './intelliSensePreferences';
import { INTELLISENSE_CONTROL_INDEX, matchIntelliSenseControls, resetIntelliSensePreference, MAX_INTELLISENSE_SEARCH_UNITS } from './intelliSenseSettingsIndex';

describe('fine-grained IntelliSense preference discovery', () => {
  it('indexes every supported preference exactly once', () => {
    expect(Object.keys(INTELLISENSE_CONTROL_INDEX).sort()).toEqual(Object.keys(defaults).sort());
    expect(matchIntelliSenseControls(defaults, '')).toHaveLength(Object.keys(defaults).length);
    for (const item of Object.values(INTELLISENSE_CONTROL_INDEX)) expect(item.label.trim()).not.toBe('');
  });
  it('matches case-insensitive aliases and all search terms without using source text', () => {
    expect(matchIntelliSenseControls(defaults, '  F12  ')).toEqual(['goToDefinition']);
    expect(matchIntelliSenseControls(defaults, 'INLAY LITERAL')).toEqual(['inlayHintMode']);
    expect(matchIntelliSenseControls(defaults, 'local tooltip')).toEqual(['localFunctionHover']);
    expect(matchIntelliSenseControls(defaults, 'modified unknown')).toEqual([]);
    expect(matchIntelliSenseControls(defaults, ' '.repeat(MAX_INTELLISENSE_SEARCH_UNITS) + 'f12')).toHaveLength(Object.keys(defaults).length);
  });
  it('combines text with modified-only filtering', () => {
    const changed = { ...defaults, hoverDelay: 750 as const, suggestionDelay: 500 as const, inlayHintMode: 'all' as const };
    expect(matchIntelliSenseControls(defaults, '', true)).toEqual([]);
    expect(matchIntelliSenseControls(changed, '', true)).toEqual(['suggestionDelay', 'hoverDelay', 'inlayHintMode']);
    expect(matchIntelliSenseControls(changed, 'delay', true)).toEqual(['suggestionDelay', 'hoverDelay']);
  });
  it('reset patches change exactly one preference and preserve unrelated settings', () => {
    const store = createIntelliSenseStore(null);
    store.update({ hover: false, suggestionLimit: 10, inlayHintMode: 'all' });
    expect(resetIntelliSensePreference('hover')).toEqual({ hover: true });
    store.update(resetIntelliSensePreference('hover'));
    expect(store.getSnapshot().preferences).toEqual({ ...defaults, suggestionLimit: 10, inlayHintMode: 'all' });
    for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
      expect(Object.keys(resetIntelliSensePreference(key))).toEqual([key]);
      expect(resetIntelliSensePreference(key)[key]).toBe(defaults[key]);
    }
  });
});
