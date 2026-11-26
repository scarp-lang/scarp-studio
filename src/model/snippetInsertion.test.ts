import { describe, expect, it } from 'vitest';
import { buildSnippetPaletteEntries, isSnippetPaletteEntry, planSnippetInsertion } from './snippetInsertion';
import { createSnippetStore } from './userSnippets';
import { createUntitled, type StudioDocument } from './documents';
import { MAX_SCARP_SOURCE_BYTES } from './sourceLimits';
import { filterNavigationEntries } from './navigation';

function fixture(body = 'bind {{1:name}} = 42;\nprint({{1}});{{0}}') {
  const store = createSnippetStore(null);
  const result = store.mutate({ kind: 'create', item: { prefix: 'my_bind', name: 'Binding example',
    description: 'Local example', body, enabled: true } }, 0);
  if (!result.ok) throw Error(result.error);
  const document: StudioDocument = { ...createUntitled(1), content: 'first\nlast', revision: 3 };
  const snapshot = store.getSnapshot();
  const entry = buildSnippetPaletteEntries(snapshot, document)[0];
  return { store, document, snapshot, entry };
}
describe('explicit snippet palette insertion', () => {
  it('provides bounded searchable metadata without indexing source or snippet text', () => {
    const { snapshot, document, entry } = fixture('print("secret source body");');
    expect(entry.label).toBe('Insert user snippet: Binding example');
    expect(isSnippetPaletteEntry(entry)).toBe(true);
    expect(isSnippetPaletteEntry({ id: entry.id, label: entry.label })).toBe(false);
    expect(filterNavigationEntries([entry], 'binding my_bind')).toEqual([entry]);
    expect(filterNavigationEntries([entry], 'secret source body')).toEqual([]);
    expect(JSON.stringify(entry)).not.toContain(document.content);
    expect(buildSnippetPaletteEntries(snapshot, null)).toEqual([]);
    expect(buildSnippetPaletteEntries({ ...snapshot, persistence: 'blocked' }, document)).toEqual([]);
    expect(buildSnippetPaletteEntries({ ...snapshot, items: [{ ...snapshot.items[0], enabled: false }] }, document)).toEqual([]);
  });
  it('expands defaults and replaces only the selected range', () => {
    const { snapshot, document, entry } = fixture();
    const result = planSnippetInsertion(document, entry, snapshot, { start: 6, end: 10 }, '\n');
    if (!result.ok) throw Error(result.error);
    expect(result.value.text).toBe('bind name = 42;\nprint(name);');
    expect(result.value.caret).toBe(6 + result.value.text.length);
    expect(document.content.slice(0, 6) + result.value.text + document.content.slice(10)).toBe('first\nbind name = 42;\nprint(name);');
    expect(Object.isFrozen(result.value)).toBe(true);
  });
  it('honors final caret placement and CRLF offsets', () => {
    const { snapshot, document, entry } = fixture('one\n{{0}}two\nthree');
    const result = planSnippetInsertion(document, entry, snapshot, { start: 0, end: 0 }, '\r\n');
    expect(result).toEqual({ ok: true, value: { start: 0, end: 0, text: 'one\r\ntwo\r\nthree', caret: 5 } });
  });
  it('rejects stale source or snippet generations and disabled entries', () => {
    const { snapshot, document, entry, store } = fixture();
    const range = { start: 0, end: 0 };
    expect(planSnippetInsertion({ ...document, revision: 4 }, entry, snapshot, range, '\n').ok).toBe(false);
    expect(planSnippetInsertion({ ...document, id: 'other' }, entry, snapshot, range, '\n').ok).toBe(false);
    expect(planSnippetInsertion(document, entry, { ...snapshot, persistence: 'blocked' }, range, '\n').ok).toBe(false);
    expect(planSnippetInsertion(document, entry, { ...snapshot, items: [{ ...snapshot.items[0], enabled: false }] }, range, '\n').ok).toBe(false);
    store.mutate({ kind: 'delete', prefix: entry.prefix }, snapshot.revision);
    expect(planSnippetInsertion(document, entry, store.getSnapshot(), range, '\n').ok).toBe(false);
  });
  it('rejects invalid ranges, split Unicode scalars and unsupported line endings', () => {
    const { snapshot, document, entry } = fixture();
    const unicode = { ...document, content: '🙂x' };
    for (const range of [{ start: -1, end: 0 }, { start: 2, end: 1 }, { start: 0, end: 4 },
      { start: 1, end: 2 }, { start: 0, end: 1 }, { start: 0.5, end: 2 }]) {
      expect(planSnippetInsertion(unicode, entry, snapshot, range, '\n').ok).toBe(false);
    }
    expect(planSnippetInsertion(unicode, entry, snapshot, { start: 2, end: 3 }, '\n').ok).toBe(true);
    expect(planSnippetInsertion(document, entry, snapshot, { start: 0, end: 0 }, '\r').ok).toBe(false);
  });
  it('validates final UTF-8 size before any mutation', () => {
    const { snapshot, document, entry } = fixture('🙂');
    const full = { ...document, content: 'a'.repeat(MAX_SCARP_SOURCE_BYTES) };
    expect(planSnippetInsertion(full, entry, snapshot, { start: 0, end: 0 }, '\n').ok).toBe(false);
    expect(planSnippetInsertion(full, entry, snapshot, { start: 0, end: 4 }, '\n').ok).toBe(true);
  });
});
