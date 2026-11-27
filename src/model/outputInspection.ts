import { nextLineBreak, lineBreakWidth } from './sourceLines';
import { unicodeSafePreviewBounds } from './utf8Text';
import { compareScarpSnapshots, type SourceDiffReport } from './sourceDiff';
import type { ActivityRecord } from './compilerActivity';

export const MAX_INSPECTION_UNITS = 256 * 1024;
export const MAX_INSPECTION_LINES = 6000;
export const MAX_INSPECTION_QUERY = 120;
export const MAX_INSPECTION_MATCHES = 500;
export const MAX_INSPECTION_PREVIEW = 320;
export const MAX_EXCERPT_UNITS = 8192;
export const MAX_EXCERPT_LINES = 21;
export const MAX_COMPARISON_UNITS = 128 * 1024;

export type OutputEnding = 'LF' | 'CRLF' | 'CR' | 'EOF';
export interface OutputLine {
  readonly number: number;
  readonly start: number;
  readonly end: number;
  readonly next: number;
  readonly ending: OutputEnding;
}
export interface OutputIndex {
  readonly lines: readonly OutputLine[];
  readonly scannedUnits: number;
  readonly totalUnits: number;
  readonly complete: boolean;
  readonly limit: 'units' | 'lines' | null;
}
export interface OutputMatch {
  readonly line: number;
  readonly start: number;
  readonly end: number;
}
export interface OutputSearchOptions {
  readonly query: string;
  readonly caseSensitive: boolean;
  readonly wholeWord: boolean;
}
export const DEFAULT_OUTPUT_SEARCH: OutputSearchOptions = Object.freeze({
  query: '', caseSensitive: false, wholeWord: false,
});
export interface OutputSearchResult {
  readonly matches: readonly OutputMatch[];
  readonly matchedLines: number;
  readonly complete: boolean;
  readonly reason: 'empty' | 'invalid' | 'index-limit' | 'match-limit' | null;
}
export interface OutputPreview {
  readonly text: string;
  readonly prefixOmitted: boolean;
  readonly suffixOmitted: boolean;
  readonly highlightStart: number | null;
  readonly highlightEnd: number | null;
}
export interface OutputExcerpt {
  readonly firstLine: number;
  readonly lastLine: number;
  readonly text: string;
  readonly units: number;
}
type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const failed = (error: string): Result<never> => ({ ok: false, error });

/** Scan only complete lines in a bounded prefix. Retain offsets, not copied
 * strings. A partially scanned line is never indexed as a complete line. */
