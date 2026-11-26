import { describe, expect, it } from 'vitest';
import { DEFAULT_INTELLISENSE_PREFERENCES as defaults } from '../model/intelliSensePreferences';
import { validateUserSnippet, type PreparedUserSnippet } from '../model/userSnippets';
import { collectScarpSuggestions } from './suggestionPipeline';
function snippet(prefix: string, enabled = true): PreparedUserSnippet {
  const result = validateUserSnippet({ prefix, name: 'Helper', description: 'Local template', body: 'print({{1:value}});{{0}}', enabled });
  if (!result.ok) throw Error(result.error);
  return result.value;
}
const samples = [snippet('my_print'), snippet('my_other'), snippet('my_disabled', false)];
describe('user snippets in shared completion policy', () => {
  it('offers exact user prefixes even with a bounded catalog and emits compiled metadata', () => {
    const items = collectScarpSuggestions({ ...defaults, suggestionLimit: 10 }, 'my_print', undefined, 'unqualified', '', samples);
    expect(items[0]).toMatchObject({ source: 'user', label: 'my_print', kind: 'snippet', asSnippet: true,
      insertText: 'print($' + '{1:value});$0', detail: 'User snippet · Helper' });
  });
  it('matches prefix or subsequence and excludes disabled snippets', () => {
    const result = collectScarpSuggestions(defaults, 'my_', undefined, 'unqualified', '', samples);
    expect(result.filter(item => item.source === 'user').map(item => item.label)).toEqual(['my_other', 'my_print']);
    expect(collectScarpSuggestions({ ...defaults, matchingMode: 'subsequence' }, 'myp', undefined, 'unqualified', '', samples)
      .some(item => item.source === 'user' && item.label === 'my_print')).toBe(true);
  });
  it('does not suggest snippets with completion or templates off, empty prefix, blocked context or call suffix', () => {
    for (const items of [
      collectScarpSuggestions({ ...defaults, completionMode: 'off' }, 'my_', undefined, 'unqualified', '', samples),
      collectScarpSuggestions({ ...defaults, templates: false }, 'my_', undefined, 'unqualified', '', samples),
      collectScarpSuggestions(defaults, '', undefined, 'unqualified', '', samples),
      collectScarpSuggestions(defaults, 'my_', undefined, 'blocked', '', samples),
      collectScarpSuggestions(defaults, 'my_', undefined, 'unqualified', ' (1)', samples),
    ]) expect(items.some(item => item.source === 'user')).toBe(false);
  });
  it('does not displace a resolved local function with the same name', () => {
    const result = collectScarpSuggestions(defaults, 'my_print', () => [{ name: 'my_print', detail: 'my_print()' }], 'unqualified', '', samples);
    expect(result.filter(item => item.label === 'my_print').map(item => item.source)).toEqual(['local']);
  });
});
