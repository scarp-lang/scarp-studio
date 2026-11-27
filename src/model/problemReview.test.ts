import { describe, expect, it } from 'vitest';
import type { StudioProblem } from './problems';
import { buildProblemReport, DEFAULT_PROBLEM_REVIEW, MAX_PROBLEM_REPORT_ROWS,
  MAX_PROBLEM_REPORT_UNITS, MAX_REVIEW_PROBLEMS, pageProblemReview, PROBLEM_REVIEW_PAGE,
  reviewCurrentProblems, type ProblemReviewOptions } from './problemReview';

function issue(id: number, patch: Partial<StudioProblem> = {}): StudioProblem {
  return { id: String(id), kind: 'compiler', code: 'E001', message: 'Problem ' + id,
    location: 'src/main.srp:' + id, help: null, target: null, ...patch };
}
const sample = [
  issue(1, { code: 'E002' }),
  issue(2, { kind: 'test', code: 'E001', target: { kind: 'test', folder: 'C:/demo', path: 'tests/example.srp' } }),
  issue(3, { code: 'E001', help: 'Use integer' }),
  issue(4, { kind: 'test', code: null, location: null }),
];
const review = (problems: readonly StudioProblem[] = sample, patch: Partial<ProblemReviewOptions> = {}, stale = false) =>
  reviewCurrentProblems(problems, stale, { ...DEFAULT_PROBLEM_REVIEW, ...patch });
const ids = (result: ReturnType<typeof review>) => result.groups.flatMap(group => group.problems.map(p => p.id));

