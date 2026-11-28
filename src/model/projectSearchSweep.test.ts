import { describe, expect, it, vi } from 'vitest';
import { prepareSearchSweep, confirmSearchSweep, executeSearchSweep, formatSearchSweepReport,
  sweepRows, pageSweepRows, MAX_SWEEP_BATCHES, MAX_SWEEP_FILES, MAX_SWEEP_BYTES,
  SWEEP_PAGE_SIZE, type SearchSweepPlan, type SweepControl } from './projectSearchSweep';
import { DEFAULT_PROJECT_SEARCH_SCOPE, PROJECT_SEARCH_BATCH_SIZE, MAX_SCOPE_REPORT_UNITS } from './projectSearchScope';
import { MAX_PROJECT_SEARCH_READ_BYTES, MAX_PROJECT_SEARCH_TOTAL_BYTES } from './projectSearch';
import { MAX_SEARCH_RESULTS } from './openFileSearch';
import type { ProjectSearchSettings } from './projectSearchPresets';
import { createUntitled } from './documents';

const size = PROJECT_SEARCH_BATCH_SIZE;
const settings: ProjectSearchSettings = {
  query: 'private-needle', options: { caseSensitive: true, wholeWord: false }, scope: DEFAULT_PROJECT_SEARCH_SCOPE,
};
const entry = (name: string) => ({ name, path: 'C:/private/workspace/' + name });
const entries = (count: number) => Array.from({ length: count }, (_, index) =>
  entry('src/file-' + String(index).padStart(3, '0') + '.srp'));
function plan(listed = entries(size * 2 + 1), first = 1, last = 2, config = settings): SearchSweepPlan {
  const result = prepareSearchSweep(listed, config, { first, last });
  if (!result.ok) throw Error(result.error);
  return result.value;
}
const control: SweepControl = { isCurrent: () => true, isCancelled: () => false };
async function run(p: SearchSweepPlan, read: (path: string, limit: number) => Promise<string> = async () => settings.query,
  c = control, docs = [] as ReturnType<typeof createUntitled>[]) {
  const result = await executeSearchSweep(p, docs, read, c);
  if (result.kind !== 'report') throw Error('No sweep report');
  return result.report;
}

describe('reviewed sweep planning', () => {
  it('partitions only the explicitly reviewed consecutive window', () => {
    const listed = entries(size * 3 + 1);
    const p = plan(listed, 2, 3);
    expect(p.totalBatches).toBe(4);
    expect(p.totalEligible).toBe(size * 3 + 1);
    expect(p.selected).toBe(size * 2);
    expect(p.batches.flatMap(batch => batch.sources)).toEqual(listed.slice(size, size * 3));
    expect(Object.isFrozen(p.batches)).toBe(true);
    expect(Object.isFrozen(p.settings.scope)).toBe(true);
  });
  it('maintains bounded maximum cumulative read capacity', () => {
    expect(MAX_SWEEP_FILES).toBe(MAX_SWEEP_BATCHES * size);
    expect(MAX_SWEEP_BYTES).toBe(MAX_SWEEP_BATCHES * MAX_PROJECT_SEARCH_TOTAL_BYTES);
    const p = plan(entries(MAX_SWEEP_FILES + 1), 1, MAX_SWEEP_BATCHES);
    expect(p.selected).toBe(MAX_SWEEP_FILES);
    expect(p.totalEligible).toBe(MAX_SWEEP_FILES + 1);
  });
  it('rejects missing, non-integer and excessive windows', () => {
    const listed = entries(MAX_SWEEP_FILES + 1);
    for (const window of [
      { first: 0, last: 1 }, { first: 2, last: 1 }, { first: 1.5, last: 2 },
      { first: 1, last: NaN }, { first: 1, last: Infinity },
      { first: 1, last: MAX_SWEEP_BATCHES + 1 }, { first: 99, last: 99 },
    ]) expect(prepareSearchSweep(listed, settings, window).ok).toBe(false);
    expect(prepareSearchSweep([], settings, { first: 1, last: 1 }).ok).toBe(false);
    expect(prepareSearchSweep(listed, { ...settings, query: '' }, { first: 1, last: 1 }).ok).toBe(false);
  });
  it('filters before selecting a window and separates withheld sources', () => {
    const listed = [...entries(size + 1), entry('tests/file-001.srp'), entry('../bad.srp'),
      entry('duplicate.srp'), entry('duplicate.srp')];
    const p = plan(listed, 2, 2, { ...settings,
      scope: { directory: 'src', descendants: true, filename: 'file-', batch: 1 } });
    expect(p.selected).toBe(1);
    expect(p.excluded).toBe(1);
    expect(p.withheld).toBe(3);
    expect(p.batches[0].sources[0]).toEqual(listed[size]);
  });
  it('retains deterministic membership under listing reorder', () => {
    const listed = entries(size + 1);
    const p = plan(listed, 1, 2);
    const confirmed = confirmSearchSweep(p, [...listed].reverse(), settings);
    expect(confirmed.ok).toBe(true);
    if (confirmed.ok) expect(confirmed.value.batches).toEqual(p.batches);
  });
  it('rejects changed source identity, counts and settings before reading', () => {
    const listed = entries(size + 1);
    const p = plan(listed, 1, 2);
    for (const changed of [
      [...listed.slice(1), entry('src/replaced.srp')],
      [...listed, entry('src/extra.srp')],
      listed.map((source, index) => index === 0 ? { ...source, path: 'D:/other/file.srp' } : source),
      listed.map((source, index) => index === 0 ? { ...source, path: source.path.toUpperCase() } : source),
    ]) expect(confirmSearchSweep(p, changed, settings).ok).toBe(false);
    for (const changed of [
      { ...settings, query: 'other' },
      { ...settings, options: { ...settings.options, wholeWord: true } },
      { ...settings, scope: { ...settings.scope, batch: 1 } },
      { ...settings, scope: { ...settings.scope, filename: 'file' } },
    ]) expect(confirmSearchSweep(p, listed, changed).ok).toBe(false);
  });
});

