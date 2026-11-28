import { describe, expect, it } from 'vitest';
import {
  buildProjectMatchInventory, filterProjectMatchInventory, pageProjectMatchRows, adjacentProjectMatch,
  resolveReviewedProjectMatch, visibleMatchContext, projectMatchExplorerReport,
  DEFAULT_PROJECT_MATCH_FILTER, PROJECT_MATCH_PAGE_SIZE, PROJECT_MATCH_MAX_LINE,
  type MatchExplorerResult, type ProjectMatchFilter,
} from './projectMatchExplorer';
import { searchListedProjectSources, type ProjectSearchResult } from './projectSearch';
import {
  buildProjectScopeInventory, planScopedProjectSearch, summarizeScopedSearch,
  DEFAULT_PROJECT_SEARCH_SCOPE, MAX_SCOPE_REPORT_UNITS, type ScopedSearchSummary,
} from './projectSearchScope';
import { createUntitled, type StudioDocument } from './documents';
import { MAX_SEARCH_RESULTS } from './openFileSearch';
import { assertWellFormedUtf16 } from './utf8Text';

const query = 'needle';
const options = { caseSensitive: true, wholeWord: false };
function entry(name: string) { return { name, path: 'C:/private-workspace/' + name }; }
function unwrap<T>(result: MatchExplorerResult<T>): T {
  if (!result.ok) throw Error(result.error);
  return result.value;
}
async function fixture(
  sources: Record<string, string>, open: readonly StudioDocument[] = [], term = query, batch?: number,
) {
  const listed = Object.keys(sources).map(entry);
  const plan = planScopedProjectSearch(buildProjectScopeInventory(listed), { ...DEFAULT_PROJECT_SEARCH_SCOPE, batch });
  if (!plan.ok) throw Error(plan.error);
  const result = await searchListedProjectSources(plan.value.sources, open, term, options, async path => {
    const source = listed.find(item => item.path === path);
    if (!source) throw Error('Unexpected native path');
    return sources[source.name];
  });
  if (!result) throw Error('Search did not return a result');
  const summary = summarizeScopedSearch(plan.value, result);
  if (!summary.ok) throw Error(summary.error);
  return { result, summary: summary.value, inventory: unwrap(buildProjectMatchInventory(result, summary.value)) };
}

