import { describe, expect, it } from 'vitest';
import {
  safeRelativeScarpDirectory, safeRelativeScarpSourceName, collectBrowseableScarpFolders,
} from './folderListing';
import { buildExplorerGroups, filterExplorerGroups, isHiddenByCollapsedExplorerAncestor } from './explorerView';
import { buildQuickOpenEntries } from './projectQuickOpen';

const file = (name: string) => ({ name, path: 'C:/Scarp-Practice/' + name });

describe('nested workspace presentation safety', () => {
  it('validates a nested source path but rejects traversal and malformed extensions', () => {
    expect(safeRelativeScarpDirectory('basic_tuple/src')).toBe(true);
    expect(safeRelativeScarpSourceName('basic_tuple/src/main.srp')).toBe(true);
    for (const name of ['../main.srp', 'src/../main.srp', 'src\\main.srp', 'src/\0x.srp', 'a//b.srp']) {
      expect(safeRelativeScarpSourceName(name)).toBe(false);
    }
    expect(safeRelativeScarpSourceName('basic_tuple/src/main.rs')).toBe(false);
  });

  it('prioritizes standard folders and skips linked/dependency directories', () => {
    const dir = (name: string, isSymlink = false) => ({
      name, isFile: false, isDirectory: true, isSymlink,
    });
    expect(collectBrowseableScarpFolders([
      dir('basic_tuple'), dir('node_modules'), dir('linked', true),
      dir('src'), dir('unit10'), dir('unit2'),
    ])).toEqual(['src', 'basic_tuple', 'unit2', 'unit10']);
  });

  it('shows empty folders and nested groups while filtering source names', () => {
    const groups = buildExplorerGroups([
      'basic_tuple/main.srp', 'basic_tuple/src/main.srp', 'conditions/if.srp',
    ].map(file), [], null, ['basic_tuple', 'basic_tuple/src', 'conditions', 'empty_project']);
    expect(groups.map(group => group.directory)).toEqual([
      'basic_tuple', 'basic_tuple/src', 'conditions', 'empty_project',
    ]);
    expect(groups[0].sources[0].entrypoint).toBe(true);
    expect(groups[3].sources).toEqual([]);
    expect(filterExplorerGroups(groups, '', 'all')).toHaveLength(4);
    expect(filterExplorerGroups(groups, 'tuple', 'all').map(group => group.directory))
      .toEqual(['basic_tuple', 'basic_tuple/src']);
  });

  it('collapsing a parent directory hides its descendants without hiding siblings', () => {
    const collapsed = new Set(['basic_tuple']);
    expect(isHiddenByCollapsedExplorerAncestor('basic_tuple/src', collapsed)).toBe(true);
    expect(isHiddenByCollapsedExplorerAncestor('basic_tuple/src/deep', collapsed)).toBe(true);
    expect(isHiddenByCollapsedExplorerAncestor('basic_tuple', collapsed)).toBe(false);
    expect(isHiddenByCollapsedExplorerAncestor('conditions/src', collapsed)).toBe(false);
  });

  it('Quick Open includes safe nested paths and excludes injected traversal', () => {
    const entries = buildQuickOpenEntries([], [
      file('basic_tuple/main.srp'),
      file('basic_tuple/examples/tuple.srp'),
      file('../outside.srp'),
      file('basic_tuple/../outside.srp'),
    ]);
    expect(entries.map(entry => entry.label)).toEqual([
      'basic_tuple/main.srp', 'basic_tuple/examples/tuple.srp',
    ]);
  });

  it('collapses duplicate Windows aliases of the same nested source', () => {
    const groups = buildExplorerGroups([
      { name: 'basic_tuple/main.srp', path: 'C:/Scarp-Practice/basic_tuple/main.srp' },
      { name: 'basic_tuple/MAIN.srp', path: 'c:\\scarp-practice\\basic_tuple\\MAIN.SRP' },
    ], [], null);
    expect(groups.flatMap(group => group.sources)).toHaveLength(1);
  });
});
