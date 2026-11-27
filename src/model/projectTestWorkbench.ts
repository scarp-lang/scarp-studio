import { sameFilePath } from './documents';
import { resolveListedTestSource, type TestSourceListing } from './projectTestNavigation';
import type { ScarpTestCase, ScarpTestReport, ScarpTestStatus } from './projectTestReport';

export const TEST_PAGE_SIZE = 12;
export const MAX_TEST_QUERY = 120;
export const MAX_TEST_REPORT_UNITS = 48 * 1024;
export type TestPhase = NonNullable<ScarpTestCase['phase']>;
export type TestGroup = 'none' | 'status' | 'phase' | 'code';
export type TestOrder = 'original' | 'path' | 'failures';
export interface TestFilter {
  readonly query: string;
  readonly status: ScarpTestStatus | 'all';
  readonly phase: TestPhase | 'all';
  readonly navigation: 'all' | 'available' | 'unavailable';
  readonly grouping: TestGroup;
  readonly order: TestOrder;
}
export const DEFAULT_TEST_FILTER: TestFilter = Object.freeze({
  query: '', status: 'all', phase: 'all', navigation: 'all', grouping: 'none', order: 'original',
});
export interface TestResultIdentity {
  readonly folder: string;
  readonly report: ScarpTestReport;
}
export interface TestRow {
  readonly test: ScarpTestCase;
  readonly listed: boolean;
}
export interface TestGroupRows {
  readonly key: string;
  readonly label: string | null;
  readonly rows: readonly TestRow[];
  readonly count: number;
}
export interface TestReview {
  readonly groups: readonly TestGroupRows[];
  readonly total: number;
  readonly matched: number;
  readonly listed: number;
  readonly compile: number;
  readonly fixture: number;
  readonly runtime: number;
  readonly historical: boolean;
}
const priority: Record<ScarpTestStatus, number> = { failed: 0, passed: 1, discovered: 2 };
function compareText(a: string, b: string): number {
  const lowerA = a.toLowerCase(), lowerB = b.toLowerCase();
  return lowerA < lowerB ? -1 : lowerA > lowerB ? 1 : a < b ? -1 : a > b ? 1 : 0;
}
export const TEST_PHASE_LABELS: Readonly<Record<TestPhase, string>> = Object.freeze({
  compile: 'Compilation', fixture: 'Fixture', runtime: 'Runtime',
});
function groupKey(test: ScarpTestCase, grouping: TestGroup): { key: string; label: string | null } {
  if (grouping === 'status') return { key: test.status, label: test.status === 'passed' ? 'Passed' : test.status === 'failed' ? 'Failed' : 'Discovered only' };
  if (grouping === 'phase') return { key: test.phase ?? test.status,
    label: test.phase ? TEST_PHASE_LABELS[test.phase] : test.status === 'passed' ? 'Passed (no failure phase)' : 'Discovery only' };
  if (grouping === 'code') return { key: JSON.stringify([test.status, test.code]),
    label: test.status === 'failed' ? test.code ?? 'Failure without a reported code' : test.status === 'passed' ? 'Passed' : 'Discovered only' };
  return { key: 'all', label: null };
}
/** Only the already validated native test report is used. No console text
 * parsing, inferred pass/fail, filesystem reads or command execution. */
export function reviewProjectTests(result: TestResultIdentity, selection: TestSourceListing | null,
  historical: boolean, filter: TestFilter): TestReview {
  const all = result.report.tests.map(test => ({
    test, listed: !historical && resolveListedTestSource(test.path, result.folder, selection) !== null,
  }));
  const terms = filter.query.slice(0, MAX_TEST_QUERY).trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rows = all.filter(({ test, listed }) =>
    (filter.status === 'all' || test.status === filter.status) &&
    (filter.phase === 'all' || test.phase === filter.phase) &&
    (filter.navigation === 'all' || (filter.navigation === 'available') === listed) &&
    terms.every(term => [test.path, test.code, test.message, test.help].some(value => value?.toLowerCase().includes(term))));
  if (filter.order === 'path') rows.sort((a, b) => compareText(a.test.path, b.test.path));
  if (filter.order === 'failures') rows.sort((a, b) =>
    priority[a.test.status] - priority[b.test.status] || compareText(a.test.path, b.test.path));
  const groups = new Map<string, { key: string; label: string | null; rows: TestRow[] }>();
  for (const row of rows) {
    const identity = groupKey(row.test, filter.grouping);
    const existing = groups.get(identity.key);
    if (existing) existing.rows.push(row);
    else groups.set(identity.key, { ...identity, rows: [row] });
  }
  return {
    groups: [...groups.values()].map(group => ({ ...group, count: group.rows.length })),
    total: all.length, matched: rows.length, listed: all.filter(row => row.listed).length,
    compile: all.filter(row => row.test.phase === 'compile').length,
    fixture: all.filter(row => row.test.phase === 'fixture').length,
    runtime: all.filter(row => row.test.phase === 'runtime').length,
    historical,
  };
}
export function pageProjectTests(review: TestReview, requested: number) {
  const pages = Math.max(1, Math.ceil(review.matched / TEST_PAGE_SIZE));
  const page = Number.isSafeInteger(requested) ? Math.max(1, Math.min(pages, requested)) : 1;
  const start = (page - 1) * TEST_PAGE_SIZE;
  const end = start + TEST_PAGE_SIZE;
  let offset = 0;
  const groups: TestGroupRows[] = [];
  for (const group of review.groups) {
    const from = Math.max(0, start - offset);
    const to = Math.min(group.rows.length, end - offset);
    if (from < to) groups.push({ ...group, rows: group.rows.slice(from, to) });
    offset += group.rows.length;
    if (offset >= end) break;
  }
  return { page, pages, groups, first: review.matched ? start + 1 : 0, last: Math.min(end, review.matched) };
}
export interface TestBaselineCase {
  readonly path: string;
  readonly status: 'passed' | 'failed';
  readonly phase: TestPhase | null;
  readonly code: string | null;
}
export interface TestBaseline {
  /** Exact project identity is retained in memory, never included in reports. */
  readonly folder: string;
  readonly capturedAt: number;
  readonly cases: readonly TestBaselineCase[];
}
export interface TestBaselineReview {
  readonly result: TestResultIdentity;
  readonly previous: TestBaseline | null;
}
export function reviewTestBaseline(result: TestResultIdentity, baseline: TestBaseline | null,
  historical: boolean): TestBaselineReview | null {
  if (historical || result.report.mode !== 'run') return null;
  return Object.freeze({ result, previous: baseline });
}
export function captureTestBaseline(review: TestBaselineReview, current: TestResultIdentity,
  baseline: TestBaseline | null, historical: boolean, timestamp: number): TestBaseline | null {
  // A reviewed capture cannot silently follow a different report or replace
  // a newer baseline. Never copy compiler messages or help into the baseline.
  if (historical || review.result !== current || review.previous !== baseline ||
      current.report.mode !== 'run' || !Number.isSafeInteger(timestamp) || timestamp < 0 ||
      timestamp > 8640000000000000) return null;
  const cases: TestBaselineCase[] = [];
  for (const test of current.report.tests) {
    if (test.status === 'discovered') return null;
    cases.push(Object.freeze({ path: test.path, status: test.status, phase: test.phase, code: test.code }));
  }
  return Object.freeze({ folder: current.folder, capturedAt: timestamp, cases: Object.freeze(cases) });
}
export type TestTransition = 'regression' | 'recovery' | 'still-passing' | 'still-failing' |
  'failure-changed' | 'added' | 'missing';