export function indexCompilerOutput(output: string): OutputIndex {
  const prefix = output.slice(0, MAX_INSPECTION_UNITS);
  const lines: OutputLine[] = [];
  let start = 0;
  let limit: OutputIndex['limit'] = null;
  while (start <= prefix.length) {
    if (lines.length >= MAX_INSPECTION_LINES) { limit = 'lines'; break; }
    const end = nextLineBreak(prefix, start);
    if (end < 0) {
      if (prefix.length !== output.length) { limit = 'units'; break; }
      lines.push(Object.freeze({ number: lines.length + 1, start, end: prefix.length,
        next: prefix.length, ending: 'EOF' as const }));
      start = prefix.length;
      break;
    }
    // A final CR within the prefix can be half of a CRLF.
    if (end + 1 === prefix.length && prefix[end] === '\r' &&
        prefix.length < output.length && output[prefix.length] === '\n') {
      limit = 'units'; break;
    }
    const width = lineBreakWidth(prefix, end);
    const ending: OutputEnding = width === 2 ? 'CRLF' : prefix[end] === '\r' ? 'CR' : 'LF';
    lines.push(Object.freeze({ number: lines.length + 1, start, end, next: end + width, ending }));
    start = end + width;
  }
  return Object.freeze({ lines: Object.freeze(lines), scannedUnits: start,
    totalUnits: output.length, complete: limit === null, limit });
}
function literalExpression(query: string, caseSensitive: boolean): RegExp {
  const special = new Set(['.', '*', '+', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\']);
  const escaped = Array.from(query, char => special.has(char) ? '\\' + char : char).join('');
  return new RegExp(escaped, caseSensitive ? 'gu' : 'giu');
}
function wordAt(text: string, offset: number): boolean {
  if (offset < 0 || offset >= text.length) return false;
  const value = text.charCodeAt(offset);
  if (value >= 0xdc00 && value <= 0xdfff && offset > 0) {
    const prior = text.charCodeAt(offset - 1);
    if (prior >= 0xd800 && prior <= 0xdbff) offset--;
  }
  const code = text.codePointAt(offset);
  return code !== undefined && /[\p{L}\p{N}_]/u.test(String.fromCodePoint(code));
}
export function searchCompilerOutput(output: string, index: OutputIndex, options: OutputSearchOptions): OutputSearchResult {
  if (!options.query) return { matches: [], matchedLines: 0, complete: false, reason: 'empty' };
  if (options.query.length > MAX_INSPECTION_QUERY || /[\r\n]/.test(options.query)) {
    return { matches: [], matchedLines: 0, complete: false, reason: 'invalid' };
  }
  // The expression consists exclusively of escaped literal characters;
  // there are no caller-controlled operators or recursive matching.
  const pattern = literalExpression(options.query, options.caseSensitive);
  const matches: OutputMatch[] = [];
  let matchedLines = 0;
  for (const line of index.lines) {
    const text = output.slice(line.start, line.end);
    let foundOnLine = false;
    pattern.lastIndex = 0;
    for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
      const start = match.index;
      const end = start + match[0].length;
      if (options.wholeWord && (wordAt(text, start - 1) || wordAt(text, end))) continue;
      if (matches.length === MAX_INSPECTION_MATCHES) {
        return { matches, matchedLines, complete: false, reason: 'match-limit' };
      }
      if (!foundOnLine) { matchedLines++; foundOnLine = true; }
      matches.push(Object.freeze({ line: line.number, start: line.start + start, end: line.start + end }));
    }
  }
  return { matches, matchedLines, complete: index.complete, reason: index.complete ? null : 'index-limit' };
}
export function outputLine(index: OutputIndex, number: number): OutputLine | null {
  if (!Number.isSafeInteger(number) || number < 1) return null;
  return index.lines[number - 1] ?? null;
}
function insideLine(match: OutputMatch, line: OutputLine): boolean {
  return match.line === line.number && Number.isSafeInteger(match.start) &&
    Number.isSafeInteger(match.end) && match.start >= line.start &&
    match.end > match.start && match.end <= line.end;
}
export function outputPreview(output: string, line: OutputLine, match: OutputMatch | null = null): OutputPreview {
  const text = output.slice(line.start, line.end);
  const localMatch = match && insideLine(match, line) ? match : null;
  const focus = localMatch ? localMatch.start - line.start : 0;
  const windowStart = Math.max(0, Math.min(focus - 80, text.length - MAX_INSPECTION_PREVIEW));
  const bounds = unicodeSafePreviewBounds(text, windowStart, Math.min(text.length, windowStart + MAX_INSPECTION_PREVIEW));
  return {
    text: text.slice(bounds.start, bounds.end), prefixOmitted: bounds.start > 0,
    suffixOmitted: bounds.end < text.length,
    highlightStart: localMatch ? localMatch.start - line.start - bounds.start : null,
    highlightEnd: localMatch ? localMatch.end - line.start - bounds.start : null,
  };
}
export function outputContextLines(index: OutputIndex, focus: number, radius: number): readonly OutputLine[] {
  if (!outputLine(index, focus) || !Number.isSafeInteger(radius) || radius < 0 || radius > 10) return [];
  return index.lines.slice(Math.max(0, focus - radius - 1), Math.min(index.lines.length, focus + radius));
}
export function reviewOutputExcerpt(output: string, index: OutputIndex, first: number, last: number): Result<OutputExcerpt> {
  const a = outputLine(index, first), b = outputLine(index, last);
  if (!a || !b || first > last) return failed('Select a valid indexed output line range.');
  if (last - first + 1 > MAX_EXCERPT_LINES) return failed('Select at most 21 output lines.');
  const units = b.end - a.start;
  if (units > MAX_EXCERPT_UNITS) return failed('Selected excerpt exceeds 8192 UTF-16 units. Narrow the range.');
  return { ok: true, value: Object.freeze({ firstLine: first, lastLine: last,
    text: output.slice(a.start, b.end), units }) };
}
export interface OutputSummary {
  readonly indexedLines: number;
  readonly emptyLines: number;
  readonly longestLineUnits: number;
  readonly endings: Readonly<Record<OutputEnding, number>>;
}
export function summarizeOutput(index: OutputIndex): OutputSummary {
  const endings: Record<OutputEnding, number> = { LF: 0, CRLF: 0, CR: 0, EOF: 0 };
  let emptyLines = 0, longestLineUnits = 0;
  for (const line of index.lines) {
    endings[line.ending]++;
    const units = line.end - line.start;
    if (units === 0) emptyLines++;
    longestLineUnits = Math.max(longestLineUnits, units);
  }
  return { indexedLines: index.lines.length, emptyLines, longestLineUnits, endings };
}
export interface OutputComparison {
  readonly historicalRecordId: number;
  readonly report: SourceDiffReport;
  readonly baselineUnits: number;
  readonly currentUnits: number;
}
/** A truncated history preview cannot prove equality of the original text. */
export function compareRetainedOutput(record: ActivityRecord | undefined, current: string): Result<OutputComparison> {
  if (!record || record.output === null) return failed('Select a history record with retained output.');
  if (record.outputTruncated || record.outputOriginalUnits !== record.output.length) {
    return failed('This historical output is incomplete and cannot be compared exactly.');
  }
  if (record.output.length > MAX_COMPARISON_UNITS || current.length > MAX_COMPARISON_UNITS) {
    return failed('Output comparison exceeds the 128 Ki UTF-16 unit limit.');
  }
  return { ok: true, value: {
    historicalRecordId: record.id, report: compareScarpSnapshots(record.output, current),
    baselineUnits: record.output.length, currentUnits: current.length,
  } };
}
