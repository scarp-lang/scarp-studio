import type { StudioDocument } from './documents';
import {
  canApplyReplacementSnapshots, sameOpenDocumentSnapshots,
  type BufferReplacement, type EditorState,
} from './editorState';

/** A one-level, in-memory undo for the most recently confirmed Replace All.
 * Snapshots include ALL open tabs, even tabs that had no matching text.
 */
export interface OpenFileReplaceUndo {
  after: readonly StudioDocument[];
  changes: readonly BufferReplacement[];
}

export function createOpenFileReplaceUndo(
  before: readonly StudioDocument[],
  after: readonly StudioDocument[],
): OpenFileReplaceUndo | null {
  if (before.length !== after.length) return null;
  // Only a pure in-memory content change is reversible by this feature.
  // Never silently restore a path or savedContent changed by a Save/Reload.
  if (!before.every((document, index) => {
    const current = after[index];
    return current !== undefined &&
      current.id === document.id &&
      current.path === document.path &&
      current.name === document.name &&
      current.savedContent === document.savedContent;
  })) return null;
  const changes: BufferReplacement[] = before.flatMap((document, index) =>
    document.content === after[index].content
      ? []
      : [{ id: document.id, snapshot: after[index], content: document.content }],
  );
  if (!changes.length) return null;
  return { after: after.slice(), changes };
}

/** Reject undo if ANY open tab changed after the replacement, even a tab
 * without matches. Only current unsaved buffers can be restored; disk stays
 * unchanged until an explicit Save/Save All.
 */
export function canUndoOpenFileReplace(
  undo: OpenFileReplaceUndo,
  state: EditorState,
): boolean {
  return sameOpenDocumentSnapshots(undo.after, state.documents) &&
    canApplyReplacementSnapshots(state, undo.changes);
}
