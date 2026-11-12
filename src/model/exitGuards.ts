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
