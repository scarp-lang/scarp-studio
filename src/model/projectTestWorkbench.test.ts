import { describe, expect, it } from 'vitest';
import { parseScarpTestReportForAction, type ScarpTestCase, type ScarpTestReport } from './projectTestReport';
import { buildTestTextReport, captureTestBaseline, compareProjectTestBaseline, DEFAULT_TEST_FILTER,
  MAX_TEST_REPORT_UNITS, pageProjectTests, reviewProjectTests, reviewTestBaseline,
  TEST_PAGE_SIZE, type TestFilter, type TestResultIdentity } from './projectTestWorkbench';
import type { TestSourceListing } from './projectTestNavigation';

const root = 'C:/practice/basic_tuple';
const test = (name: string, status: ScarpTestCase['status'], patch: Partial<ScarpTestCase> = {}): ScarpTestCase => ({
  path: 'tests/' + name + '.srp', status, phase: status === 'failed' ? 'compile' : null,
  code: status === 'failed' ? 'E0015' : null, message: status === 'failed' ? 'Wrong type' : null,
  help: null, ...patch,
});
function result(tests: ScarpTestCase[], folder = root, mode: ScarpTestReport['mode'] = 'run'): TestResultIdentity {
  return { folder, report: { mode, tests, discovered: tests.length,
    passed: tests.filter(item => item.status === 'passed').length,
    failed: tests.filter(item => item.status === 'failed').length } };
}
const selection: TestSourceListing = {
  path: 'C:/practice', projectRoots: [{ directory: 'basic_tuple', path: root }],
  files: [
    { name: 'basic_tuple/tests/alpha.srp', path: root + '/tests/alpha.srp' },
    { name: 'basic_tuple/tests/beta.srp', path: root + '/tests/beta.srp' },
    { name: 'other/tests/gamma.srp', path: 'C:/practice/other/tests/gamma.srp' },
  ],
};
const sample = result([
  test('alpha', 'passed'),
  test('beta', 'failed', { phase: 'runtime', message: 'Actual result differs', help: 'Check fixture' }),
  test('gamma', 'failed', { phase: 'fixture', code: null, message: 'Fixture missing' }),
  test('delta', 'failed'),
]);
const review = (patch: Partial<TestFilter> = {}, historical = false, input = sample) =>
  reviewProjectTests(input, selection, historical, { ...DEFAULT_TEST_FILTER, ...patch });
