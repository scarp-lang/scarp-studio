import { describe, expect, it, vi } from 'vitest';
import {
  createSearchBatchLedger, checkSearchLedgerContext, checkSearchLedgerInventory,
  recordSearchLedgerBatch, removeSearchLedgerBatch, summarizeSearchBatchLedger,
  nextSearchLedgerBatch, searchBatchLedgerReport,
  type SearchBatchLedger,
} from './projectSearchLedger';
import { captureSearchObservation, type SearchObservation } from './projectSearchComparison';
import {
  buildProjectScopeInventory, planScopedProjectSearch, summarizeScopedSearch,
  DEFAULT_PROJECT_SEARCH_SCOPE, MAX_SCOPE_REPORT_UNITS, PROJECT_SEARCH_BATCH_SIZE,
  type ProjectScopeInventory, type ProjectSearchScope,
} from './projectSearchScope';
import { searchListedProjectSources, type ProjectSearchSource } from './projectSearch';
import { MAX_SEARCH_RESULTS, type SearchOptions } from './openFileSearch';
import { createUntitled } from './documents';

const size = PROJECT_SEARCH_BATCH_SIZE;
const query = 'secret-term';
const options = { caseSensitive: true, wholeWord: false };
function entry(name: string): ProjectSearchSource {
  return { name, path: 'C:/private-workspace/' + name };
}
function entries(count: number, directory = 'src') {
  return Array.from({ length: count }, (_, index) => entry(directory + '/part-' + String(index).padStart(3, '0') + '.srp'));
}
function inventory(count: number) { return buildProjectScopeInventory(entries(count)); }
async function observe(
  sourceInventory: ProjectScopeInventory, batch: number | undefined,
  read: (path: string, limit: number) => Promise<string> = async () => query,
  patch: Partial<ProjectSearchScope> = {}, term = query, flags: SearchOptions = options,
): Promise<SearchObservation> {
  const planned = planScopedProjectSearch(sourceInventory, { ...DEFAULT_PROJECT_SEARCH_SCOPE, ...patch, batch });
  if (!planned.ok) throw Error(planned.error);
  const result = await searchListedProjectSources(planned.value.sources, [], term, flags, read);
  if (!result) throw Error('Missing result');
  const summary = summarizeScopedSearch(planned.value, result);
  if (!summary.ok) throw Error(summary.error);
  const captured = captureSearchObservation(term, flags, summary.value);
  if (!captured.ok) throw Error(captured.error);
  return captured.value;
}
function start(sourceInventory: ProjectScopeInventory, observation: SearchObservation): SearchBatchLedger {
  const result = createSearchBatchLedger(sourceInventory, observation);
  if (!result.ok) throw Error(result.error);
  return result.value;
}
function record(ledger: SearchBatchLedger, sourceInventory: ProjectScopeInventory, observation: SearchObservation,
  replace = false): SearchBatchLedger {
  const result = recordSearchLedgerBatch(ledger, sourceInventory, observation, replace);
  if (!result.ok) throw Error(result.error);
  return result.value;
}

