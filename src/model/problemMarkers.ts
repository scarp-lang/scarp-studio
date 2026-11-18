import type { StudioDocument } from './documents';
import { diagnosticSourcePosition, type ScarpDiagnostic } from './diagnostics';
import { sourceLineAt } from './sourceLines';
import { isCurrentVerifiedSource, type VerifiedSourceSnapshot } from './verifiedSource';

export interface ScarpProblemMarker {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  message: string;
  code?: string;
}

/** Generate only an error marker backed by the exact verified source snapshot.
 * Scarp columns count Unicode scalars; Monaco uses UTF-16 code units.
 * This intentionally underlines a single scalar: older compilers may not
 * provide a reliable diagnostic end span.
 */
export function verifiedProblemMarker(
  diagnostic: ScarpDiagnostic | null,
  verified: VerifiedSourceSnapshot | null,
  document: StudioDocument | null,
): ScarpProblemMarker | null {
  if (!isCurrentVerifiedSource(verified, document) || !document?.path) return null;
  const position = diagnosticSourcePosition(diagnostic, document.path, document.content);
  if (!position || !diagnostic) return null;
  const line = sourceLineAt(document.content, position.lineNumber);
  if (line === null) return null;
  const index = position.column - 1;
  const scalar = line.codePointAt(index);
  // At an EOF insertion point, a zero-width marker stays within Monaco's
  // valid source bounds; do not underline an unrelated previous character.
  const width = scalar === undefined ? 0 : scalar > 0xffff ? 2 : 1;
  return {
    startLineNumber: position.lineNumber,
    startColumn: position.column,
    endLineNumber: position.lineNumber,
    endColumn: position.column + width,
    message: diagnostic.message,
    ...(diagnostic.code ? { code: diagnostic.code } : {}),
  };
}
