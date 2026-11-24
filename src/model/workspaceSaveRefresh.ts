import { sameFilePath } from './documents';

/** Existing file writes never change the Explorer's file membership. Only a
 * first Save or Save As to a different path can introduce a newly listed
 * source. This is a UI-refresh hint, not a filesystem authorization check.
 */
export function saveChangesWorkspaceListing(
  priorPath: string | null, writtenPath: string,
): boolean {
  return priorPath === null || !sameFilePath(priorPath, writtenPath);
}
