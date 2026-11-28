import { describe, expect, it } from 'vitest';
import { createUntitled } from './documents';
import {
  prepareManifestLedger, startManifestLedger, prepareLedgerBatch,
  recordManifestLedgerBatch, type ManifestLedger,
} from './manifestBatchLedger';
import {
  captureLedgerComparisonBaseline, compareLedgerObservations, filterLedgerComparison,
  ledgerComparisonText, DEFAULT_LEDGER_COMPARISON_FILTER, LEDGER_COMPARISON_STATES,
} from './manifestLedgerComparison';
import { DEFAULT_PROJECT_SEARCH_SCOPE, PROJECT_SEARCH_BATCH_SIZE } from './projectSearchScope';
import { executeSourceManifest, type ProjectSourceManifest } from './projectSourceManifest';
import type { InspectionControl } from './projectInspection';

const entries = Array.from({ length: PROJECT_SEARCH_BATCH_SIZE * 2 + 1 }, (_, index) => ({
  name: 'src/private-source-' + String(index).padStart(3, '0') + '.srp',
  path: 'C:/private-root/src/private-source-' + String(index).padStart(3, '0') + '.srp',
}));
const control: InspectionControl = { isCurrent: () => true, isCancelled: () => false };
const scope = DEFAULT_PROJECT_SEARCH_SCOPE;
function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) throw Error(result.error);
  return result.value;
}
function setup(mode: 'working' | 'saved' = 'saved') {
  return startManifestLedger(unwrap(prepareManifestLedger(entries, scope, mode, false)));
}
async function scan(
  ledger: ManifestLedger,
  batch: number,
  reader: (path: string) => Promise<string> = async () => 'original private text',
  documents: ReturnType<typeof createUntitled>[] = [],
  state = control,
): Promise<ProjectSourceManifest> {
  const plan = unwrap(prepareLedgerBatch(ledger, batch, entries, scope, ledger.plan.mode, false));
  const result = await executeSourceManifest(plan, documents, reader, state);
  if (result.kind !== 'report') throw Error('Expected a report');
  return result.report;
}
async function observe(
  ledger: ManifestLedger,
  batch: number,
  reader?: (path: string) => Promise<string>,
  documents?: ReturnType<typeof createUntitled>[],
  state?: InspectionControl,
): Promise<ManifestLedger> {
  return unwrap(recordManifestLedgerBatch(ledger, await scan(ledger, batch, reader, documents, state), true));
}
const compare = (before: ManifestLedger, after: ManifestLedger) => unwrap(compareLedgerObservations(before, after));

