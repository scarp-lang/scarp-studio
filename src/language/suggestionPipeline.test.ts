import { describe, expect, it } from 'vitest';
import { DEFAULT_INTELLISENSE_PREFERENCES as defaults } from '../model/intelliSensePreferences';
import { collectScarpSuggestions, scarpCompletionEnabled } from './suggestionPipeline';
const local = [{ name: 'print_total', detail: 'print_total(value: integer)' }];

describe('shared completion policy', () => {
  it('does no local work for off, all sources disabled, or oversized prefix', () => {
    const forbidden = () => { throw Error('local work must be skipped'); };
    expect(collectScarpSuggestions({ ...defaults, completionMode: 'off' }, 'pri', forbidden)).toEqual([]);
    const none = { ...defaults, templates: false, builtins: false, keywordsAndTypes: false, localFunctions: false };
    expect(scarpCompletionEnabled(none)).toBe(false);
    expect(collectScarpSuggestions(none, 'pri', forbidden)).toEqual([]);
    expect(collectScarpSuggestions(defaults, 'x'.repeat(129), forbidden)).toEqual([]);
    expect(collectScarpSuggestions({ ...defaults, localFunctions: false }, 'pri', forbidden).length).toBeGreaterThan(0);
  });
  it('uses the same duplicate exclusions, order and insertion metadata as the provider', () => {
    const items = collectScarpSuggestions(defaults, 'pri', excluded => {
      expect(excluded.has('print')).toBe(true);
      return local;
    });
    expect(items[0]).toMatchObject({ label: 'print_total', source: 'local', insertText: 'print_total', sortText: '0_print_total' });
    expect(items.some(item => item.source === 'catalog' && item.label === 'print')).toBe(true);
    const catalogFirst = collectScarpSuggestions({ ...defaults, preferLocal: false }, 'pri', () => local);
    expect(catalogFirst[0].source).toBe('catalog');
    expect(catalogFirst.at(-1)?.sortText).toBe('1_print_total');
  });
  it('filters catalog categories before limiting results and preserves manual mode', () => {
    const entries = collectScarpSuggestions({ ...defaults, completionMode: 'manual', suggestionLimit: 10,
      templates: false, localFunctions: false, keywordsAndTypes: false }, '');
    expect(entries).toHaveLength(10);
    expect(entries.every(item => item.kind === 'function' && item.source === 'catalog')).toBe(true);
  });
});
