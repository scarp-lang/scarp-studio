import { safeRelativeScarpSourceName, safeRelativeScarpDirectory, MAX_DISPLAYED_SCARP_FILES } from './folderListing';
import { MAX_SEARCH_QUERY_UNITS, MAX_SEARCH_RESULTS, type SearchOptions } from './openFileSearch';
import { PROJECT_SEARCH_FILE_STATES } from './projectSearch';
import {
  MAX_SCOPE_NAME_QUERY, MAX_SCOPE_REPORT_UNITS, PROJECT_SEARCH_BATCH_SIZE,
  sameProjectScope, SEARCH_COVERAGE_LABELS, searchCoverageOrigin,
  type ScopedSearchSummary, type ScopedFileCoverageRow, type ProjectSearchScope, type ProjectSearchBatch,
} from './projectSearchScope';
import { assertWellFormedUtf16 } from './utf8Text';

export const MAX_SEARCH_OBSERVATIONS = 8;
export const SEARCH_COMPARISON_PAGE_SIZE = 20;

export interface SearchObservation {
  /** Used only to establish comparability in memory, never included in exports. */
  readonly query: string;
  readonly options: Readonly<SearchOptions>;
  readonly scope: ProjectSearchScope;
  readonly batch?: ProjectSearchBatch;
  readonly listed: number;
  readonly withheld: number;
  readonly excluded: number;
  readonly incomplete: boolean;
  readonly rows: readonly ScopedFileCoverageRow[];
}
export type ObservationResult<T> = { readonly ok: true; readonly value: T } |
  { readonly ok: false; readonly error: string };
const fail = (error: string): ObservationResult<never> => ({ ok: false, error });