describe('sequential manifest ledger comparisons', () => {
  it('requires an actual recorded baseline and does not count retained evidence as re-observed', async () => {
    const empty = setup();
    expect(captureLedgerComparisonBaseline(empty).ok).toBe(false);
    const earlier = await observe(empty, 1);
    const baseline = unwrap(captureLedgerComparisonBaseline(earlier));
    const comparison = compare(baseline, earlier);
    expect(comparison.counts.retained).toBe(entries.length);
    expect(comparison.comparableRows).toBe(0);
    expect(comparison.refreshedBatches).toBe(0);
    expect(comparison.rows.every(row => row.byteDelta === null && row.lineDelta === null)).toBe(true);
    expect(baseline).toBe(earlier);
  });

  it('distinguishes newly observed batches from previous pending labels', async () => {
    const baseline = await observe(setup(), 1);
    const latest = await observe(baseline, 2);
    const result = compare(baseline, latest);
    expect(result.counts['newly-hashed']).toBe(PROJECT_SEARCH_BATCH_SIZE);
    expect(result.counts.retained).toBe(entries.length - PROJECT_SEARCH_BATCH_SIZE);
    expect(result.refreshedBatches).toBe(1);
    expect(result.comparableRows).toBe(0);
    expect(result.baselineSequence).toBe(1);
    expect(result.currentSequence).toBe(2);
    expect(result.rows.filter(row => row.state === 'newly-hashed').every(row =>
      row.previous.file === null && row.current.file?.state === 'hashed')).toBe(true);
  });

  it('computes exact deltas only for refreshed same-origin comparable evidence', async () => {
    const baseline = await observe(setup(), 1);
    const latest = await observe(baseline, 1, async path =>
      path === entries[0].path ? 'original private text\nnext' : 'original private text');
    const result = compare(baseline, latest);
    expect(result.counts.changed).toBe(1);
    expect(result.counts.unchanged).toBe(PROJECT_SEARCH_BATCH_SIZE - 1);
    expect(result.comparableRows).toBe(PROJECT_SEARCH_BATCH_SIZE);
    expect(result.rows[0]).toMatchObject({ state: 'changed', byteDelta: 5, lineDelta: 1 });
    expect(result.rows[1]).toMatchObject({ state: 'unchanged', byteDelta: 0, lineDelta: 0 });
    expect(result.rows[0].previous.sequence).toBe(1);
    expect(result.rows[0].current.sequence).toBe(2);
    expect(result.rows[PROJECT_SEARCH_BATCH_SIZE].state).toBe('retained');
  });

  it('does not treat working-buffer and disk observations as directly comparable', async () => {
    const baseline = await observe(setup('working'), 1);
    const doc = {
      ...createUntitled(1), name: entries[0].name, path: entries[0].path,
      content: 'original private text', savedContent: 'old text',
    };
    const latest = await observe(baseline, 1, undefined, [doc]);
    const result = compare(baseline, latest);
    expect(result.rows[0]).toMatchObject({ state: 'origin-changed', byteDelta: null, lineDelta: null });
    expect(result.rows[0].previous.file?.origin).toBe('disk');
    expect(result.rows[0].current.file?.origin).toBe('open-buffer');
    expect(result.comparableRows).toBe(PROJECT_SEARCH_BATCH_SIZE - 1);
  });

  it('distinguishes lost and unavailable digests from unchanged content', async () => {
    const failed = await observe(setup(), 1, async () => { throw Error('private native failure'); });
    const recovered = await observe(failed, 1, async path => {
      if (path === entries[0].path) return 'now available';
      throw Error('private native failure');
    });
    const result = compare(failed, recovered);
    expect(result.counts['newly-hashed']).toBe(1);
    expect(result.counts.unavailable).toBe(PROJECT_SEARCH_BATCH_SIZE - 1);
    const lost = await observe(recovered, 1, async () => { throw Error('private native failure'); });
    expect(compare(recovered, lost).counts['newly-unavailable']).toBe(1);
    expect(compare(recovered, lost).comparableRows).toBe(0);
    expect(ledgerComparisonText(compare(recovered, lost), true, true)).not.toContain('private native failure');
  });

  it('keeps cancelled scans incomplete rather than inferring unchanged files', async () => {
    const baseline = await observe(setup(), 1);
    const latest = await observe(baseline, 1, undefined, [], { ...control, isCancelled: () => true });
    const result = compare(baseline, latest);
    expect(latest.receipts[0].status).toBe('cancelled');
    expect(result.counts['newly-unavailable']).toBe(PROJECT_SEARCH_BATCH_SIZE);
    expect(result.counts.unchanged).toBe(0);
    expect(result.rows[0].current.file?.state).toBe('not-observed');
  });

  it('refuses unrelated sessions and baselines from a later receipt generation', async () => {
    const earlier = await observe(setup(), 1);
    const later = await observe(earlier, 1);
    expect(compareLedgerObservations(later, earlier).ok).toBe(false);
    const unrelated = await observe(setup(), 1);
    expect(compareLedgerObservations(earlier, unrelated).ok).toBe(false);
    expect(compareLedgerObservations(earlier, startManifestLedger(earlier.plan)).ok).toBe(false);
    const fork = await observe(startManifestLedger(earlier.plan), 1);
    expect(compareLedgerObservations(earlier, fork).ok).toBe(false);
  });

  it('does not produce deltas when equal digests carry inconsistent length evidence', async () => {
    const baseline = await observe(setup(), 1);
    const report = await scan(baseline, 1, async () => 'x');
    const files = report.files.map((file, index) => index === 0 ?
      { ...file, digest: baseline.receipts[0].files[0].digest } : file);
    const latest = unwrap(recordManifestLedgerBatch(baseline, { ...report, files }, true));
    const result = compare(baseline, latest);
    expect(result.rows[0]).toMatchObject({ state: 'inconsistent', byteDelta: null, lineDelta: null });
    expect(result.counts.inconsistent).toBe(1);
    expect(result.comparableRows).toBe(PROJECT_SEARCH_BATCH_SIZE - 1);
  });

  it('filters without mutating counts and keeps labels and digests independently private', async () => {
    const baseline = await observe(setup(), 1);
    const latest = await observe(baseline, 1, async path => path === entries[0].path ? 'x' : 'original private text');
    const result = compare(baseline, latest);
    expect(filterLedgerComparison(result, { ...DEFAULT_LEDGER_COMPARISON_FILTER, state: 'changed' })).toHaveLength(1);
    expect(filterLedgerComparison(result, { ...DEFAULT_LEDGER_COMPARISON_FILTER, batch: 2 })).toHaveLength(PROJECT_SEARCH_BATCH_SIZE);
    expect(filterLedgerComparison(result, { ...DEFAULT_LEDGER_COMPARISON_FILTER, query: 'PRIVATE-SOURCE-000' })).toHaveLength(1);
    expect(filterLedgerComparison(result, { ...DEFAULT_LEDGER_COMPARISON_FILTER, query: '\u0000' })).toEqual([]);
    expect(filterLedgerComparison(result, { ...DEFAULT_LEDGER_COMPARISON_FILTER, query: 'x'.repeat(121) })).toEqual([]);
    expect(LEDGER_COMPARISON_STATES.reduce((sum, state) => sum + result.counts[state], 0)).toBe(entries.length);
    const hash = result.rows[0].previous.file!.digest!;
    const privateReport = ledgerComparisonText(result);
    expect(privateReport).not.toContain(entries[0].name);
    expect(privateReport).not.toContain(hash);
    expect(privateReport).toContain('NOT atomic snapshots');
    expect(ledgerComparisonText(result, true, false)).toContain(entries[0].name);
    expect(ledgerComparisonText(result, true, false)).not.toContain(hash);
    expect(ledgerComparisonText(result, false, true)).not.toContain(entries[0].name);
    expect(ledgerComparisonText(result, false, true)).toContain(hash);
    expect(ledgerComparisonText(result, true, true)).not.toContain('C:/private-root');
    expect(ledgerComparisonText(result, true, true)).not.toContain('original private text');
  });
});
