import {
  summarizeManifestLedger,
  isKnownManifestLedger,
  descendsFromManifestLedger,
  type ManifestLedger,
  type ManifestLedgerReceipt,
  type ManifestLedgerRow,
} from './manifestBatchLedger';
import { MAX_SCOPE_REPORT_UNITS } from './projectSearchScope';
import { MANIFEST_STATE_LABELS, type ManifestFile } from './projectSourceManifest';

export const LEDGER_COMPARISON_STATES = [
  'retained', 'newly-hashed', 'newly-unavailable', 'unchanged',
  'changed', 'origin-changed', 'inconsistent', 'unavailable',
] as const;
export type LedgerComparisonState = typeof LEDGER_COMPARISON_STATES[number];

export const LEDGER_COMPARISON_LABELS: Readonly<Record<LedgerComparisonState, string>> = Object.freeze({
  retained: 'Not re-observed',
  'newly-hashed': 'New digest evidence',
  'newly-unavailable': 'Digest evidence lost',
  unchanged: 'Equal digest and length',
  changed: 'Different digest',
  inconsistent: 'Digest and metric evidence disagree',
  'origin-changed': 'Snapshot origin changed',
  unavailable: 'No comparable digest evidence',
});

export interface LedgerComparisonRow {
  readonly label: string;
  readonly batch: number;
  readonly previous: ManifestLedgerRow;
  readonly current: ManifestLedgerRow;
  readonly state: LedgerComparisonState;
  readonly byteDelta: number | null;
  readonly lineDelta: number | null;
}

export interface LedgerComparison {
  readonly baselineSequence: number;
  readonly currentSequence: number;
  readonly rows: readonly LedgerComparisonRow[];
  readonly counts: Readonly<Record<LedgerComparisonState, number>>;
  readonly refreshedBatches: number;
  readonly comparableRows: number;
  readonly selected: number;
}

type Result<T> = { readonly ok: true; readonly value: T } |
  { readonly ok: false; readonly error: string };
const fail = (error: string): Result<never> => ({ ok: false, error });

/** A baseline is the actual immutable in-session ledger, not an imported
 * report, a timestamp, or an authorization to open its private paths. */
export function captureLedgerComparisonBaseline(ledger: ManifestLedger): Result<ManifestLedger> {
  if (!isKnownManifestLedger(ledger)) return fail('The ledger is not an active session revision.');
  if (!ledger.receipts.length) return fail('Record at least one batch before capturing a comparison baseline.');
  return { ok: true, value: ledger };
}

function hashed(file: ManifestFile | null): file is ManifestFile & { digest: string; bytes: number } {
  return file !== null && file.state === 'hashed' && file.digest !== null && file.bytes !== null;
}

function receiptMap(ledger: ManifestLedger): ReadonlyMap<number, ManifestLedgerReceipt> {
  return new Map(ledger.receipts.map(receipt => [receipt.batch, receipt]));
}

/** Refuse unrelated ledgers, even if their public labels happen to match.
 * Unreplaced receipts are retained observations, not new unchanged evidence.
 * The ledger never removes a recorded receipt except when it is replaced. */
export function compareLedgerObservations(baseline: ManifestLedger, current: ManifestLedger): Result<LedgerComparison> {
  if (baseline.plan !== current.plan) return fail('The ledger membership session was replaced. Capture a new baseline.');
  if (!baseline.receipts.length) return fail('The baseline has no recorded batches.');
  if (current.nextSequence < baseline.nextSequence) return fail('The current ledger predates this baseline.');
  if (!descendsFromManifestLedger(current, baseline)) return fail('The current ledger does not descend from this baseline.');
  const beforeReceipts = receiptMap(baseline);
  const afterReceipts = receiptMap(current);
  for (const receipt of baseline.receipts) {
    const after = afterReceipts.get(receipt.batch);
    if (!after || (after !== receipt && after.sequence < baseline.nextSequence)) {
      return fail('The current ledger does not descend from this baseline.');
    }
  }
  const previous = summarizeManifestLedger(baseline);
  const next = summarizeManifestLedger(current);
  if (previous.rows.length !== next.rows.length) return fail('The selected source inventory changed.');
  const counts: Record<LedgerComparisonState, number> = {
    retained: 0, 'newly-hashed': 0, 'newly-unavailable': 0, unchanged: 0,
    changed: 0, 'origin-changed': 0, inconsistent: 0, unavailable: 0,
  };
  const refreshedBatches = current.receipts.filter(receipt => receipt !== beforeReceipts.get(receipt.batch)).length;
  const rows: LedgerComparisonRow[] = [];
  for (const [index, row] of next.rows.entries()) {
    const old = previous.rows[index];
    if (old.label !== row.label || old.batch !== row.batch) return fail('The selected source inventory changed.');
    const before = old.file;
    const after = row.file;
    let state: LedgerComparisonState;
    let byteDelta: number | null = null;
    let lineDelta: number | null = null;
    if (beforeReceipts.get(row.batch) === afterReceipts.get(row.batch)) {
      state = 'retained';
    } else if (hashed(before) && hashed(after)) {
      if (before.origin !== after.origin) {
        state = 'origin-changed';
      } else {
        state = before.digest !== after.digest ? 'changed' :
          before.bytes === after.bytes && JSON.stringify(before.metrics) === JSON.stringify(after.metrics) ? 'unchanged' : 'inconsistent';
        if (state !== 'inconsistent') {
          byteDelta = after.bytes - before.bytes;
          if (before.metrics && after.metrics) lineDelta = after.metrics.lines - before.metrics.lines;
        }
      }
    } else if (hashed(after)) {
      state = 'newly-hashed';
    } else if (hashed(before)) {
      state = 'newly-unavailable';
    } else {
      state = 'unavailable';
    }
    counts[state]++;
    rows.push(Object.freeze({ label: row.label, batch: row.batch, previous: old, current: row, state, byteDelta, lineDelta }));
  }
  return { ok: true, value: Object.freeze({
    baselineSequence: baseline.nextSequence - 1,
    currentSequence: current.nextSequence - 1,
    rows: Object.freeze(rows),
    counts: Object.freeze(counts),
    refreshedBatches,
    comparableRows: counts.unchanged + counts.changed,
    selected: rows.length,
  }) };
}

