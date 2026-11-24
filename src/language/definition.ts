import {
  isScarpCodePosition, MAX_ASSIST_SCAN_UNITS, MAX_SCARP_OUTLINE_SYMBOLS,
  scanScarpFunctions, type ScarpFunctionSymbol,
} from './assist';

/** Editor-only, bounded lookup for unqualified function calls. It is not
 * compiler symbol resolution: imports, field access, and duplicate names
 * deliberately yield no result rather than a guessed navigation target.
 */
export const MAX_DEFINITION_SOURCE_UNITS = 512 * 1024;

export function scarpCallNameAt(line: string, column: number): string | null {
  const offset = column - 1;
  if (!Number.isSafeInteger(column) || offset < 0 || offset >= line.length ||
      line.length > MAX_ASSIST_SCAN_UNITS || !isScarpCodePosition(line, offset)) return null;
  for (const match of line.matchAll(/[A-Za-z_][A-Za-z_0-9]*/g)) {
    const start = match.index;
    const end = start + match[0].length;
    if (offset < start) return null;
    if (offset >= end) continue;
    if (!isScarpCodePosition(line, start) ||
        (start > 0 && /[A-Za-z_0-9]/.test(line[start - 1])) ||
        !/^\s*\(/.test(line.slice(end))) return null;
    const prefix = line.slice(0, start).trimEnd();
    // Module names use '.', variant constructors '::', fields '->'.
    // Do not resolve declaration names or construction syntax as calls.
    if (/[.:>]$/.test(prefix) || /\b(?:funcra|new)\s*$/.test(prefix)) return null;
    return match[0];
  }
  return null;
}

/** Suppress a target when the bounded inventory may have omitted a duplicate.
 * The call-site check is independent of model word-separator configuration.
 */
export function findLocalFunctionDefinition(
  source: string, name: string,
): ScarpFunctionSymbol | null {
  if (source.length > MAX_DEFINITION_SOURCE_UNITS ||
      !/^[A-Za-z_][A-Za-z_0-9]*$/.test(name)) return null;
  const functions = scanScarpFunctions(source);
  if (functions.length >= MAX_SCARP_OUTLINE_SYMBOLS) return null;
  const matches = functions.filter(symbol => symbol.name === name);
  return matches.length === 1 ? matches[0] : null;
}