describe('bounded sweep execution', () => {
  it('reads only selected paths, at most once, and preserves dirty buffer precedence', async () => {
    const listed = entries(size * 3 + 1);
    const p = plan(listed, 2, 3);
    const dirty = { ...createUntitled(1), path: listed[size].path, name: listed[size].name,
      content: settings.query + ' ' + settings.query, savedContent: '' };
    const read = vi.fn(async (_path: string, _limit: number) => settings.query);
    const data = await run(p, read, control, [dirty]);
    expect(read.mock.calls.map(call => call[0]).sort()).toEqual(listed.slice(size + 1, size * 3).map(x => x.path).sort());
    expect(read.mock.calls.every(call => call[1] <= MAX_PROJECT_SEARCH_READ_BYTES)).toBe(true);
    expect(data).toMatchObject({ status: 'completed', selected: size * 2,
      fullyScanned: size * 2, incomplete: 0, unobserved: 0, deferred: size + 1 });
    expect(data.batches[0].rows.find(row => row.name === dirty.name)).toMatchObject({ origin: 'open-buffer', hits: 2 });
    expect(JSON.stringify(data)).not.toContain(settings.query);
    expect(JSON.stringify(data)).not.toContain('C:/private');
    expect(Object.isFrozen(data.batches[0].rows)).toBe(true);
  });
  it('continues following a failed read and separates incomplete observations', async () => {
    const p = plan();
    const data = await run(p, async path => {
      if (path.endsWith('000.srp')) throw Error('private native error');
      return settings.query;
    });
    expect(data).toMatchObject({ status: 'completed', fullyScanned: size * 2 - 1, incomplete: 1, unobserved: 0 });
    expect(sweepRows(data, 'incomplete')).toHaveLength(1);
    expect(sweepRows(data, 'matched')).toHaveLength(size * 2 - 1);
    expect(JSON.stringify(data)).not.toContain('private native error');
  });
  it('keeps per-batch hit limits independent and marks incomplete evidence', async () => {
    const p = plan(entries(size + 1), 1, 2);
    const data = await run(p, async path => path.endsWith('000.srp')
      ? (settings.query + ' ').repeat(MAX_SEARCH_RESULTS + 1) : settings.query);
    expect(data.batches[0].displayed).toBe(MAX_SEARCH_RESULTS);
    expect(data.batches[0].skipped).toBeGreaterThan(0);
    expect(data.batches[1].displayed).toBe(1);
    expect(data.batches[1].fullyScanned).toBe(1);
  });
  it('never exceeds the individual native read budget', async () => {
    const p = plan(entries(size * 2), 1, 2);
    const read = vi.fn(async (_path: string, limit: number) => 'x'.repeat(limit));
    const data = await run(p, read);
    expect(read).toHaveBeenCalledTimes(size * 2);
    expect(read.mock.calls.reduce((sum, call) => sum + call[1], 0)).toBe(2 * MAX_PROJECT_SEARCH_TOTAL_BYTES);
    // The independent in-memory content budget may still limit coverage.
    expect(data.fullyScanned + data.incomplete).toBe(size * 2);
  });
  it('publishes monotonic batch progress without source text', async () => {
    const onProgress = vi.fn();
    await run(plan(), undefined, { ...control, onProgress });
    expect(onProgress.mock.calls.map(call => call[0])).toEqual([
      { finishedBatches: 0, totalBatches: 2, currentBatch: 1 },
      { finishedBatches: 1, totalBatches: 2, currentBatch: 2 },
      { finishedBatches: 2, totalBatches: 2, currentBatch: null },
    ]);
  });
  it('honors cancellation before reads and after a completed batch', async () => {
    const reader = vi.fn(async () => settings.query);
    const p = plan();
    const early = await run(p, reader, { ...control, isCancelled: () => true });
    expect(early).toMatchObject({ status: 'cancelled', unobserved: size * 2, batches: [] });
    expect(reader).not.toHaveBeenCalled();
    let cancelled = false;
    const later = await run(p, reader, { ...control, isCancelled: () => cancelled, onProgress: progress => {
      if (progress.currentBatch === 2) cancelled = true;
    } });
    expect(later).toMatchObject({ status: 'cancelled', fullyScanned: size, unobserved: size });
    expect(reader).toHaveBeenCalledTimes(size);
  });
  it('discards the current partially read batch on cancellation', async () => {
    let cancel = false;
    const read = vi.fn(async () => { cancel = true; return settings.query; });
    const data = await run(plan(), read, { ...control, isCancelled: () => cancel });
    expect(data).toMatchObject({ status: 'cancelled', fullyScanned: 0, unobserved: size * 2, batches: [] });
    expect(read).toHaveBeenCalledTimes(1);
  });
  it('discards even earlier completed evidence on invalidation', async () => {
    let current = true;
    const result = await executeSearchSweep(plan(), [], async () => settings.query, {
      isCurrent: () => current, isCancelled: () => false, onProgress: progress => {
        if (progress.currentBatch === 2) current = false;
      },
    });
    expect(result).toEqual({ kind: 'invalidated' });
  });
});

