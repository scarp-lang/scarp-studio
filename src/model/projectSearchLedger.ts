import type { SearchOptions } from './openFileSearch';
import {
  planScopedProjectSearch, sameProjectScope, PROJECT_SEARCH_BATCH_SIZE, MAX_SCOPE_REPORT_UNITS,
  SEARCH_COVERAGE_LABELS, searchCoverageOrigin,
  type ProjectSearchScope, type ProjectScopeInventory, type ScopedFileCoverageRow,
} from './projectSearchScope';
import { validRelativeLabel, type SearchObservation, type ObservationResult } from './projectSearchComparison';

export interface SearchLedgerBatch {
  readonly index: number;
  readonly labels: readonly string[];
}
export interface SearchLedgerRecord {
  readonly index: number;
  readonly rows: readonly ScopedFileCoverageRow[];
}
export interface SearchBatchLedger {
  /** Session-only matching settings; not included in reports. */
  readonly query: string;
  readonly options: Readonly<SearchOptions>;
  readonly scope: ProjectSearchScope;
  readonly listed: number;
  readonly excluded: number;
  readonly withheld: number;
  readonly batches: readonly SearchLedgerBatch[];
  readonly records: readonly SearchLedgerRecord[];
}
export type LedgerStatus = 'unrecorded' | 'incomplete' | 'fully-scanned';
export interface SearchLedgerBatchSummary {
  readonly index: number;
  readonly labels: readonly string[];
  readonly status: LedgerStatus;
  readonly fullyScanned: number;
  readonly incomplete: number;
  readonly unrecorded: number;
  readonly rows: readonly ScopedFileCoverageRow[];
}
export interface SearchLedgerSummary {
  readonly batches: readonly SearchLedgerBatchSummary[];
  readonly totalBatches: number;
  readonly recordedBatches: number;
  readonly fullyScannedBatches: number;
  readonly incompleteBatches: number;
  readonly unrecordedBatches: number;
  readonly candidates: number;
  readonly fullyScanned: number;
  readonly incomplete: number;
  readonly unrecorded: number;
  readonly withheld: number;
  readonly excluded: number;
  readonly listed: number;
}
const fail = (error: string): ObservationResult<never> => ({ ok: false, error });

/** Batch number is an action within a fixed scope, not part of the ledger's
 * overall selection identity. All other settings must remain exact.
 */
function baseScope(scope: ProjectSearchScope): ProjectSearchScope {
  return Object.freeze({ directory: scope.directory, descendants: scope.descendants, filename: scope.filename });
}
function sameSettings(ledger: SearchBatchLedger, query: string, options: SearchOptions, scope: ProjectSearchScope): boolean {
  return ledger.query === query && ledger.options.caseSensitive === options.caseSensitive &&
    ledger.options.wholeWord === options.wholeWord && sameProjectScope(ledger.scope, baseScope(scope));
}
function exactLabels(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((label, index) => label === b[index]);
}
function inventoryLabels(inventory: ProjectScopeInventory, scope: ProjectSearchScope) {
  const plan = planScopedProjectSearch(inventory, baseScope(scope));
  if (!plan.ok) return plan;
  const labels = plan.value.sources.map(source => source.name).sort();
  if (!labels.every(validRelativeLabel)) return fail('The scope contains source labels that are unsafe to record.');
  return { ok: true as const, value: {
    labels, listed: plan.value.listed, excluded: plan.value.excluded,
    withheld: plan.value.invalid + plan.value.ambiguous + plan.value.uninspected,
  } };
}

/** A ledger is pinned to the exact eligible relative label inventory, not to
 * an atomic disk snapshot or native filesystem identities. A changed listing
 * cannot silently move a recorded source to another batch.
 */
export function checkSearchLedgerInventory(
  ledger: SearchBatchLedger, inventory: ProjectScopeInventory,
): ObservationResult<true> {
  const current = inventoryLabels(inventory, ledger.scope);
  if (!current.ok) return current;
  if (current.value.listed !== ledger.listed || current.value.excluded !== ledger.excluded ||
      current.value.withheld !== ledger.withheld ||
      !exactLabels(ledger.batches.flatMap(batch => batch.labels), current.value.labels)) {
    return fail('The listed source inventory changed. Start a new ledger for the current selection.');
  }
  return { ok: true, value: true };
}

export function checkSearchLedgerContext(
  ledger: SearchBatchLedger, inventory: ProjectScopeInventory, query: string,
  options: SearchOptions, scope: ProjectSearchScope,
): ObservationResult<true> {
  if (!sameSettings(ledger, query, options, scope)) {
    return fail('Return to the original query, matching options, directory and filename scope to continue this ledger.');
  }
  return checkSearchLedgerInventory(ledger, inventory);
}

