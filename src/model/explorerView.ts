import { isDirty, isScarpPath, sameFilePath, type StudioDocument } from './documents';
import { MAX_DISPLAYED_SCARP_FILES } from './folderListing';
import type { ListedProjectSource } from './projectQuickOpen';

export const EXPLORER_GROUPS = ['', 'src', 'tests', 'examples'] as const;
export type ExplorerDirectory = (typeof EXPLORER_GROUPS)[number];
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
const relativeSource = /^(?:(src|tests|examples)\/)?([^/\\\0]+\.srp)$/i;
const compareNames = (a: ExplorerSource, b: ExplorerSource) =>
  Number(b.entrypoint) - Number(a.entrypoint) ||
  a.basename.localeCompare(b.basename, 'en', { numeric: true }) ||
  (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/** Display-only transformation of the existing bounded listing. Never
 * construct paths, enumerate directories or read source text here. */
export function buildExplorerGroups(
  files: readonly ListedProjectSource[], documents: readonly StudioDocument[], activeId: string | null,
): ExplorerGroup[] {
  const groups = EXPLORER_GROUPS.map(directory => ({ directory, sources: [] as ExplorerSource[] }));
  const seen = new Set<string>();
  for (const entry of files.slice(0, MAX_DISPLAYED_SCARP_FILES)) {
    const match = relativeSource.exec(entry.name);
    if (!match || !isScarpPath(entry.path) || seen.has(entry.path)) continue;
    // Only fixed directory spellings returned by the existing source scanner.
    const group = groups.find(item => item.directory === (match[1] ?? ''));
    if (!group || /[\x00-\x1f]/.test(entry.name)) continue;
    seen.add(entry.path);
    const document = documents.find(item => item.path !== null && sameFilePath(item.path, entry.path));
    group.sources.push({
      ...entry, directory: group.directory, basename: match[2],
      documentId: document?.id ?? null, active: document !== undefined && document.id === activeId,
      modified: document !== undefined && isDirty(document),
      entrypoint: (group.directory === '' || group.directory === 'src') && match[2].toLowerCase() === 'main.srp',
    });
  }
  return groups.filter(group => group.sources.length).map(group => ({ ...group, sources: group.sources.sort(compareNames) }));
}

export function filterExplorerGroups(groups: readonly ExplorerGroup[], query: string, filter: ExplorerFilter): ExplorerGroup[] {
  const terms = query.slice(0, 160).trim().toLowerCase().split(/\s+/).filter(Boolean);
  return groups.map(group => ({
    directory: group.directory,
    sources: group.sources.filter(source =>
      (filter === 'all' || (filter === 'open' ? source.documentId !== null : source.modified)) &&
      terms.every(term => source.name.toLowerCase().includes(term))),
  })).filter(group => group.sources.length > 0);
}
