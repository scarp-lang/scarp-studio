import { describe, expect, it } from 'vitest';
import { createUntitled, type StudioDocument } from './documents';
import {
  MAX_SEARCH_CANDIDATES, MAX_SEARCH_CONTENT_UNITS, MAX_SEARCH_DOCUMENTS,
  MAX_SEARCH_QUERY_UNITS, MAX_SEARCH_RESULTS, isCurrentSearchHit, searchOpenFiles,
} from './openFileSearch';

const defaults = { caseSensitive: false, wholeWord: false };

function source(id: number, content: string): StudioDocument {
  return {
    ...createUntitled(id),
    id: 'open-' + id,
    name: 'file-' + id + '.srp',
    path: '/project/file-' + id + '.srp',
    content,
    savedContent: content,
  };
}

describe('bounded search across open Scarp buffers', () => {
  it('finds case-insensitive matches in several open files', () => {
    const result = searchOpenFiles([
      source(1, 'print("Alpha");'), source(2, 'bind alpha = 3;'),
    ], 'ALPHA', defaults);
    expect(result.error).toBeNull();
    expect(result.hits.map((hit) => hit.documentId)).toEqual(['open-1', 'open-2']);
    expect(result.hits.map((hit) => hit.matchText)).toEqual(['Alpha', 'alpha']);
    expect(result.truncated).toBe(false);
  });

  it('can search case-sensitively', () => {
    const result = searchOpenFiles([source(1, 'Cat cat CAT')], 'Cat', {
      ...defaults, caseSensitive: true,
    });
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].column).toBe(1);
  });

  it('treats regex operators as ordinary Scarp source text', () => {
    const content = 'print("[a+b].*");';
    const result = searchOpenFiles([source(1, content)], '[a+b].*', defaults);
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].matchText).toBe('[a+b].*');
  });

  it('reports Monaco UTF-16 columns after emoji rather than codepoint columns', () => {
    const content = 'print("😀"); unknown_name;';
    const result = searchOpenFiles([source(1, content)], 'unknown_name', defaults);
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].column).toBe(content.indexOf('unknown_name') + 1);
    expect(result.hits[0].offset).toBe(content.indexOf('unknown_name'));
  });

  it('tracks CRLF and LF line numbers and 1-based columns', () => {
    const content = 'first\r\n  print("one");\nprint("two");';
    const result = searchOpenFiles([source(1, content)], 'print', defaults);
    expect(result.hits.map(({ line, column }) => [line, column]))
      .toEqual([[2, 3], [3, 1]]);
  });

  it('matches whole Unicode identifiers but not their internal substrings', () => {
    const content = 'résumé _résumé résumé42 résumé';
    const result = searchOpenFiles([source(1, content)], 'résumé', {
      ...defaults, wholeWord: true,
    });
    expect(result.hits.map((hit) => hit.offset))
      .toEqual([0, content.lastIndexOf('résumé')]);
  });

  it('handles supplementary Unicode surrounding identifier boundaries', () => {
    const result = searchOpenFiles([source(1, '😀var var😀 varé')], 'var', {
      ...defaults, wholeWord: true,
    });
    expect(result.hits).toHaveLength(2);
    expect(result.hits.map((hit) => hit.column)).toEqual([3, 7]);
  });

  it('limits search to the first 32 open documents with an honest truncation indicator', () => {
    const docs = Array.from({ length: MAX_SEARCH_DOCUMENTS + 3 }, (_, index) =>
      source(index + 1, 'needle'));
    const result = searchOpenFiles(docs, 'needle', defaults);
    expect(result.hits).toHaveLength(MAX_SEARCH_DOCUMENTS);
    expect(result.skippedDocuments).toBe(3);
    expect(result.truncated).toBe(true);
  });

  it('skips overly large buffers rather than searching an unbounded prefix', () => {
    const huge = 'a'.repeat(MAX_SEARCH_CONTENT_UNITS + 1) + 'needle';
    const result = searchOpenFiles([source(1, huge), source(2, 'needle')], 'needle', defaults);
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].documentId).toBe('open-2');
    expect(result.skippedDocuments).toBe(1);
    expect(result.truncated).toBe(true);
  });

  it('caps output even if many matches are present', () => {
    const result = searchOpenFiles([source(1, 'z '.repeat(MAX_SEARCH_RESULTS + 20))], 'z', defaults);
    expect(result.hits).toHaveLength(MAX_SEARCH_RESULTS);
    expect(result.truncated).toBe(true);
  });

  it('returns exact source snapshots for navigation invalidation', () => {
    const docs = [source(1, 'print("hello");')];
    const result = searchOpenFiles(docs, 'hello', defaults);
    expect(result.hits[0].sourceContent).toBe(docs[0].content);
    expect(result.hits[0].matchText).toBe('hello');
    expect(result.hits[0].preview).toContain('print');
  });

  it('rejects stale, closed or malformed result locations', () => {
    const initial = source(1, 'alpha beta');
    const hit = searchOpenFiles([initial], 'beta', defaults).hits[0];
    expect(isCurrentSearchHit(initial, hit)).toBe(true);
    expect(isCurrentSearchHit({ ...initial, content: 'alpha Xbeta' }, hit)).toBe(false);
    expect(isCurrentSearchHit(undefined, hit)).toBe(false);
    expect(isCurrentSearchHit(source(2, 'alpha beta'), hit)).toBe(false);
    expect(isCurrentSearchHit(initial, { ...hit, offset: -1 })).toBe(false);
  });

  it('caps candidate processing even when all whole-word matches are rejected', () => {
    const sourceText = 'varname '.repeat(MAX_SEARCH_CANDIDATES + 5);
    const result = searchOpenFiles([source(1, sourceText)], 'var', {
      caseSensitive: false, wholeWord: true,
    });
    expect(result.hits).toHaveLength(0);
    expect(result.truncated).toBe(true);
  });

  it('rejects oversized or multi-line search input', () => {
    expect(searchOpenFiles([source(1, 'x')], 'x'.repeat(MAX_SEARCH_QUERY_UNITS + 1), defaults)
      .error).toMatch(/120/);
    expect(searchOpenFiles([source(1, 'x')], 'x\ny', defaults).error)
      .toMatch(/one line/);
    expect(searchOpenFiles([source(1, 'x')], 'x\ry', defaults).error)
      .toMatch(/one line/);
  });

  it('does not search empty queries', () => {
    expect(searchOpenFiles([source(1, 'anything')], '', defaults).hits).toEqual([]);
  });
});