describe('exact bounded project match presentation', () => {
  it('validates CRLF, lone CR, LF and supplementary UTF-16 coordinates', async () => {
    const { inventory } = await fixture({ 'src/a.srp': 'first\r\n😀 needle\rneedle\nx needle' });
    expect(inventory.rows.map(row => [row.line, row.column, row.context.match])).toEqual([
      [2, 4, query], [3, 1, query], [4, 3, query],
    ]);
    expect(inventory.groups[0]).toMatchObject({
      name: 'src/a.srp', count: 3, firstLine: 2, lastLine: 4, origin: 'disk', coverage: 'fully-scanned',
    });
    expect(inventory.rows[0].context).toEqual({
      before: '😀 ', match: query, after: '', leadingOmitted: false, trailingOmitted: false,
    });
  });

  it('reconstructs context from source evidence rather than trusting supplied preview text', async () => {
    const { result, summary } = await fixture({ 'src/a.srp': 'prefix needle suffix' });
    const changed = { ...result, hits: [{ ...result.hits[0], match: { ...result.hits[0].match, preview: 'forged preview' } }] };
    const inventory = unwrap(buildProjectMatchInventory(changed, summary));
    expect(inventory.rows[0].context).toEqual({
      before: 'prefix ', match: query, after: ' suffix', leadingOmitted: false, trailingOmitted: false,
    });
    expect(JSON.stringify(inventory)).not.toContain('forged preview');
    expect(JSON.stringify(inventory)).not.toContain('C:/private-workspace');
    expect(JSON.stringify(inventory)).not.toContain('documentId');
    expect(Object.isFrozen(inventory.rows)).toBe(true);
    expect(Object.isFrozen(inventory.rows[0].context)).toBe(true);
  });

  it('clips large lines at Unicode-safe preview boundaries', async () => {
    const source = '😀'.repeat(40) + 'x' + query + 'x' + '😀'.repeat(60);
    const { inventory } = await fixture({ 'a.srp': source });
    const { context } = inventory.rows[0];
    expect(context.leadingOmitted).toBe(true);
    expect(context.trailingOmitted).toBe(true);
    expect(context.before.length).toBeLessThanOrEqual(61);
    expect(context.after.length).toBeLessThanOrEqual(81);
    expect(context.before.endsWith('x')).toBe(true);
    expect(context.after.startsWith('x')).toBe(true);
    expect(() => assertWellFormedUtf16(context.before, 'before')).not.toThrow();
    expect(() => assertWellFormedUtf16(context.after, 'after')).not.toThrow();
  });

  it('visibly escapes controls and isolated surrogate units without changing normal Unicode scalars', () => {
    expect(visibleMatchContext('a\t\u202e\u0001\u007f\ud800😀é')).toBe('a\\t\\u202e\\u0001\\u007f\\ud800😀é');
    expect(visibleMatchContext('普通文本')).toBe('普通文本');
  });

  it('retains open-buffer origin and the original result indices', async () => {
    const open = { ...createUntitled(1), path: entry('src/b.srp').path, name: 'b.srp',
      content: 'needle needle', savedContent: 'old' };
    const { inventory, result } = await fixture({ 'src/a.srp': 'needle', 'src/b.srp': 'old' }, [open]);
    expect(inventory.rows.map(row => row.index)).toEqual([0, 1, 2]);
    expect(inventory.rows.filter(row => row.origin === 'open-buffer')).toHaveLength(2);
    for (const row of inventory.rows) expect(resolveReviewedProjectMatch(result, row)).toBe(result.hits[row.index]);
  });

  it('does not claim complete per-file evidence for legacy or truncated search results', async () => {
    const { inventory, result, summary } = await fixture({ 'a.srp': (query + ' ').repeat(MAX_SEARCH_RESULTS + 1) });
    expect(inventory.rows).toHaveLength(MAX_SEARCH_RESULTS);
    expect(inventory.rows.every(row => row.coverage === 'partial')).toBe(true);
    expect(inventory.incomplete).toBe(true);
    const legacy = unwrap(buildProjectMatchInventory(result, { ...summary, fileCoverage: undefined }));
    expect(legacy.rows.every(row => row.coverage === 'unknown')).toBe(true);
    expect(legacy.incomplete).toBe(true);
  });

  it('supports successful zero-match searches without inventing source groups', async () => {
    const { inventory } = await fixture({ 'a.srp': 'unrelated' });
    expect(inventory.rows).toEqual([]);
    expect(inventory.groups).toEqual([]);
    expect(inventory.scannedFiles).toBe(1);
  });
});

