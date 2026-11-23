import { fileName, sameFilePath } from './documents';
import { sourceLineAt } from './sourceLines';

/** Scarp's published --diagnostic-format=json schema v1, with scalar columns. */
export interface ScarpDiagnostic {
  code: string | null;
  message: string;
  path: string | null;
  line: number | null;
  column: number | null;
  /** Optional validated end of the compiler's half-open Unicode-scalar span. */
  endLine: number | null;
  endColumn: number | null;
  help: string | null;
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sourcePosition(value: unknown): { line: number; column: number } | null {
  if (!object(value)) return null;
  const { line, column } = value;
  if (!Number.isSafeInteger(line) || !Number.isSafeInteger(column) ||
      typeof line !== 'number' || typeof column !== 'number' ||
      line < 1 || column < 1 || line > 10_000_000 || column > 10_000_000) {
    return null;
  }
  return { line, column };
}

/** Parse only isolated compiler stderr supplied by the native service.
 * Program stdout is never an input. Malformed/future schemas stay raw.
 */
export function parseScarpDiagnostic(stderr: string | null): ScarpDiagnostic | null {
  if (!stderr) return null;
  const raw = stderr.trimStart().split(/\r?\n/, 1)[0];
  if (!raw || raw.length > 64 * 1024) return null;
  try {
    const diagnostic: unknown = JSON.parse(raw);
    if (!object(diagnostic) || diagnostic.schema_version !== 1 ||
        diagnostic.severity !== 'error' || typeof diagnostic.message !== 'string' ||
        diagnostic.span_encoding !== 'utf-8-bytes' ||
        diagnostic.column_encoding !== 'unicode-scalar' ||
        diagnostic.position_base !== 1) {
      return null;
    }
    const code = typeof diagnostic.code === 'string' && /^E\d{4}$/.test(diagnostic.code)
      ? diagnostic.code : null;
    const primary = object(diagnostic.primary) ? diagnostic.primary : null;
    const start = sourcePosition(primary?.start);
    const candidateEnd = sourcePosition(primary?.end);
    // Half-open compiler span: a missing, reversed or zero-width end is not
    // safe to underline as a source range. Preserve the valid start alone.
    const end = start && candidateEnd &&
      (candidateEnd.line > start.line ||
        (candidateEnd.line === start.line && candidateEnd.column > start.column))
      ? candidateEnd : null;
    const path = typeof primary?.path === 'string' && primary.path.length <= 4096
      ? primary.path : null;
    return {
      code,
      message: diagnostic.message,
      path: start ? path : null,
      line: start ? start.line : null,
      column: start ? start.column : null,
      endLine: end?.line ?? null,
      endColumn: end?.column ?? null,
      help: typeof diagnostic.help === 'string' ? diagnostic.help : null,
    };
  } catch {
    return null;
  }
}

/** Imported-module diagnostics cannot navigate the active tab by accident. */
export function diagnosticBelongsToSource(diagnosticPath: string, sourcePath: string): boolean {
  if (sameFilePath(diagnosticPath, sourcePath)) return true;
  if (/[\\/]/.test(diagnosticPath)) return false;
  const basename = fileName(sourcePath);
  if (diagnosticPath === basename) return true;
  // Windows paths already compare case-insensitively in sameFilePath. A bare
  // compiler diagnostic filename deserves the same treatment, but matching
  // differently cased POSIX basenames would risk navigating a distinct file.
  const windowsSource = /^[A-Za-z]:[\\/]/.test(sourcePath) || /^\\\\/.test(sourcePath);
  return windowsSource && diagnosticPath.toLowerCase() === basename.toLowerCase();
}

/** A compiler-reported position must exist in this unchanged source.
 * Reject oversized columns rather than silently moving the caret to EOL.
 */
export function diagnosticSourcePosition(
  diagnostic: ScarpDiagnostic | null, sourcePath: string, content: string,
): { lineNumber: number; column: number } | null {
  if (!diagnostic?.path || diagnostic.line === null || diagnostic.column === null ||
      !diagnosticBelongsToSource(diagnostic.path, sourcePath)) return null;
  // If the main file imports other modules, a basename-only diagnostic could
  // refer to a different module with the same name. Require a full path.
  if (!sameFilePath(diagnostic.path, sourcePath) &&
      /^\s*(?:pub\s+)?import\s+["']/m.test(content)) return null;
  const line = sourceLineAt(content, diagnostic.line);
  if (line === null) return null;
  // An insertion-point diagnostic can legitimately identify the column
  // immediately after the last Unicode scalar.
  const scalarCount = Array.from(line).length;
  if (diagnostic.column < 1 || diagnostic.column > scalarCount + 1) return null;
  return {
    lineNumber: diagnostic.line,
    column: scalarColumnToUtf16(line, diagnostic.column),
  };
}

/** Scarp columns are Unicode scalar values, while Monaco uses UTF-16 offsets. */
export function scalarColumnToUtf16(sourceLine: string, scalarColumn: number): number {
  if (!Number.isSafeInteger(scalarColumn) || scalarColumn < 1) return 1;
  let column = 1;
  let remaining = scalarColumn - 1;
  for (const scalar of sourceLine) {
    if (remaining-- <= 0) break;
    column += scalar.length;
  }
  return column;
}
