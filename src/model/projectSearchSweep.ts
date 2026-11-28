import { sameFilePath, type StudioDocument } from './documents';
import {
  searchListedProjectSources, MAX_PROJECT_SEARCH_TOTAL_BYTES, type ProjectSearchSource,
} from './projectSearch';
import {
  buildProjectScopeInventory, planScopedProjectSearch, summarizeScopedSearch,
  PROJECT_SEARCH_BATCH_SIZE, SEARCH_COVERAGE_LABELS, searchCoverageOrigin,
  MAX_SCOPE_REPORT_UNITS, type ScopedProjectSearchPlan, type ScopedFileCoverageRow,
} from './projectSearchScope';
import {
  validateProjectSearchSettings, sameProjectSearchSettings, type ProjectSearchSettings,
} from './projectSearchPresets';
import { validRelativeLabel } from './projectSearchComparison';

export const MAX_SWEEP_BATCHES = 12;
export const MAX_SWEEP_FILES = MAX_SWEEP_BATCHES * PROJECT_SEARCH_BATCH_SIZE;
export const MAX_SWEEP_BYTES = MAX_SWEEP_BATCHES * MAX_PROJECT_SEARCH_TOTAL_BYTES;

export type SweepResult<T> = { readonly ok: true; readonly value: T } |
  { readonly ok: false; readonly error: string };
const fail = (error: string): SweepResult<never> => ({ ok: false, error });
export interface SweepWindow {
  readonly first: number;
  readonly last: number;
}
export interface SearchSweepPlan {
  readonly settings: ProjectSearchSettings;
  readonly window: SweepWindow;
  readonly totalBatches: number;
  readonly totalEligible: number;
  readonly selected: number;
  readonly excluded: number;
  readonly withheld: number;
  readonly listed: number;
  readonly batches: readonly ScopedProjectSearchPlan[];
}

/** A sweep is an explicit window of consecutive numbered batches, rather
 * than an unbounded crawl. Preserve exact listing paths only in the
 * transient plan; results cannot be used as native navigation authority.
 */
export function prepareSearchSweep(
  listed: readonly ProjectSearchSource[], settings: ProjectSearchSettings, window: SweepWindow,
): SweepResult<SearchSweepPlan> {
  const valid = validateProjectSearchSettings(settings);
  if (!valid.ok) return valid;
  const normalized = valid.value;
  const inventory = buildProjectScopeInventory(listed);
  const baseScope = { ...normalized.scope, batch: undefined };
  const base = planScopedProjectSearch(inventory, baseScope);
  if (!base.ok) return base;
  const candidates = base.value.sources;
  const totalBatches = Math.ceil(candidates.length / PROJECT_SEARCH_BATCH_SIZE);
  if (!totalBatches) return fail('No eligible sources match this search scope.');
  if (!Number.isSafeInteger(window.first) || !Number.isSafeInteger(window.last) ||
      window.first < 1 || window.last < window.first || window.last > totalBatches ||
      window.last - window.first + 1 > MAX_SWEEP_BATCHES) {
    return fail('Choose an available consecutive range of at most ' + MAX_SWEEP_BATCHES + ' batches.');
  }
  const batches: ScopedProjectSearchPlan[] = [];
  for (let index = window.first; index <= window.last; index++) {
    const plan = planScopedProjectSearch(inventory, { ...baseScope, batch: index });
    if (!plan.ok) return plan;
    if (!plan.value.sources.every(source => validRelativeLabel(source.name))) {
      return fail('The sweep contains source labels that cannot be safely reviewed.');
    }
    batches.push(plan.value);
  }
  return { ok: true, value: Object.freeze({
    settings: normalized, window: Object.freeze({ first: window.first, last: window.last }),
    totalBatches, totalEligible: candidates.length,
    selected: batches.reduce((total, batch) => total + batch.sources.length, 0),
    excluded: base.value.excluded, listed: base.value.listed,
    withheld: base.value.invalid + base.value.ambiguous + base.value.uninspected,
    batches: Object.freeze(batches),
  }) };
}

/** Rebuild from live selection and require exact membership, counts and path
 * spelling before authorizing any read. A saved preset is not a path grant.
 */
