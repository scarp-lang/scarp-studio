import { describe, expect, it } from 'vitest';
import { buildExplorerGroups, filterExplorerGroups } from './explorerView';
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
  it('never joins arbitrary directory names or admits unsupported or malformed names', () => {
    const groups = buildExplorerGroups([...listed, ...['../a.srp', 'src/deep/a.srp', 'other/a.srp', 'src/../x.srp', 'readme.md', 'SRC/x.srp'].map(file), listed[0]], [], null);
    expect(groups.flatMap(g => g.sources)).toHaveLength(listed.length);
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
