import type { MatchingMode } from '../model/intelliSensePreferences';
import { MAX_ASSIST_SCAN_UNITS, MAX_COMPLETION_PREFIX_UNITS } from './assist';
import { blocksLocalFunctionName } from './localCallContext';

export type CompletionContext = 'unqualified' | 'blocked';

/** Smaller is better. Prefix matches always precede abbreviation matches.
 * Case handling is owned by the caller: catalog uses lowercase; local names
 * preserve exact ASCII spelling. Linear in the bounded candidate length. */
export function completionMatchRank(label: string, needle: string, mode: MatchingMode): number {
  if (needle.length > MAX_COMPLETION_PREFIX_UNITS || label.length > 256) return Infinity;
  if (label === needle) return 0;
  if (label.startsWith(needle)) return 1;
  if (mode !== 'subsequence' || !needle.length || !/^[A-Za-z_0-9]+$/.test(needle)) return Infinity;
  let cursor = 0;
  let first = -1;
  let last = -1;
  let gaps = 0;
  for (let i = 0; i < label.length && cursor < needle.length; i++) {
    if (label[i] !== needle[cursor]) continue;
    if (first < 0) first = i;
    else gaps += i - last - 1;
    last = i;
    cursor++;
  }
  if (cursor !== needle.length) return Infinity;
  return 2 + first * 4 + gaps * 2 + Math.min(label.length, 256);
}

/** Same-line conservative heuristic only. Whole-source local resolution
 * performs its own independent lexical validation. Do not interpret '>' on
 * its own as qualification because comparison is a valid expression context. */
export function lineCompletionContext(line: string, start: number): CompletionContext {
  if (!Number.isSafeInteger(start) || start < 0 || start > line.length || line.length > MAX_ASSIST_SCAN_UNITS) return 'blocked';
  const preceding = line.slice(0, start).trimEnd();
  if (/(?:\.|::|->)$/.test(preceding)) return 'blocked';
  const word = /(?:^|[^A-Za-z_0-9])([A-Za-z_][A-Za-z_0-9]*)$/.exec(preceding)?.[1];
  return word && blocksLocalFunctionName(word) ? 'blocked' : 'unqualified';
}
