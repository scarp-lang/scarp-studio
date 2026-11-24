import { MAX_ASSIST_SCAN_UNITS, MAX_COMPLETION_PREFIX_UNITS, isScarpCodePosition } from './assist';
import { indexLocalFunctionHeaders, MAX_DEFINITION_SOURCE_UNITS } from './definition';
import { readLocalParameters } from './signature';

export interface LocalFunctionCompletion {
  name: string;
  detail: string;
}

export const MAX_LOCAL_COMPLETIONS = 20;

/** Only explicit ASCII prefixes in an unqualified code position qualify.
 * This is not a scope-aware name resolver. Keep local suggestions separate
 * from compiler-provided keywords/builtins, and never insert arguments
 * or punctuation that could duplicate an existing call suffix. */
export function canCompleteLocalFunction(line: string, start: number, prefix: string): boolean {
  if (line.length > MAX_ASSIST_SCAN_UNITS || !Number.isSafeInteger(start) ||
      start < 0 || prefix.length > MAX_COMPLETION_PREFIX_UNITS ||
      !/^[A-Za-z_][A-Za-z_0-9]*$/.test(prefix) ||
      line.slice(start, start + prefix.length) !== prefix ||
      !isScarpCodePosition(line, start) || !isScarpCodePosition(line, start + prefix.length)) return false;
  if (start > 0 && /[A-Za-z_0-9]/.test(line[start - 1])) return false;
  const before = line.slice(0, start).trimEnd();
  return !/[.:>]$/.test(before) &&
    !/\b(?:funcra|new|record|variant|bind|var|import|as)\s*$/.test(before);
}

export function completeLocalFunctions(
  source: string, prefix: string, exclude: ReadonlySet<string> = new Set(),
): LocalFunctionCompletion[] {
  if (source.length > MAX_DEFINITION_SOURCE_UNITS ||
      prefix.length > MAX_COMPLETION_PREFIX_UNITS ||
      !/^[A-Za-z_][A-Za-z_0-9]*$/.test(prefix)) return [];
  const headers = indexLocalFunctionHeaders(source);
  if (!headers) return [];
  const counts = new Map<string, number>();
  for (const header of headers) counts.set(header.name, (counts.get(header.name) ?? 0) + 1);
  const results: LocalFunctionCompletion[] = [];
  for (const header of headers) {
    if (!header.name.startsWith(prefix) || counts.get(header.name) !== 1 || exclude.has(header.name)) continue;
    const parameters = readLocalParameters(source, header.openOffset);
    if (!parameters) continue;
    results.push({ name: header.name, detail: header.name + '(' + parameters.join(', ') + ')' });
    if (results.length >= MAX_LOCAL_COMPLETIONS) break;
  }
  return results;
}