export const TRANSITION_LABELS: Readonly<Record<TestTransition, string>> = Object.freeze({
  regression: 'Previously passed, now failed', recovery: 'Previously failed, now passed',
  'still-passing': 'Passed in both reports', 'still-failing': 'Failed in both reports',
  'failure-changed': 'Failed in both; phase or code changed',
  added: 'Only in current report', missing: 'Only in baseline report',
});
export const TEST_TRANSITIONS = Object.keys(TRANSITION_LABELS) as TestTransition[];
export interface TestTransitionRow {
  readonly path: string;
  readonly before: TestBaselineCase | null;
  readonly after: ScarpTestCase | null;
  readonly transition: TestTransition;
}
export interface TestComparison {
  readonly rows: readonly TestTransitionRow[];
  readonly counts: Readonly<Record<TestTransition, number>>;
}
type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export function compareProjectTestBaseline(baseline: TestBaseline | null, current: TestResultIdentity,
  historical: boolean): Result<TestComparison> {
  if (!baseline) return { ok: false, error: 'Capture a completed run as a session baseline first.' };
  if (historical) return { ok: false, error: 'Current test results are historical. Rerun tests before comparison.' };
  if (current.report.mode !== 'run') return { ok: false, error: 'Discovery is not an executed test run.' };
  if (!sameFilePath(baseline.folder, current.folder)) return { ok: false, error: 'The baseline belongs to a different selected project.' };
  const before = new Map(baseline.cases.map(test => [test.path, test]));
  const after = new Map(current.report.tests.map(test => [test.path, test]));
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort(compareText);
  const counts = Object.fromEntries(TEST_TRANSITIONS.map(kind => [kind, 0])) as Record<TestTransition, number>;
  const rows = paths.map(path => {
    const old = before.get(path) ?? null, next = after.get(path) ?? null;
    const transition: TestTransition = !old ? 'added' : !next ? 'missing' :
      old.status === 'passed' ? next.status === 'failed' ? 'regression' : 'still-passing' :
      next.status === 'passed' ? 'recovery' :
      old.phase !== next.phase || old.code !== next.code ? 'failure-changed' : 'still-failing';
    counts[transition]++;
    return Object.freeze({ path, before: old, after: next, transition });
  });
  return { ok: true, value: { rows: Object.freeze(rows), counts: Object.freeze(counts) } };
}
export interface TestTextReport {
  readonly text: string;
  readonly included: number;
  readonly omitted: number;
}
function visibleField(text: string): string {
  return text.replace(/[\x00-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,
    char => '[U+' + char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0') + ']');
}
/** Reports contain relative test labels, never the native project folder.
 * Optional compiler messages may still contain private text or paths. */
export function buildTestTextReport(result: TestResultIdentity, review: TestReview, includeMessages: boolean): TestTextReport {
  const header = [
    'Scarp Studio structured project test review',
    review.historical ? 'Historical report; not a current test result.' :
      result.report.mode === 'list' ? 'Discovery only; no tests executed.' : 'Completed structured run report.',
    'Matching rows: ' + review.matched + '/' + review.total,
    'Messages may contain private text or paths. No native project folder included as a field.',
  ].join('\n') + '\n';
  const chunks = [header];
  let units = header.length, included = 0;
  for (const group of review.groups) {
    for (const { test } of group.rows) {
      const row = [visibleField(test.path), test.status, test.phase ?? '', test.code ?? '',
        includeMessages && test.message ? visibleField(test.message) : '',
        includeMessages && test.help ? visibleField(test.help) : ''].filter(Boolean).join(' | ') + '\n';
      if (units + row.length > MAX_TEST_REPORT_UNITS - 100) {
        const omitted = review.matched - included;
        return { text: chunks.join('') + '\n' + omitted + ' matching row(s) omitted by size limit.', included, omitted };
      }
      chunks.push(row); included++; units += row.length;
    }
  }
  return { text: chunks.join(''), included, omitted: 0 };
}