describe('batch ledger planning and immutable records', () => {
  it('starts only from a numbered observation, retaining no native paths or source text', async () => {
    const listed = inventory(size * 2 + 1);
    expect(createSearchBatchLedger(listed, await observe(listed, undefined)).ok).toBe(false);
    const ledger = start(listed, await observe(listed, 2));
    expect(ledger.batches.map(batch => batch.labels.length)).toEqual([size, size, 1]);
    expect(ledger.records.map(record => record.index)).toEqual([2]);
    expect(ledger.scope).toEqual(DEFAULT_PROJECT_SEARCH_SCOPE);
    expect(ledger.batches.flatMap(batch => batch.labels)).toEqual(listed.sources.map(source => source.name).sort());
    expect(JSON.stringify(ledger)).not.toContain('C:/private-workspace');
    expect(Object.isFrozen(ledger)).toBe(true);
    expect(Object.isFrozen(ledger.records)).toBe(true);
    expect(Object.isFrozen(ledger.batches[0].labels)).toBe(true);
    expect(Object.isFrozen(ledger.records[0].rows[0])).toBe(true);
  });

  it('separates planned, excluded, withheld and unrecorded labels', async () => {
    const listed = buildProjectScopeInventory([
      ...entries(size + 1, 'src'), entry('tests/part-000.srp'), entry('../unsafe.srp'),
      entry('duplicate.srp'), entry('duplicate.srp'),
    ]);
    const ledger = start(listed, await observe(listed, 2, async () => 'unrelated', {
      directory: 'src', filename: 'part-',
    }));
    const summary = summarizeSearchBatchLedger(ledger);
    expect(summary).toMatchObject({
      listed: size + 5, candidates: size + 1, excluded: 1, withheld: 3,
      fullyScanned: 1, incomplete: 0, unrecorded: size, recordedBatches: 1, totalBatches: 2,
    });
    expect(summary.batches.map(batch => batch.status)).toEqual(['unrecorded', 'fully-scanned']);
    expect(nextSearchLedgerBatch(summary)).toBe(1);
  });

  it('rejects unsafe labels even if they lie in an unrecorded batch', async () => {
    const good = entries(size + 1);
    const listed = buildProjectScopeInventory([...good, entry('z/\u202eprivate.srp')]);
    const observation = await observe(listed, 1);
    expect(createSearchBatchLedger(listed, observation).ok).toBe(false);
  });

  it('retains deterministic membership when listing enumeration order changes', async () => {
    const original = entries(size * 3);
    const listed = buildProjectScopeInventory(original);
    const ledger = start(listed, await observe(listed, 1));
    const reordered = buildProjectScopeInventory([...original].reverse());
    expect(checkSearchLedgerInventory(ledger, reordered).ok).toBe(true);
    const next = record(ledger, reordered, await observe(reordered, 2));
    expect(next.records.map(batch => batch.index)).toEqual([1, 2]);
    expect(ledger.records.map(batch => batch.index)).toEqual([1]);
  });

  it('rejects a changed label inventory even when its counts are unchanged', async () => {
    const listed = inventory(size + 1);
    const ledger = start(listed, await observe(listed, 1));
    const changed = buildProjectScopeInventory([...entries(size), entry('src/replaced.srp')]);
    expect(checkSearchLedgerInventory(ledger, changed).ok).toBe(false);
    expect(recordSearchLedgerBatch(ledger, changed, await observe(changed, 2), false).ok).toBe(false);
  });

  it('rejects changed excluded or withheld listing counts', async () => {
    const original = [...entries(size + 1), entry('tests/a.srp')];
    const listed = buildProjectScopeInventory(original);
    const ledger = start(listed, await observe(listed, 1, async () => query, { directory: 'src' }));
    for (const added of [entry('examples/a.srp'), entry('../bad.srp')]) {
      const changed = buildProjectScopeInventory([...original, added]);
      expect(checkSearchLedgerInventory(ledger, changed).ok).toBe(false);
    }
  });

  it('accepts another batch number but rejects other matching setting changes', async () => {
    const listed = inventory(size + 1);
    const ledger = start(listed, await observe(listed, 1));
    const nextScope = { ...DEFAULT_PROJECT_SEARCH_SCOPE, batch: 2 };
    expect(checkSearchLedgerContext(ledger, listed, query, options, nextScope).ok).toBe(true);
    expect(checkSearchLedgerContext(ledger, listed, 'other', options, nextScope).ok).toBe(false);
    expect(checkSearchLedgerContext(ledger, listed, query, { ...options, wholeWord: true }, nextScope).ok).toBe(false);
    expect(checkSearchLedgerContext(ledger, listed, query, { ...options, caseSensitive: false }, nextScope).ok).toBe(false);
    expect(checkSearchLedgerContext(ledger, listed, query, options, { ...nextScope, filename: 'part' }).ok).toBe(false);
    expect(checkSearchLedgerContext(ledger, listed, query, options, { ...nextScope, descendants: false }).ok).toBe(false);
    expect(recordSearchLedgerBatch(ledger, listed, await observe(listed, 2, async () => 'other', {}, 'other'), false).ok).toBe(false);
  });

  it('requires exact batch evidence membership and metadata', async () => {
    const listed = inventory(size * 2);
    const ledger = start(listed, await observe(listed, 1));
    const observation = await observe(listed, 2);
    const forged = { ...observation, rows: [...observation.rows.slice(1), { ...observation.rows[0], name: 'src/forged.srp' }] };
    expect(recordSearchLedgerBatch(ledger, listed, forged, false).ok).toBe(false);
    expect(recordSearchLedgerBatch(ledger, listed, { ...observation, batch: { ...observation.batch!, deferred: 0 } }, false).ok).toBe(false);
    expect(recordSearchLedgerBatch(ledger, listed, { ...observation, listed: 100 }, false).ok).toBe(false);
    expect(recordSearchLedgerBatch(ledger, listed, await observe(listed, undefined), false).ok).toBe(false);
  });
});

