import { describe, expect, it } from 'vitest';
import { scanScarpOutlineSymbols } from '../language/assist';
import { buildDeclarationEntries, isCurrentDeclarationEntry } from './declarationNavigation';
import { filterNavigationEntries } from './navigation';
import type { StudioDocument } from './documents';

const content = [
  'pub record Task { done: boolean }',
  '// funcra hidden() -> unit {}',
  'variant Result { Ready }',
  'pure funcra compute(a: integer) -> integer { return a; }',
  'funcra duplicate() -> unit {}',
  'funcra duplicate() -> unit {}',
].join('\n');
const doc: StudioDocument = {
  id: 'test', name: 'Untitled.srp', path: null,
  content, savedContent: '', revision: 2,
};
const entries = () => buildDeclarationEntries(doc, scanScarpOutlineSymbols(doc.content));

describe('current-file declaration navigation', () => {
  it('indexes current unsaved source in order without opening files', () => {
    const found = entries();
    expect(found.map(item => [item.label, item.symbol.kind, item.symbol.line])).toEqual([
      ['Task', 'record', 1], ['Result', 'variant', 3], ['compute', 'function', 4],
      ['duplicate', 'function', 5], ['duplicate', 'function', 6],
    ]);
    expect(new Set(found.map(item => item.id)).size).toBe(found.length);
    expect(filterNavigationEntries(found, 'record task')).toEqual([found[0]]);
    expect(filterNavigationEntries(found, 'function duplicate')).toEqual(found.slice(3));
    expect(filterNavigationEntries(found, 'hidden')).toEqual([]);
  });
  it('rejects stale revision, ABA edit, changed text and a different active tab', () => {
    const entry = entries()[0];
    expect(isCurrentDeclarationEntry(doc, entry)).toBe(true);
    expect(isCurrentDeclarationEntry({ ...doc, revision: 3 }, entry)).toBe(false);
    expect(isCurrentDeclarationEntry({ ...doc, content: 'print(1);' }, entry)).toBe(false);
    expect(isCurrentDeclarationEntry({ ...doc, id: 'other' }, entry)).toBe(false);
    expect(isCurrentDeclarationEntry(null, entry)).toBe(false);
  });
  it('handles no active source and bounds the declaration inventory', () => {
    const symbols = scanScarpOutlineSymbols(content);
    expect(buildDeclarationEntries(null, symbols)).toEqual([]);
    expect(buildDeclarationEntries(doc, Array.from({ length: 501 }, (_, i) =>
      ({ ...symbols[0], line: i + 1 })))).toHaveLength(500);
    expect(buildDeclarationEntries(doc, [])).toEqual([]);
  });
});
