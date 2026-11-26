import { describe, expect, it } from 'vitest';
import { scarpCompletions, type ScarpCompletion } from './assist';
import { planCatalogInsertion } from './completionInsertion';
import { DEFAULT_INTELLISENSE_PREFERENCES as defaults } from '../model/intelliSensePreferences';
import { collectScarpSuggestions } from './suggestionPipeline';

function item(name: string, kind?: ScarpCompletion['kind']) {
  const result = scarpCompletions(name).find(entry => entry.label === name && (!kind || entry.kind === kind));
  if (!result) throw Error('Missing catalog item: ' + name);
  return result;
}
describe('catalog insertion planning', () => {
  it('keeps existing calls intact and preserves exact case of the catalog label', () => {
    for (const name of ['print', 'println', 'bigint_pow', 'read_line', 'decimal', 'assert']) {
      expect(planCatalogInsertion(item(name, 'function'), ' (42);')).toEqual({ insertText: name, asSnippet: false });
    }
    expect(planCatalogInsertion(item('print'), '')).toEqual({ insertText: 'print(${1:value});', asSnippet: true });
  });
  it('keeps existing generic arguments and statement terminators', () => {
    expect(planCatalogInsertion(item('array', 'snippet'), '<integer, 2>')).toEqual({ insertText: 'array', asSnippet: false });
    expect(planCatalogInsertion(item('break'), ' ;')).toEqual({ insertText: 'break', asSnippet: false });
    expect(planCatalogInsertion(item('print'), ';')).toEqual({ insertText: 'print(${1:value})', asSnippet: true });
    expect(planCatalogInsertion(item('continue'), '')).toEqual({ insertText: 'continue;', asSnippet: false });
  });
  it('does not mistake comments or strings for existing argument lists', () => {
    const p = item('print');
    expect(planCatalogInsertion(p, ' // (42)').insertText).toBe(p.insertText);
    expect(planCatalogInsertion(p, ' "(42)"').insertText).toBe(p.insertText);
    expect(planCatalogInsertion(p, 'x'.repeat(20000)).insertText).toBe(p.insertText);
  });
  it('uses the shared suggestion plan and never converts local identifiers to snippets', () => {
    const suggestions = collectScarpSuggestions(defaults, 'pri', () => [{ name: 'print_total', detail: 'print_total()' }], 'unqualified', '(42);');
    expect(suggestions.find(item => item.label === 'print')).toMatchObject({ insertText: 'print', asSnippet: false });
    expect(suggestions.find(item => item.label === 'print_total')).toMatchObject({ insertText: 'print_total', asSnippet: false });
    expect(collectScarpSuggestions(defaults, 'pri').find(item => item.label === 'print')).toMatchObject({ asSnippet: true });
  });
});
