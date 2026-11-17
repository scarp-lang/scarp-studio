import { isScarpPath, sameFilePath, type StudioDocument } from './documents';

export type PickedSourceDecision =
  | { kind: 'stale' }
  | { kind: 'invalid' }
  | { kind: 'activate'; documentId: string }
  | { kind: 'read'; path: string };

/** The dialog response is allowed to change tabs only while the user's
 * original active tab remains selected. A newly created or switched tab is a
 * signal that the result would unexpectedly steal focus.
 *
 * Reopening a source already in memory NEVER requires a second disk read.
 */
export function decidePickedSourceOpen(
  path: string,
  documents: readonly StudioDocument[],
  activeAtPickerStart: string | null,
  currentActive: string | null,
): PickedSourceDecision {
  if (!isScarpPath(path)) return { kind: 'invalid' };
  if (activeAtPickerStart !== currentActive) return { kind: 'stale' };
  const existing = documents.find((document) =>
    document.path !== null && sameFilePath(document.path, path));
  return existing
    ? { kind: 'activate', documentId: existing.id }
    : { kind: 'read', path };
}
