import {
  scanScarpSource, codeTokens,
  type InsightToken, type SourceLexResult,
} from '../language/sourceLex';
import { findScarpCommentTasks, taskCounts } from './commentTasks';

/** Read-only, approximate structural metrics for a Scarp editor snapshot.
 * No metric is a parser diagnostic, compiler result, performance guarantee
 * or statement about language validity. Incomplete lexical scans are flagged.
 */
export const MAX_SUMMARY_LONG_LINE = 120;
export interface ScarpSourceSummary {
  complete: boolean;
  units: number;
  lines: number;
  nonBlankLines: number;
  commentOnlyLines: number;
  longLines: number;
  longestLine: number;
  trailingWhitespaceLines: number;
  tabIndentedLines: number;
  mixedIndentLines: number;
  lineEnding: 'lf' | 'crlf' | 'cr' | 'mixed' | 'none';
  functions: number;
  pureFunctions: number;
  records: number;
  variants: number;
  imports: number;
  branches: number;
  loops: number;
  matchArms: number;
  assertions: number;
  returns: number;
  literals: number;
  identifierCount: number;
  comments: number;
  maxBlockDepth: number;
  unmatchedClosingBraces: number;
  unmatchedOpeningBraces: number;
  tasks: { high: number; normal: number; low: number };
  notes: string[];
}

/** Inspect line lengths and indentation without allocating an array holding
 * all source lines. CRLF is counted as one delimiter. Note that long lines
 * count UTF-16 code units and are not Unicode grapheme measurements.
 */
export function measureSourceLines(source: string): Pick<
  ScarpSourceSummary,
  'lines' | 'nonBlankLines' | 'commentOnlyLines' | 'longLines' |
  'longestLine' | 'trailingWhitespaceLines' | 'tabIndentedLines' | 'mixedIndentLines'
> {
  let lines = 0, nonBlankLines = 0, commentOnlyLines = 0, longLines = 0;
  let longestLine = 0, trailingWhitespaceLines = 0, tabIndentedLines = 0;
  let mixedIndentLines = 0;
  let start = 0;
  function countLine(end: number): void {
    lines++;
    const line = source.slice(start, end);
    longestLine = Math.max(longestLine, line.length);
    if (line.length > MAX_SUMMARY_LONG_LINE) longLines++;
    if (/\S/.test(line)) nonBlankLines++;
    if (/^\s*\/\//.test(line)) commentOnlyLines++;
    if (/[ \t]+$/.test(line)) trailingWhitespaceLines++;
    const indent = /^[ \t]*/.exec(line)?.[0] ?? '';
    if (indent.includes('\t')) tabIndentedLines++;
    if (indent.includes('\t') && indent.includes(' ')) mixedIndentLines++;
  }
  for (let offset = 0; offset < source.length; offset++) {
    const current = source.charCodeAt(offset);
    if (current !== 10 && current !== 13) continue;
    countLine(offset);
    if (current === 13 && source.charCodeAt(offset + 1) === 10) offset++;
    start = offset + 1;
  }
  countLine(source.length);
  return {
    lines, nonBlankLines, commentOnlyLines, longLines, longestLine,
    trailingWhitespaceLines, tabIndentedLines, mixedIndentLines,
  };
}

function structuralCounts(tokens: readonly InsightToken[]) {
  const terms = {
    functions: 0, pureFunctions: 0, records: 0, variants: 0,
    imports: 0, branches: 0, loops: 0, matchArms: 0,
    assertions: 0, returns: 0, literals: 0, identifierCount: 0,
    maxBlockDepth: 0, unmatchedClosingBraces: 0, unmatchedOpeningBraces: 0,
  };
  let depth = 0;
  let previous: InsightToken | undefined;
  for (const token of tokens) {
    if (token.kind === 'string' || token.kind === 'number') terms.literals++;
    if (token.kind === 'identifier') {
      terms.identifierCount++;
      switch (token.text) {
        case 'funcra':
          terms.functions++;
          if (previous?.text === 'pure') terms.pureFunctions++;
          break;
        case 'record': terms.records++; break;
        case 'variant': terms.variants++; break;
        case 'import': terms.imports++; break;
        case 'if': case 'elif': case 'else': terms.branches++; break;
        case 'while': case 'repeat': terms.loops++; break;
        case 'case': terms.matchArms++; break;
        case 'assert': terms.assertions++; break;
        case 'return': terms.returns++; break;
      }
    }
    if (token.kind === 'delimiter') {
      if (token.text === '{') {
        depth++;
        terms.maxBlockDepth = Math.max(terms.maxBlockDepth, depth);
      } else if (token.text === '}') {
        if (depth === 0) terms.unmatchedClosingBraces++;
        else depth--;
      }
    }
    if (token.kind !== 'comment') previous = token;
  }
  terms.unmatchedOpeningBraces = depth;
  return terms;
}

export function summarizeScarpSource(
  source: string, scan: SourceLexResult = scanScarpSource(source),
): ScarpSourceSummary {
  const measured = measureSourceLines(source);
  const structures = structuralCounts(codeTokens(scan.tokens));
  const tasks = taskCounts(findScarpCommentTasks(source, scan).tasks);
  const notes: string[] = [];
  if (!scan.complete) notes.push('Analysis is incomplete because a safety budget was reached.');
  if (scan.issues.some(issue => issue.kind === 'unterminated-string')) {
    notes.push('One or more possible unterminated string literals were observed.');
  }
  if (scan.lineEnding === 'mixed') notes.push('This buffer contains mixed newline conventions.');
  if (measured.mixedIndentLines) notes.push('Some lines mix tabs and spaces in indentation.');
  if (measured.trailingWhitespaceLines) notes.push('Some lines have trailing spaces or tabs.');
  if (structures.unmatchedClosingBraces || structures.unmatchedOpeningBraces) {
    notes.push('Brace counts look unbalanced; only the compiler can validate syntax.');
  }
  if (measured.longLines) notes.push('Some lines are longer than 120 UTF-16 units.');
  return {
    ...measured, ...structures, complete: scan.complete,
    units: source.length, lineEnding: scan.lineEnding,
    comments: scan.commentCount, tasks, notes,
  };
}