const paths = (report: ReturnType<typeof review>) => report.groups.flatMap(group => group.rows.map(row => row.test.path));
function baseline(input: TestResultIdentity = sample) {
  const plan = reviewTestBaseline(input, null, false)!;
  const snapshot = captureTestBaseline(plan, input, null, false, 123);
  if (!snapshot) throw Error('Unexpected capture rejection');
  return snapshot;
}
describe('structured test review', () => {
  it('retains compiler report ordering and counts phases independently', () => {
    const report = review();
    expect(paths(report)).toEqual(sample.report.tests.map(item => item.path));
    expect(report).toMatchObject({ total: 4, matched: 4, listed: 2, compile: 1, fixture: 1, runtime: 1 });
  });
  it('uses exact nested project listing, not another manifest root with the same test name', () => {
    expect(paths(review({ navigation: 'available' }))).toEqual(['tests/alpha.srp', 'tests/beta.srp']);
    expect(paths(review({ navigation: 'unavailable' }))).toEqual(['tests/gamma.srp', 'tests/delta.srp']);
  });
  it('combines terms across message, help, code and path with phase and status', () => {
    expect(paths(review({ query: 'BETA fixture', status: 'failed', phase: 'runtime' }))).toEqual(['tests/beta.srp']);
    expect(paths(review({ query: 'e0015 wrong', phase: 'compile' }))).toEqual(['tests/delta.srp']);
    expect(paths(review({ status: 'passed', phase: 'runtime' }))).toEqual([]);
  });
  it('groups by failure phase without treating passed tests as failures', () => {
    expect(review({ grouping: 'phase' }).groups.map(group => [group.label, group.count])).toEqual([
      ['Passed (no failure phase)', 1], ['Runtime', 1], ['Fixture', 1], ['Compilation', 1],
    ]);
  });
  it('groups by code and separates passed tests and absent diagnostic codes', () => {
    const groups = review({ grouping: 'code' }).groups;
    expect(groups.map(group => [group.label, group.count])).toEqual([
      ['Passed', 1], ['E0015', 2], ['Failure without a reported code', 1],
    ]);
  });
  it('sorts deterministically without changing the underlying report', () => {
    expect(paths(review({ order: 'failures' }))).toEqual([
      'tests/beta.srp', 'tests/delta.srp', 'tests/gamma.srp', 'tests/alpha.srp',
    ]);
    expect(paths(review({ order: 'path' }))).toEqual([
      'tests/alpha.srp', 'tests/beta.srp', 'tests/delta.srp', 'tests/gamma.srp',
    ]);
    expect(sample.report.tests[0].path).toBe('tests/alpha.srp');
  });
  it('suppresses navigation for historical reports without fabricating newer results', () => {
    expect(review({}, true)).toMatchObject({ historical: true, listed: 0, matched: 4 });
    expect(paths(review({ navigation: 'available' }, true))).toEqual([]);
  });
  it('does not classify listed-only discovery as executed tests', () => {
    const discovery = result([test('alpha', 'discovered')], root, 'list');
    const report = review({ grouping: 'status' }, false, discovery);
    expect(report.groups[0].label).toBe('Discovered only');
    expect(report.compile + report.fixture + report.runtime).toBe(0);
    expect(paths(review({ status: 'passed' }, false, discovery))).toEqual([]);
  });
  it('keeps group totals and every row across pages', () => {
    const input = result(Array.from({ length: 64 }, (_, i) => test(String(i), i % 2 ? 'failed' : 'passed')));
    const report = review({ grouping: 'status' }, false, input);
    const first = pageProjectTests(report, 1);
    expect(first.groups[0].count).toBe(32);
    expect(first.groups[0].rows).toHaveLength(TEST_PAGE_SIZE);
    const all = Array.from({ length: first.pages }, (_, i) => pageProjectTests(report, i + 1))
      .flatMap(page => page.groups.flatMap(group => group.rows.map(row => row.test.path)));
    expect(all).toEqual(paths(report));
    expect(new Set(all).size).toBe(64);
    expect(pageProjectTests(report, Infinity).page).toBe(1);
    expect(pageProjectTests(report, 999).last).toBe(64);
  });
});
describe('explicit test baseline provenance', () => {
  it('captures only completed run metadata, with no diagnostic messages or help', () => {
    const snapshot = baseline();
    expect(snapshot.capturedAt).toBe(123);
    expect(snapshot.folder).toBe(root);
    expect(snapshot.cases[1]).toEqual({
      path: 'tests/beta.srp', status: 'failed', phase: 'runtime', code: 'E0015',
    });
    expect(JSON.stringify(snapshot)).not.toContain('Actual result differs');
    expect(JSON.stringify(snapshot)).not.toContain('Check fixture');
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.cases)).toBe(true);
    expect(Object.isFrozen(snapshot.cases[1])).toBe(true);
  });
  it('rejects discovery, historical reports, changed identity or replaced baselines', () => {
    const list = result([test('alpha', 'discovered')], root, 'list');
    expect(reviewTestBaseline(list, null, false)).toBeNull();
    expect(reviewTestBaseline(sample, null, true)).toBeNull();
    const plan = reviewTestBaseline(sample, null, false)!;
    expect(captureTestBaseline(plan, { ...sample }, null, false, 123)).toBeNull();
    expect(captureTestBaseline(plan, sample, baseline(), false, 123)).toBeNull();
    expect(captureTestBaseline(plan, sample, null, true, 123)).toBeNull();
    expect(captureTestBaseline(plan, sample, null, false, NaN)).toBeNull();
  });
  it('does not alias a mutable caller test record', () => {
    const item = test('original', 'failed');
    const snapshot = baseline(result([item]));
    item.status = 'passed';
    item.path = 'tests/other.srp';
    expect(snapshot.cases[0]).toMatchObject({ path: 'tests/original.srp', status: 'failed' });
  });
  it('handles all seven transitions without treating absent tests as deleted files', () => {
    const old = baseline(result([
      test('a', 'passed'), test('b', 'failed'), test('c', 'passed'),
      test('d', 'failed'), test('e', 'failed'), test('missing', 'passed'),
    ]));
    const next = result([
      test('a', 'failed'), test('b', 'passed'), test('c', 'passed'),
      test('d', 'failed'), test('e', 'failed', { phase: 'runtime' }), test('new', 'passed'),
    ]);
    const comparison = compareProjectTestBaseline(old, next, false);
    if (!comparison.ok) throw Error(comparison.error);
    expect(comparison.value.counts).toEqual({
      regression: 1, recovery: 1, 'still-passing': 1, 'still-failing': 1,
      'failure-changed': 1, added: 1, missing: 1,
    });
    expect(comparison.value.rows.find(row => row.path === 'tests/missing.srp')?.after).toBeNull();
    expect(comparison.value.rows.find(row => row.path === 'tests/new.srp')?.before).toBeNull();
  });
  it('classifies same-phase changed diagnostic codes as changed failure', () => {
    const old = baseline(result([test('a', 'failed')]));
    const next = result([test('a', 'failed', { code: 'E0042' })]);
    expect(compareProjectTestBaseline(old, next, false)).toMatchObject({
      ok: true, value: { counts: { 'failure-changed': 1 } },
    });
  });
  it('does not claim identical diagnostics when messages alone change', () => {
    const old = baseline(result([test('a', 'failed', { message: 'old' })]));
    const next = result([test('a', 'failed', { message: 'new' })]);
    expect(compareProjectTestBaseline(old, next, false)).toMatchObject({
      ok: true, value: { counts: { 'still-failing': 1 } },
    });
  });
  it('allows ordinary Windows path aliases but rejects different project roots and historical reports', () => {
    const old = baseline();
    expect(compareProjectTestBaseline(old, { ...sample, folder: 'c:\\PRACTICE\\basic_tuple' }, false).ok).toBe(true);
    expect(compareProjectTestBaseline(old, { ...sample, folder: 'C:/practice/other' }, false).ok).toBe(false);
    expect(compareProjectTestBaseline(old, sample, true).ok).toBe(false);
    expect(compareProjectTestBaseline(null, sample, false).ok).toBe(false);
    expect(compareProjectTestBaseline(old, result([], root, 'list'), false).ok).toBe(false);
  });
  it('handles empty executed suites as zero observed transitions', () => {
    const empty = result([]);
    const comparison = compareProjectTestBaseline(baseline(empty), empty, false);
    expect(comparison).toMatchObject({ ok: true, value: { rows: [], counts: { regression: 0, recovery: 0 } } });
  });
  it('uses validated compiler schema and exit-code reports rather than arbitrary console text', () => {
    const json = JSON.stringify({ schema_version: 2, mode: 'run', discovered: 1, passed: 1, failed: 0,
      tests: [{ path: 'tests/a.srp', status: 'passed' }] });
    expect(parseScarpTestReportForAction(json, 'run-tests', 1)).toBeNull();
    const report = parseScarpTestReportForAction(json, 'run-tests', 0)!;
    const actual = { folder: root, report };
    expect(baseline(actual).cases[0].status).toBe('passed');
  });
});
describe('matching test report review', () => {
  it('includes only filtered outcomes and excludes the native project folder and messages by default', () => {
    const report = buildTestTextReport(sample, review({ phase: 'runtime' }), false);
    expect(report).toMatchObject({ included: 1, omitted: 0 });
    expect(report.text).toContain('tests/beta.srp | failed | runtime | E0015');
    expect(report.text).not.toContain('tests/alpha.srp');
    expect(report.text).not.toContain(root);
    expect(report.text).not.toContain('Actual result differs');
  });
  it('allows explicit message inclusion and visibly encodes control characters', () => {
    const input = result([test('a', 'failed', { message: 'bad\u0000\u202e\ntext' })]);
    const report = buildTestTextReport(input, review({}, false, input), true);
    expect(report.text).toContain('bad[U+0000][U+202E][U+000A]text');
    expect(report.text).not.toContain('\u202e');
  });
  it('labels historical and discovery-only results', () => {
    expect(buildTestTextReport(sample, review({}, true), false).text).toContain('Historical report');
    const discovery = result([test('a', 'discovered')], root, 'list');
    expect(buildTestTextReport(discovery, review({}, false, discovery), false).text).toContain('no tests executed');
  });
  it('omits whole oversized rows rather than silently cutting compiler messages', () => {
    const input = result([test('a', 'passed'), test('b', 'failed', { message: '😀'.repeat(MAX_TEST_REPORT_UNITS) })]);
    const report = buildTestTextReport(input, review({}, false, input), true);
    expect(report).toMatchObject({ included: 1, omitted: 1 });
    expect(report.text.length).toBeLessThanOrEqual(MAX_TEST_REPORT_UNITS);
    expect(report.text).not.toContain('😀');
  });
});