/** Create from a real captured batch observation. The caller must have
 * validated the result with captureSearchObservation; no raw hits or native
 * source paths are retained by this model.
 */
export function createSearchBatchLedger(
  inventory: ProjectScopeInventory, observation: SearchObservation,
): ObservationResult<SearchBatchLedger> {
  if (!observation.batch || observation.scope.batch === undefined) {
    return fail('Run an explicit numbered search batch before starting a ledger.');
  }
  const current = inventoryLabels(inventory, observation.scope);
  if (!current.ok) return current;
  const { labels, listed, excluded, withheld } = current.value;
  if (!labels.length) return fail('The current scope has no eligible listed sources.');
  const batches: SearchLedgerBatch[] = [];
  for (let start = 0; start < labels.length; start += PROJECT_SEARCH_BATCH_SIZE) {
    batches.push(Object.freeze({
      index: batches.length + 1,
      labels: Object.freeze(labels.slice(start, start + PROJECT_SEARCH_BATCH_SIZE)),
    }));
  }
  const ledger: SearchBatchLedger = Object.freeze({
    query: observation.query,
    options: Object.freeze({
      caseSensitive: observation.options.caseSensitive, wholeWord: observation.options.wholeWord,
    }),
    scope: baseScope(observation.scope), listed, excluded, withheld,
    batches: Object.freeze(batches), records: Object.freeze([]),
  });
  return recordSearchLedgerBatch(ledger, inventory, observation, false);
}

/** Check provenance before copying any observation. Replacement is explicit;
 * retrying a batch replaces its previous evidence rather than accumulating
 * counts from multiple snapshots of the same labels.
 */
export function recordSearchLedgerBatch(
  ledger: SearchBatchLedger, inventory: ProjectScopeInventory, observation: SearchObservation,
  replaceExisting: boolean,
): ObservationResult<SearchBatchLedger> {
  const compatible = checkSearchLedgerContext(
    ledger, inventory, observation.query, observation.options, observation.scope,
  );
  if (!compatible.ok) return compatible;
  if (!observation.batch || observation.scope.batch === undefined) {
    return fail('Only explicit numbered batch observations can be recorded.');
  }
  const batch = ledger.batches.find(item => item.index === observation.scope.batch);
  if (!batch) return fail('This observation does not belong to a planned batch.');
  const labels = observation.rows.map(row => row.name).sort();
  const candidates = ledger.batches.reduce((count, item) => count + item.labels.length, 0);
  if (!exactLabels(batch.labels, labels) || observation.batch.index !== batch.index ||
      observation.batch.total !== ledger.batches.length || observation.batch.candidates !== candidates ||
      observation.batch.deferred !== candidates - labels.length ||
      observation.batch.first !== (batch.index - 1) * PROJECT_SEARCH_BATCH_SIZE + 1 ||
      observation.batch.last !== (batch.index - 1) * PROJECT_SEARCH_BATCH_SIZE + labels.length ||
      observation.listed !== ledger.listed || observation.excluded !== ledger.excluded ||
      observation.withheld !== ledger.withheld) {
    return fail('The observed batch does not match the recorded label inventory.');
  }
  if (ledger.records.some(record => record.index === batch.index) && !replaceExisting) {
    return fail('This batch already has an observation. Explicitly choose replacement to update it.');
  }
  const record: SearchLedgerRecord = Object.freeze({
    index: batch.index,
    rows: Object.freeze(observation.rows.map(row => Object.freeze({
      name: row.name, state: row.state, origin: row.origin, hits: row.hits,
    }))),
  });
  const records = [...ledger.records.filter(item => item.index !== batch.index), record]
    .sort((a, b) => a.index - b.index);
  return { ok: true, value: Object.freeze({ ...ledger, records: Object.freeze(records) }) };
}

export function removeSearchLedgerBatch(
  ledger: SearchBatchLedger, index: number,
): ObservationResult<SearchBatchLedger> {
  if (!ledger.records.some(record => record.index === index)) return fail('This batch has no recorded observation.');
  return { ok: true, value: Object.freeze({
    ...ledger, records: Object.freeze(ledger.records.filter(record => record.index !== index)),
  }) };
}