describe('match snapshot validation', () => {
  it('rejects inconsistent counts, mixed origins and duplicate coverage labels', async () => {
    const { result, summary } = await fixture({ 'a.srp': 'needle needle' });
    const badSummaries: ScopedSearchSummary[] = [
      { ...summary, hits: 10 }, { ...summary, matchingFiles: 0 }, { ...summary, inScope: 2 },
      { ...summary, searched: 0 }, { ...summary, rows: [{ ...summary.rows[0], openBuffer: true }] },
      { ...summary, fileCoverage: [...summary.fileCoverage!, ...summary.fileCoverage!] },
      { ...summary, fileCoverage: [{ ...summary.fileCoverage![0], state: 'read-failed' }] },
      { ...summary, fileCoverage: [{ ...summary.fileCoverage![0], hits: 0 }] },
    ];
    for (const changed of badSummaries) expect(buildProjectMatchInventory(result, changed).ok).toBe(false);
    expect(buildProjectMatchInventory({ ...result, truncated: true }, summary).ok).toBe(false);
  });

  it('rejects forged source coordinates, text and revisions', async () => {
    const { result, summary } = await fixture({ 'a.srp': 'prefix needle suffix' });
    const first = result.hits[0];
    for (const patch of [
      { line: 2 }, { column: 1 }, { offset: -1 }, { offset: 1 }, { offset: NaN },
      { sourceRevision: -1 }, { matchText: 'wrong' }, { sourceContent: 'wrong' }, { matchText: '' },
      { matchText: 'needle\n' },
    ]) {
      const forged: ProjectSearchResult = { ...result, hits: [{ ...first, match: { ...first.match, ...patch } }] };
      expect(buildProjectMatchInventory(forged, summary).ok).toBe(false);
    }
  });

  it('rejects duplicate, overlapping and mixed-snapshot matches in one label group', async () => {
    const { result, summary } = await fixture({ 'a.srp': 'needle needle' });
    const [first, second] = result.hits;
    for (const hit of [
      first,
      { ...second, path: 'C:/another/a.srp' },
      { ...second, match: { ...second.match, sourceRevision: 10 } },
      { ...second, match: { ...second.match, documentId: 'different' } },
      { ...second, match: { ...second.match, sourceContent: 'needle needle trailing' } },
    ]) expect(buildProjectMatchInventory({ ...result, hits: [first, hit] }, summary).ok).toBe(false);
  });

  it('refuses a reviewed match if the original identity or bounded context changed', async () => {
    const { result, inventory } = await fixture({ 'a.srp': 'prefix needle suffix' });
    const row = inventory.rows[0], hit = result.hits[0];
    expect(resolveReviewedProjectMatch(result, { ...row, index: 99 })).toBeNull();
    expect(resolveReviewedProjectMatch(result, { ...row, column: 1 })).toBeNull();
    expect(resolveReviewedProjectMatch(result, { ...row, context: { ...row.context, match: 'other' } })).toBeNull();
    const changed = { ...result, hits: [{ ...hit, match: { ...hit.match, sourceContent: 'PREFIX needle suffix' } }] };
    expect(resolveReviewedProjectMatch(changed, row)).toBeNull();
  });
});