function validCount(n: number, maximum = Number.MAX_SAFE_INTEGER): boolean {
  return Number.isSafeInteger(n) && n >= 0 && n <= maximum;
}
function validText(text: string, maximum: number): boolean {
  if (typeof text !== 'string' || text.length > maximum) return false;
  try { assertWellFormedUtf16(text, 'Search observation'); return true; }
  catch { return false; }
}
/** Reject drive-qualified or invisible-format labels from observation exports. */
export function validRelativeLabel(label: string): boolean {
  return validText(label, 1024) && !/^[A-Za-z]:/.test(label) &&
    !/[\x00-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/.test(label);
}
function validRow(row: ScopedFileCoverageRow): boolean {
  if (!safeRelativeScarpSourceName(row.name) || !validRelativeLabel(row.name) ||
      !validCount(row.hits, MAX_SEARCH_RESULTS) || !PROJECT_SEARCH_FILE_STATES.includes(row.state)) return false;
  const origin = row.origin;
  if (origin !== null && origin !== 'disk' && origin !== 'open-buffer') return false;
  if ((row.state === 'scanned' || row.state === 'content-limit') && origin === null) return false;
  if (row.state === 'read-failed' && origin !== 'disk') return false;
  if ((row.state === 'file-limit' || row.state === 'invalid-listing') && origin !== null) return false;
  return !row.hits || row.state === 'scanned' || row.state === 'content-limit';
}
function validScope(scope: ProjectSearchScope): boolean {
  return (scope.directory === '' || safeRelativeScarpDirectory(scope.directory)) &&
    validRelativeLabel(scope.directory) && typeof scope.descendants === 'boolean' &&
    validText(scope.filename, MAX_SCOPE_NAME_QUERY) &&
    !/[/\\\x00-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/.test(scope.filename) &&
    (scope.batch === undefined || (Number.isSafeInteger(scope.batch) && scope.batch > 0));
}
function validBatch(batch: ProjectSearchBatch, scope: ProjectSearchScope, count: number): boolean {
  return validCount(batch.candidates, MAX_DISPLAYED_SCARP_FILES) &&
    batch.candidates >= count && batch.deferred === batch.candidates - count &&
    batch.index === scope.batch && batch.index >= 1 && batch.index <= batch.total &&
    batch.total === Math.ceil(batch.candidates / PROJECT_SEARCH_BATCH_SIZE) &&
    batch.first === (batch.index - 1) * PROJECT_SEARCH_BATCH_SIZE + 1 &&
    batch.last === Math.min(batch.candidates, batch.index * PROJECT_SEARCH_BATCH_SIZE) &&
    count === batch.last - batch.first + 1;
}

/** Copy only bounded observation metadata. No hit text, previews, document IDs,
 * source snapshots, native paths, or execution capabilities cross this boundary.
 * An old summary without per-file evidence cannot establish zero-match coverage.
 */
export function captureSearchObservation(
  query: string, options: SearchOptions, summary: ScopedSearchSummary,
): ObservationResult<SearchObservation> {
  if (!validText(query, MAX_SEARCH_QUERY_UNITS) || !query || /[\r\n]/.test(query) ||
      typeof options.caseSensitive !== 'boolean' || typeof options.wholeWord !== 'boolean' ||
      !validScope(summary.scope)) return fail('Search settings are not valid for comparison.');
  const rows = summary.fileCoverage;
  if (!rows) return fail('Run a search with per-file coverage before recording an observation.');
  if (!validCount(summary.listed) || !validCount(summary.withheld) ||
      !validCount(summary.excluded, MAX_DISPLAYED_SCARP_FILES) ||
      !validCount(summary.inScope, MAX_DISPLAYED_SCARP_FILES) ||
      !validCount(summary.searched, MAX_DISPLAYED_SCARP_FILES) ||
      !validCount(summary.skipped, MAX_DISPLAYED_SCARP_FILES) ||
      !validCount(summary.hits, MAX_SEARCH_RESULTS) ||
      !validCount(summary.matchingFiles, MAX_DISPLAYED_SCARP_FILES) ||
      typeof summary.incomplete !== 'boolean' ||
      rows.length !== summary.inScope || rows.length > MAX_DISPLAYED_SCARP_FILES) {
    return fail('Search observation counts are inconsistent.');
  }
  if ((summary.scope.batch === undefined) !== (summary.batch === undefined) ||
      (summary.batch && !validBatch(summary.batch, summary.scope, rows.length))) {
    return fail('Search batch metadata is inconsistent.');
  }
  const deferred = summary.batch?.deferred ?? 0;
  if (summary.listed !== summary.inScope + summary.excluded + summary.withheld + deferred ||
      summary.searched + summary.skipped !== rows.length ||
      (!summary.incomplete && (summary.skipped > 0 || summary.withheld > 0 || deferred > 0))) {
    return fail('Search observation coverage is inconsistent.');
  }
  const names = new Set<string>();
  let scanned = 0;
  let hits = 0;
  let matched = 0;
  const copy: ScopedFileCoverageRow[] = [];
  for (const row of rows) {
    if (!validRow(row) || names.has(row.name)) return fail('Search observation contains invalid source evidence.');
    names.add(row.name);
    if (row.state === 'scanned') scanned++;
    hits += row.hits;
    if (row.hits > 0) matched++;
    copy.push(Object.freeze({ name: row.name, state: row.state, origin: row.origin, hits: row.hits }));
  }
  if (scanned !== summary.searched || hits !== summary.hits || matched !== summary.matchingFiles) {
    return fail('Search observation rows do not agree with the totals.');
  }
  return { ok: true, value: Object.freeze({
    query, options: Object.freeze({ caseSensitive: options.caseSensitive, wholeWord: options.wholeWord }),
    scope: Object.freeze({
      directory: summary.scope.directory, descendants: summary.scope.descendants,
      filename: summary.scope.filename,
      ...(summary.scope.batch === undefined ? {} : { batch: summary.scope.batch }),
    }),
    ...(summary.batch ? { batch: Object.freeze({
      index: summary.batch.index, total: summary.batch.total, candidates: summary.batch.candidates,
      deferred: summary.batch.deferred, first: summary.batch.first, last: summary.batch.last,
    }) } : {}),
    listed: summary.listed, withheld: summary.withheld, excluded: summary.excluded,
    incomplete: summary.incomplete, rows: Object.freeze(copy),
  }) };
}

export const SEARCH_COMPARISON_STATES = [
  'increased', 'decreased', 'unchanged', 'not-comparable', 'earlier-only', 'current-only',
] as const;
export type SearchComparisonState = typeof SEARCH_COMPARISON_STATES[number];
export const SEARCH_COMPARISON_LABELS: Readonly<Record<SearchComparisonState, string>> = Object.freeze({
  increased: 'More observed matches',
  decreased: 'Fewer observed matches',
  unchanged: 'Same observed count',
  'not-comparable': 'Incomplete file evidence',
  'earlier-only': 'Earlier selection only',
  'current-only': 'Current selection only',
});
export interface SearchComparisonRow {
  readonly name: string;
  readonly before: ScopedFileCoverageRow | null;
  readonly after: ScopedFileCoverageRow | null;
  readonly state: SearchComparisonState;
  /** Only both fully scanned files may produce an exact observed count delta. */
  readonly delta: number | null;
  readonly originChanged: boolean;
}
export interface SearchObservationComparison {
  readonly rows: readonly SearchComparisonRow[];
  readonly counts: Readonly<Record<SearchComparisonState, number>>;
  readonly earlierIncomplete: boolean;
  readonly currentIncomplete: boolean;
  readonly comparableFiles: number;
  readonly observedDelta: number;
  readonly earlierListed: number;
  readonly currentListed: number;
  readonly earlierDeferred: number;
  readonly currentDeferred: number;
  readonly originChanges: number;
}

function compareRow(
  name: string, before: ScopedFileCoverageRow | null, after: ScopedFileCoverageRow | null,
): SearchComparisonRow {
  let state: SearchComparisonState;
  let delta: number | null = null;
  if (!before) state = 'current-only';
  else if (!after) state = 'earlier-only';
  else if (before.state !== 'scanned' || after.state !== 'scanned') state = 'not-comparable';
  else {
    delta = after.hits - before.hits;
    state = delta > 0 ? 'increased' : delta < 0 ? 'decreased' : 'unchanged';
  }
  return Object.freeze({ name, before, after, state, delta,
    originChanged: Boolean(before && after && before.origin !== after.origin) });
}

/** Compare observations only for exactly the same literal query, flags and
 * scope. Pair exact relative labels, not native paths or file identities.
 * No result proves a filesystem addition/deletion or semantic source change.
 */
export function compareSearchObservations(
  before: SearchObservation, after: SearchObservation,
): ObservationResult<SearchObservationComparison> {
  if (before.query !== after.query || before.options.caseSensitive !== after.options.caseSensitive ||
      before.options.wholeWord !== after.options.wholeWord) return fail('Use the same search query and matching options.');
  if (!sameProjectScope(before.scope, after.scope)) return fail('Use the same directory, filename filter and batch selection.');
  const earlier = new Map(before.rows.map(row => [row.name, row]));
  const current = new Map(after.rows.map(row => [row.name, row]));
  const names = [...new Set([...earlier.keys(), ...current.keys()])].sort();
  const counts: Record<SearchComparisonState, number> = {
    increased: 0, decreased: 0, unchanged: 0, 'not-comparable': 0, 'earlier-only': 0, 'current-only': 0,
  };
  let observedDelta = 0;
  let comparableFiles = 0;
  let originChanges = 0;
  const rows = names.map(name => {
    const row = compareRow(name, earlier.get(name) ?? null, current.get(name) ?? null);
    counts[row.state]++;
    if (row.delta !== null) { observedDelta += row.delta; comparableFiles++; }
    if (row.originChanged) originChanges++;
    return row;
  });
  return { ok: true, value: Object.freeze({
    rows: Object.freeze(rows), counts: Object.freeze(counts),
    earlierIncomplete: before.incomplete, currentIncomplete: after.incomplete,
    comparableFiles, observedDelta, originChanges,
    earlierListed: before.listed, currentListed: after.listed,
    earlierDeferred: before.batch?.deferred ?? 0, currentDeferred: after.batch?.deferred ?? 0,
  }) };
}

export type SearchComparisonFilter = 'all' | 'changed' | SearchComparisonState;
export const SEARCH_COMPARISON_FILTERS: readonly SearchComparisonFilter[] = Object.freeze([
  'all', 'changed', ...SEARCH_COMPARISON_STATES,
]);
export function filterSearchComparison(
  comparison: SearchObservationComparison, filter: SearchComparisonFilter,
): readonly SearchComparisonRow[] {
  if (filter === 'all') return comparison.rows;
  if (filter === 'changed') return comparison.rows.filter(row => row.state !== 'unchanged' || row.originChanged);
  return comparison.rows.filter(row => row.state === filter);
}
export function pageSearchComparison(rows: readonly SearchComparisonRow[], requestedPage: number) {
  const pages = Math.max(1, Math.ceil(rows.length / SEARCH_COMPARISON_PAGE_SIZE));
  const page = Math.max(1, Math.min(pages, Number.isSafeInteger(requestedPage) ? requestedPage : 1));
  const start = (page - 1) * SEARCH_COMPARISON_PAGE_SIZE;
  return { page, pages, first: rows.length ? start + 1 : 0,
    last: Math.min(rows.length, start + SEARCH_COMPARISON_PAGE_SIZE),
    rows: rows.slice(start, start + SEARCH_COMPARISON_PAGE_SIZE) };
}
function signed(value: number): string { return value > 0 ? '+' + value : String(value); }
export function searchComparisonEvidence(row: ScopedFileCoverageRow | null): string {
  return row ? row.hits + ' displayed · ' + SEARCH_COVERAGE_LABELS[row.state] + ' · ' + searchCoverageOrigin(row)
    : 'Not in this selection';
}
export function searchComparisonDelta(row: SearchComparisonRow): string {
  return row.delta === null ? 'Not established' : signed(row.delta);
}

/** Counts-only by default. Never include query, filters, native paths, source
 * content, or preview text. Labels are an independent explicit opt-in.
 */
export function searchObservationComparisonReport(
  comparison: SearchObservationComparison, includeLabels = false,
): string {
  const lines = [
    'Scarp Studio — observed search comparison',
    'Exact relative labels paired; no filesystem identity or semantic change asserted.',
    'Only files fully scanned in both observations have comparable match counts.',
    'Earlier scope coverage: ' + (comparison.earlierIncomplete ? 'incomplete' : 'complete for selection'),
    'Current scope coverage: ' + (comparison.currentIncomplete ? 'incomplete' : 'complete for selection'),
    'Earlier listed sources: ' + comparison.earlierListed,
    'Current listed sources: ' + comparison.currentListed,
    'Earlier deferred sources: ' + comparison.earlierDeferred,
    'Current deferred sources: ' + comparison.currentDeferred,
    'Comparable file labels: ' + comparison.comparableFiles,
    'Observed count delta across comparable files: ' + (comparison.comparableFiles ? signed(comparison.observedDelta) : 'not established'),
    'Origin changes: ' + comparison.originChanges,
    ...SEARCH_COMPARISON_STATES.map(state => SEARCH_COMPARISON_LABELS[state] + ': ' + comparison.counts[state]),
  ];
  if (includeLabels) {
    let length = lines.join('\n').length;
    for (const row of comparison.rows) {
      const line = JSON.stringify(row.name) + ' — ' + SEARCH_COMPARISON_LABELS[row.state] +
        '; earlier: ' + searchComparisonEvidence(row.before) + '; current: ' + searchComparisonEvidence(row.after) +
        '; delta: ' + searchComparisonDelta(row) + (row.originChanged ? '; origin changed' : '');
      if (length + line.length + 1 > MAX_SCOPE_REPORT_UNITS - 100) {
        lines.push('Additional file labels omitted from report due to size limit.');
        break;
      }
      lines.push(line);
      length += line.length + 1;
    }
  }
  return lines.join('\n');
}
