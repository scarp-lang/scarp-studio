import { describe, expect, it } from 'vitest';
import {
  captureSearchObservation, compareSearchObservations, filterSearchComparison, pageSearchComparison,
  searchComparisonEvidence, searchComparisonDelta, searchObservationComparisonReport,
  SEARCH_COMPARISON_PAGE_SIZE, type SearchObservation, type SearchObservationComparison,
} from './projectSearchComparison';
import {
  buildProjectScopeInventory, planScopedProjectSearch, summarizeScopedSearch,
  DEFAULT_PROJECT_SEARCH_SCOPE, MAX_SCOPE_REPORT_UNITS, PROJECT_SEARCH_BATCH_SIZE,
  type ProjectSearchScope, type ScopedSearchSummary, type ScopedFileCoverageRow,
} from './projectSearchScope';
import { searchListedProjectSources } from './projectSearch';
import { createUntitled } from './documents';
import { MAX_SEARCH_RESULTS, type SearchOptions } from './openFileSearch';

const query = 'secret-needle';
const options = { caseSensitive: true, wholeWord: false };
const source = (name: string) => ({ name, path: 'C:/private-project/' + name });
const scanned = (name: string, hits: number, origin: 'disk' | 'open-buffer' = 'disk'): ScopedFileCoverageRow =>
  ({ name, hits, state: 'scanned', origin });
const missing = (name: string): ScopedFileCoverageRow =>
  ({ name, hits: 0, state: 'read-failed', origin: 'disk' });

function summary(rows: readonly ScopedFileCoverageRow[], patch: Partial<ScopedSearchSummary> = {}): ScopedSearchSummary {
  const searched = rows.filter(row => row.state === 'scanned').length;
  return {
    scope: DEFAULT_PROJECT_SEARCH_SCOPE, listed: rows.length, inScope: rows.length, excluded: 0, withheld: 0,
    searched, skipped: rows.length - searched, hits: rows.reduce((total, row) => total + row.hits, 0),
    matchingFiles: rows.filter(row => row.hits > 0).length, incomplete: searched !== rows.length,
    rows: rows.filter(row => row.hits > 0).map(row => ({
      name: row.name, hits: row.hits, openBuffer: row.origin === 'open-buffer',
    })),
    fileCoverage: rows, ...patch,
  };
}
function capture(rows: readonly ScopedFileCoverageRow[], patch: Partial<ScopedSearchSummary> = {},
  term = query, flags: SearchOptions = options): SearchObservation {
  const result = captureSearchObservation(term, flags, summary(rows, patch));
  if (!result.ok) throw Error(result.error);
  return result.value;
}
function compare(before: SearchObservation, after: SearchObservation): SearchObservationComparison {
  const result = compareSearchObservations(before, after);
  if (!result.ok) throw Error(result.error);
  return result.value;
}

