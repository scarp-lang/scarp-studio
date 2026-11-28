import { isDirty, isScarpPath, sameFilePath, type StudioDocument } from './documents';
import { MAX_DISPLAYED_SCARP_FILES, safeRelativeScarpSourceName } from './folderListing';
import type { NavigationEntry } from './navigation';

export interface ListedProjectSource {
  /** A display-only relative name from the bounded Scarp Explorer listing. */
  name: string;
  /** The original absolute path returned by the scoped folder picker. */
  path: string;
}

export type QuickOpenEntry =
  | (NavigationEntry & { kind: 'tab'; documentId: string; path?: string | null; modified?: boolean; relativeLabel?: string })
  | (NavigationEntry & { kind: 'project'; sourcePath: string });

/** Include only already-open tabs and explicitly listed Scarp project files.
 * Building this palette never reads source files or scans the filesystem.
 * Paths are opaque selectors: the native read still checks the live listing.
 */
export function buildQuickOpenEntries(
  documents: readonly StudioDocument[],
  listedFiles: readonly ListedProjectSource[],
): QuickOpenEntry[] {
  const entries: QuickOpenEntry[] = documents.map((document) => ({
    kind: 'tab',
    documentId: document.id,
    path: document.path,
    modified: isDirty(document),
    relativeLabel: document.path === null ? undefined : listedFiles.slice(0, MAX_DISPLAYED_SCARP_FILES)
      .find(source => safeRelativeScarpSourceName(source.name) && isScarpPath(source.path) &&
        sameFilePath(source.path, document.path!))?.name,
    id: 'tab:' + document.id,
    label: document.name,
    detail: (document.path ?? 'Unsaved Scarp source') +
      (isDirty(document) ? ' • modified' : '') + ' • open tab',
  }));
  const listedPaths: string[] = [];
  // An extra guard protects the palette if a caller ever supplies an
  // oversized or malformed listing. It never widens filesystem access.
  for (const [index, source] of listedFiles.slice(0, MAX_DISPLAYED_SCARP_FILES).entries()) {
    if (!safeRelativeScarpSourceName(source.name) || !isScarpPath(source.path)) continue;
    if (documents.some((document) =>
      document.path !== null && sameFilePath(document.path, source.path))) continue;
    if (listedPaths.some((path) => sameFilePath(path, source.path))) continue;
    listedPaths.push(source.path);
    entries.push({
      kind: 'project',
      sourcePath: source.path,
      id: 'project:' + index,
      label: source.name,
      detail: source.path + ' • selected project',
    });
  }
  return entries;
}
