/** Bounded, non-executing Scarp lexical index for editor-only insights.
 * It is not the official compiler lexer and does not validate language syntax.
 * Offsets use UTF-16 units, lines and columns are Monaco-compatible.
 */
export const MAX_INSIGHT_SOURCE_UNITS = 512 * 1024;
export const MAX_INSIGHT_TOKENS = 24000;
export const MAX_INSIGHT_ISSUES = 128;
export const MAX_TOKEN_PREVIEW_UNITS = 240;
export const MAX_COMMENT_PREVIEW_UNITS = 2048;

export type InsightTokenKind =
  'identifier' | 'number' | 'string' | 'comment' | 'operator' | 'delimiter';
export type SourceLexIssueKind =
  'unterminated-string' | 'token-limit' | 'source-limit' | 'invalid-control';

export interface InsightToken {
  kind: InsightTokenKind;
  text: string;
  start: number;
  end: number;
  line: number;
  column: number;
  previewTruncated: boolean;
}
export interface SourceLexIssue {
  kind: SourceLexIssueKind;
  offset: number;
  line: number;
  column: number;
  message: string;
}
export interface SourceLexResult {
  tokens: InsightToken[];
  issues: SourceLexIssue[];
  complete: boolean;
  sourceLength: number;
  scannedUnits: number;
  lines: number;
  commentCount: number;
  stringCount: number;
  identifierCount: number;
  numberCount: number;
  operatorCount: number;
  delimiterCount: number;
  lineEnding: 'lf' | 'crlf' | 'cr' | 'mixed' | 'none';
}

const isStart = (n: number): boolean =>
  n === 95 || (n >= 65 && n <= 90) || (n >= 97 && n <= 122);
const isPart = (n: number): boolean => isStart(n) || (n >= 48 && n <= 57);
const isDigit = (n: number): boolean => n >= 48 && n <= 57;
const twoOps = new Set([
  '->', '=>', '::', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=',
  '%=', '&&', '||', '<<', '>>', '..', '??', '?.', '|>',
]);
const threeOps = new Set(['...', '<<=', '>>=']);
const delimiters = new Set(['(', ')', '[', ']', '{', '}', ',', ';']);
interface Position { offset: number; line: number; column: number }

function emptyResult(source: string): SourceLexResult {
  return {
    tokens: [], issues: [], complete: true, sourceLength: source.length,
    scannedUnits: 0, lines: 1, commentCount: 0, stringCount: 0,
    identifierCount: 0, numberCount: 0, operatorCount: 0,
    delimiterCount: 0, lineEnding: 'none',
  };
}
function allowedControl(n: number): boolean {
  return n >= 32 || n === 9 || n === 10 || n === 13 || n === 12;
}


export interface ScarpLiteralSpan {
  end: number;
  closed: boolean;
  kind: 'ordinary' | 'raw' | 'multiline';
  brokenEscape: boolean;
}

/** Recognize published alpha.3 literal delimiters at a token boundary.
 * The limit is an exclusive caret/scan boundary; never consume text after it.
 * Escape validity and decoded values belong to the official compiler. */
export function scanScarpLiteral(source: string, start: number, limit = source.length): ScarpLiteralSpan | null {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(limit) ||
      start < 0 || start >= limit || limit > source.length) return null;
  const raw = source.startsWith('r"', start);
  if (!raw && source[start] !== '"') return null;
  const multiline = !raw && source.startsWith('"""', start);
  const kind = raw ? 'raw' : multiline ? 'multiline' : 'ordinary';
  const delimiter = multiline ? '"""' : '"';
  const opening = raw ? 2 : multiline ? 3 : 1;
  let end = Math.min(start + opening, limit);
  let brokenEscape = false;
  while (end < limit) {
    if (end + delimiter.length <= limit && source.startsWith(delimiter, end)) {
      return { end: end + delimiter.length, closed: true, kind, brokenEscape };
    }
    const unit = source.charCodeAt(end);
    if (!multiline && (unit === 10 || unit === 13)) break;
    if (kind === 'ordinary' && unit === 92) {
      end++;
      if (end >= limit || source.charCodeAt(end) === 10 || source.charCodeAt(end) === 13) {
        brokenEscape = true;
        break;
      }
    }
    end++;
  }
  return { end, closed: false, kind, brokenEscape };
}

/** Scan a snapshot without any IO or side effects. Long text and too many
 * tokens produce incomplete results; consumers must not treat them as
 * exhaustive. CRLF is one line ending; CR and LF are also recognized.
 */
