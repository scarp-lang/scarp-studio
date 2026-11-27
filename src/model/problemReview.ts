import { filterProblems, type ProblemFilter, type StudioProblem } from './problems';
import { unicodeSafePreviewBounds } from './utf8Text';

export const MAX_REVIEW_PROBLEMS = 2000;
export const MAX_PROBLEM_REPORT_ROWS = 200;
export const MAX_PROBLEM_REPORT_UNITS = 64 * 1024;
export const PROBLEM_REVIEW_PAGE = 25;
export type NavigationFilter = 'all' | 'available' | 'unavailable';
export type ProblemGrouping = 'none' | 'kind' | 'code';
export type ProblemOrder = 'original' | 'code' | 'location';
export interface ProblemReviewOptions {
  readonly kind: ProblemFilter;
  readonly query: string;
  readonly navigation: NavigationFilter;
  readonly grouping: ProblemGrouping;
  readonly order: ProblemOrder;
}
export const DEFAULT_PROBLEM_REVIEW: ProblemReviewOptions = Object.freeze({
  kind: 'all', query: '', navigation: 'all', grouping: 'none', order: 'original',
});
export interface ProblemReviewGroup {
  readonly key: string;
  readonly label: string | null;
  readonly count: number;
  readonly problems: readonly StudioProblem[];
}
export interface ProblemReviewResult {
  readonly groups: readonly ProblemReviewGroup[];
  readonly total: number;
  readonly scanned: number;
  readonly matching: number;
  readonly compiler: number;
  readonly tests: number;
  readonly available: number;
  readonly unavailable: number;
  readonly limited: boolean;
  readonly stale: boolean;
}
export interface ProblemReviewPage {
  readonly page: number;
  readonly pages: number;
  readonly first: number;
  readonly last: number;
  readonly groups: readonly ProblemReviewGroup[];
}
function compareText(left: string | null, right: string | null): number {
  // Unknown values last, stable ordering independent of browser locale.
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  const a = left.toLowerCase(), b = right.toLowerCase();
  return a < b ? -1 : a > b ? 1 : left < right ? -1 : left > right ? 1 : 0;
}
function groupIdentity(problem: StudioProblem, grouping: ProblemGrouping): { key: string; label: string | null } {
  if (grouping === 'kind') return {
    key: problem.kind, label: problem.kind === 'compiler' ? 'Compiler diagnostics' : 'Failed project tests',
  };
  if (grouping === 'code') return {
    key: JSON.stringify([problem.kind, problem.code]),
    label: (problem.kind === 'compiler' ? 'Compiler' : 'Test') + ' · ' + (problem.code || 'No code reported'),
  };
  return { key: 'all', label: null };
}
/** Only the supplied current structured problem collection is reviewed.
 * No diagnosis is inferred from console text. Stale state suppresses
 * every row, even if the caller accidentally still supplies old results. */
export function reviewCurrentProblems(
  problems: readonly StudioProblem[], stale: boolean, options: ProblemReviewOptions,
): ProblemReviewResult {
  if (stale) return {
    groups: [], total: 0, scanned: 0, matching: 0, compiler: 0, tests: 0,
    available: 0, unavailable: 0, limited: false, stale: true,
  };
  const scanned = problems.slice(0, MAX_REVIEW_PROBLEMS);
  const compiler = scanned.filter(problem => problem.kind === 'compiler').length;
  const available = scanned.filter(problem => problem.target !== null).length;
  const matching = filterProblems(scanned, options.kind, options.query).filter(problem =>
    options.navigation === 'all' || (options.navigation === 'available') === (problem.target !== null));
  if (options.order === 'code') matching.sort((a, b) => compareText(a.code, b.code));
  if (options.order === 'location') matching.sort((a, b) => compareText(a.location, b.location));
  const map = new Map<string, { key: string; label: string | null; problems: StudioProblem[] }>();
  for (const problem of matching) {
    const identity = groupIdentity(problem, options.grouping);
    const existing = map.get(identity.key);
    if (existing) existing.problems.push(problem);
    else map.set(identity.key, { ...identity, problems: [problem] });
  }
  return {
    groups: [...map.values()].map(group => ({ ...group, count: group.problems.length })),
    total: problems.length, scanned: scanned.length, matching: matching.length,
    compiler, tests: scanned.length - compiler, available, unavailable: scanned.length - available,
    limited: scanned.length < problems.length, stale: false,
  };
}