describe('bounded explicit search observations', () => {
  it('copies metadata instead of retaining source snapshots or additional object fields', () => {
    const row = { ...scanned('src/a.srp', 1), nativePath: 'C:/private-project/src/a.srp',
      content: 'private source', preview: 'private preview' };
    const flags = { ...options, arbitrary: 'private value' };
    const scope = { ...DEFAULT_PROJECT_SEARCH_SCOPE, secret: 'private value' };
    const evidence = [row];
    const result = captureSearchObservation(query, flags, summary(evidence, { scope }));
    if (!result.ok) throw Error(result.error);
    row.hits = 10;
    evidence.push(scanned('other.srp', 2));
    expect(result.value.rows).toEqual([scanned('src/a.srp', 1)]);
    expect(result.value.options).toEqual(options);
    expect(result.value.scope).toEqual(DEFAULT_PROJECT_SEARCH_SCOPE);
    expect(JSON.stringify(result.value)).not.toContain('private');
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.rows)).toBe(true);
    expect(Object.isFrozen(result.value.rows[0])).toBe(true);
  });

  it('requires per-file evidence, not only visible matching rows', () => {
    const legacy = summary([scanned('a.srp', 1)], { fileCoverage: undefined });
    expect(captureSearchObservation(query, options, legacy).ok).toBe(false);
  });

  it('rejects malformed query text and invalid scope metadata', () => {
    for (const term of ['', 'a\nb', 'a\rb', '\ud800', 'x'.repeat(121)]) {
      expect(captureSearchObservation(term, options, summary([])).ok).toBe(false);
    }
    for (const directory of ['../src', 'C:/private', '.git', 'src\\nested']) {
      expect(captureSearchObservation(query, options, summary([], {
        scope: { ...DEFAULT_PROJECT_SEARCH_SCOPE, directory },
      })).ok).toBe(false);
    }
    for (const filename of ['../file', 'src/file', 'x\n', '\ud800', 'x'.repeat(121)]) {
      expect(captureSearchObservation(query, options, summary([], {
        scope: { ...DEFAULT_PROJECT_SEARCH_SCOPE, filename },
      })).ok).toBe(false);
    }
  });

  it('rejects invalid relative names and duplicate evidence labels', () => {
    for (const name of ['../a.srp', 'C:/private/a.srp', 'src/a.txt', '.git/a.srp', 'src\\a.srp', '\ud800.srp']) {
      expect(captureSearchObservation(query, options, summary([scanned(name, 0)])).ok).toBe(false);
    }
    expect(captureSearchObservation(query, options, summary([scanned('a.srp', 0), scanned('a.srp', 1)])).ok).toBe(false);
  });

  it('rejects forged coverage totals, excessive hit counts and missing completion flags', () => {
    const rows = [scanned('a.srp', 1), missing('b.srp')];
    for (const patch of [
      { listed: 1 }, { inScope: 3 }, { searched: 0 }, { skipped: 0 }, { hits: 2 },
      { matchingFiles: 2 }, { incomplete: false }, { withheld: -1 }, { excluded: NaN },
    ]) expect(captureSearchObservation(query, options, summary(rows, patch)).ok).toBe(false);
    expect(captureSearchObservation(query, options, summary([scanned('a.srp', MAX_SEARCH_RESULTS + 1)])).ok).toBe(false);
    expect(captureSearchObservation(query, options, summary([scanned('a.srp', -1)])).ok).toBe(false);
  });

  it('rejects contradictory evidence origins and unsupported hits', () => {
    const row = scanned('a.srp', 0);
    for (const bad of [
      { ...row, origin: null }, { ...row, state: 'read-failed' as const, origin: 'open-buffer' as const },
      { ...row, state: 'file-limit' as const }, { ...row, state: 'content-limit' as const, origin: null },
      { ...missing('a.srp'), hits: 1 },
    ]) expect(captureSearchObservation(query, options, summary([bad])).ok).toBe(false);
  });

  it('validates batch position, total and deferred counts before capture', () => {
    const size = PROJECT_SEARCH_BATCH_SIZE;
    const scope = { ...DEFAULT_PROJECT_SEARCH_SCOPE, batch: 2 };
    const batch = { index: 2, total: 2, candidates: size + 1, deferred: size, first: size + 1, last: size + 1 };
    const rows = [scanned('later.srp', 0)];
    const data = { scope, batch, listed: size + 1, incomplete: true };
    expect(captureSearchObservation(query, options, summary(rows, data)).ok).toBe(true);
    for (const invalid of [
      { ...batch, deferred: 0 }, { ...batch, index: 1 }, { ...batch, first: 1 },
      { ...batch, total: 3 }, { ...batch, candidates: 2000 }, { ...batch, last: size + 2 },
    ]) expect(captureSearchObservation(query, options, summary(rows, { ...data, batch: invalid })).ok).toBe(false);
    expect(captureSearchObservation(query, options, summary(rows, { ...data, batch: undefined })).ok).toBe(false);
    expect(captureSearchObservation(query, options, summary(rows, { ...data, scope: DEFAULT_PROJECT_SEARCH_SCOPE })).ok).toBe(false);
  });
});

