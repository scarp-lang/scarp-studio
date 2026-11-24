import { describe, expect, it } from 'vitest';
import {
  scanScarpSource, tokenAtOffset, tokenPosition, codeTokens,
  scarpInsightIdentifier, MAX_INSIGHT_SOURCE_UNITS, MAX_INSIGHT_TOKENS,
  MAX_COMMENT_PREVIEW_UNITS,
} from './sourceLex';

describe('bounded Scarp source lexical index', () => {
  it('produces a stable empty result without inventing declarations', () => {
    const scan = scanScarpSource('');
    expect(scan).toMatchObject({
      complete: true, sourceLength: 0, scannedUnits: 0, lines: 1,
      lineEnding: 'none', commentCount: 0, stringCount: 0,
    });
    expect(scan.tokens).toEqual([]);
    expect(scan.issues).toEqual([]);
  });

  it('separates literal strings, comments, identifiers and punctuation', () => {
    const source = 'bind name = "// not comment"; // TODO fix\nprint(name);';
    const scan = scanScarpSource(source);
    expect(scan.complete).toBe(true);
    expect(scan.commentCount).toBe(1);
    expect(scan.stringCount).toBe(1);
    expect(scan.tokens.filter(t => t.kind === 'identifier').map(t => t.text))
      .toEqual(['bind', 'name', 'print', 'name']);
    expect(scan.tokens.find(t => t.kind === 'string')?.text)
      .toBe('"// not comment"');
    expect(scan.tokens.find(t => t.kind === 'comment')?.text).toBe('// TODO fix');
    expect(codeTokens(scan.tokens).every(t => t.kind !== 'string' &&
      t.kind !== 'comment')).toBe(true);
  });

  it('tracks UTF-16 offsets and 1-based columns through mixed line endings', () => {
    const scan = scanScarpSource('a\r\nb\rc\nd');
    expect(scan.lines).toBe(4);
    expect(scan.lineEnding).toBe('mixed');
    expect(scan.tokens.map(t => [t.text, t.start, t.line, t.column]))
      .toEqual([['a', 0, 1, 1], ['b', 3, 2, 1], ['c', 5, 3, 1], ['d', 7, 4, 1]]);
  });

  it.each([
    ['x\ny', 'lf', 2], ['x\ry', 'cr', 2],
    ['x\r\ny', 'crlf', 2], ['x y', 'none', 1],
    ['x\n', 'lf', 2], ['x\r\n', 'crlf', 2],
    ['\n', 'lf', 2], ['\r', 'cr', 2],
  ] as const)('classifies line endings for %j', (source, kind, lines) => {
    const scan = scanScarpSource(source);
    expect(scan.lineEnding).toBe(kind);
    expect(scan.lines).toBe(lines);
    expect(scan.complete).toBe(true);
  });

  it('keeps escaped quotes and double slash inside a string', () => {
    const source = 'print("escaped \\" // not a comment"); // real';
    const scan = scanScarpSource(source);
    expect(scan.commentCount).toBe(1);
    expect(scan.stringCount).toBe(1);
    expect(scan.issues).toEqual([]);
  });

  it.each([
    ['print("unfinished', 'unterminated-string'],
    ['print("unfinished\nx', 'unterminated-string'],
    ['print("unfinished\rx', 'unterminated-string'],
    ['print("bad\\', 'unterminated-string'],
  ] as const)('bounds malformed source %j', (source, kind) => {
    const scan = scanScarpSource(source);
    expect(scan.issues.some(issue => issue.kind === kind)).toBe(true);
    expect(scan.complete).toBe(true);
    expect(scan.scannedUnits).toBe(source.length);
  });

  it('keeps exact operator and delimiter offsets', () => {
    const input = 'funcra sample(x: integer) -> integer { return x >= 1 && x != 2; }';
    const scan = scanScarpSource(input);
    for (const marker of ['->', '>=', '&&', '!=']) {
      expect(scan.tokens.some(t => t.kind === 'operator' && t.text === marker)).toBe(true);
    }
    for (const marker of ['(', ')', '{', '}', ';']) {
      expect(scan.tokens.some(t => t.kind === 'delimiter' && t.text === marker)).toBe(true);
    }
    for (const token of scan.tokens) {
      expect(input.slice(token.start, token.end)).toBe(token.text);
    }
  });

  it('does not claim to validate numeric syntax', () => {
    const scan = scanScarpSource('0 12 0xFF 0b101 3.14 123d 12_00 0bX');
    expect(scan.tokens.map(t => t.text))
      .toEqual(['0', '12', '0xFF', '0b101', '3.14', '123d', '12_00', '0bX']);
    expect(scan.tokens.every(t => t.kind === 'number')).toBe(true);
  });

  it('treats surrogate pairs as two Monaco UTF-16 units', () => {
    const scan = scanScarpSource('print("🚀");\n// हिंदी\nvar x = 1;');
    expect(scan.tokens.find(t => t.text === '"🚀"')?.end -
      scan.tokens.find(t => t.text === '"🚀"')!.start).toBe(4);
    expect(scan.tokens.find(t => t.text === 'var')?.line).toBe(3);
  });

  it('refuses oversized source rather than giving an incomplete index as final', () => {
    const scan = scanScarpSource('x'.repeat(MAX_INSIGHT_SOURCE_UNITS + 1));
    expect(scan.complete).toBe(false);
    expect(scan.tokens).toEqual([]);
    expect(scan.issues[0]?.kind).toBe('source-limit');
  });

  it('caps massive comment previews without losing the real token range', () => {
    const input = '//' + 'a'.repeat(MAX_COMMENT_PREVIEW_UNITS * 2);
    const scan = scanScarpSource(input);
    expect(scan.tokens).toHaveLength(1);
    expect(scan.tokens[0].previewTruncated).toBe(true);
    expect(scan.tokens[0].text.length).toBe(MAX_COMMENT_PREVIEW_UNITS);
    expect(scan.tokens[0].end).toBe(input.length);
  });

  it('aborts at token budget and marks the result incomplete', () => {
    const input = 'x '.repeat(MAX_INSIGHT_TOKENS + 5);
    const scan = scanScarpSource(input);
    expect(scan.complete).toBe(false);
    expect(scan.tokens).toHaveLength(MAX_INSIGHT_TOKENS);
    expect(scan.issues.some(x => x.kind === 'token-limit')).toBe(true);
  });

  it('tracks invalid control units without emitting unsafe labels', () => {
    const scan = scanScarpSource('bind x = 1;\0//hi\nvar y = 2;');
    expect(scan.issues.some(x => x.kind === 'invalid-control')).toBe(true);
    expect(scan.tokens.some(t => t.text.includes('\0'))).toBe(false);
    expect(scan.tokens.find(t => t.text === 'var')?.line).toBe(2);
  });

  it('binary-searches source tokens without guessing from whitespace', () => {
    const scan = scanScarpSource('alpha  beta');
    expect(tokenAtOffset(scan.tokens, 0)?.text).toBe('alpha');
    expect(tokenAtOffset(scan.tokens, 5)).toBeNull();
    expect(tokenAtOffset(scan.tokens, 7)?.text).toBe('beta');
    expect(tokenAtOffset(scan.tokens, 11)).toBeNull();
    expect(tokenAtOffset(scan.tokens, Number.NaN)).toBeNull();
    expect(tokenPosition(scan.tokens, 8)).toEqual({ line: 1, column: 9 });
  });

  it.each([
    ['a', true], ['_', true], ['snake_case', true],
    ['CamelCase42', true], ['a-b', false], ['0a', false],
    ['नमस्ते', false], ['', false],
    ['a'.repeat(129), false], ['a'.repeat(128), true],
  ] as const)('validates editor-only identifiers %j', (name, valid) => {
    expect(scarpInsightIdentifier(name)).toBe(valid);
  });

  it('returns deterministic independent snapshots', () => {
    const source = 'funcra main() { print("done"); }';
    const first = scanScarpSource(source);
    const second = scanScarpSource(source);
    expect(first).toEqual(second);
    expect(first.tokens).not.toBe(second.tokens);
    expect(source).toBe('funcra main() { print("done"); }');
  });
});