/** Paginate rows, not groups. Preserve a group's complete matched count
 * when its rows extend to another page. No rows are dropped at boundaries. */
export function pageProblemReview(review: ProblemReviewResult, requestedPage: number): ProblemReviewPage {
  const pages = Math.max(1, Math.ceil(review.matching / PROBLEM_REVIEW_PAGE));
  const page = Number.isSafeInteger(requestedPage) ? Math.max(1, Math.min(pages, requestedPage)) : 1;
  const start = (page - 1) * PROBLEM_REVIEW_PAGE, end = start + PROBLEM_REVIEW_PAGE;
  let offset = 0;
  const groups: ProblemReviewGroup[] = [];
  for (const group of review.groups) {
    const first = Math.max(0, start - offset);
    const last = Math.min(group.problems.length, end - offset);
    if (first < last) groups.push({ ...group, problems: group.problems.slice(first, last) });
    offset += group.problems.length;
    if (offset >= end) break;
  }
  return { page, pages, first: review.matching ? start + 1 : 0,
    last: Math.min(end, review.matching), groups };
}
export interface ProblemReportOptions {
  readonly includeLocations: boolean;
  readonly includeHelp: boolean;
}
export interface ProblemReport {
  readonly text: string;
  readonly included: number;
  readonly omitted: number;
  readonly truncated: boolean;
}
function displayField(value: string): string {
  // Preserve ordinary Unicode and tabs in readable text; represent control
  // and directional formatting characters visibly in the optional report.
  return value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,
    char => '[U+' + char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0') + ']')
    .replace(/\r\n|\r|\n/g, '\n  ');
}
function reportRow(problem: StudioProblem, options: ProblemReportOptions): string {
  const kind = problem.kind === 'compiler' ? 'Compiler' : 'Failed test';
  const parts = [
    kind + (problem.code ? ' [' + displayField(problem.code) + ']' : ''),
    'Message: ' + displayField(problem.message),
    'Navigation: ' + (problem.target ? 'Available in current Studio state' : 'Unavailable'),
  ];
  if (options.includeLocations && problem.location) parts.push('Location: ' + displayField(problem.location));
  if (options.includeHelp && problem.help) parts.push('Help: ' + displayField(problem.help));
  return parts.join('\n');
}
/** Prepare a bounded, user-reviewed text report of matching structured
 * problems. Location omission removes only the explicit field: compiler
 * messages and help may still contain paths or private source text.
 * Never silently truncate a row and call it complete. */
export function buildProblemReport(review: ProblemReviewResult, options: ProblemReportOptions): ProblemReport {
  const title = review.stale ? 'Scarp Studio: results are historical; no current structured problems reviewed.'
    : 'Scarp Studio: current structured problem review (' + review.matching + ' matching indexed rows)';
  const coverage = review.limited ? '\nLimited coverage: ' + review.scanned + ' of ' + review.total + ' problems indexed.' : '';
  const preface = title + coverage + '\nNot proof of successful verification. Messages may contain private text or paths.\n';
  const chunks = [preface];
  let units = preface.length;
  let included = 0;
  for (const group of review.groups) {
    for (const problem of group.problems) {
      if (included >= MAX_PROBLEM_REPORT_ROWS) break;
      const row = '\n' + reportRow(problem, options) + '\n';
      // Reserve space for an explicit omission footer.
      if (units + row.length > MAX_PROBLEM_REPORT_UNITS - 150) {
        const omitted = review.matching - included;
        const footer = '\n' + omitted + ' matching row(s) omitted by report size limit.';
        return { text: chunks.join('') + footer, included, omitted, truncated: true };
      }
      chunks.push(row); units += row.length; included++;
    }
    if (included >= MAX_PROBLEM_REPORT_ROWS) break;
  }
  const omitted = review.matching - included;
  if (omitted) chunks.push('\n' + omitted + ' matching row(s) omitted by report row limit.');
  // Guard the final string, preserving valid supplementary scalars.
  const text = chunks.join('');
  const bounds = unicodeSafePreviewBounds(text, 0, Math.min(text.length, MAX_PROBLEM_REPORT_UNITS - 1));
  return { text: text.slice(0, bounds.end), included, omitted, truncated: omitted > 0 || bounds.end !== text.length };
}
