import { isDirty, isScarpPath, type StudioDocument } from './documents';

/** Compiler commands always operate on a saved Scarp file, never a stale buffer. */
export function runnableSource(document: StudioDocument | null): string {
  if (!document) throw new Error('Open a Scarp source file first.');
  if (!document.path || !isScarpPath(document.path)) {
    throw new Error('Save the source as a .srp file before Run or Verify.');
  }
  if (isDirty(document)) {
    throw new Error('Save your latest edits before Run or Verify.');
  }
  return document.path;
}
