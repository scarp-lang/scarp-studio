import { describe, expect, it } from 'vitest';
import { buildExplorerGroups, filterExplorerGroups, explorerDirectoryLabel, explorerHeadingIndent, explorerSourceIndent } from './explorerView';
import { openedDocument, updateContent } from './documents';

const file = (name: string) => ({ name, path: 'C:/project/' + name });
const listed = ['tests/math.srp', 'src/item10.srp', 'examples/demo.srp', 'main.srp', 'src/item2.srp', 'src/main.srp'].map(file);
const opened = openedDocument([], 'c:/PROJECT/src/item2.srp', 'print(2);');
const dirty = updateContent(opened.documents, opened.id, 'print(3);');

describe('bounded Explorer presentation', () => {
  it('groups root/src/tests/examples in fixed order and prioritizes conventional main sources', () => {
    const groups = buildExplorerGroups(listed, [], null);
    expect(groups.map(g => g.directory)).toEqual(['', 'src', 'tests', 'examples']);
    expect(groups[1].sources.map(s => s.basename)).toEqual(['main.srp', 'item2.srp', 'item10.srp']);
    expect(groups[0].sources[0].entrypoint).toBe(true);
  });
  it('shows active and dirty states across Windows path aliases without mutating documents', () => {
    const groups = buildExplorerGroups(listed, dirty, opened.id);
    const source = groups[1].sources.find(s => s.basename === 'item2.srp')!;
    expect(source).toMatchObject({ path: 'C:/project/src/item2.srp', active: true, modified: true, documentId: opened.id });
    expect(dirty[0].content).toBe('print(3);');
  });
  it('accepts safe nested practice names but rejects traversal and unsupported names', () => {
    const groups = buildExplorerGroups([...listed, ...['../a.srp', 'src/deep/a.srp', 'other/a.srp', 'src/../x.srp', 'readme.md', 'SRC/x.srp'].map(file), listed[0]], [], null);
    expect(groups.flatMap(g => g.sources)).toHaveLength(listed.length + 3);
  });
  it('preserves the 200-entry listing budget and exact original paths', () => {
    const files = Array.from({ length: 300 }, (_, i) => file('src/item' + i + '.srp'));
    const sources = buildExplorerGroups(files, [], null).flatMap(g => g.sources);
    expect(sources).toHaveLength(200);
    expect(sources.every(s => files.slice(0, 200).some(f => f.path === s.path))).toBe(true);
  });
  it('combines case-insensitive path search with open/modified filters', () => {
    const groups = buildExplorerGroups(listed, dirty, opened.id);
    expect(filterExplorerGroups(groups, 'SRC item', 'all')[0].sources).toHaveLength(2);
    expect(filterExplorerGroups(groups, '', 'open')[0].sources).toHaveLength(1);
    expect(filterExplorerGroups(groups, 'item2', 'modified')[0].sources[0].documentId).toBe(opened.id);
    expect(filterExplorerGroups(groups, 'tests', 'modified')).toEqual([]);
    expect(filterExplorerGroups(groups, 'unknown', 'all')).toEqual([]);
  });
});

describe('hierarchical nested Explorer presentation', () => {
  it('labels nested folders by basename but shows full context during search', () => {
    expect(explorerDirectoryLabel('', false)).toBe('Project root');
    expect(explorerDirectoryLabel('basic_tuple', false)).toBe('basic_tuple/');
    expect(explorerDirectoryLabel('basic_tuple/examples', false)).toBe('examples/');
    expect(explorerDirectoryLabel('basic_tuple/examples', true)).toBe('basic_tuple/examples/');
  });
  it('indents nested file rows deeper than their headings, with a bounded depth', () => {
    expect(explorerHeadingIndent('')).toBe(12);
    expect(explorerSourceIndent('')).toBe(18);
    expect(explorerHeadingIndent('basic_tuple')).toBe(24);
    expect(explorerSourceIndent('basic_tuple')).toBe(30);
    expect(explorerHeadingIndent('basic_tuple/examples')).toBe(36);
    expect(explorerSourceIndent('basic_tuple/examples')).toBe(42);
    expect(explorerSourceIndent('a/b/c/d/e/f')).toBe(78);
  });
});

describe('manifest-root Explorer headings', () => {
  it('includes an empty workspace project root and an empty nested project folder', () => {
    const groups = buildExplorerGroups([], [], null, [], ['', 'basic_tuple']);
    expect(groups.map(group => group.directory)).toEqual(['', 'basic_tuple']);
    expect(groups.every(group => group.sources.length === 0)).toBe(true);
  });
  it('does not trust forged manifest names as folder headings', () => {
    const groups = buildExplorerGroups([], [], null, [], ['../outside', 'src/../escape']);
    expect(groups).toEqual([]);
  });
});
