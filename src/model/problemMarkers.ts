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
 * A valid same-line half-open compiler end highlights the actual short span.
 * Older, malformed, multiline or excessively long spans retain the safe
 * single-scalar fallback, without ever clamping a position beyond the source.
 */
const MAX_MARKER_SPAN_SCALARS = 160;

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
  let endColumn = position.column + width;
  if (diagnostic.column !== null && diagnostic.endColumn !== null &&
      diagnostic.endLine === position.lineNumber &&
      diagnostic.endColumn > diagnostic.column &&
      diagnostic.endColumn - diagnostic.column <= MAX_MARKER_SPAN_SCALARS) {
    // Validate against the same verified source and Monaco's UTF-16 column
    // convention. A compiler end beyond EOL is never silently clamped.
    const end = diagnosticSourcePosition(
      { ...diagnostic, line: diagnostic.endLine, column: diagnostic.endColumn },
      document.path, document.content,
    );
    if (end?.lineNumber === position.lineNumber && end.column > position.column) {
      endColumn = end.column;
    }
  }
  return {
    startLineNumber: position.lineNumber,
    startColumn: position.column,
    endLineNumber: position.lineNumber,
    endColumn,
    message: diagnostic.message,
    ...(diagnostic.code ? { code: diagnostic.code } : {}),
  };
}
