import { describe, expect, it } from 'vitest';
import { createUntitled, type StudioDocument } from './documents';
import { MAX_SEARCH_RESULTS } from './openFileSearch';
import { MAX_REPLACEMENT_TEXT_UNITS, planOpenFileReplacement } from './openFileReplace';

const options = { caseSensitive: false, wholeWord: false };
function doc(number: number, content: string): StudioDocument {
  return {
    ...createUntitled(number),
    id: 'doc-' + number,
    name: 'source-' + number + '.srp',
    path: '/project/source-' + number + '.srp',
    content,
    savedContent: content,
  };
}

describe('previewed, literal replacements in open buffers only', () => {
  it('plans case-insensitive changes in several tabs without editing source state', () => {
    const docs = [doc(1, 'Alpha'), doc(2, 'alpha ALPHA')];
    const preview = planOpenFileReplacement(docs, 'alpha', 'beta', options);
    expect(preview.totalReplacements).toBe(3);
    expect(preview.sourceSnapshots.map((source) => source.id)).toEqual(docs.map((source) => source.id));
    expect(preview.changes.map((change) => change.content)).toEqual(['beta', 'beta beta']);
    expect(docs[0].content).toBe('Alpha');
    expect(docs[1].savedContent).toBe('alpha ALPHA');
    expect(preview.changes[0].previewBefore).toContain('Alpha');
    expect(preview.changes[0].previewAfter).toContain('beta');
  });

  it('treats punctuation as literal text, never as a regex', () => {
    const preview = planOpenFileReplacement([doc(1, 'print("[a+b].*");')],
      '[a+b].*', 'literal', options);
    expect(preview.changes[0].content).toBe('print("literal");');
  });

  it('preserves Windows CRLF and supplementary Unicode around replacements', () => {
    const preview = planOpenFileReplacement(
      [doc(1, '😀 first\r\n😀 first\n')], 'first', 'दूसरा', options,
    );
    expect(preview.changes[0].content).toBe('😀 दूसरा\r\n😀 दूसरा\n');
    expect(preview.totalReplacements).toBe(2);
  });

  it('respects whole-word and case-sensitive search options', () => {
    const preview = planOpenFileReplacement([doc(1, 'cat Cat cater _cat cat')],
      'cat', 'dog', { caseSensitive: true, wholeWord: true });
    expect(preview.totalReplacements).toBe(2);
    expect(preview.changes[0].content).toBe('dog Cat cater _cat dog');
  });

  it('can delete matched text using an empty replacement string', () => {
    const preview = planOpenFileReplacement([doc(1, 'abc-abc')],
      'abc', '', options);
    expect(preview.changes[0].content).toBe('-');
    expect(preview.totalReplacements).toBe(2);
  });

  it('skips already-identical case-insensitive matches', () => {
    const preview = planOpenFileReplacement([doc(1, 'Alpha alpha ALPHA')],
      'alpha', 'alpha', options);
    expect(preview.totalReplacements).toBe(2);
    expect(preview.changes[0].content).toBe('alpha alpha alpha');
  });

  it('refuses a no-op instead of announcing replacement success', () => {
    expect(() => planOpenFileReplacement([doc(1, 'cat cat')], 'cat', 'cat', options))
      .toThrow('No matching text');
    expect(() => planOpenFileReplacement([doc(1, 'cat')], 'absent', 'x', options))
      .toThrow('No matching text');
  });

  it('rejects truncated searches rather than changing only the first matches', () => {
    expect(() => planOpenFileReplacement([doc(1, 'x '.repeat(MAX_SEARCH_RESULTS + 10))],
      'x', 'z', options)).toThrow('incomplete');
  });

  it('rejects oversized and multiline replacement input', () => {
    expect(() => planOpenFileReplacement([doc(1, 'a')], 'a',
      'z'.repeat(MAX_REPLACEMENT_TEXT_UNITS + 1), options)).toThrow('256');
    expect(() => planOpenFileReplacement([doc(1, 'a')], 'a', 'b\nc', options))
      .toThrow('one line');
    expect(() => planOpenFileReplacement([doc(1, 'a')], 'a', 'b\rc', options))
      .toThrow('one line');
  });

  it('rejects invalid search queries and changes no documents', () => {
    const docs = [doc(1, 'a')];
    expect(() => planOpenFileReplacement(docs, '', 'b', options)).toThrow('search term');
    expect(() => planOpenFileReplacement(docs, 'a\nb', 'x', options)).toThrow('one line');
    expect(docs[0].content).toBe('a');
  });

  it('includes unsaved buffers without requiring any disk path', () => {
    const untitled = { ...createUntitled(8), content: 'needle' };
    const preview = planOpenFileReplacement([untitled], 'needle', 'replacement', options);
    expect(preview.changes[0].snapshot.path).toBeNull();
    expect(preview.changes[0].content).toBe('replacement');
  });
});
