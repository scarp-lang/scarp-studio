import { sameProjectScope, MAX_SCOPE_REPORT_UNITS, type ProjectSearchScope } from './projectSearchScope';
import { validRelativeLabel } from './projectSearchComparison';
import { QUALITY_RULES, QUALITY_LABELS, type QualityRule } from './sourceQuality';
import type { ScarpTaskKind } from './commentTasks';
import {
  INSPECTION_TASK_KINDS, INSPECTION_STATES, INSPECTION_READ_LIMITS,
  MAX_INSPECTION_TASKS, MAX_INSPECTION_FINDINGS,
  type ProjectInspectionReport, type InspectionState, type InspectionOrigin, type InspectionMode,
} from './projectInspection';

export const MAX_INSPECTION_BASELINES = 8;
export const INSPECTION_COMPARISON_PAGE = 20;
type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };
const fail = (error: string): Result<never> => ({ ok: false, error });
function count(n: number, max = Number.MAX_SAFE_INTEGER) { return Number.isSafeInteger(n) && n >= 0 && n <= max; }
function taskCounts(): Record<ScarpTaskKind, number> {
  return Object.fromEntries(INSPECTION_TASK_KINDS.map(kind => [kind, 0])) as Record<ScarpTaskKind, number>;
}
function qualityCounts(): Record<QualityRule, number> {
  return Object.fromEntries(QUALITY_RULES.map(rule => [rule, 0])) as Record<QualityRule, number>;
}
export interface InspectionBaselineFile {
  readonly name: string;
  readonly state: InspectionState;
  readonly origin: InspectionOrigin;
  readonly lexicalComplete: boolean;
  readonly tasksComplete: boolean;
  readonly qualityComplete: boolean;
  readonly tasks: Readonly<Record<ScarpTaskKind, number>>;
  readonly quality: Readonly<Record<QualityRule, number>>;
}
export interface InspectionBaseline {
  readonly scope: ProjectSearchScope;
  readonly mode: InspectionMode;
  readonly selected: number;
  readonly deferred: number;
  readonly excluded: number;
  readonly withheld: number;
  readonly listingLimited: boolean;
  readonly complete: boolean;
  readonly files: readonly InspectionBaselineFile[];
}

/** Metadata-only capture. Task descriptions, owners, quality messages,
 * coordinates, native paths and edits never enter the baseline library.
 * Reject inconsistent evidence rather than using a partial count as exact.
 */
