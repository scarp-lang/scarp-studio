import { MAX_ASSIST_SCAN_UNITS, MAX_COMPLETION_PREFIX_UNITS, isScarpCodePosition } from './assist';
import { indexLocalFunctionHeaders, MAX_DEFINITION_SOURCE_UNITS } from './definition';
import { readLocalParameters } from './signature';
import { scanScarpSource, tokenAtOffset } from './sourceLex';
import { blocksLocalFunctionName } from './localCallContext';

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

/** Validate the full replacement range against a bounded source snapshot.
 * Comments and line breaks are trivia, but qualification and declaration
 * keywords on preceding lines must still suppress local-function suggestions.
 * Never widen a replacement to an unsupported or only partly recognized name.
 */
export function canCompleteLocalFunctionAtOffset(
  source: string, start: number, end: number, prefix: string,
): boolean {
  if (source.length > MAX_DEFINITION_SOURCE_UNITS ||
      !Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
      start < 0 || end > source.length || end < start + prefix.length ||
      prefix.length > MAX_COMPLETION_PREFIX_UNITS ||
      !/^[A-Za-z_][A-Za-z_0-9]*$/.test(prefix) ||
      source.slice(start, start + prefix.length) !== prefix) return false;
  const lexical = scanScarpSource(source);
  if (!lexical.complete || lexical.issues.length) return false;
  const token = tokenAtOffset(lexical.tokens, start);
  if (!token || token.kind !== 'identifier' || token.previewTruncated ||
      token.start !== start || token.end !== end ||
      token.column + prefix.length > MAX_ASSIST_SCAN_UNITS + 1) return false;
  if ((start > 0 && /[^\x00-\x7f]/.test(source[start - 1])) ||
      (end < source.length && /[^\x00-\x7f]/.test(source[end]))) return false;
  let previous = lexical.tokens.indexOf(token) - 1;
  while (previous >= 0 && lexical.tokens[previous].kind === 'comment') previous--;
  const before = lexical.tokens[previous];
  if (!before) return true;
  return (before.kind !== 'identifier' && before.kind !== 'operator') ||
    !blocksLocalFunctionName(before.text);
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
