import { describe, expect, it } from 'vitest';
import { scarpReferenceCatalog, scarpCompletions } from './assist';
import { DEFAULT_INTELLISENSE_PREFERENCES as defaults } from '../model/intelliSensePreferences';
import { REFERENCE_PAGE_SIZE, searchScarpReference, type ReferenceQuery } from './intelliSenseReference';

const all: ReferenceQuery = { text: '', kind: 'all', availability: 'all' };
describe('read-only Scarp reference catalog', () => {
  it('exposes the entire catalog without mutating shared completion entries', () => {
    const entries = scarpReferenceCatalog();
    expect(entries.length).toBeGreaterThan(scarpCompletions('').length);
    const label = entries[0].label;
    entries[0].label = 'mutated';
    expect(scarpReferenceCatalog()[0].label).toBe(label);
    expect(searchScarpReference(all, defaults).catalogTotal).toBe(entries.length);
  });
  it('paginates all entries with distinct identities, including duplicate type/function labels', () => {
    const first = searchScarpReference(all, defaults);
    expect(first.entries).toHaveLength(REFERENCE_PAGE_SIZE);
    const ids = new Set<string>();
    for (let page = 1; page <= first.pages; page++) {
      for (const item of searchScarpReference(all, defaults, page).entries) {
        expect(ids.has(item.id)).toBe(false); ids.add(item.id);
      }
    }
    expect(ids.size).toBe(first.catalogTotal);
    expect(searchScarpReference(all, defaults, 9999).page).toBe(first.pages);
    expect(searchScarpReference(all, defaults, NaN).page).toBe(1);
    const bigint = searchScarpReference({ ...all, text: 'bigint' }, defaults);
    expect(bigint.entries.filter(item => item.label === 'bigint').map(item => item.kind).sort()).toEqual(['function', 'type']);
  });
  it('ranks exact labels ahead of prefix and documentation matches without locale dependence', () => {
    const result = searchScarpReference({ ...all, text: '  BIGINT_POW ' }, defaults);
    expect(result.entries[0].label).toBe('bigint_pow');
    expect(result.entries[0].signature).toBe('bigint_pow(value: bigint, exponent: integer)');
    const byDocs = searchScarpReference({ ...all, text: 'canonical decimal text' }, defaults);
    expect(byDocs.entries.some(item => item.label === 'decimal_to_text')).toBe(true);
  });
  it('filters by kind and reports query-wide category counts', () => {
    const result = searchScarpReference({ ...all, text: 'bigint', kind: 'function' }, defaults);
    expect(result.entries.every(item => item.kind === 'function')).toBe(true);
    expect(result.counts.function).toBe(result.total);
    expect(result.counts.type).toBeGreaterThan(0);
    expect(result.counts.all).toBeGreaterThan(result.total);
  });
  it('keeps reference accessible when completion is disabled, but marks availability accurately', () => {
    const prefs = { ...defaults, completionMode: 'off' as const };
    expect(searchScarpReference(all, prefs).entries.every(item => !item.enabled)).toBe(true);
    expect(searchScarpReference({ ...all, availability: 'enabled' }, prefs).total).toBe(0);
    expect(searchScarpReference({ ...all, availability: 'disabled' }, prefs).total).toBe(scarpReferenceCatalog().length);
    const only = searchScarpReference({ ...all, availability: 'enabled' }, { ...defaults, builtins: false });
    expect(only.counts.function).toBe(0);
  });
  it('handles empty results and bounded queries; returned entries are isolated', () => {
    const result = searchScarpReference({ ...all, text: 'z'.repeat(20000) }, defaults, 9);
    expect(result).toMatchObject({ total: 0, page: 1, pages: 1, entries: [] });
    const first = searchScarpReference(all, defaults);
    first.entries[0].documentation = 'mutated';
    expect(searchScarpReference(all, defaults).entries[0].documentation).not.toBe('mutated');
  });
});