export function captureInspectionBaseline(report: ProjectInspectionReport): Result<InspectionBaseline> {
  if (!count(report.selected, INSPECTION_READ_LIMITS.files) || report.files.length !== report.selected ||
      !count(report.listed) || !count(report.excluded) || !count(report.deferred) || !count(report.withheld) ||
      report.listed !== report.selected + report.excluded + report.deferred + report.withheld ||
      report.tasks.length > MAX_INSPECTION_TASKS || report.findings.length > MAX_INSPECTION_FINDINGS ||
      (report.mode !== 'working' && report.mode !== 'saved') ||
      typeof report.listingLimited !== 'boolean' || typeof report.complete !== 'boolean') {
    return fail('Inspection evidence totals are inconsistent.');
  }
  const names = new Set<string>();
  const files: InspectionBaselineFile[] = [];
  for (const file of report.files) {
    if (!validRelativeLabel(file.name) || names.has(file.name) || !INSPECTION_STATES.includes(file.state) ||
        !['open-buffer','disk','none'].includes(file.origin) ||
        typeof file.lexicalComplete !== 'boolean' || typeof file.tasksComplete !== 'boolean' ||
        typeof file.qualityComplete !== 'boolean' ||
        !count(file.tasksObserved) || !count(file.tasksRetained, MAX_INSPECTION_TASKS) ||
        file.tasksRetained > file.tasksObserved || !count(file.findingsRetained, MAX_INSPECTION_FINDINGS)) {
      return fail('Inspection contains invalid file evidence.');
    }
    names.add(file.name);
    const observed = file.state === 'scanned' || file.state === 'partial';
    if ((observed && file.origin === 'none') ||
        (!observed && (file.lexicalComplete || file.tasksComplete || file.qualityComplete ||
          file.tasksRetained || file.findingsRetained || file.tasksObserved)) ||
        (file.tasksComplete && (!file.lexicalComplete || file.tasksObserved !== file.tasksRetained)) ||
        (file.state === 'scanned' && (!file.lexicalComplete || !file.tasksComplete || !file.qualityComplete)) ||
        (file.state === 'partial' && file.lexicalComplete && file.tasksComplete && file.qualityComplete)) {
      return fail('Inspection completeness flags contradict the file evidence.');
    }
    const tasks = taskCounts(), quality = qualityCounts();
    const taskRows = report.tasks.filter(task => task.source === file.name);
    const findingRows = report.findings.filter(finding => finding.source === file.name);
    if (taskRows.length !== file.tasksRetained || findingRows.length !== file.findingsRetained ||
        taskRows.some(task => !INSPECTION_TASK_KINDS.includes(task.kind)) ||
        findingRows.some(finding => !QUALITY_RULES.includes(finding.rule))) {
      return fail('Inspection file counts do not match the retained observations.');
    }
    for (const task of taskRows) tasks[task.kind]++;
    for (const finding of findingRows) quality[finding.rule]++;
    files.push(Object.freeze({
      name: file.name, state: file.state, origin: file.origin,
      lexicalComplete: file.lexicalComplete, tasksComplete: file.tasksComplete, qualityComplete: file.qualityComplete,
      tasks: Object.freeze(tasks), quality: Object.freeze(quality),
    }));
  }
  if (report.tasks.some(task => !names.has(task.source)) || report.findings.some(finding => !names.has(finding.source)) ||
      new Set(report.tasks.map(task => task.id)).size !== report.tasks.length ||
      new Set(report.findings.map(finding => finding.id)).size !== report.findings.length ||
      report.fullyInspected !== files.filter(file => file.state === 'scanned').length ||
      report.partial !== files.filter(file => file.state === 'partial').length ||
      report.unread !== files.length - report.fullyInspected - report.partial ||
      (report.complete && (report.status !== 'completed' || report.listingLimited ||
        report.deferred || report.withheld || report.partial || report.unread))) {
    return fail('Inspection coverage does not match retained evidence.');
  }
  for (const kind of INSPECTION_TASK_KINDS) {
    if (report.taskCounts[kind] !== files.reduce((sum, file) => sum + file.tasks[kind], 0)) return fail('Task totals are inconsistent.');
  }
  for (const rule of QUALITY_RULES) {
    if (report.qualityCounts[rule] !== files.reduce((sum, file) => sum + file.quality[rule], 0)) return fail('Quality totals are inconsistent.');
  }
  return { ok: true, value: Object.freeze({
    scope: Object.freeze({ directory: report.scope.directory, descendants: report.scope.descendants,
      filename: report.scope.filename, ...(report.scope.batch === undefined ? {} : { batch: report.scope.batch }) }),
    mode: report.mode, selected: report.selected, deferred: report.deferred, excluded: report.excluded,
    withheld: report.withheld, listingLimited: report.listingLimited, complete: report.complete,
    files: Object.freeze(files),
  }) };
}

