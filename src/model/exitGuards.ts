import { sameOpenDocumentSnapshots, type EditorState } from './editorState';

/** Human-readable reasons why the desktop window must remain open.
 * A live compiler can otherwise outlive its output panel when the UI closes.
 */
export function exitBlockReason(
  saving: boolean, executing: boolean, choosingCompiler: boolean, choosingSource: boolean = false,
): string | null {
  if (saving) return 'A file is being saved. Finish saving before exiting.';
  if (executing) return 'Scarp is running. Stop it and finish execution before exiting.';
  if (choosingCompiler) return 'Finish selecting the Scarp compiler before exiting.';
  if (choosingSource) return 'Finish choosing a Scarp source or folder before exiting.';
  return null;
}

/** An exit confirmation covers the entire editor state, not only dirty tabs.
 * A clean tab can be edited and saved while a native question is outstanding;
 * a tab may also be opened and closed (A-B-A) before the response arrives.
 * Fail closed so the user's exit decision never applies to a newer session.
 */
export function sameExitEditorState(
  initial: EditorState, current: EditorState,
): boolean {
  return initial.activeId === current.activeId &&
    initial.nextUntitled === current.nextUntitled &&
    sameOpenDocumentSnapshots(initial.documents, current.documents);
}