describe('coverage-aware observed count comparison', () => {
  it('requires exact query, options and scope identity', () => {
    const base = capture([scanned('a.srp', 1)]);
    for (const after of [
      capture([scanned('a.srp', 2)], {}, 'other'),
      capture([scanned('a.srp', 2)], {}, query, { ...options, caseSensitive: false }),
      capture([scanned('a.srp', 2)], {}, query, { ...options, wholeWord: true }),
      capture([scanned('a.srp', 2)], { scope: { ...DEFAULT_PROJECT_SEARCH_SCOPE, descendants: false } }),
      capture([scanned('a.srp', 2)], { scope: { ...DEFAULT_PROJECT_SEARCH_SCOPE, filename: 'a' } }),
    ]) expect(compareSearchObservations(base, after).ok).toBe(false);
  });

  it('pairs exact relative labels and classifies all six evidence states', () => {
    const earlier = capture([
      scanned('up.srp', 1), scanned('down.srp', 3), scanned('same.srp', 1),
      missing('unknown.srp'), scanned('old.srp', 2),
    ]);
    const current = capture([
      scanned('up.srp', 4), scanned('down.srp', 0), scanned('same.srp', 1),
      scanned('unknown.srp', 5), scanned('new.srp', 2),
    ]);
    const result = compare(earlier, current);
    expect(result.counts).toEqual({
      increased: 1, decreased: 1, unchanged: 1, 'not-comparable': 1, 'earlier-only': 1, 'current-only': 1,
    });
    expect(result.comparableFiles).toBe(3);
    expect(result.observedDelta).toBe(0);
    expect(result.rows.find(row => row.name === 'up.srp')?.delta).toBe(3);
    expect(result.rows.find(row => row.name === 'down.srp')?.delta).toBe(-3);
    expect(result.rows.find(row => row.name === 'unknown.srp')?.delta).toBeNull();
    expect(result.rows.find(row => row.name === 'new.srp')?.delta).toBeNull();
    expect(result.earlierIncomplete).toBe(true);
    expect(result.currentIncomplete).toBe(false);
    expect(Object.isFrozen(result.rows)).toBe(true);
    expect(Object.isFrozen(result.counts)).toBe(true);
  });

  it('does not treat a partial visible match count as a complete count', () => {
    const partial: ScopedFileCoverageRow = { ...scanned('a.srp', 3), state: 'content-limit' };
    const result = compare(capture([partial]), capture([scanned('a.srp', 0)]));
    expect(result.rows[0]).toMatchObject({ state: 'not-comparable', delta: null });
    expect(result.comparableFiles).toBe(0);
    expect(searchComparisonDelta(result.rows[0])).toBe('Not established');
    expect(searchComparisonEvidence(result.rows[0].before)).toContain('3 displayed');
  });

  it('does not pair labels that differ by case or Unicode normalization', () => {
    const result = compare(
      capture([scanned('A.srp', 1), scanned('é.srp', 1)]),
      capture([scanned('a.srp', 1), scanned('e\u0301.srp', 1)]),
    );
    expect(result.comparableFiles).toBe(0);
    expect(result.counts['earlier-only']).toBe(2);
    expect(result.counts['current-only']).toBe(2);
  });

  it('flags a changed source origin even when observed count is unchanged', () => {
    const result = compare(capture([scanned('a.srp', 1)]), capture([scanned('a.srp', 1, 'open-buffer')]));
    expect(result.originChanges).toBe(1);
    expect(result.rows[0]).toMatchObject({ state: 'unchanged', delta: 0, originChanged: true });
    expect(filterSearchComparison(result, 'changed')).toHaveLength(1);
  });

  it('classifies all missing or limited evidence without a fabricated aggregate delta', () => {
    const limited: ScopedFileCoverageRow = { name: 'b.srp', state: 'file-limit', origin: null, hits: 0 };
    const result = compare(capture([missing('a.srp'), limited]), capture([missing('a.srp'), limited]));
    expect(result.comparableFiles).toBe(0);
    expect(result.counts['not-comparable']).toBe(2);
    expect(searchObservationComparisonReport(result)).toContain('Observed count delta across comparable files: not established');
  });

  it('handles empty and paged comparisons with bounded page navigation', () => {
    const empty = compare(capture([]), capture([]));
    expect(pageSearchComparison(empty.rows, 99)).toEqual({ page: 1, pages: 1, first: 0, last: 0, rows: [] });
    const rows = Array.from({ length: SEARCH_COMPARISON_PAGE_SIZE * 2 + 1 }, (_, index) =>
      scanned('file-' + String(index).padStart(3, '0') + '.srp', 0));
    const result = compare(capture(rows), capture(rows));
    expect(filterSearchComparison(result, 'changed')).toHaveLength(0);
    expect(filterSearchComparison(result, 'unchanged')).toHaveLength(rows.length);
    expect(pageSearchComparison(result.rows, 99)).toMatchObject({ page: 3, pages: 3, first: 41, last: 41 });
    expect(pageSearchComparison(result.rows, NaN)).toMatchObject({ page: 1, first: 1, last: 20 });
  });

  it('keeps reports counts-only by default and omits query and filters even with labels', () => {
    const scope: ProjectSearchScope = { directory: 'private-dir', descendants: true, filename: 'private-filter' };
    const earlier = capture([scanned('private-dir/private-filter.srp', 1)], { scope });
    const current = capture([scanned('private-dir/private-filter.srp', 2)], { scope });
    const result = compare(earlier, current);
    const report = searchObservationComparisonReport(result);
    expect(report).not.toContain('private-dir');
    expect(report).not.toContain(query);
    expect(report).toContain('Observed count delta across comparable files: +1');
    const labeled = searchObservationComparisonReport(result, true);
    expect(labeled).toContain('private-dir/private-filter.srp');
    expect(labeled).not.toContain(query);
    expect(labeled).not.toContain('C:/');
  });

  it('bounds reports with large optional labels and explicitly discloses omission', () => {
    const rows = Array.from({ length: 150 }, (_, index) => scanned(index + 'x'.repeat(950) + '.srp', 0));
    const result = compare(capture(rows), capture(rows));
    const report = searchObservationComparisonReport(result, true);
    expect(report.length).toBeLessThanOrEqual(MAX_SCOPE_REPORT_UNITS);
    expect(report).toContain('Additional file labels omitted');
  });
});

