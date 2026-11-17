import { sameFilePath, type StudioDocument } from './documents';

/** An Explorer entry's path comes from a bounded, user-selected listing. */
export interface ListedSourcePath {
  path: string;
}

export type ListedProjectOpenDecision =
  | { kind: 'not-listed' }
  | { kind: 'activate'; documentId: string }
  | { kind: 'load'; path: string };

/** Never open a path absent from the *current* project listing.
 * Reuse an existing tab without re-reading the disk, because that would
 * otherwise make external renames/deletions block access to unsaved work.
 *
 * For a new tab, return the exact scoped listing path rather than a
 * caller-provided Windows spelling or alias.
 */
export function resolveListedProjectOpen(
  requestedPath: string,
  listedFiles: readonly ListedSourcePath[],
  documents: readonly StudioDocument[],
): ListedProjectOpenDecision {
  const selected = listedFiles.find((item) => sameFilePath(item.path, requestedPath));
  if (!selected) return { kind: 'not-listed' };
  const existing = documents.find((item) =>
    item.path !== null && sameFilePath(item.path, selected.path));
  return existing
    ? { kind: 'activate', documentId: existing.id }
    : { kind: 'load', path: selected.path };
}