export interface InspectionCountDelta {
  readonly earlier: number;
  readonly current: number;
  readonly delta: number;
}
function delta(earlier: number, current: number): InspectionCountDelta {
  return Object.freeze({ earlier, current, delta: current - earlier });
}
export interface InspectionComparisonRow {
  readonly name: string;
  readonly before: InspectionBaselineFile | null;
  readonly after: InspectionBaselineFile | null;
  readonly taskDelta: InspectionCountDelta | null;
  readonly qualityDelta: InspectionCountDelta | null;
  readonly originChanged: boolean;
  readonly taskChanges: Readonly<Record<ScarpTaskKind, InspectionCountDelta>> | null;
  readonly qualityChanges: Readonly<Record<QualityRule, InspectionCountDelta>> | null;
}
export interface InspectionComparison {
  readonly rows: readonly InspectionComparisonRow[];
  readonly earlierComplete: boolean;
  readonly currentComplete: boolean;
  readonly comparableTaskFiles: number;
  readonly comparableQualityFiles: number;
  readonly taskTotals: InspectionCountDelta | null;
  readonly qualityTotals: InspectionCountDelta | null;
  readonly taskRules: Readonly<Record<ScarpTaskKind, InspectionCountDelta>>;
  readonly qualityRules: Readonly<Record<QualityRule, InspectionCountDelta>>;
  readonly earlierOnly: number;
  readonly currentOnly: number;
  readonly originChanges: number;
}
const total = (counts: Readonly<Record<string, number>>) => Object.values(counts).reduce((sum, count) => sum + count, 0);
function countDeltas<K extends string>(keys: readonly K[], before: Readonly<Record<K, number>>, after: Readonly<Record<K, number>>) {
  return Object.freeze(Object.fromEntries(keys.map(key => [key, delta(before[key], after[key])])) as Record<K, InspectionCountDelta>);
}

/** Exact labels are paired only in compatible snapshot modes and scopes.
 * Task and quality completeness are independent: a truncated task list
 * cannot invalidate an otherwise complete quality observation, or vice versa.
 */
export function compareInspectionBaselines(before: InspectionBaseline, after: InspectionBaseline): Result<InspectionComparison> {
  if (before.mode !== after.mode) return fail('Use the same working-buffer or saved-disk mode.');
  if (!sameProjectScope(before.scope, after.scope)) return fail('Use the same directory, filename filter and batch selection.');
  const earlier = new Map(before.files.map(file => [file.name, file]));
  const current = new Map(after.files.map(file => [file.name, file]));
  const names = [...new Set([...earlier.keys(), ...current.keys()])].sort();
  const taskBefore = taskCounts(), taskAfter = taskCounts();
  const qualityBefore = qualityCounts(), qualityAfter = qualityCounts();
  let comparableTaskFiles = 0, comparableQualityFiles = 0;
  let earlierOnly = 0, currentOnly = 0, originChanges = 0;
  const rows = names.map(name => {
    const a = earlier.get(name) ?? null, b = current.get(name) ?? null;
    if (!a) currentOnly++;
    if (!b) earlierOnly++;
    const originChanged = Boolean(a && b && a.origin !== b.origin);
    if (originChanged) originChanges++;
    let taskDelta: InspectionCountDelta | null = null;
    let qualityDelta: InspectionCountDelta | null = null;
    let taskChanges: InspectionComparisonRow['taskChanges'] = null;
    let qualityChanges: InspectionComparisonRow['qualityChanges'] = null;
    if (a?.tasksComplete && b?.tasksComplete) {
      comparableTaskFiles++;
      taskDelta = delta(total(a.tasks), total(b.tasks));
      taskChanges = countDeltas(INSPECTION_TASK_KINDS, a.tasks, b.tasks);
      for (const kind of INSPECTION_TASK_KINDS) {
        taskBefore[kind] += a.tasks[kind]; taskAfter[kind] += b.tasks[kind];
      }
    }
    if (a?.qualityComplete && b?.qualityComplete) {
      comparableQualityFiles++;
      qualityDelta = delta(total(a.quality), total(b.quality));
      qualityChanges = countDeltas(QUALITY_RULES, a.quality, b.quality);
      for (const rule of QUALITY_RULES) {
        qualityBefore[rule] += a.quality[rule]; qualityAfter[rule] += b.quality[rule];
      }
    }
    return Object.freeze({ name, before: a, after: b, taskDelta, qualityDelta, originChanged, taskChanges, qualityChanges });
  });
  return { ok: true, value: Object.freeze({
    rows: Object.freeze(rows), earlierComplete: before.complete, currentComplete: after.complete,
    comparableTaskFiles, comparableQualityFiles,
    taskTotals: comparableTaskFiles ? delta(total(taskBefore), total(taskAfter)) : null,
    qualityTotals: comparableQualityFiles ? delta(total(qualityBefore), total(qualityAfter)) : null,
    taskRules: countDeltas(INSPECTION_TASK_KINDS, taskBefore, taskAfter),
    qualityRules: countDeltas(QUALITY_RULES, qualityBefore, qualityAfter),
    earlierOnly, currentOnly, originChanges,
  }) };
}

