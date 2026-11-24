import { describe, expect, it } from 'vitest';
import {
  createSourceBookmark, resolveSourceBookmark, removeSourceBookmark,
  resolveSourceBookmarks, bookmarkTargetForCurrentSource,
  filterSourceBookmarks, bookmarkSourceLine,
  MAX_BOOKMARKS_PER_DOCUMENT, MAX_STUDIO_BOOKMARKS,
} from './sourceBookmarks';
import type { StudioDocument } from './documents';

function doc(content: string, revision = 0): StudioDocument {
  return {
    id: 'main', name: 'main.srp', path: 'C:/Scarp/main.srp',
    content, savedContent: content, revision,
  };
}
function bookmark(source: string, line: number, column = 1) {
  return createSourceBookmark([doc(source)], [], 'main', line, column, 1);
}

describe('session-only source bookmarks', () => {
  it('creates a bookmark on an exact nonempty code line', () => {
    const source = 'funcra run() {\n    print("hello");\n}';
    const marked = bookmark(source, 2, 5);
    expect(marked).toMatchObject({
      documentId: 'main', originalLine: 2,
      originalColumn: 5, anchor: '    print("hello");',
      label: 'print("hello");', revision: 0,
    });
    expect(resolveSourceBookmark(marked, [doc(source)]))
      .toMatchObject({ status: 'current', line: 2, column: 5 });
  });

  it('keeps bookmark coordinates across CRLF and Unicode text', () => {
    const source = 'print("नमस्ते");\r\nprint("🚀");';
    const marked = bookmark(source, 2, 7);
    expect(marked.anchor).toBe('print("🚀");');
    expect(resolveSourceBookmark(marked, [doc(source)]))
      .toMatchObject({ status: 'current', line: 2, column: 7 });
  });

  it('relocates a unique line after a preceding insert', () => {
    const marked = bookmark('first\nsecond\nthird', 2);
    const changed = doc('new\nfirst\nsecond\nthird', 2);
    const resolved = resolveSourceBookmark(marked, [changed]);
    expect(resolved).toMatchObject({ status: 'relocated', line: 3 });
    expect(bookmarkSourceLine(changed, marked)).toBe('second');
  });

  it('never guesses among two identical changed line candidates', () => {
    const marked = bookmark('start\nunique\nend', 2);
    const newDoc = doc('unique\nstart\nunique\nend');
    const resolved = resolveSourceBookmark(marked, [newDoc]);
    expect(resolved.status).toBe('stale');
    expect(resolved.line).toBeNull();
  });

  it('retains original coordinate when the same anchor still appears there', () => {
    const source = 'same\nsame\nend';
    const marked = bookmark(source, 2);
    expect(resolveSourceBookmark(marked, [doc(source)]).status).toBe('current');
  });

  it('marks deleted and edited anchor text stale', () => {
    const marked = bookmark('one\ntwo\nthree', 2);
    expect(resolveSourceBookmark(marked, [doc('one\nthree')]).status).toBe('stale');
    expect(resolveSourceBookmark(marked, [doc('one\nTWO\nthree')]).status).toBe('stale');
  });

  it('never opens a closed document without an explicit new editor open', () => {
    const marked = bookmark('print(1);', 1);
    expect(resolveSourceBookmark(marked, [])).toMatchObject({
      status: 'closed', line: null, column: null,
    });
  });

  it('rejects blank or oversized line anchors and out-of-range columns', () => {
    for (const source of ['', '  ', '\t']) {
      expect(() => bookmark(source, 1)).toThrow(/non-empty/);
    }
    expect(() => bookmark('x'.repeat(241), 1)).toThrow(/non-empty/);
    expect(() => bookmark('hi', 1, 99)).toThrow(/column/);
    expect(() => bookmark('hi', 2)).toThrow(/limit/);
  });

  it('rejects invalid numeric positions and unknown documents', () => {
    const documents = [doc('one')];
    for (const line of [0, -1, NaN, Infinity, 1.5]) {
      expect(() => createSourceBookmark(documents, [], 'main', line, 1, 0))
        .toThrow();
    }
    expect(() => createSourceBookmark(documents, [], 'missing', 1, 1, 0))
      .toThrow(/No open/);
    expect(() => createSourceBookmark(documents, [], 'main', 1, 1, -1))
      .toThrow();
  });

  it('rejects duplicate bookmarks on the same line', () => {
    const document = doc('a\nb');
    const first = createSourceBookmark([document], [], 'main', 1, 1, 1);
    expect(() => createSourceBookmark([document], [first], 'main', 1, 1, 2))
      .toThrow(/already bookmarked/);
  });

  it('limits per-document bookmarks separately from global session cap', () => {
    const source = Array.from({length: MAX_BOOKMARKS_PER_DOCUMENT + 2},
      (_, i) => 'print('+i+');').join('\n');
    const document = doc(source);
    const bookmarks = Array.from({length: MAX_BOOKMARKS_PER_DOCUMENT},
      (_, i) => createSourceBookmark(
        [document],
        Array.from({length:i}, (_, j) => ({...bookmark(source,j+1), id:'b'+j})),
        'main', i+1, 1, i+100,
      ));
    expect(() => createSourceBookmark(
      [document], bookmarks, 'main', MAX_BOOKMARKS_PER_DOCUMENT+1, 1, 99,
    )).toThrow(/Maximum 40/);
    const oversized = Array.from({ length: MAX_STUDIO_BOOKMARKS }, (_, i) =>
      ({...bookmarks[0], id:'duplicate'+i}));
    expect(() => createSourceBookmark([document], oversized, 'main', 1, 1, 9))
      .toThrow(/limit reached/);
  });

  it('removes only the requested stable bookmark ID', () => {
    const a = bookmark('one\ntwo', 1);
    const b = {...a, id:'second', originalLine: 2, anchor:'two'};
    expect(removeSourceBookmark([a,b], 'second')).toEqual([a]);
    expect(removeSourceBookmark([a,b], 'missing')).toEqual([a,b]);
  });

  it('never navigates to a stale/closed source', () => {
    const marked = bookmark('first\nsecond', 2);
    const changed = doc('first\nchanged', 3);
    const stale = resolveSourceBookmarks([marked], [changed])[0];
    expect(bookmarkTargetForCurrentSource(stale, [changed])).toBeNull();
    const closed = resolveSourceBookmarks([marked], [])[0];
    expect(bookmarkTargetForCurrentSource(closed, [])).toBeNull();
  });

  it('produces a validated source-bound target for current text', () => {
    const source = doc('first\nsecond', 2);
    const marked = bookmark(source.content, 2);
    const resolved = resolveSourceBookmarks([marked], [source])[0];
    expect(bookmarkTargetForCurrentSource(resolved, [source])).toMatchObject({
      documentId: source.id, revision: 2, source: source.content, line: 2,
    });
  });

  it('filters by status, active tab and query without regex execution', () => {
    const source = doc('print(1);\nprint(2);');
    const a = createSourceBookmark([source], [], 'main', 1, 1, 1);
    const b = {...a, id: 'other', documentId: 'other', documentName: 'other.srp'};
    const entries = resolveSourceBookmarks([a,b], [source]);
    expect(filterSourceBookmarks(entries, 'main',
      { scope:'active', status:'all', query:'', order:'created' })).toHaveLength(1);
    expect(filterSourceBookmarks(entries, null,
      { scope:'all', status:'closed', query:'', order:'created' })).toHaveLength(1);
    expect(filterSourceBookmarks(entries, 'main',
      { scope:'all', status:'all', query:'other', order:'source' })).toHaveLength(1);
    expect(filterSourceBookmarks(entries, 'main',
      { scope:'all', status:'all', query:'x'.repeat(121), order:'source' }))
      .toEqual([]);
  });

  it('returns independent deterministic resolutions and never mutates source', () => {
    const source = doc('hello\nworld');
    const marked = bookmark(source.content, 2);
    const a = resolveSourceBookmarks([marked], [source]);
    const b = resolveSourceBookmarks([marked], [source]);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(source.content).toBe('hello\nworld');
  });
});
