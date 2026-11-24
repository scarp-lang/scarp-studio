import { describe, expect, it } from 'vitest';
import { measureSourceLines, summarizeScarpSource, MAX_SUMMARY_LONG_LINE } from './sourceSummary';

describe('Scarp source summary and safety notices', () => {
  it('summarizes empty text consistently with Monaco final-line semantics', () => {
    const result = summarizeScarpSource('');
    expect(result).toMatchObject({
      complete: true, units: 0, lines: 1, nonBlankLines: 0,
      functions: 0, records: 0, variants: 0, comments: 0,
      maxBlockDepth: 0, unmatchedClosingBraces: 0,
    });
    expect(result.notes).toEqual([]);
  });
  it('counts published declaration and control-flow names outside comments and strings', () => {
    const text = [
      'pure funcra square(n: integer) -> integer { return n*n; }',
      'funcra run() {',
      '  // funcra fake and while fake',
      '  print("record variant funcra");',
      '  if true { assert(true); } else { assert(false); }',
      '  repeat 2 as idx { print(idx); }',
      '}',
      'pub record Item { value: integer }',
      'pub variant State { Ok, Fail }',
    ].join('\n');
    const result = summarizeScarpSource(text);
    expect(result.functions).toBe(2);
    expect(result.pureFunctions).toBe(1);
    expect(result.records).toBe(1);
    expect(result.variants).toBe(1);
    expect(result.branches).toBe(2);
    expect(result.loops).toBe(1);
    expect(result.assertions).toBe(2);
    expect(result.comments).toBe(1);
    expect(result.maxBlockDepth).toBeGreaterThanOrEqual(2);
    expect(result.unmatchedOpeningBraces).toBe(0);
    expect(result.unmatchedClosingBraces).toBe(0);
  });
  it('does not mistake quoted comment markers for comment tasks', () => {
    const result = summarizeScarpSource('print("// TODO fake");\n// FIXME: real');
    expect(result.comments).toBe(1);
    expect(result.tasks).toEqual({ high: 1, normal: 0, low: 0 });
  });
  it.each([
    ['x', 1, 1],
    ['x\n', 2, 1],
    ['\n', 2, 0],
    ['a\r\nb', 2, 2],
    ['a\rb', 2, 2],
    ['a\nb\n', 3, 2],
  ] as const)('measures line structure for %j', (text, lines, nonBlank) => {
    const measure = measureSourceLines(text);
    expect(measure.lines).toBe(lines);
    expect(measure.nonBlankLines).toBe(nonBlank);
  });
  it('counts long lines, whitespace and mixed indentation without changing text', () => {
    const source = [
      ' \tvar x = 1;  ',
      '\tprint(x);',
      '// hello',
      'a'.repeat(MAX_SUMMARY_LONG_LINE + 3),
    ].join('\r\n');
    const result = summarizeScarpSource(source);
    expect(result.longLines).toBe(1);
    expect(result.longestLine).toBe(MAX_SUMMARY_LONG_LINE + 3);
    expect(result.trailingWhitespaceLines).toBe(1);
    expect(result.tabIndentedLines).toBe(2);
    expect(result.mixedIndentLines).toBe(1);
    expect(result.commentOnlyLines).toBe(1);
    expect(result.notes.some(x => x.includes('tabs and spaces'))).toBe(true);
    expect(result.notes.some(x => x.includes('trailing'))).toBe(true);
    expect(result.notes.some(x => x.includes('120'))).toBe(true);
  });
  it('reports unmatched braces as heuristics, not compiler diagnostics', () => {
    const result = summarizeScarpSource('} funcra start() {');
    expect(result.unmatchedClosingBraces).toBe(1);
    expect(result.unmatchedOpeningBraces).toBe(1);
    expect(result.notes.some(x => x.includes('compiler'))).toBe(true);
  });
  it('counts a mixed newline as a descriptive note', () => {
    const result = summarizeScarpSource('x\r\ny\nz');
    expect(result.lineEnding).toBe('mixed');
    expect(result.notes.some(x => x.includes('mixed newline'))).toBe(true);
  });
  it('clearly marks oversized source incomplete', () => {
    const result = summarizeScarpSource('x'.repeat(512*1024+1));
    expect(result.complete).toBe(false);
    expect(result.notes.some(x => x.includes('incomplete'))).toBe(true);
  });
  it('does not count declarations embedded in a comment or string', () => {
    const result = summarizeScarpSource(
      '// record Test {}\nprint("variant Fake {}");\nfuncra one() {}',
    );
    expect(result.functions).toBe(1);
    expect(result.records).toBe(0);
    expect(result.variants).toBe(0);
  });
  it('never modifies input text when measuring source', () => {
    const text = 'funcra run() { }   \r\n';
    const a = summarizeScarpSource(text);
    const b = summarizeScarpSource(text);
    expect(a).toEqual(b);
    expect(text).toBe('funcra run() { }   \r\n');
  });
});
