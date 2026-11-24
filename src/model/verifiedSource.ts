import { isDirty, sameFilePath, type StudioDocument } from './documents';

/** Identity and generation of the precise saved source submitted to Scarp.
 * Equal text is not evidence of the same editor version after an A-B-A edit,
 * save, or close/reopen. The verifier's display and F8 navigation are separate.
 */
export interface VerifiedSourceSnapshot {
  documentId: string;
  path: string;
  content: string;
  revision: number;
}

/** Only a named clean source can be the subject of a compiler verification. */
export function captureVerifiedSource(
  document: StudioDocument | null,
): VerifiedSourceSnapshot | null {
  if (!document?.path || isDirty(document)) return null;
  return {
    documentId: document.id,
    path: document.path,
    content: document.savedContent,
    revision: document.revision,
  };
}

/** Old errors may stay visible in output, but must never attach to newer text.
 * We deliberately do NOT require current active-tab focus; switching away
 * and returning without modifying the source is safe.
 */
export function isCurrentVerifiedSource(
  verified: VerifiedSourceSnapshot | null,
  document: StudioDocument | null,
): boolean {
  return verified !== null && document !== null && document.path !== null &&
    verified.documentId === document.id &&
    sameFilePath(verified.path, document.path) &&
    verified.content === document.content &&
    verified.content === document.savedContent &&
    verified.revision === document.revision;
}

/** Retain a previous Verify's source ONLY while it still exists as an
 * unchanged saved document. Switching focus, opening a different tab and
 * editing unrelated tabs do not invalidate the source that was verified.
 * A-to-B-to-A edits, saves, close/reopen and changed paths fail closed.
 *
 * Called after every reducer transition; returning the same reference avoids
 * unnecessary rerenders, and null discards an obsolete source text snapshot.
 */
export function retainVerifiedSourceSnapshot(
  verified: VerifiedSourceSnapshot | null,
  documents: readonly StudioDocument[],
): VerifiedSourceSnapshot | null {
  if (!verified) return null;
  return documents.some((document) => isCurrentVerifiedSource(verified, document))
    ? verified
    : null;
}
