import { isDirty, isScarpPath, sameFilePath, type StudioDocument } from './documents';
import {
  MAX_DISPLAYED_SCARP_FILES, MAX_SCANNED_SCARP_DIRECTORIES,
  safeRelativeScarpDirectory, safeRelativeScarpSourceName,
} from './folderListing';
import type { ListedProjectSource } from './projectQuickOpen';

export const EXPLORER_GROUPS = ['', 'src', 'tests', 'examples'] as const;
export type ExplorerDirectory = string;
export type ExplorerFilter = 'all' | 'open' | 'modified';
export interface ExplorerSource extends ListedProjectSource {
  directory: ExplorerDirectory;
  basename: string;
  documentId: string | null;
  active: boolean;
  modified: boolean;
  entrypoint: boolean;
}
export interface ExplorerGroup {
  directory: ExplorerDirectory;
  sources: ExplorerSource[];
}
const compareNames = (a: ExplorerSource, b: ExplorerSource) =>
  Number(b.entrypoint) - Number(a.entrypoint) ||
  a.basename.localeCompare(b.basename, 'en', { numeric: true }) ||
  (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

function compareDirectories(a: string, b: string): number {
  if (!a) return -1;
  if (!b) return 1;
  const left = a.split('/');
  const right = b.split('/');
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    if (left[i] === right[i]) continue;
    if (i === 0) {
      const p = EXPLORER_GROUPS.indexOf(left[i] as typeof EXPLORER_GROUPS[number]);
      const q = EXPLORER_GROUPS.indexOf(right[i] as typeof EXPLORER_GROUPS[number]);
      if (p >= 0 || q >= 0) {
        if (p < 0) return 1;
        if (q < 0) return -1;
        return p - q;
      }
    }
    const order = left[i].localeCompare(right[i], 'en', { numeric: true });
    return order || (left[i] < right[i] ? -1 : 1);
  }
  return left.length - right.length;
}

/** Presentation only: does not enumerate directories or authorize paths. */
export function buildExplorerGroups(
  files: readonly ListedProjectSource[], documents: readonly StudioDocument[],
  activeId: string | null, directories: readonly string[] = [],
): ExplorerGroup[] {
  const groups = new Map<string, ExplorerGroup>();
  for (const directory of directories.slice(0, MAX_SCANNED_SCARP_DIRECTORIES - 1)) {
    if (safeRelativeScarpDirectory(directory) && !groups.has(directory)) {
      groups.set(directory, { directory, sources: [] });
    }
  }
  const seenPaths: string[] = [];
  for (const entry of files.slice(0, MAX_DISPLAYED_SCARP_FILES)) {
    if (!safeRelativeScarpSourceName(entry.name) || !isScarpPath(entry.path) ||
        seenPaths.some(path => sameFilePath(path, entry.path))) continue;
    seenPaths.push(entry.path);
    const slash = entry.name.lastIndexOf('/');
    const directory = slash < 0 ? '' : entry.name.slice(0, slash);
    const basename = entry.name.slice(slash + 1);
    const group: ExplorerGroup = groups.get(directory) ?? { directory, sources: [] };
    if (!groups.has(directory)) groups.set(directory, group);
    const document = documents.find(item => item.path !== null && sameFilePath(item.path, entry.path));
    group.sources.push({
      ...entry, directory, basename,
      documentId: document?.id ?? null,
      active: document !== undefined && document.id === activeId,
      modified: document !== undefined && isDirty(document),
      entrypoint: basename.toLowerCase() === 'main.srp',
    });
  }
  return [...groups.values()].filter(group =>
    group.sources.length > 0 || directories.includes(group.directory))
    .map(group => ({ ...group, sources: group.sources.sort(compareNames) }))
    .sort((a, b) => compareDirectories(a.directory, b.directory));
}

export function filterExplorerGroups(
  groups: readonly ExplorerGroup[], query: string, filter: ExplorerFilter,
): ExplorerGroup[] {
  const terms = query.slice(0, 160).trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length && filter === 'all') return [...groups];
  return groups.map(group => ({
    directory: group.directory,
    sources: group.sources.filter(source =>
      (filter === 'all' || (filter === 'open' ? source.documentId !== null : source.modified)) &&
      terms.every(term => source.name.toLowerCase().includes(term))),
  })).filter(group => group.sources.length > 0);
}
