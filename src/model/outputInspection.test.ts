import { describe, expect, it } from 'vitest';
import { createCompilerActivityStore } from './compilerActivity';
import { compareRetainedOutput, DEFAULT_OUTPUT_SEARCH, indexCompilerOutput, MAX_COMPARISON_UNITS,
  MAX_EXCERPT_UNITS, MAX_INSPECTION_LINES, MAX_INSPECTION_MATCHES, MAX_INSPECTION_PREVIEW,
  MAX_INSPECTION_QUERY, MAX_INSPECTION_UNITS, outputContextLines, outputLine, outputPreview,
  reviewOutputExcerpt, searchCompilerOutput, summarizeOutput } from './outputInspection';

function search(text: string, query: string, caseSensitive = false, wholeWord = false) {
  return searchCompilerOutput(text, indexCompilerOutput(text), { query, caseSensitive, wholeWord });
}
function record(output: string) {
  const store = createCompilerActivityStore();
  store.setMode('output');
  const token = store.start({ command: { scope: 'source', action: 'verify' }, target: 'main.srp', timestamp: 1 });
  return store.finish(token, { timestamp: 2, outcome: 'returned', exitCode: null,
    staleAtCompletion: false, inputChanged: false, output })!;
}
describe('bounded output line indexing', () => {
  it('preserves original UTF-16 offsets and line separator types', () => {
    const index = indexCompilerOutput('a\r\n😀\rb\n');
    expect(index.lines).toEqual([
      { number: 1, start: 0, end: 1, next: 3, ending: 'CRLF' },
      { number: 2, start: 3, end: 5, next: 6, ending: 'CR' },
      { number: 3, start: 6, end: 7, next: 8, ending: 'LF' },
      { number: 4, start: 8, end: 8, next: 8, ending: 'EOF' },
    ]);
    expect(index).toMatchObject({ complete: true, totalUnits: 8, scannedUnits: 8, limit: null });
    expect(Object.isFrozen(index.lines)).toBe(true);
  });
  it('represents an empty output as one empty line', () => {
    expect(indexCompilerOutput('').lines).toEqual([{ number: 1, start: 0, end: 0, next: 0, ending: 'EOF' }]);
  });
  it('includes a final line without a trailing newline', () => {
    expect(indexCompilerOutput('hello').lines[0]).toMatchObject({ start: 0, end: 5, next: 5, ending: 'EOF' });
  });
  it('does not index a partially scanned long line', () => {
    const output = 'first\n' + 'a'.repeat(MAX_INSPECTION_UNITS) + '\nlast';
    const index = indexCompilerOutput(output);
    expect(index).toMatchObject({ complete: false, limit: 'units', scannedUnits: 6 });
    expect(index.lines).toHaveLength(1);
    expect(search(output, 'last')).toMatchObject({ complete: false, reason: 'index-limit', matches: [] });
  });
  it('does not split CRLF at the prefix boundary', () => {
    const output = 'a'.repeat(MAX_INSPECTION_UNITS - 1) + '\r\nnext';
    expect(indexCompilerOutput(output)).toMatchObject({ lines: [], scannedUnits: 0, limit: 'units', complete: false });
  });
  it('accepts a complete terminated line at the prefix boundary', () => {
    const output = 'a'.repeat(MAX_INSPECTION_UNITS - 1) + '\nnext';
    const index = indexCompilerOutput(output);
    expect(index.lines).toHaveLength(1);
    expect(index.scannedUnits).toBe(MAX_INSPECTION_UNITS);
    expect(index.complete).toBe(false);
  });
  it('bounds the line count including a terminal empty line', () => {
    const output = 'a\n'.repeat(MAX_INSPECTION_LINES);
    const index = indexCompilerOutput(output);
    expect(index.lines).toHaveLength(MAX_INSPECTION_LINES);
    expect(index).toMatchObject({ limit: 'lines', complete: false, scannedUnits: output.length });
    expect(indexCompilerOutput('a\n'.repeat(MAX_INSPECTION_LINES - 1)).complete).toBe(true);
  });
  it('does not retain copied output text in line metadata', () => {
    expect(JSON.stringify(indexCompilerOutput('secret reply'))).not.toContain('secret reply');
  });
  it('summarizes indexed lines and ending types', () => {
    expect(summarizeOutput(indexCompilerOutput('a\r\n\r\nlong\nz'))).toEqual({
      indexedLines: 4, emptyLines: 1, longestLineUnits: 4, endings: { LF: 1, CRLF: 2, CR: 0, EOF: 1 },
    });
  });
});
describe('bounded literal output search', () => {
  it('returns original offsets and repeated occurrences', () => {
    const result = search('Error: error\r\nnot error', 'error');
    expect(result.matches).toEqual([{ line: 1, start: 0, end: 5 },
      { line: 1, start: 7, end: 12 }, { line: 2, start: 18, end: 23 }]);
    expect(result).toMatchObject({ matchedLines: 2, complete: true, reason: null });
    expect(search('Error: error', 'Error', true).matches).toHaveLength(1);
  });
  it.each(['.*', '[x]', '(a)', 'a|b', '\\d+', '$', '^', '?', '{1,9}', 'a+b'])(
    'treats regex syntax as literal %s', query => {
      const output = 'unrelated text\n' + query + '\nmore text';
      const result = search(output, query);
      expect(result.matches).toHaveLength(1);
      expect(output.slice(result.matches[0].start, result.matches[0].end)).toBe(query);
    });
  it('uses non-overlapping matches', () => {
    expect(search('aaaaa', 'aa').matches).toEqual([{ line: 1, start: 0, end: 2 }, { line: 1, start: 2, end: 4 }]);
  });
  it('matches Unicode case folds without changing original offsets', () => {
    const output = '😀 É é K k';
    expect(search(output, 'é').matches.map(m => output.slice(m.start, m.end))).toEqual(['É', 'é']);
    expect(search(output, 'k').matches.map(m => output.slice(m.start, m.end))).toEqual(['K', 'k']);
  });
  it('uses Unicode word boundaries including supplementary letters', () => {
    const text = 'cat concatenate cat_ cat2 𐐀cat cat𐐀 (cat) cat';
    expect(search(text, 'cat', true, true).matches.map(m => text.slice(m.start, m.end))).toEqual(['cat', 'cat', 'cat']);
  });
  it('keeps literal spaces', () => {
    expect(search('a  b c', '  ').matches).toHaveLength(1);
  });
  it('does not allow matches across line endings', () => {
    expect(search('a\nb', 'a\nb').reason).toBe('invalid');
    expect(search('a\rb', '\r').reason).toBe('invalid');
  });
  it('distinguishes blank and over-budget queries from no-match results', () => {
    expect(searchCompilerOutput('text', indexCompilerOutput('text'), DEFAULT_OUTPUT_SEARCH).reason).toBe('empty');
    expect(search('text', 'x'.repeat(MAX_INSPECTION_QUERY + 1)).reason).toBe('invalid');
    expect(search('text', 'missing')).toMatchObject({ matches: [], complete: true, reason: null });
  });
  it('labels partial searches rather than claiming exhaustive coverage', () => {
    expect(search('found\n' + 'x'.repeat(MAX_INSPECTION_UNITS), 'found'))
      .toMatchObject({ complete: false, reason: 'index-limit', matchedLines: 1 });
  });
  it('caps occurrence results only if another qualifying match exists', () => {
    expect(search('x '.repeat(MAX_INSPECTION_MATCHES), 'x')).toMatchObject({ complete: true, reason: null });
    const larger = search('x '.repeat(MAX_INSPECTION_MATCHES + 1), 'x');
    expect(larger).toMatchObject({ complete: false, reason: 'match-limit', matchedLines: 1 });
    expect(larger.matches).toHaveLength(MAX_INSPECTION_MATCHES);
  });
});
describe('output context and excerpts', () => {
  it('rejects invalid line numbers', () => {
    const index = indexCompilerOutput('a\nb');
    for (const number of [0, -1, 1.1, Infinity, 3]) expect(outputLine(index, number)).toBeNull();
    expect(outputLine(index, 2)?.start).toBe(2);
  });
  it('bounds context to indexed lines and supported radius', () => {
    const index = indexCompilerOutput('a\nb\nc\nd\ne');
    expect(outputContextLines(index, 1, 2).map(line => line.number)).toEqual([1, 2, 3]);
    expect(outputContextLines(index, 5, 2).map(line => line.number)).toEqual([3, 4, 5]);
    expect(outputContextLines(index, 3, 0).map(line => line.number)).toEqual([3]);
    expect(outputContextLines(index, 3, 11)).toEqual([]);
    expect(outputContextLines(index, 99, 2)).toEqual([]);
  });
  it('shows distant occurrences in a bounded preview', () => {
    const text = 'x'.repeat(900) + 'needle' + 'y'.repeat(900);
    const line = indexCompilerOutput(text).lines[0];
    const preview = outputPreview(text, line, search(text, 'needle').matches[0]);
    expect(preview).toMatchObject({ prefixOmitted: true, suffixOmitted: true });
    expect(preview.text.slice(preview.highlightStart!, preview.highlightEnd!)).toBe('needle');
    expect(preview.text.length).toBeLessThanOrEqual(MAX_INSPECTION_PREVIEW + 2);
  });
  it('preserves supplementary scalar boundaries in preview windows', () => {
    const text = 'x' + '😀'.repeat(500);
    const preview = outputPreview(text, indexCompilerOutput(text).lines[0]);
    expect(preview.text).toBe('x' + '😀'.repeat(160));
    expect(preview.suffixOmitted).toBe(true);
  });
  it('does not highlight a match outside the selected line', () => {
    const output = 'first\nsecond';
    expect(outputPreview(output, indexCompilerOutput(output).lines[0], search(output, 'second').matches[0]).highlightStart).toBeNull();
  });
  it('retains original internal line endings in excerpts', () => {
    const output = 'zero\none\r\ntwo\rthree\nlast';
    expect(reviewOutputExcerpt(output, indexCompilerOutput(output), 2, 4)).toEqual({
      ok: true, value: { firstLine: 2, lastLine: 4, text: 'one\r\ntwo\rthree', units: 14 },
    });
  });
  it('includes an existing terminal newline when selecting the empty final line', () => {
    expect(reviewOutputExcerpt('line\n', indexCompilerOutput('line\n'), 1, 2))
      .toMatchObject({ ok: true, value: { text: 'line\n', units: 5 } });
  });
  it('rejects reversed, invalid and over-budget excerpts', () => {
    const output = 'a\n'.repeat(30), index = indexCompilerOutput(output);
    for (const [first, last] of [[0, 1], [2, 1], [1, 99], [1, 22]]) {
      expect(reviewOutputExcerpt(output, index, first, last).ok).toBe(false);
    }
    const long = 'a'.repeat(MAX_EXCERPT_UNITS + 1);
    expect(reviewOutputExcerpt(long, indexCompilerOutput(long), 1, 1).ok).toBe(false);
  });
  it('allows an empty line excerpt without inventing content', () => {
    expect(reviewOutputExcerpt('\n', indexCompilerOutput('\n'), 2, 2)).toMatchObject({ ok: true, value: { text: '', units: 0 } });
  });
});
describe('retained historical output comparison', () => {
  it('rejects unavailable, metadata-only and incomplete records', () => {
    expect(compareRetainedOutput(undefined, '').ok).toBe(false);
    const old = record('abc');
    expect(compareRetainedOutput({ ...old, output: null }, 'abc').ok).toBe(false);
    expect(compareRetainedOutput({ ...old, outputTruncated: true }, 'abc').ok).toBe(false);
    expect(compareRetainedOutput({ ...old, outputOriginalUnits: 100 }, 'abc').ok).toBe(false);
  });
  it('detects identical output without equating source or exit status', () => {
    const old = record('one\r\ntwo');
    expect(compareRetainedOutput(old, 'one\r\ntwo')).toMatchObject({
      ok: true, value: { historicalRecordId: old.id, report: { status: 'clean' } },
    });
  });
  it('compares in historical-to-current direction including changed line endings', () => {
    expect(compareRetainedOutput(record('a\r\nb'), 'a\nc\nd')).toMatchObject({
      ok: true, value: { report: { status: 'ready', addedLines: 3, removedLines: 2 } },
    });
  });
  it('bounds current text before line comparison', () => {
    expect(compareRetainedOutput(record('a'), 'a'.repeat(MAX_COMPARISON_UNITS + 1)).ok).toBe(false);
  });
  it('preserves limited diff reporting without fabricating exact counts', () => {
    expect(compareRetainedOutput(record('a\n'.repeat(1000)), 'b\n'.repeat(1000))).toMatchObject({
      ok: true, value: { report: { status: 'limited', addedLines: null } },
    });
  });
});
