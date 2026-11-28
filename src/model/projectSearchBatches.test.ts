import { describe, expect, it, vi } from 'vitest';
import {
  buildProjectScopeInventory,
  DEFAULT_PROJECT_SEARCH_SCOPE,
  planScopedProjectSearch,
  PROJECT_SEARCH_BATCH_SIZE,
  sameProjectScope,
  scopeLabel,
  scopedSearchReport,
  summarizeScopedSearch,
  type ProjectSearchScope,
  type ProjectScopeInventory,
} from './projectSearchScope';
import {
  MAX_PROJECT_SEARCH_FILES,
  MAX_PROJECT_SEARCH_READ_BYTES,
  MAX_PROJECT_SEARCH_TOTAL_BYTES,
  searchListedProjectSources,
} from './projectSearch';
import { createUntitled } from './documents';
import { MAX_SEARCH_RESULTS } from './openFileSearch';

const options = { caseSensitive: true, wholeWord: false };
function entry(name: string) {
  return { name, path: 'C:/practice/' + name };
}
function entries(count: number, directory = 'src') {
  return Array.from({ length: count }, (_, index) =>
    entry(directory + '/item-' + String(index).padStart(3, '0') + '.srp'));
}
function plan(inventory: ProjectScopeInventory, patch: Partial<ProjectSearchScope> = {}) {
  const result = planScopedProjectSearch(inventory, { ...DEFAULT_PROJECT_SEARCH_SCOPE, ...patch });
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
const size = PROJECT_SEARCH_BATCH_SIZE;

describe('project search batch membership', () => {
  it('uses a size compatible with both the file count and worst-case byte budgets', () => {
    expect(size).toBeGreaterThan(0);
    expect(size).toBeLessThanOrEqual(MAX_PROJECT_SEARCH_FILES);
    expect(size * MAX_PROJECT_SEARCH_READ_BYTES).toBeLessThanOrEqual(MAX_PROJECT_SEARCH_TOTAL_BYTES);
  });

  it('keeps conventional search membership and order when no batch was selected', () => {
    const listed = entries(12).reverse();
    const result = plan(buildProjectScopeInventory(listed));
    expect(result.sources).toEqual(listed);
    expect(result.batch).toBeUndefined();
  });

  it('partitions all eligible sources exactly once, including a short final batch', () => {
    const listed = entries(size * 3 + 1);
    const inventory = buildProjectScopeInventory(listed);
    const batches = Array.from({ length: 4 }, (_, index) => plan(inventory, { batch: index + 1 }));
    expect(batches.flatMap(batch => batch.sources)).toEqual(listed);
    expect(batches.map(batch => batch.sources.length)).toEqual([size, size, size, 1]);
    expect(batches[0].batch).toEqual({
      index: 1, total: 4, candidates: listed.length, deferred: listed.length - size,
      first: 1, last: size,
    });
    expect(batches[3].batch).toEqual({
      index: 4, total: 4, candidates: listed.length, deferred: listed.length - 1,
      first: 3 * size + 1, last: listed.length,
    });
    expect(Object.isFrozen(batches[0].batch)).toBe(true);
    expect(Object.isFrozen(batches[0].sources)).toBe(true);
  });

  it('keeps membership deterministic across listing permutations', () => {
    const listed = [
      entry('src/x.srp'), entry('src/X.srp'), entry('src/é.srp'),
      entry('root.srp'), entry('src/nested/2.srp'), entry('src/nested/10.srp'),
    ];
    const inventory = buildProjectScopeInventory(listed.map(source => ({
      ...source, path: '/practice/' + source.name,
    })));
    const reversed = buildProjectScopeInventory([...inventory.sources].reverse());
    const count = Math.ceil(inventory.sources.length / size);
    for (let batch = 1; batch <= count; batch++) {
      expect(plan(inventory, { batch }).sources).toEqual(plan(reversed, { batch }).sources);
    }
    const names = Array.from({ length: count }, (_, index) =>
      plan(inventory, { batch: index + 1 }).sources.map(source => source.name)).flat();
    expect(names).toEqual([...names].sort());
  });

  it('filters by directory and basename before partitioning and preserves native paths', () => {
    const chosen = entries(size + 1, 'src/nested');
    const listed = [...chosen, ...entries(5, 'src-other'), entry('src/unrelated.srp')];
    const result = plan(buildProjectScopeInventory(listed), {
      directory: 'src', filename: 'item-', batch: 2,
    });
    expect(result.sources).toEqual(chosen.slice(size));
    expect(result.excluded).toBe(6);
    expect(result.batch?.candidates).toBe(chosen.length);
    expect(result.batch?.deferred).toBe(size);
    expect(result.listed).toBe(result.excluded + result.sources.length + result.batch!.deferred);
  });

  it('rejects stale, non-integer and empty-scope batch selections without broadening scope', () => {
    const inventory = buildProjectScopeInventory(entries(size + 1));
    for (const batch of [0, -1, 1.5, 3, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
      expect(planScopedProjectSearch(inventory, { ...DEFAULT_PROJECT_SEARCH_SCOPE, batch }).ok).toBe(false);
    }
    expect(planScopedProjectSearch(inventory, {
      ...DEFAULT_PROJECT_SEARCH_SCOPE, filename: 'no-match', batch: 1,
    }).ok).toBe(false);
    expect(plan(inventory, { filename: 'no-match' }).sources).toEqual([]);
  });

  it('does not silently include ambiguous or malformed listing entries in batches', () => {
    const valid = entries(size + 1);
    const inventory = buildProjectScopeInventory([
      ...valid, entry('../bad.srp'), entry('dup.srp'), entry('dup.srp'),
    ]);
    const result = plan(inventory, { batch: 2 });
    expect(result.invalid).toBe(1);
    expect(result.ambiguous).toBe(2);
    expect(result.batch?.candidates).toBe(valid.length);
    expect(result.sources).toEqual(valid.slice(size));
  });

  it('treats batch selection as part of exact scope identity', () => {
    const first = { ...DEFAULT_PROJECT_SEARCH_SCOPE, batch: 1 };
    const second = { ...DEFAULT_PROJECT_SEARCH_SCOPE, batch: 2 };
    expect(sameProjectScope(first, second)).toBe(false);
    expect(sameProjectScope(first, DEFAULT_PROJECT_SEARCH_SCOPE)).toBe(false);
    expect(sameProjectScope(first, { ...first })).toBe(true);
    expect(scopeLabel(first)).toBe('Workspace root and descendants · batch 1');
    expect(sameProjectScope(DEFAULT_PROJECT_SEARCH_SCOPE, { ...DEFAULT_PROJECT_SEARCH_SCOPE, batch: undefined })).toBe(true);
  });
});

describe('actual search of selected batches', () => {
  it('reaches files beyond the conventional file cap with only selected native reads', async () => {
    const listed = entries(MAX_PROJECT_SEARCH_FILES + size + 1);
    const selected = plan(buildProjectScopeInventory(listed), {
      batch: Math.floor(MAX_PROJECT_SEARCH_FILES / size) + 1,
    });
    const reader = vi.fn(async (_path: string, _limit: number) => 'needle');
    const result = await searchListedProjectSources(selected.sources, [], 'needle', options, reader);
    expect(reader.mock.calls.map(call => call[0]).sort()).toEqual(selected.sources.map(source => source.path).sort());
    expect(result?.searchedFiles).toBe(size);
    expect(result?.hits).toHaveLength(size);
    expect(result?.skippedFiles).toBe(0);
    expect(result?.truncated).toBe(false);
    const summary = summarizeScopedSearch(selected, result!);
    expect(summary).toMatchObject({
      ok: true,
      value: { inScope: size, excluded: 0, skipped: 0, incomplete: true,
        batch: { candidates: listed.length, deferred: listed.length - size } },
    });
  });

  it('does not let a dirty buffer outside the selected batch change membership', async () => {
    const listed = entries(size + 1);
    const selected = plan(buildProjectScopeInventory(listed), { batch: 2 });
    const outside = { ...createUntitled(1), path: listed[0].path,
      name: listed[0].name, content: 'needle', savedContent: '' };
    const inside = { ...createUntitled(2), path: listed[size].path,
      name: listed[size].name, content: 'needle needle', savedContent: '' };
    const reader = vi.fn(async (_path: string, _limit: number) => 'old');
    const result = await searchListedProjectSources(selected.sources, [outside, inside], 'needle', options, reader);
    expect(reader).not.toHaveBeenCalled();
    expect(result?.hits).toHaveLength(2);
    expect(result?.hits.every(hit => hit.path === inside.path && hit.fromOpenTab)).toBe(true);
  });

  it('fits a full batch of maximum-sized sources without aggregate byte omissions', async () => {
    const selected = plan(buildProjectScopeInventory(entries(size)), { batch: 1 });
    const reader = vi.fn(async (_path: string, limit: number) => 'x'.repeat(limit));
    const result = await searchListedProjectSources(selected.sources, [], 'needle', options, reader);
    expect(reader).toHaveBeenCalledTimes(size);
    expect(reader.mock.calls.every(call => call[1] === MAX_PROJECT_SEARCH_READ_BYTES)).toBe(true);
    expect(result?.searchedFiles).toBe(size);
    expect(result?.skippedFiles).toBe(0);
    expect(result?.truncated).toBe(false);
    expect(summarizeScopedSearch(selected, result!)).toMatchObject({
      ok: true, value: { incomplete: false, batch: { deferred: 0 } },
    });
  });

  it('does not claim selected-batch completeness after a read failure', async () => {
    const selected = plan(buildProjectScopeInventory(entries(size + 1)), { batch: 1 });
    const result = await searchListedProjectSources(selected.sources, [], 'needle', options, async path => {
      if (path === selected.sources[0].path) throw Error('private error');
      return 'needle';
    });
    const summary = summarizeScopedSearch(selected, result!);
    expect(summary).toMatchObject({ ok: true, value: {
      searched: size - 1, skipped: 1, incomplete: true, batch: { deferred: 1 },
    } });
    if (!summary.ok) throw Error(summary.error);
    expect(summary.value.fileCoverage?.filter(row => row.state === 'read-failed')).toHaveLength(1);
    expect(scopedSearchReport(summary.value)).not.toContain('private error');
  });

  it('still enforces match limits in small batches', async () => {
    const selected = plan(buildProjectScopeInventory(entries(1)), { batch: 1 });
    const result = await searchListedProjectSources(selected.sources, [], 'needle', options,
      async () => 'needle '.repeat(MAX_SEARCH_RESULTS + 1));
    expect(result?.hits).toHaveLength(MAX_SEARCH_RESULTS);
    expect(result?.truncated).toBe(true);
    expect(summarizeScopedSearch(selected, result!)).toMatchObject({
      ok: true, value: { incomplete: true, skipped: 1, batch: { deferred: 0 } },
    });
  });

  it('rejects evidence from a different batch even when counts are equal', async () => {
    const inventory = buildProjectScopeInventory(entries(size * 2));
    const first = plan(inventory, { batch: 1 });
    const second = plan(inventory, { batch: 2 });
    const result = await searchListedProjectSources(first.sources, [], 'needle', options, async () => 'unrelated');
    expect(summarizeScopedSearch(second, result!).ok).toBe(false);
  });

  it('reports deferred and excluded sources separately without private labels by default', async () => {
    const selected = plan(buildProjectScopeInventory([
      ...entries(size + 1, 'private'), entry('other/root.srp'),
    ]), { directory: 'private', filename: 'item-', batch: 2 });
    const result = await searchListedProjectSources(selected.sources, [], 'needle', options, async () => 'needle');
    const summary = summarizeScopedSearch(selected, result!);
    if (!summary.ok) throw Error(summary.error);
    const report = scopedSearchReport(summary.value);
    expect(report).toContain('Eligible sources in scope: ' + (size + 1));
    expect(report).toContain('Selected batch: 2 / 2');
    expect(report).toContain('Sources selected in this batch: 1');
    expect(report).toContain('Deferred to other batches: ' + size);
    expect(report).toContain('Excluded by scope: 1');
    expect(report).toContain('Not fully scanned: 0');
    expect(report).toContain('No combined coverage across separate searches is asserted.');
    expect(report).not.toContain('private');
    expect(report).not.toContain('C:/practice');
    expect(report).not.toContain('needle');
    const withLabels = scopedSearchReport(summary.value, { includeLabels: true, includeFilenameQuery: false });
    expect(withLabels).toContain(selected.sources[0].name);
    expect(withLabels).not.toContain('C:/practice');
  });
});
