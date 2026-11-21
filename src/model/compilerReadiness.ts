import { isDirty, isScarpPath, sameFilePath, type StudioDocument } from './documents';

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

/**
 * Capture exactly the saved file that the user requested to run.
 * Setup can be asynchronous (discovery, consent, compiler capability probes).
 */
export interface ScarpRunSnapshot {
  documentId: string;
  path: string;
  savedContent: string;
}

export function captureRunSnapshot(document: StudioDocument | null): ScarpRunSnapshot {
  const path = runnableSource(document);
  return { documentId: document!.id, path, savedContent: document!.savedContent };
}

/** Revalidate after asynchronous compiler setup, just before starting a process. */
export function validateRunSnapshot(
  snapshot: ScarpRunSnapshot, activeDocument: StudioDocument | null,
): void {
  if (!activeDocument || activeDocument.id !== snapshot.documentId) {
    throw new Error('The active source changed during compiler setup. Click Run again.');
  }
  const currentPath = runnableSource(activeDocument);
  if (!sameFilePath(currentPath, snapshot.path) ||
      activeDocument.savedContent !== snapshot.savedContent) {
    throw new Error('The saved source changed during compiler setup. Review it and click Run again.');
  }
}
