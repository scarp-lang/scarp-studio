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