export interface LedgerComparisonFilter {
  readonly query: string;
  readonly state: LedgerComparisonState | 'all';
  readonly batch: number | null;
}
export const DEFAULT_LEDGER_COMPARISON_FILTER: LedgerComparisonFilter = Object.freeze({
  query: '', state: 'all', batch: null,
});

export function filterLedgerComparison(
  comparison: LedgerComparison,
  filter: LedgerComparisonFilter,
): readonly LedgerComparisonRow[] {
  if (filter.query.length > 120 || /[\x00-\x1f\x7f]/.test(filter.query)) return [];
  const query = filter.query.trim().toLowerCase();
  return comparison.rows.filter(row =>
    (!query || row.label.toLowerCase().includes(query)) &&
    (filter.state === 'all' || row.state === filter.state) &&
    (filter.batch === null || row.batch === filter.batch));
}

function observationText(row: ManifestLedgerRow, includeDigest: boolean): string {
  const receipt = row.sequence === null ? 'no receipt' : 'receipt ' + row.sequence;
  if (!row.file) return receipt + ', not observed';
  return receipt + ', ' + MANIFEST_STATE_LABELS[row.file.state] + ', ' + row.file.origin +
    (includeDigest && hashed(row.file) ? ', SHA-256 ' + row.file.digest : '');
}

/** Labels and fingerprints are independent opt-ins. The report includes
 * no absolute paths, source contents or authority, and makes no claim
 * that either side is a simultaneous filesystem snapshot. */
export function ledgerComparisonText(
  comparison: LedgerComparison,
  includeLabels = false,
  includeDigests = false,
): string {
  const lines = [
    'Scarp Studio — sequential ledger observation comparison',
    'Historical observations, NOT atomic snapshots. Retained rows were not re-observed.',
    'Baseline receipt sequence: ' + comparison.baselineSequence,
    'Current receipt sequence: ' + comparison.currentSequence,
    'Refreshed batches: ' + comparison.refreshedBatches,
    'Selected labels: ' + comparison.selected,
    'Comparable refreshed rows: ' + comparison.comparableRows,
    ...LEDGER_COMPARISON_STATES.map(state => LEDGER_COMPARISON_LABELS[state] + ': ' + comparison.counts[state]),
    'A changed origin is not comparable content evidence. No source text or native paths included.',
  ];
  let units = lines.join('\n').length;
  if (includeLabels || includeDigests) for (const [index, row] of comparison.rows.entries()) {
    const line = 'Source ' + (index + 1) + (includeLabels ? ' ' + JSON.stringify(row.label) : '') +
      '; batch ' + row.batch + '; ' + LEDGER_COMPARISON_LABELS[row.state] +
      '; before: ' + observationText(row.previous, includeDigests) +
      '; after: ' + observationText(row.current, includeDigests) +
      (row.byteDelta !== null ? '; byte delta: ' + row.byteDelta : '') +
      (row.lineDelta !== null ? '; editor line delta: ' + row.lineDelta : '');
    if (units + line.length + 1 > MAX_SCOPE_REPORT_UNITS - 100) {
      lines.push('Additional comparison rows omitted.');
      break;
    }
    lines.push(line);
    units += line.length + 1;
  }
  return lines.join('\n');
}
