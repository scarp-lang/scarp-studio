import type { ExplorerGroup } from './explorerView';

export type ExplorerRow =
  | { readonly kind: 'folder'; readonly key: string; readonly directory: string; readonly expanded: boolean }
  | { readonly kind: 'source'; readonly key: string; readonly directory: string; readonly path: string };

export const explorerFolderKey = (directory: string) => 'folder:' + directory;
export const explorerSourceKey = (path: string) => 'source:' + path;

export type ExplorerNavigationKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End';

export type ExplorerNavigationAction =
  | { readonly kind: 'focus'; readonly key: string }
  | { readonly kind: 'expand' | 'collapse'; readonly directory: string }
  | { readonly kind: 'none' };

const NONE: ExplorerNavigationAction = Object.freeze({ kind: 'none' });

export function isExplorerNavigationKey(key: string): key is ExplorerNavigationKey {
  return key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' ||
    key === 'ArrowRight' || key === 'Home' || key === 'End';
}

/** This list follows rendered order, not the filesystem. Only enabled,
 * visible navigation buttons participate; project switching and filters
 * retain their independent native Tab/Enter behavior. */
export function explorerNavigationRows(
  visibleGroups: readonly ExplorerGroup[],
  collapsed: ReadonlySet<string>,
  searching: boolean,
  busy: boolean,
): readonly ExplorerRow[] {
  const rows: ExplorerRow[] = [];
  for (const group of visibleGroups) {
    const expanded = searching || !collapsed.has(group.directory);
    if (!searching) rows.push({
      kind: 'folder', key: explorerFolderKey(group.directory),
      directory: group.directory, expanded,
    });
    if (expanded && !busy) for (const source of group.sources) {
      rows.push({ kind: 'source', key: explorerSourceKey(source.path),
        directory: group.directory, path: source.path });
    }
  }
  return rows;
}

function focus(row: ExplorerRow | undefined, current: ExplorerRow): ExplorerNavigationAction {
  return row && row.key !== current.key ? { kind: 'focus', key: row.key } : NONE;
}

function parentFolder(rows: readonly ExplorerRow[], row: ExplorerRow): ExplorerRow | undefined {
  if (row.kind === 'source') {
    return rows.find(item => item.kind === 'folder' && item.directory === row.directory);
  }
  // Root is a sibling heading for direct root sources, not a parent above
  // all top-level project folders.
  const slash = row.directory.lastIndexOf('/');
  if (slash < 0) return undefined;
  const parent = row.directory.slice(0, slash);
  return rows.find(item => item.kind === 'folder' && item.directory === parent);
}

function firstChild(rows: readonly ExplorerRow[], row: Extract<ExplorerRow, { kind: 'folder' }>): ExplorerRow | undefined {
  return rows.find(item => {
    if (item.kind === 'source') return item.directory === row.directory;
    if (!row.directory || !item.directory.startsWith(row.directory + '/')) return false;
    return item.directory.slice(row.directory.length + 1).indexOf('/') < 0;
  });
}

export function resolveExplorerNavigation(
  rows: readonly ExplorerRow[],
  currentKey: string,
  key: ExplorerNavigationKey,
): ExplorerNavigationAction {
  const index = rows.findIndex(row => row.key === currentKey);
  if (index < 0) return NONE;
  const current = rows[index];
  switch (key) {
    case 'ArrowUp': return focus(rows[index - 1], current);
    case 'ArrowDown': return focus(rows[index + 1], current);
    case 'Home': return focus(rows[0], current);
    case 'End': return focus(rows[rows.length - 1], current);
    case 'ArrowLeft':
      if (current.kind === 'folder' && current.expanded) {
        return { kind: 'collapse', directory: current.directory };
      }
      return focus(parentFolder(rows, current), current);
    case 'ArrowRight':
      if (current.kind !== 'folder') return NONE;
      if (!current.expanded) return { kind: 'expand', directory: current.directory };
      return focus(firstChild(rows, current), current);
  }
}
