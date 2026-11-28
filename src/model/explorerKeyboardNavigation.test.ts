import { describe, expect, it } from 'vitest';
import { buildExplorerGroups, isHiddenByCollapsedExplorerAncestor } from './explorerView';
import { completeExplorerHierarchy } from './explorerFolderNavigation';
import {
  explorerFolderKey, explorerSourceKey, explorerNavigationRows,
  isExplorerNavigationKey, resolveExplorerNavigation,
} from './explorerKeyboardNavigation';

const files = ['main.srp', 'a/main.srp', 'a/src/math.srp', 'b/main.srp']
  .map(name => ({ name, path: 'C:/workspace/' + name }));
const groups = completeExplorerHierarchy(buildExplorerGroups(files, [], null));
const root = explorerFolderKey('');
const a = explorerFolderKey('a');
const src = explorerFolderKey('a/src');
const b = explorerFolderKey('b');
const rootFile = explorerSourceKey(files[0].path);
const aFile = explorerSourceKey(files[1].path);
const srcFile = explorerSourceKey(files[2].path);
const bFile = explorerSourceKey(files[3].path);

function visible(collapsed: ReadonlySet<string> = new Set(), searching = false, busy = false) {
  const visibleGroups = groups.filter(group => searching ||
    !isHiddenByCollapsedExplorerAncestor(group.directory, collapsed));
  return explorerNavigationRows(visibleGroups, collapsed, searching, busy);
}

describe('Explorer keyboard navigation', () => {
  it('orders enabled folders and files exactly as rendered', () => {
    expect(visible().map(row => row.key)).toEqual([root, rootFile, a, aFile, src, srcFile, b, bFile]);
  });

  it('excludes collapsed descendants and files', () => {
    expect(visible(new Set(['a'])).map(row => row.key)).toEqual([root, rootFile, a, b, bFile]);
  });

  it('retains root sibling projects when root is collapsed', () => {
    expect(visible(new Set([''])).map(row => row.key)).toEqual([root, a, aFile, src, srcFile, b, bFile]);
  });

  it('skips disabled folder headings during search and keeps matching sources', () => {
    expect(visible(new Set(['a']), true).map(row => row.key)).toEqual([rootFile, aFile, srcFile, bFile]);
  });

  it('skips disabled source rows during native operations', () => {
    expect(visible(new Set(), false, true).map(row => row.key)).toEqual([root, a, src, b]);
    expect(visible(new Set(), true, true)).toEqual([]);
  });

  it('moves one enabled row at a time without wrapping', () => {
    const rows = visible();
    expect(resolveExplorerNavigation(rows, a, 'ArrowDown')).toEqual({ kind: 'focus', key: aFile });
    expect(resolveExplorerNavigation(rows, a, 'ArrowUp')).toEqual({ kind: 'focus', key: rootFile });
    expect(resolveExplorerNavigation(rows, root, 'ArrowUp')).toEqual({ kind: 'none' });
    expect(resolveExplorerNavigation(rows, bFile, 'ArrowDown')).toEqual({ kind: 'none' });
  });

  it('jumps to the first and last visible rows', () => {
    const rows = visible();
    expect(resolveExplorerNavigation(rows, a, 'Home')).toEqual({ kind: 'focus', key: root });
    expect(resolveExplorerNavigation(rows, a, 'End')).toEqual({ kind: 'focus', key: bFile });
  });

  it('expands a collapsed folder before navigating to a child', () => {
    expect(resolveExplorerNavigation(visible(new Set(['a'])), a, 'ArrowRight'))
      .toEqual({ kind: 'expand', directory: 'a' });
    expect(resolveExplorerNavigation(visible(), a, 'ArrowRight'))
      .toEqual({ kind: 'focus', key: aFile });
    expect(resolveExplorerNavigation(visible(new Set(), false, true), a, 'ArrowRight'))
      .toEqual({ kind: 'focus', key: src });
  });

  it('collapses expanded folders and returns from files to their own folders', () => {
    const rows = visible();
    expect(resolveExplorerNavigation(rows, src, 'ArrowLeft')).toEqual({ kind: 'collapse', directory: 'a/src' });
    expect(resolveExplorerNavigation(rows, srcFile, 'ArrowLeft')).toEqual({ kind: 'focus', key: src });
    expect(resolveExplorerNavigation(visible(new Set(['a/src'])), src, 'ArrowLeft'))
      .toEqual({ kind: 'focus', key: a });
  });

  it('does not treat the workspace root heading as the parent of sibling projects', () => {
    expect(resolveExplorerNavigation(visible(new Set(['a'])), a, 'ArrowLeft')).toEqual({ kind: 'none' });
    expect(resolveExplorerNavigation(visible(), root, 'ArrowRight')).toEqual({ kind: 'focus', key: rootFile });
  });

  it('ignores missing rows and right navigation on source rows', () => {
    expect(resolveExplorerNavigation(visible(), 'missing', 'Home')).toEqual({ kind: 'none' });
    expect(resolveExplorerNavigation(visible(), rootFile, 'ArrowRight')).toEqual({ kind: 'none' });
    expect(resolveExplorerNavigation(visible(new Set(), true), aFile, 'ArrowLeft')).toEqual({ kind: 'none' });
  });

  it('recognizes only the supported traversal keys', () => {
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']) {
      expect(isExplorerNavigationKey(key)).toBe(true);
    }
    for (const key of ['Enter', ' ', 'Tab', 'Delete', 'Escape']) {
      expect(isExplorerNavigationKey(key)).toBe(false);
    }
  });
});