describe('display-only filters and navigation order', () => {
  async function several() {
    const open = { ...createUntitled(1), path: entry('src/b.srp').path, name: 'b.srp',
      content: 'needle banana\nneedle apple\nneedle apple', savedContent: 'old' };
    return fixture({
      'src/a.srp': 'needle pear\nneedle apple', 'src/b.srp': 'old', 'tests/test.srp': 'needle pear',
    }, [open]);
  }
  function filters(patch: Partial<ProjectMatchFilter> = {}) { return { ...DEFAULT_PROJECT_MATCH_FILTER, ...patch }; }

  it('combines source, origin, literal context, coverage and inclusive line filters', async () => {
    const { inventory } = await several();
    const rows = unwrap(filterProjectMatchInventory(inventory, filters({
      source: 'src/b.srp', origin: 'open-buffer', context: 'APPLE', coverage: 'fully-scanned', lineFrom: '2', lineTo: '2',
    })));
    expect(rows.map(row => [row.name, row.line])).toEqual([['src/b.srp', 2]]);
    expect(unwrap(filterProjectMatchInventory(inventory, filters({ origin: 'disk', context: 'pear' }))).map(row => row.name).sort())
      .toEqual(['src/a.srp', 'tests/test.srp']);
    expect(unwrap(filterProjectMatchInventory(inventory, filters({ coverage: 'partial' })))).toEqual([]);
    expect(unwrap(filterProjectMatchInventory(inventory, filters({ context: '.*' })))).toEqual([]);
  });

  it('rejects invalid source labels, line ranges and excessive filter terms', async () => {
    const { inventory } = await several();
    for (const patch of [
      { source: 'unknown.srp' }, { lineFrom: '0' }, { lineTo: '-1' },
      { lineFrom: '3', lineTo: '2' }, { lineFrom: '1.5' }, { lineTo: String(PROJECT_MATCH_MAX_LINE + 1) },
      { context: 'a\nb' }, { context: 'x'.repeat(121) },
    ]) expect(filterProjectMatchInventory(inventory, filters(patch)).ok).toBe(false);
  });

  it('sorts by exact label or original displayed file density without changing hit identities', async () => {
    const { inventory, result } = await several();
    const bySource = unwrap(filterProjectMatchInventory(inventory, filters({ sort: 'source' })));
    expect(bySource.map(row => row.name)).toEqual([
      'src/a.srp', 'src/a.srp', 'src/b.srp', 'src/b.srp', 'src/b.srp', 'tests/test.srp',
    ]);
    const density = unwrap(filterProjectMatchInventory(inventory, filters({ sort: 'file-density' })));
    expect(density.map(row => row.name)).toEqual([
      'src/b.srp', 'src/b.srp', 'src/b.srp', 'src/a.srp', 'src/a.srp', 'tests/test.srp',
    ]);
    for (const row of density) expect(resolveReviewedProjectMatch(result, row)).toBe(result.hits[row.index]);
    expect(unwrap(filterProjectMatchInventory(inventory, filters())).map(row => row.index)).toEqual(inventory.rows.map(row => row.index));
  });

  it('navigates adjacent filtered rows and clamps pages without wrapping or changing original indices', async () => {
    const { inventory } = await fixture({ 'a.srp': (query + '\n').repeat(PROJECT_MATCH_PAGE_SIZE * 2 + 1) });
    const rows = unwrap(filterProjectMatchInventory(inventory, filters({ lineFrom: '2' })));
    expect(pageProjectMatchRows(rows, 999)).toMatchObject({ page: 2, pages: 2, first: 21, last: 40 });
    expect(pageProjectMatchRows(rows, NaN).page).toBe(1);
    expect(adjacentProjectMatch(rows, rows[0].index, -1)).toBeNull();
    expect(adjacentProjectMatch(rows, rows[0].index, 1)).toBe(rows[1]);
    expect(adjacentProjectMatch(rows, rows.at(-1)!.index, 1)).toBeNull();
    expect(adjacentProjectMatch(rows, 999, 1)).toBeNull();
    expect(pageProjectMatchRows([], 3)).toEqual({ page: 1, pages: 1, first: 0, last: 0, rows: [] });
  });
});

describe('privacy-selective displayed-match reports', () => {
  it('reports filtered counts without source content or labels by default', async () => {
    const { inventory } = await fixture({ 'private-name.srp': 'private-context needle\nneedle' });
    const rows = unwrap(filterProjectMatchInventory(inventory, { ...DEFAULT_PROJECT_MATCH_FILTER, context: 'private-context' }));
    const safe = projectMatchExplorerReport(inventory, rows);
    expect(safe).toContain('All displayed matches: 2');
    expect(safe).toContain('Filtered displayed matches: 1');
    expect(safe).not.toContain('private-name.srp');
    expect(safe).not.toContain('private-context');
    expect(safe).not.toContain(query);
    const locations = projectMatchExplorerReport(inventory, rows, true);
    expect(locations).toContain('"private-name.srp":1:17');
    expect(locations).not.toContain('private-context');
    expect(locations).not.toContain('C:/private-workspace');
    expect(locations).not.toContain(query);
  });

  it('reports deferred batch scope without claiming undisplayed matches were scanned', async () => {
    const sources = Object.fromEntries(Array.from({ length: 6 }, (_, index) => ['part-' + index + '.srp', 'needle']));
    const { inventory } = await fixture(sources, [], query, 2);
    const report = projectMatchExplorerReport(inventory, inventory.rows);
    expect(report).toContain('Deferred to other batches: 4');
    expect(report).toContain('Scope coverage: incomplete');
    expect(report).toContain('All displayed matches: 2');
  });

  it('bounds optional location exports with long repeated labels', async () => {
    const name = 'x'.repeat(950) + '.srp';
    const { inventory } = await fixture({ [name]: (query + '\n').repeat(60) });
    const report = projectMatchExplorerReport(inventory, inventory.rows, true);
    expect(report.length).toBeLessThanOrEqual(MAX_SCOPE_REPORT_UNITS);
    expect(report).toContain('Additional locations omitted');
  });
});