describe('separate observation progress', () => {
  it('prefers an unrecorded batch before retrying a partially scanned batch', async () => {
    const listed = inventory(size * 2 + 1);
    const first = await observe(listed, 1, async path => {
      if (path.endsWith('000.srp')) throw Error('private read failure');
      return query;
    });
    let ledger = start(listed, first);
    expect(summarizeSearchBatchLedger(ledger)).toMatchObject({
      recordedBatches: 1, incompleteBatches: 1, fullyScanned: size - 1, incomplete: 1,
      unrecorded: size + 1,
    });
    expect(nextSearchLedgerBatch(summarizeSearchBatchLedger(ledger))).toBe(2);
    ledger = record(ledger, listed, await observe(listed, 2));
    expect(nextSearchLedgerBatch(summarizeSearchBatchLedger(ledger))).toBe(3);
    ledger = record(ledger, listed, await observe(listed, 3));
    expect(nextSearchLedgerBatch(summarizeSearchBatchLedger(ledger))).toBe(1);
  });

  it('replaces prior batch evidence only when replacement is explicitly requested', async () => {
    const listed = inventory(size + 1);
    const partial = await observe(listed, 1, async () => { throw Error('denied'); });
    const ledger = start(listed, partial);
    const retry = await observe(listed, 1, async () => 'unrelated');
    expect(recordSearchLedgerBatch(ledger, listed, retry, false).ok).toBe(false);
    const updated = record(ledger, listed, retry, true);
    expect(updated.records).toHaveLength(1);
    expect(summarizeSearchBatchLedger(updated)).toMatchObject({ fullyScanned: size, incomplete: 0, unrecorded: 1 });
    expect(summarizeSearchBatchLedger(ledger)).toMatchObject({ fullyScanned: 0, incomplete: size, unrecorded: 1 });
  });

  it('does not treat match-limited source observations as fully scanned', async () => {
    const listed = inventory(1);
    const partial = await observe(listed, 1, async () => (query + ' ').repeat(MAX_SEARCH_RESULTS + 1));
    const ledger = start(listed, partial);
    const result = summarizeSearchBatchLedger(ledger);
    expect(result).toMatchObject({ fullyScanned: 0, incomplete: 1, unrecorded: 0, incompleteBatches: 1 });
    expect(nextSearchLedgerBatch(result)).toBe(1);
    expect(result.batches[0].rows[0].state).toBe('content-limit');
  });

  it('reports completed separate observations without asserting an atomic current scan', async () => {
    const listed = inventory(size + 1);
    const ledger = record(start(listed, await observe(listed, 1)), listed, await observe(listed, 2));
    const summary = summarizeSearchBatchLedger(ledger);
    expect(summary).toMatchObject({ fullyScannedBatches: 2, fullyScanned: size + 1, incomplete: 0, unrecorded: 0 });
    expect(nextSearchLedgerBatch(summary)).toBeNull();
    const report = searchBatchLedgerReport(summary);
    expect(report).toContain('no combined or current workspace scan is asserted');
    expect(report).toContain('No combined match count');
    expect(report).not.toContain(query);
    expect(report).not.toContain('src/part-000.srp');
    expect(report).not.toContain('C:/private-workspace');
  });

  it('removes a recorded batch without affecting other evidence or the membership plan', async () => {
    const listed = inventory(size * 2 + 1);
    const ledger = record(start(listed, await observe(listed, 1)), listed, await observe(listed, 3));
    expect(removeSearchLedgerBatch(ledger, 2).ok).toBe(false);
    const removed = removeSearchLedgerBatch(ledger, 1);
    if (!removed.ok) throw Error(removed.error);
    expect(removed.value.records.map(batch => batch.index)).toEqual([3]);
    expect(removed.value.batches).toBe(ledger.batches);
    expect(nextSearchLedgerBatch(summarizeSearchBatchLedger(removed.value))).toBe(1);
    expect(ledger.records).toHaveLength(2);
  });

  it('can record an open-buffer origin without retaining the buffer or issuing a disk read', async () => {
    const listed = inventory(1);
    const source = listed.sources[0];
    const planned = planScopedProjectSearch(listed, { ...DEFAULT_PROJECT_SEARCH_SCOPE, batch: 1 });
    if (!planned.ok) throw Error(planned.error);
    const doc = { ...createUntitled(1), path: source.path, name: source.name,
      content: 'private unsaved ' + query, savedContent: '' };
    const reader = vi.fn(async () => 'unrelated');
    const result = await searchListedProjectSources(planned.value.sources, [doc], query, options, reader);
    expect(reader).not.toHaveBeenCalled();
    const summary = summarizeScopedSearch(planned.value, result!);
    if (!summary.ok) throw Error(summary.error);
    const observation = captureSearchObservation(query, options, summary.value);
    if (!observation.ok) throw Error(observation.error);
    const ledger = start(listed, observation.value);
    expect(ledger.records[0].rows[0]).toMatchObject({ origin: 'open-buffer', hits: 1 });
    expect(JSON.stringify(ledger)).not.toContain('private unsaved');
    expect(searchBatchLedgerReport(summarizeSearchBatchLedger(ledger), true)).toContain('Open buffer');
  });
});