describe('structured problem review', () => {
  it('preserves original order and reports navigation counts', () => {
    const result = review();
    expect(ids(result)).toEqual(['1', '2', '3', '4']);
    expect(result).toMatchObject({ total: 4, scanned: 4, compiler: 2, tests: 2, available: 1,
      unavailable: 3, matching: 4, limited: false, stale: false });
  });
  it('suppresses all supplied rows when results are stale', () => {
    const result = review(sample, {}, true);
    expect(result).toMatchObject({ groups: [], total: 0, matching: 0, stale: true });
    expect(pageProblemReview(result, 1)).toMatchObject({ first: 0, last: 0, groups: [] });
  });
  it('combines kind, message search and navigation filters', () => {
    expect(ids(review(sample, { kind: 'test', navigation: 'available', query: 'E001' }))).toEqual(['2']);
    expect(ids(review(sample, { kind: 'compiler', navigation: 'unavailable', query: 'INTEGER' }))).toEqual(['3']);
    expect(ids(review(sample, { navigation: 'available', query: 'missing' }))).toEqual([]);
  });
  it('groups by kind without intermixing compiler and failed test codes', () => {
    const result = review(sample, { grouping: 'kind' });
    expect(result.groups.map(group => [group.label, group.count])).toEqual([
      ['Compiler diagnostics', 2], ['Failed project tests', 2],
    ]);
    expect(ids(result)).toEqual(['1', '3', '2', '4']);
  });
  it('groups by kind and code, keeping unknown codes distinct', () => {
    const result = review(sample, { grouping: 'code' });
    expect(result.groups.map(group => group.label)).toEqual([
      'Compiler · E002', 'Test · E001', 'Compiler · E001', 'Test · No code reported',
    ]);
    expect(new Set(result.groups.map(group => group.key)).size).toBe(4);
  });
  it('uses stable deterministic ordering and puts unknown values last', () => {
    expect(ids(review(sample, { order: 'code' }))).toEqual(['2', '3', '1', '4']);
    expect(ids(review(sample, { order: 'location' }))).toEqual(['1', '2', '3', '4']);
    expect(sample.map(problem => problem.id)).toEqual(['1', '2', '3', '4']);
  });
  it('labels bounded review rather than claiming to filter the unindexed suffix', () => {
    const many = Array.from({ length: MAX_REVIEW_PROBLEMS + 1 }, (_, i) => issue(i));
    many[many.length - 1] = issue(90000, { message: 'late target' });
    const result = review(many, { query: 'late target' });
    expect(result).toMatchObject({ scanned: MAX_REVIEW_PROBLEMS, total: MAX_REVIEW_PROBLEMS + 1,
      matching: 0, limited: true });
  });
});
describe('problem review pagination', () => {
  it('does not lose rows across group boundaries or page boundaries', () => {
    const problems = Array.from({ length: PROBLEM_REVIEW_PAGE * 3 + 4 }, (_, i) =>
      issue(i, { kind: i % 3 === 0 ? 'test' : 'compiler' }));
    const result = review(problems, { grouping: 'kind' });
    const flattened = Array.from({ length: 4 }, (_, i) => pageProblemReview(result, i + 1))
      .flatMap(page => page.groups.flatMap(group => group.problems.map(problem => problem.id)));
    expect(flattened).toEqual(ids(result));
    expect(new Set(flattened).size).toBe(problems.length);
  });
  it('clamps invalid page indexes and keeps whole-group counts on partial pages', () => {
    const problems = Array.from({ length: PROBLEM_REVIEW_PAGE + 5 }, (_, i) => issue(i));
    const result = review(problems, { grouping: 'code' });
    expect(pageProblemReview(result, Infinity).page).toBe(1);
    expect(pageProblemReview(result, -2).page).toBe(1);
    const last = pageProblemReview(result, 99);
    expect(last).toMatchObject({ page: 2, first: PROBLEM_REVIEW_PAGE + 1, last: problems.length });
    expect(last.groups[0].count).toBe(problems.length);
    expect(last.groups[0].problems).toHaveLength(5);
  });
});
describe('reviewed problem text report', () => {
  const minimal = { includeLocations: false, includeHelp: false };
  it('exports matching rows only and distinguishes omitted fields from privacy guarantees', () => {
    const result = buildProblemReport(review(sample, { kind: 'test', navigation: 'available' }), minimal);
    expect(result).toMatchObject({ included: 1, omitted: 0, truncated: false });
    expect(result.text).toContain('Failed test [E001]');
    expect(result.text).toContain('Problem 2');
    expect(result.text).not.toContain('Problem 1');
    expect(result.text).not.toContain('Location:');
    expect(result.text).toContain('Messages may contain private text or paths.');
  });
  it('includes locations and help only with explicit review options', () => {
    const result = buildProblemReport(review([sample[2]]), { includeLocations: true, includeHelp: true });
    expect(result.text).toContain('Location: src/main.srp:3');
    expect(result.text).toContain('Help: Use integer');
    expect(buildProblemReport(review([sample[2]]), minimal).text).not.toContain('Use integer');
  });
  it('renders control characters visibly and indents multiline content', () => {
    const result = buildProblemReport(review([issue(1, { message: 'bad\u0000\u202E\nnext' })]), minimal);
    expect(result.text).toContain('bad[U+0000][U+202E]\n  next');
    expect(result.text).not.toContain('\u202e');
  });
  it('does not include historical diagnostic messages', () => {
    const result = buildProblemReport(review(sample, {}, true), minimal);
    expect(result).toMatchObject({ included: 0, omitted: 0, truncated: false });
    expect(result.text).not.toContain('Problem 1');
    expect(result.text).toContain('historical');
  });
  it('reports row limits and preserves the bounded indexed count', () => {
    const result = buildProblemReport(review(Array.from({ length: MAX_PROBLEM_REPORT_ROWS + 3 }, (_, i) => issue(i))), minimal);
    expect(result).toMatchObject({ included: MAX_PROBLEM_REPORT_ROWS, omitted: 3, truncated: true });
    expect(result.text).toContain('3 matching row(s) omitted');
  });
  it('never represents a partly clipped problem as an included complete row', () => {
    const result = buildProblemReport(review([issue(1), issue(2, { message: '😀'.repeat(MAX_PROBLEM_REPORT_UNITS) })]), minimal);
    expect(result).toMatchObject({ included: 1, omitted: 1, truncated: true });
    expect(result.text.length).toBeLessThanOrEqual(MAX_PROBLEM_REPORT_UNITS);
    expect(result.text).not.toContain('😀');
  });
  it('reports incomplete review coverage separately from omitted matching rows', () => {
    const problems = Array.from({ length: MAX_REVIEW_PROBLEMS + 10 }, (_, i) => issue(i));
    const result = buildProblemReport(review(problems, { query: 'unmatched' }), minimal);
    expect(result.text).toContain('Limited coverage:');
    expect(result.included).toBe(0);
    expect(result.omitted).toBe(0);
  });
});
