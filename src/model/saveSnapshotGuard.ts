import type { StudioDocument } from './documents';
import {
  hasUnchangedEditorSession, isUnchangedSnapshot, type EditorState,
} from './editorState';

/** An individual Save/Save As began for the active source, not for any
 * future editor session that merely happens to focus the same tab again.
 * Reject focus A→B→A, edits A→B→A, close/reopen, and unrelated edits while
 * the native chooser or pre-write disk check is awaiting completion.
 */
export function isCurrentSingleSaveRequest(
  started: EditorState,
  current: EditorState,
  source: StudioDocument,
): boolean {
  return started.activeId === source.id &&
    hasUnchangedEditorSession(started, current) &&
    current.documents.some((document) => isUnchangedSnapshot(document, source));
}

/** Save All captures each document immediately before its own dialog.
 * Changes to OTHER tabs are allowed while an earlier dialog is open; changes
 * to this exact pending source require a fresh snapshot and a new save request.
 */
export function isCurrentSaveAllSource(
  source: StudioDocument,
  current: StudioDocument | undefined,
): boolean {
  return current !== undefined && isUnchangedSnapshot(current, source);
}