export type InspectionComparisonFilter = 'all' | 'changed' | 'uncertain' | 'earlier-only' | 'current-only';
function changed(row: InspectionComparisonRow): boolean {
  return row.originChanged || (row.taskChanges !== null && Object.values(row.taskChanges).some(change => change.delta !== 0)) ||
    (row.qualityChanges !== null && Object.values(row.qualityChanges).some(change => change.delta !== 0));
}
export function filterInspectionComparison(data: InspectionComparison, filter: InspectionComparisonFilter) {
  return data.rows.filter(row => filter === 'all' || (filter === 'changed' && changed(row)) ||
    (filter === 'uncertain' && (row.taskDelta === null || row.qualityDelta === null)) ||
    (filter === 'earlier-only' && row.after === null) || (filter === 'current-only' && row.before === null));
}
export function pageInspectionComparison(rows: readonly InspectionComparisonRow[], requested: number) {
  const pages = Math.max(1, Math.ceil(rows.length / INSPECTION_COMPARISON_PAGE));
  const page = Math.min(pages, Math.max(1, Number.isSafeInteger(requested) ? requested : 1));
  return { page, pages, rows: rows.slice((page - 1) * INSPECTION_COMPARISON_PAGE, page * INSPECTION_COMPARISON_PAGE) };
}
export function inspectionDeltaLabel(change: InspectionCountDelta | null): string {
  return change ? change.earlier + ' → ' + change.current + ' (' + (change.delta > 0 ? '+' : '') + change.delta + ')' : 'Not comparable';
}
export function inspectionComparisonReport(data: InspectionComparison, includeLabels = false): string {
  const lines = [
    'Scarp Studio — source inspection comparison',
    'Exact relative labels paired; no filesystem identity or semantic change asserted.',
    'Earlier / current scope coverage: ' + (data.earlierComplete ? 'complete' : 'incomplete') + ' / ' +
      (data.currentComplete ? 'complete' : 'incomplete'),
    'Comparable task labels: ' + data.comparableTaskFiles,
    'Task count change: ' + inspectionDeltaLabel(data.taskTotals),
    'Comparable quality labels: ' + data.comparableQualityFiles,
    'Quality count change: ' + inspectionDeltaLabel(data.qualityTotals),
    'Earlier-only / current-only labels: ' + data.earlierOnly + ' / ' + data.currentOnly,
    'Source origin changes: ' + data.originChanges,
    'A lower observed count does not establish that particular issues were resolved.',
    'Task kind changes over comparable task labels:',
    ...INSPECTION_TASK_KINDS.map(kind => kind + ': ' + inspectionDeltaLabel(data.comparableTaskFiles ? data.taskRules[kind] : null)),
    'Quality rule changes over comparable quality labels:',
    ...QUALITY_RULES.map(rule => QUALITY_LABELS[rule] + ': ' + inspectionDeltaLabel(data.comparableQualityFiles ? data.qualityRules[rule] : null)),
  ];
  if (includeLabels) {
    let units = lines.join('\n').length;
    for (const row of data.rows) {
      const line = JSON.stringify(row.name) + ' — tasks: ' + inspectionDeltaLabel(row.taskDelta) +
        '; quality: ' + inspectionDeltaLabel(row.qualityDelta) +
        (row.originChanged ? '; origin changed' : '') + (!row.before ? '; current selection only' : !row.after ? '; earlier selection only' : '');
      if (units + line.length + 1 > MAX_SCOPE_REPORT_UNITS - 100) {
        lines.push('Additional labels omitted due to report size limit.'); break;
      }
      units += line.length + 1;
      lines.push(line);
    }
  }
  return lines.join('\n');
}