export function scanScarpSource(source: string): SourceLexResult {
  const result = emptyResult(source);
  if (source.length > MAX_INSIGHT_SOURCE_UNITS) {
    result.complete = false;
    result.issues.push({
      kind: 'source-limit', offset: 0, line: 1, column: 1,
      message: 'Source Insights is limited to 512 Ki UTF-16 units.',
    });
    return result;
  }
  const cursor: Position = { offset: 0, line: 1, column: 1 };
  let lf = 0, cr = 0, crlf = 0;

  function advance(): void {
    const unit = source.charCodeAt(cursor.offset);
    if (unit === 13) {
      if (source.charCodeAt(cursor.offset + 1) === 10) {
        cursor.offset += 2;
        crlf++;
      } else {
        cursor.offset++;
        cr++;
      }
      cursor.line++;
      cursor.column = 1;
    } else if (unit === 10) {
      cursor.offset++;
      lf++;
      cursor.line++;
      cursor.column = 1;
    } else {
      cursor.offset++;
      cursor.column++;
    }
  }
  function issue(kind: SourceLexIssueKind, message: string, at: Position): void {
    if (result.issues.length >= MAX_INSIGHT_ISSUES) return;
    result.issues.push({
      kind, offset: at.offset, line: at.line, column: at.column, message,
    });
  }
  function emit(kind: InsightTokenKind, start: Position, preview: number): boolean {
    if (result.tokens.length >= MAX_INSIGHT_TOKENS) {
      result.complete = false;
      issue('token-limit', 'Source Insights reached its 24,000-token limit.', start);
      return false;
    }
    const end = cursor.offset;
    let previewEnd = Math.min(end, start.offset + preview);
    // Keep preview text valid UTF-16 without changing authoritative offsets.
    if (previewEnd < end && /[\uD800-\uDBFF]/.test(source[previewEnd - 1]) &&
        /[\uDC00-\uDFFF]/.test(source[previewEnd])) previewEnd--;
    result.tokens.push({
      kind, start: start.offset, end, line: start.line, column: start.column,
      text: source.slice(start.offset, previewEnd),
      previewTruncated: previewEnd < end,
    });
    if (kind === 'comment') result.commentCount++;
    if (kind === 'string') result.stringCount++;
    if (kind === 'identifier') result.identifierCount++;
    if (kind === 'number') result.numberCount++;
    if (kind === 'operator') result.operatorCount++;
    if (kind === 'delimiter') result.delimiterCount++;
    return true;
  }

  while (cursor.offset < source.length) {
    const start = { ...cursor };
    const unit = source.charCodeAt(cursor.offset);
    const next = source.charCodeAt(cursor.offset + 1);
    if (!allowedControl(unit)) {
      issue('invalid-control', 'Unexpected control code in Scarp source.', start);
      advance();
      continue;
    }
    if (unit === 10 || unit === 13 || unit === 32 || unit === 9 ||
        unit === 12 || unit === 11) {
      advance();
      continue;
    }
    if (unit === 47 && next === 47) {
      advance();
      advance();
      while (cursor.offset < source.length &&
          source.charCodeAt(cursor.offset) !== 10 &&
          source.charCodeAt(cursor.offset) !== 13) advance();
      if (!emit('comment', start, MAX_COMMENT_PREVIEW_UNITS)) break;
      continue;
    }
    const literal = scanScarpLiteral(source, cursor.offset);
    if (literal) {
      while (cursor.offset < literal.end) {
        if (!allowedControl(source.charCodeAt(cursor.offset))) {
          issue('invalid-control', 'Control code inside string.', { ...cursor });
        }
        advance();
      }
      if (!literal.closed) {
        issue('unterminated-string', literal.brokenEscape
          ? 'String ends with an incomplete escape.'
          : literal.kind === 'multiline' ? 'Multiline string is not closed.'
          : 'String literal is not closed on this line.', start);
      }
      if (!emit('string', start, MAX_TOKEN_PREVIEW_UNITS)) break;
      continue;
    }
    if (isStart(unit)) {
      advance();
      while (cursor.offset < source.length && isPart(source.charCodeAt(cursor.offset))) advance();
      if (!emit('identifier', start, MAX_TOKEN_PREVIEW_UNITS)) break;
      continue;
    }
    if (isDigit(unit)) {
      advance();
      if (unit === 48 && (next === 120 || next === 88 || next === 98 || next === 66)) {
        advance();
      }
      while (cursor.offset < source.length && isPart(source.charCodeAt(cursor.offset))) advance();
      if (source[cursor.offset] === '.' && isDigit(source.charCodeAt(cursor.offset + 1))) {
        advance();
        while (cursor.offset < source.length &&
            (isPart(source.charCodeAt(cursor.offset)) || source[cursor.offset] === '.')) advance();
      }
      if (!emit('number', start, MAX_TOKEN_PREVIEW_UNITS)) break;
      continue;
    }
    const three = source.slice(cursor.offset, cursor.offset + 3);
    const two = source.slice(cursor.offset, cursor.offset + 2);
    const width = threeOps.has(three) ? 3 : twoOps.has(two) ? 2 : 1;
    for (let index = 0; index < width; index++) advance();
    if (!emit(delimiters.has(source[start.offset]) ? 'delimiter' : 'operator',
      start, MAX_TOKEN_PREVIEW_UNITS)) break;
  }

  result.scannedUnits = cursor.offset;
  result.lines = cursor.line;
  const kinds = Number(lf > 0) + Number(cr > 0) + Number(crlf > 0);
  result.lineEnding = kinds > 1 ? 'mixed'
    : crlf ? 'crlf' : lf ? 'lf' : cr ? 'cr' : 'none';
  return result;
}

/** Binary search by original UTF-16 position. Whitespace is not a token. */
export function tokenAtOffset(
  tokens: readonly InsightToken[], offset: number,
): InsightToken | null {
  if (!Number.isSafeInteger(offset) || offset < 0) return null;
  let low = 0, high = tokens.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (tokens[middle].end <= offset) low = middle + 1;
    else high = middle;
  }
  const found = tokens[low];
  return found && found.start <= offset && offset < found.end ? found : null;
}
export function scarpInsightIdentifier(text: string): boolean {
  return text.length <= 128 && /^[A-Za-z_][A-Za-z_0-9]*$/.test(text);
}
export function codeTokens(tokens: readonly InsightToken[]): InsightToken[] {
  return tokens.filter(t => t.kind !== 'comment' && t.kind !== 'string');
}
export function tokenPosition(
  tokens: readonly InsightToken[], offset: number,
): { line: number; column: number } | null {
  const found = tokenAtOffset(tokens, offset);
  return found ? { line: found.line, column: found.column + offset - found.start } : null;
}
