import { sameFilePath, type StudioDocument } from './documents';
import { currentActiveDocument, isUnchangedSnapshot, type EditorState } from './editorState';

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

// A selected folder's object identity changes on Choose Folder and Refresh.
// Delayed file reads may never replace the editor's current work after either
// a folder change or an edit to the active buffer.
export function isCurrentListedSourceRead(
  initialSelection: object,
  currentSelection: object | null,
  initialActiveId: string | null,
  initialActiveSnapshot: StudioDocument | null,
  currentEditor: EditorState,
): boolean {
  if (initialSelection !== currentSelection || initialActiveId !== currentEditor.activeId) {
    return false;
  }
  const current = currentActiveDocument(currentEditor);
  return initialActiveSnapshot === null
    ? current === null
    : current !== null && isUnchangedSnapshot(current, initialActiveSnapshot);
}
