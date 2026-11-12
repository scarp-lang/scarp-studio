import { fileName, sameFilePath } from './documents';

/** Scarp's published --diagnostic-format=json schema v1, with scalar columns. */
export interface ScarpDiagnostic {
  code: string | null;
  message: string;
  path: string | null;
  line: number | null;
  column: number | null;
  help: string | null;
}

const DIAGNOSTIC_MARKER = '\nCompiler diagnostics:\n';

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

/** Only parse JSON from the compiler's stderr marker, never from program stdout.
 * Malformed and future diagnostic schemas remain visible as raw output.
 */
export function parseScarpDiagnostic(output: string): ScarpDiagnostic | null {
  const offset = output.lastIndexOf(DIAGNOSTIC_MARKER);
  if (offset < 0) return null;
  const raw = output.slice(offset + DIAGNOSTIC_MARKER.length).trimStart().split(/\r?\n/, 1)[0];
  if (!raw || raw.length > 64 * 1024) return null;
  try {
    const diagnostic: unknown = JSON.parse(raw);
    if (!object(diagnostic) || diagnostic.schema_version !== 1 ||
        diagnostic.severity !== 'error' || typeof diagnostic.message !== 'string') {
      return null;
    }
    const code = typeof diagnostic.code === 'string' && /^E\d{4}$/.test(diagnostic.code)
      ? diagnostic.code : null;
    const primary = object(diagnostic.primary) ? diagnostic.primary : null;
    const start = sourcePosition(primary?.start);
    const path = typeof primary?.path === 'string' && primary.path.length <= 4096
      ? primary.path : null;
    return {
      code,
      message: diagnostic.message,
      path: start ? path : null,
      line: start ? start.line : null,
      column: start ? start.column : null,
      help: typeof diagnostic.help === 'string' ? diagnostic.help : null,
    };
  } catch {
    return null;
  }
}

/** Imported-module diagnostics cannot navigate the active tab by accident. */
export function diagnosticBelongsToSource(diagnosticPath: string, sourcePath: string): boolean {
  if (sameFilePath(diagnosticPath, sourcePath)) return true;
  return !/[\\/]/.test(diagnosticPath) && diagnosticPath === fileName(sourcePath);
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