describe('ledger report privacy and bounds', () => {
  it('includes relative labels only on request, including labels not yet observed', async () => {
    const listed = buildProjectScopeInventory(entries(size + 1, 'private-folder'));
    const ledger = start(listed, await observe(listed, 1, async () => query, {
      directory: 'private-folder', filename: 'part-',
    }));
    const summary = summarizeSearchBatchLedger(ledger);
    const ordinary = searchBatchLedgerReport(summary);
    expect(ordinary).not.toContain('private-folder');
    expect(ordinary).not.toContain(query);
    const labeled = searchBatchLedgerReport(summary, true);
    expect(labeled).toContain(listed.sources[size].name);
    expect(labeled).toContain('No observation');
    expect(labeled).not.toContain('C:/private-workspace');
    expect(labeled).not.toContain(query);
  });

  it('bounds long optional labels and discloses omitted report rows', async () => {
    const listed = buildProjectScopeInventory(Array.from({ length: 150 }, (_, index) =>
      entry(String(index).padStart(3, '0') + 'x'.repeat(900) + '.srp')));
    const ledger = start(listed, await observe(listed, 1));
    const report = searchBatchLedgerReport(summarizeSearchBatchLedger(ledger), true);
    expect(report.length).toBeLessThanOrEqual(MAX_SCOPE_REPORT_UNITS);
    expect(report).toContain('Additional rows omitted');
  });
});