export function summarizeSearchBatchLedger(ledger: SearchBatchLedger): SearchLedgerSummary {
  const batches = ledger.batches.map((batch): SearchLedgerBatchSummary => {
    const record = ledger.records.find(item => item.index === batch.index);
    const rows = record?.rows ?? [];
    const fullyScanned = rows.filter(row => row.state === 'scanned').length;
    const incomplete = record ? batch.labels.length - fullyScanned : 0;
    return Object.freeze({
      index: batch.index, labels: batch.labels, rows,
      status: !record ? 'unrecorded' : incomplete > 0 ? 'incomplete' : 'fully-scanned',
      fullyScanned, incomplete, unrecorded: record ? 0 : batch.labels.length,
    });
  });
  const totals = batches.reduce((result, batch) => ({
    candidates: result.candidates + batch.labels.length,
    fullyScanned: result.fullyScanned + batch.fullyScanned,
    incomplete: result.incomplete + batch.incomplete,
    unrecorded: result.unrecorded + batch.unrecorded,
  }), { candidates: 0, fullyScanned: 0, incomplete: 0, unrecorded: 0 });
  return Object.freeze({
    batches: Object.freeze(batches), totalBatches: batches.length,
    recordedBatches: batches.filter(batch => batch.status !== 'unrecorded').length,
    fullyScannedBatches: batches.filter(batch => batch.status === 'fully-scanned').length,
    incompleteBatches: batches.filter(batch => batch.status === 'incomplete').length,
    unrecordedBatches: batches.filter(batch => batch.status === 'unrecorded').length,
    ...totals, listed: ledger.listed, excluded: ledger.excluded, withheld: ledger.withheld,
  });
}

/** Prefer the lowest-numbered unrecorded batch, then the first incomplete
 * recorded batch. Never start a search or select a native path.
 */
export function nextSearchLedgerBatch(summary: SearchLedgerSummary): number | null {
  return summary.batches.find(batch => batch.status === 'unrecorded')?.index ??
    summary.batches.find(batch => batch.status === 'incomplete')?.index ?? null;
}
export const SEARCH_LEDGER_STATUS_LABELS: Readonly<Record<LedgerStatus, string>> = Object.freeze({
  unrecorded: 'No observation',
  incomplete: 'Recorded, not fully scanned',
  'fully-scanned': 'All batch labels fully scanned in its observation',
});

/** This report counts label observations only. Do not merge hits or claim
 * that multiple separate reads establish a current, complete workspace scan.
 */
export function searchBatchLedgerReport(summary: SearchLedgerSummary, includeLabels = false): string {
  const lines = [
    'Scarp Studio — separate search batch observations',
    'These observations were recorded independently; no combined or current workspace scan is asserted.',
    'Counts refer to listed relative source labels, not filesystem identities.',
    'Listed sources at ledger creation: ' + summary.listed,
    'Excluded by scope: ' + summary.excluded,
    'Withheld listing entries: ' + summary.withheld,
    'Eligible planned labels: ' + summary.candidates,
    'Labels fully scanned in recorded observations: ' + summary.fullyScanned,
    'Labels not fully scanned in recorded observations: ' + summary.incomplete,
    'Labels without a recorded observation: ' + summary.unrecorded,
    'Recorded batches: ' + summary.recordedBatches + ' / ' + summary.totalBatches,
    'Fully scanned batches in separate observations: ' + summary.fullyScannedBatches,
    'Incomplete recorded batches: ' + summary.incompleteBatches,
    'Unrecorded batches: ' + summary.unrecordedBatches,
    'No combined match count, match locations or source snapshots are included.',
  ];
  let length = lines.join('\n').length;
  const append = (line: string) => {
    if (length + line.length + 1 > MAX_SCOPE_REPORT_UNITS - 100) return false;
    lines.push(line); length += line.length + 1; return true;
  };
  for (const batch of summary.batches) {
    if (!append('Batch ' + batch.index + ': ' + SEARCH_LEDGER_STATUS_LABELS[batch.status] +
      '; fully scanned ' + batch.fullyScanned + '; incomplete ' + batch.incomplete + '; unrecorded ' + batch.unrecorded)) {
      lines.push('Additional rows omitted from report due to size limit.'); break;
    }
    if (!includeLabels) continue;
    for (const label of batch.labels) {
      const row = batch.rows.find(item => item.name === label);
      const line = '  ' + JSON.stringify(label) + ' — ' + (row
        ? SEARCH_COVERAGE_LABELS[row.state] + ', ' + searchCoverageOrigin(row) : 'No observation');
      if (!append(line)) {
        lines.push('Additional rows omitted from report due to size limit.');
        return lines.join('\n');
      }
    }
  }
  return lines.join('\n');
}