export function confirmSearchSweep(
  plan: SearchSweepPlan, listed: readonly ProjectSearchSource[], settings: ProjectSearchSettings,
): SweepResult<SearchSweepPlan> {
  if (!sameProjectSearchSettings(plan.settings, settings)) {
    return fail('Search settings changed. Review the sweep again.');
  }
  const rebuilt = prepareSearchSweep(listed, settings, plan.window);
  if (!rebuilt.ok) return rebuilt;
  const current = rebuilt.value;
  if (current.totalBatches !== plan.totalBatches || current.totalEligible !== plan.totalEligible ||
      current.selected !== plan.selected || current.excluded !== plan.excluded ||
      current.withheld !== plan.withheld || current.listed !== plan.listed ||
      current.batches.length !== plan.batches.length ||
      current.batches.some((batch, index) => {
        const reviewed = plan.batches[index];
        return batch.sources.length !== reviewed.sources.length ||
          batch.sources.some((source, offset) => {
            const earlier = reviewed.sources[offset];
            return source.name !== earlier.name || source.path !== earlier.path;
          });
      })) return fail('The reviewed source listing changed. Review the sweep again.');
  return rebuilt;
}

export type SweepStatus = 'completed' | 'cancelled' | 'failed';
export interface SweepBatchEvidence {
  readonly index: number;
  readonly rows: readonly ScopedFileCoverageRow[];
  readonly fullyScanned: number;
  readonly skipped: number;
  readonly displayed: number;
}
export interface SweepProgress {
  readonly finishedBatches: number;
  readonly totalBatches: number;
  readonly currentBatch: number | null;
}
export interface SearchSweepReport {
  readonly status: SweepStatus;
  readonly firstBatch: number;
  readonly lastBatch: number;
  readonly totalBatches: number;
  readonly selected: number;
  readonly deferred: number;
  readonly excluded: number;
  readonly withheld: number;
  readonly listed: number;
  readonly fullyScanned: number;
  readonly incomplete: number;
  readonly unobserved: number;
  readonly batches: readonly SweepBatchEvidence[];
}
export interface SweepControl {
  /** False means the workspace, settings or editor generation is invalid. */
  readonly isCurrent: () => boolean;
  /** Explicit user cancellation can retain already completed batch evidence. */
  readonly isCancelled: () => boolean;
  readonly onProgress?: (progress: SweepProgress) => void;
  readonly yieldBetweenFiles?: () => Promise<void>;
}
function report(
  plan: SearchSweepPlan, batches: readonly SweepBatchEvidence[], status: SweepStatus,
): SearchSweepReport {
  const fullyScanned = batches.reduce((sum, batch) => sum + batch.fullyScanned, 0);
  const incomplete = batches.reduce((sum, batch) => sum + batch.skipped, 0);
  return Object.freeze({
    status, firstBatch: plan.window.first, lastBatch: plan.window.last,
    totalBatches: plan.totalBatches, selected: plan.selected,
    deferred: plan.totalEligible - plan.selected,
    excluded: plan.excluded, withheld: plan.withheld, listed: plan.listed,
    fullyScanned, incomplete, unobserved: plan.selected - fullyScanned - incomplete,
    batches: Object.freeze([...batches]),
  });
}

export type SweepExecution = { readonly kind: 'report'; readonly report: SearchSweepReport } |
  { readonly kind: 'invalidated' };

/** Each batch uses the existing bounded reader and exact editor snapshot.
 * Drop all source snapshots and hit objects after each batch, retaining only
 * coverage metadata. Disk reads are sequential, not an atomic snapshot.
 */