describe('sweep evidence reports', () => {
  it('keeps label and source context disclosure independent', async () => {
    const data = await run(plan());
    const plain = formatSearchSweepReport(data);
    expect(plain).toContain('Disk observations are sequential');
    expect(plain).not.toContain('src/file-000.srp');
    expect(plain).not.toContain(settings.query);
    const withLabels = formatSearchSweepReport(data, true);
    expect(withLabels).toContain('src/file-000.srp');
    expect(withLabels).not.toContain('C:/private');
    expect(withLabels).not.toContain(settings.query);
  });
  it('bounds paging and retains exact batch evidence', async () => {
    const data = await run(plan(entries(size * 8), 1, 8));
    const rows = sweepRows(data, 'scanned');
    expect(rows).toHaveLength(size * 8);
    expect(pageSweepRows(rows, 1).rows).toHaveLength(SWEEP_PAGE_SIZE);
    expect(pageSweepRows(rows, 999).page).toBe(Math.ceil(rows.length / SWEEP_PAGE_SIZE));
    expect(pageSweepRows(rows, NaN).page).toBe(1);
    expect(pageSweepRows([], 999)).toEqual({ page: 1, pages: 1, rows: [] });
  });
  it('bounds optional labels and discloses truncation', async () => {
    const listed = Array.from({ length: size * 8 }, (_, index) =>
      entry(String(index).padStart(3, '0') + 'x'.repeat(900) + '.srp'));
    const data = await run(plan(listed, 1, 8));
    const output = formatSearchSweepReport(data, true);
    expect(output.length).toBeLessThanOrEqual(MAX_SCOPE_REPORT_UNITS);
    expect(output).toContain('Additional labels omitted');
  });
});
