/** Human-readable reasons why the desktop window must remain open.
 * A live compiler can otherwise outlive its output panel when the UI closes.
 */
export function exitBlockReason(
  saving: boolean, executing: boolean, choosingCompiler: boolean,
): string | null {
  if (saving) return 'A file is being saved. Finish saving before exiting.';
  if (executing) return 'Scarp is running. Stop it and finish execution before exiting.';
  if (choosingCompiler) return 'Finish selecting the Scarp compiler before exiting.';
  return null;
}

/**
 * Manual saves must not change compiler inputs while Run/Verify is active
 * or while a compiler setup dialog/probe could immediately launch it.
 * The caller checks this before opening Save As and before writing.
 */
export function saveBlockReason(
  executing: boolean, choosingCompiler: boolean,
): string | null {
  if (executing) {
    return 'Scarp is running or verifying. Stop it or finish execution before saving.';
  }
  if (choosingCompiler) {
    return 'Finish the compiler selection or verification setup before saving.';
  }
  return null;
}