export async function executeSearchSweep(
  plan: SearchSweepPlan, documents: readonly StudioDocument[],
  read: (path: string, maxBytes: number) => Promise<string>, control: SweepControl,
): Promise<SweepExecution> {
  const evidence: SweepBatchEvidence[] = [];
  const current = () => control.isCurrent() && !control.isCancelled();
  const finish = (status: SweepStatus): SweepExecution => {
    if (!control.isCurrent()) return { kind: 'invalidated' };
    control.onProgress?.({ finishedBatches: evidence.length, totalBatches: plan.batches.length, currentBatch: null });
    if (!control.isCurrent()) return { kind: 'invalidated' };
    return { kind: 'report', report: report(plan, evidence, status) };
  };
  for (const batch of plan.batches) {
    if (!control.isCurrent()) return { kind: 'invalidated' };
    if (control.isCancelled()) return finish('cancelled');
    control.onProgress?.({ finishedBatches: evidence.length, totalBatches: plan.batches.length, currentBatch: batch.batch!.index });
    try {
      // Check the exact planned membership at the adapter boundary too.
      const result = await searchListedProjectSources(
        batch.sources, documents, plan.settings.query, plan.settings.options,
        async (path, maxBytes) => {
          if (!current() || !batch.sources.some(source => sameFilePath(source.path, path))) {
            throw Error('Search sweep source authorization changed.');
          }
          return read(path, maxBytes);
        },
        current,
        control.yieldBetweenFiles,
      );
      if (!control.isCurrent()) return { kind: 'invalidated' };
      if (control.isCancelled()) return finish('cancelled');
      if (!result) return finish('failed');
      const summary = summarizeScopedSearch(batch, result);
      if (!summary.ok || !summary.value.fileCoverage) return finish('failed');
      evidence.push(Object.freeze({
        index: batch.batch!.index,
        rows: Object.freeze(summary.value.fileCoverage.map(row => Object.freeze({
          name: row.name, state: row.state, origin: row.origin, hits: row.hits,
        }))),
        fullyScanned: summary.value.searched, skipped: summary.value.skipped,
        displayed: summary.value.hits,
      }));
    } catch {
      if (!control.isCurrent()) return { kind: 'invalidated' };
      return finish(control.isCancelled() ? 'cancelled' : 'failed');
    }
  }
  return finish('completed');
}

export type SweepRowFilter = 'all' | 'scanned' | 'incomplete' | 'matched';
export interface SweepRow {
  readonly batch: number;
  readonly evidence: ScopedFileCoverageRow;
}
export function sweepRows(report: SearchSweepReport, filter: SweepRowFilter): readonly SweepRow[] {
  return report.batches.flatMap(batch => batch.rows
    .filter(row => filter === 'all' || (filter === 'scanned' && row.state === 'scanned') ||
      (filter === 'incomplete' && row.state !== 'scanned') ||
      (filter === 'matched' && row.hits > 0))
    .map(row => ({ batch: batch.index, evidence: row })));
}
export const SWEEP_PAGE_SIZE = 15;
export function pageSweepRows(rows: readonly SweepRow[], requested: number) {
  const pages = Math.max(1, Math.ceil(rows.length / SWEEP_PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number.isSafeInteger(requested) ? requested : 1));
  return { page, pages, rows: rows.slice((page - 1) * SWEEP_PAGE_SIZE, page * SWEEP_PAGE_SIZE) };
}
export function formatSearchSweepReport(data: SearchSweepReport, includeLabels = false): string {
  const lines = [
    'Scarp Studio — reviewed search sweep',
    'Status: ' + data.status,
    'Selected batch range: ' + data.firstBatch + '–' + data.lastBatch + ' of ' + data.totalBatches,
    'Completed batch observations: ' + data.batches.length,
    'Listed sources: ' + data.listed,
    'Selected labels: ' + data.selected,
    'Deferred outside the selected range: ' + data.deferred,
    'Excluded by scope: ' + data.excluded,
    'Withheld listing entries: ' + data.withheld,
    'Fully scanned in separate batch observations: ' + data.fullyScanned,
    'Recorded but not fully scanned: ' + data.incomplete,
    'Without completed batch evidence: ' + data.unobserved,
    'Disk observations are sequential, not an atomic or current workspace snapshot.',
    'Displayed counts are per batch; no combined match list or replacement authority is retained.',
  ];
  let units = lines.join('\n').length;
  const append = (line: string) => {
    if (units + line.length + 1 > MAX_SCOPE_REPORT_UNITS - 100) return false;
    lines.push(line);
    units += line.length + 1;
    return true;
  };
  for (const batch of data.batches) {
    if (!append('Batch ' + batch.index + ': ' + batch.fullyScanned + ' fully scanned; ' +
      batch.skipped + ' incomplete; ' + batch.displayed + ' displayed matches')) break;
    if (!includeLabels) continue;
    for (const row of batch.rows) {
      if (!append(JSON.stringify(row.name) + ' — ' + SEARCH_COVERAGE_LABELS[row.state] +
        '; ' + searchCoverageOrigin(row) + '; displayed matches: ' + row.hits)) {
        lines.push('Additional labels omitted due to report size limit.');
        return lines.join('\n');
      }
    }
  }
  return lines.join('\n');
}