describe('observations from real bounded project searches', () => {
  it('records disk and open-buffer changes without retaining matched text', async () => {
    const entries = [source('src/a.srp'), source('src/b.srp')];
    const planned = planScopedProjectSearch(buildProjectScopeInventory(entries), DEFAULT_PROJECT_SEARCH_SCOPE);
    if (!planned.ok) throw Error(planned.error);
    const before = await searchListedProjectSources(planned.value.sources, [], query, options, async () => query);
    const open = { ...createUntitled(1), name: 'a.srp', path: entries[0].path, content: query + ' ' + query, savedContent: query };
    const after = await searchListedProjectSources(planned.value.sources, [open], query, options,
      async () => { throw Error('private native failure'); });
    const earlierSummary = summarizeScopedSearch(planned.value, before!);
    const currentSummary = summarizeScopedSearch(planned.value, after!);
    if (!earlierSummary.ok || !currentSummary.ok) throw Error('Missing summary');
    const earlier = captureSearchObservation(query, options, earlierSummary.value);
    const current = captureSearchObservation(query, options, currentSummary.value);
    if (!earlier.ok || !current.ok) throw Error('Missing observation');
    const result = compare(earlier.value, current.value);
    expect(result.rows.find(row => row.name === 'src/a.srp')).toMatchObject({ delta: 1, originChanged: true });
    expect(result.rows.find(row => row.name === 'src/b.srp')).toMatchObject({ delta: null, state: 'not-comparable' });
    expect(searchObservationComparisonReport(result, true)).not.toContain(query);
    expect(JSON.stringify(current.value.rows)).not.toContain('C:/private-project');
  });
});
