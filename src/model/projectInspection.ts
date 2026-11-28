import { sameFilePath, isDirty, type StudioDocument } from './documents';
import { buildProjectScopeInventory, planScopedProjectSearch, sameProjectScope,
  MAX_SCOPE_REPORT_UNITS, type ProjectSearchScope } from './projectSearchScope';
import { selectProjectSearchSources, MAX_PROJECT_SEARCH_FILES, MAX_PROJECT_SEARCH_READ_BYTES,
  MAX_PROJECT_SEARCH_TOTAL_BYTES, type ProjectSearchSource } from './projectSearch';
import { findScarpCommentTasks, type ScarpTaskKind, type ScarpTaskPriority } from './commentTasks';
import { analyzeQualityFile, QUALITY_RULES, QUALITY_LABELS, type QualityRule, type QualitySeverity } from './sourceQuality';
import { scanScarpSource } from '../language/sourceLex';
import { assertWellFormedUtf16, utf8ByteLength } from './utf8Text';
import { validRelativeLabel } from './projectSearchComparison';

export const MAX_INSPECTION_TASKS = 300;
export const MAX_INSPECTION_FINDINGS = 600;
export const INSPECTION_PAGE_SIZE = 20;
export const INSPECTION_TASK_KINDS = ['TODO', 'FIXME', 'BUG', 'REVIEW', 'NOTE', 'HACK', 'XXX'] as const;
export type InspectionMode = 'working' | 'saved';
export type InspectionResult<T> = { readonly ok: true; readonly value: T } |
  { readonly ok: false; readonly error: string };
const fail = (error: string): InspectionResult<never> => ({ ok: false, error });
export interface InspectionSettings {
  readonly scope: ProjectSearchScope;
  readonly mode: InspectionMode;
  readonly listingLimited: boolean;
}
export interface ProjectInspectionPlan {
  readonly settings: InspectionSettings;
  readonly sources: readonly ProjectSearchSource[];
  readonly listed: number;
  readonly selected: number;
  readonly excluded: number;
  readonly deferred: number;
  readonly withheld: number;
}

/** Preview only the already-authorized Explorer entries. For conventional
 * scope, use the same fair directory ordering as search. Dirty buffers do
 * not alter selection membership; mode only changes how content is obtained.
 */
export function prepareProjectInspection(listed: readonly ProjectSearchSource[], settings: InspectionSettings):
  InspectionResult<ProjectInspectionPlan> {
  if (settings.mode !== 'working' && settings.mode !== 'saved') return fail('Choose a source snapshot mode.');
  if (typeof settings.listingLimited !== 'boolean') return fail('Invalid listing coverage state.');
  const scoped = planScopedProjectSearch(buildProjectScopeInventory(listed), settings.scope);
  if (!scoped.ok) return scoped;
  const p = scoped.value;
  const sources = selectProjectSearchSources(p.sources);
  if (!sources.length) return fail('No eligible listed sources match the inspection scope.');
  if (!sources.every(source => validRelativeLabel(source.name))) return fail('The scope includes labels that cannot be safely reviewed.');
  const selected = sources.length;
  return { ok: true, value: Object.freeze({
    settings: Object.freeze({ scope: Object.freeze({ ...settings.scope }), mode: settings.mode,
      listingLimited: settings.listingLimited }),
    sources: Object.freeze(sources.map(source => Object.freeze({ name: source.name, path: source.path }))),
    listed: p.listed, selected, excluded: p.excluded,
    deferred: p.sources.length - selected + (p.batch?.deferred ?? 0),
    withheld: p.invalid + p.ambiguous + p.uninspected,
  }) };
}

export function confirmProjectInspection(plan: ProjectInspectionPlan, listed: readonly ProjectSearchSource[],
  settings: InspectionSettings): InspectionResult<ProjectInspectionPlan> {
  if (!sameProjectScope(plan.settings.scope, settings.scope) || plan.settings.mode !== settings.mode ||
      plan.settings.listingLimited !== settings.listingLimited) return fail('Inspection settings changed. Review the scope again.');
  const checked = prepareProjectInspection(listed, settings);
  if (!checked.ok) return checked;
  const current = checked.value;
  if (current.listed !== plan.listed || current.selected !== plan.selected || current.excluded !== plan.excluded ||
      current.deferred !== plan.deferred || current.withheld !== plan.withheld ||
      current.sources.some((source, index) => {
        const prior = plan.sources[index];
        return source.name !== prior?.name || source.path !== prior.path;
      })) return fail('The reviewed source listing changed. Review the scope again.');
  return checked;
}

export const INSPECTION_STATES = ['scanned', 'partial', 'read-failed', 'byte-limit', 'ambiguous-buffer', 'not-observed'] as const;
export type InspectionState = typeof INSPECTION_STATES[number];
export type InspectionOrigin = 'open-buffer' | 'disk' | 'none';
export const INSPECTION_STATE_LABELS: Readonly<Record<InspectionState, string>> = Object.freeze({
  scanned: 'Fully inspected', partial: 'Partial inspection', 'read-failed': 'Read unavailable',
  'byte-limit': 'Byte budget', 'ambiguous-buffer': 'Ambiguous open buffer', 'not-observed': 'No completed observation',
});
export const INSPECTION_ORIGIN_LABELS: Readonly<Record<InspectionOrigin, string>> = Object.freeze({
  'open-buffer': 'Working buffer', disk: 'Disk read', none: 'Not read',
});

export interface InspectionTask {
  readonly id: string;
  readonly source: string;
  readonly kind: ScarpTaskKind;
  readonly priority: ScarpTaskPriority;
  readonly description: string;
  readonly owner: string | null;
  readonly line: number;
  readonly column: number;
}
export interface InspectionFinding {
  readonly id: string;
  readonly source: string;
  readonly rule: QualityRule;
  readonly severity: QualitySeverity;
  readonly line: number;
  readonly column: number;
  readonly message: string;
}
export interface InspectionFile {
  readonly name: string;
  readonly state: InspectionState;
  readonly origin: InspectionOrigin;
  readonly dirtyTab: boolean;
  readonly bytes: number | null;
  readonly lexicalComplete: boolean;
  readonly tasksComplete: boolean;
  readonly qualityComplete: boolean;
  readonly tasksObserved: number;
  readonly tasksRetained: number;
  readonly findingsRetained: number;
  readonly lexicalLines: number | null;
  readonly lexicalTokens: number | null;
}
export interface ProjectInspectionReport {
  readonly status: 'completed' | 'cancelled';
  readonly mode: InspectionMode;
  readonly scope: ProjectSearchScope;
  readonly listed: number;
  readonly selected: number;
  readonly deferred: number;
  readonly excluded: number;
  readonly withheld: number;
  readonly listingLimited: boolean;
  readonly bytes: number;
  readonly files: readonly InspectionFile[];
  readonly tasks: readonly InspectionTask[];
  readonly findings: readonly InspectionFinding[];
  readonly taskCounts: Readonly<Record<ScarpTaskKind, number>>;
  readonly qualityCounts: Readonly<Record<QualityRule, number>>;
  readonly fullyInspected: number;
  readonly partial: number;
  readonly unread: number;
  readonly complete: boolean;
}
export interface InspectionProgress {
  readonly observed: number;
  readonly total: number;
}
export interface InspectionControl {
  readonly isCurrent: () => boolean;
  readonly isCancelled: () => boolean;
  readonly onProgress?: (progress: InspectionProgress) => void;
}
export type InspectionExecution = { readonly kind: 'report'; readonly report: ProjectInspectionReport } |
  { readonly kind: 'invalidated' };

function unavailable(name: string, state: InspectionState, origin: InspectionOrigin,
  dirtyTab: boolean): InspectionFile {
  return Object.freeze({ name, state, origin, dirtyTab, bytes: null,
    lexicalComplete: false, tasksComplete: false, qualityComplete: false,
    tasksObserved: 0, tasksRetained: 0, findingsRetained: 0,
    lexicalLines: null, lexicalTokens: null });
}

/** Keep only bounded lexical evidence and display metadata; never retain a
 * source snapshot, native path, document id, cleanup edit or raw read error.
 * Each file is read once, then inspected locally without further native IO.
 */
export async function executeProjectInspection(
  plan: ProjectInspectionPlan, documents: readonly StudioDocument[],
  read: (path: string, maxBytes: number) => Promise<string>, control: InspectionControl,
): Promise<InspectionExecution> {
  const files: InspectionFile[] = [];
  const tasks: InspectionTask[] = [];
  const findings: InspectionFinding[] = [];
  let bytes = 0;
  const stopped = () => !control.isCurrent() || control.isCancelled();
  for (const source of plan.sources) {
    if (stopped()) break;
    control.onProgress?.({ observed: files.length, total: plan.selected });
    if (stopped()) break;
    const matching = documents.filter(document => document.path !== null && sameFilePath(document.path, source.path));
    const dirtyTab = matching.some(isDirty);
    if (plan.settings.mode === 'working' && matching.length > 1) {
      files.push(unavailable(source.name, 'ambiguous-buffer', 'none', dirtyTab));
      continue;
    }
    const open = plan.settings.mode === 'working' ? matching[0] : undefined;
    const origin: InspectionOrigin = open ? 'open-buffer' : 'disk';
    const budget = Math.min(MAX_PROJECT_SEARCH_READ_BYTES, MAX_PROJECT_SEARCH_TOTAL_BYTES - bytes);
    if (budget <= 0) {
      files.push(unavailable(source.name, 'byte-limit', 'none', dirtyTab));
      continue;
    }
    let content: string;
    try {
      content = open ? open.content : await read(source.path, budget);
      if (stopped()) break;
      if (typeof content !== 'string') throw Error('Invalid source text');
      assertWellFormedUtf16(content, 'Inspected source');
    } catch {
      if (stopped()) break;
      files.push(unavailable(source.name, 'read-failed', origin, dirtyTab));
      continue;
    }
    const size = content.length <= budget ? utf8ByteLength(content) : budget + 1;
    if (size > budget) {
      files.push(unavailable(source.name, 'byte-limit', origin, dirtyTab));
      continue;
    }
    bytes += size;
    const lex = scanScarpSource(content);
    const lexicalComplete = lex.complete && !lex.issues.some(issue =>
      issue.kind === 'unterminated-string' || issue.kind === 'invalid-control');
    const taskScan = findScarpCommentTasks(content, lex);
    const quality = analyzeQualityFile({
      id: 'inspection-source', name: source.name, path: null, content, savedContent: content, revision: 0,
    });
    const keptTasks = taskScan.tasks.slice(0, Math.max(0, MAX_INSPECTION_TASKS - tasks.length));
    const keptFindings = quality.findings.slice(0, Math.max(0, MAX_INSPECTION_FINDINGS - findings.length));
    for (const task of keptTasks) tasks.push(Object.freeze({
      id: JSON.stringify([source.name, task.kind, task.offset]),
      source: source.name, kind: task.kind, priority: task.priority, description: task.description,
      owner: task.owner, line: task.line, column: task.column,
    }));
    for (const finding of keptFindings) findings.push(Object.freeze({
      id: JSON.stringify([source.name, finding.rule, finding.offset]),
      source: source.name, rule: finding.rule, severity: finding.severity,
      line: finding.line, column: finding.column, message: finding.message,
    }));
    const tasksComplete = lexicalComplete && taskScan.complete && keptTasks.length === taskScan.tasks.length &&
      !lex.tokens.some(token => token.kind === 'comment' && token.previewTruncated);
    const qualityComplete = quality.complete && keptFindings.length === quality.findings.length;
    const fully = lexicalComplete && tasksComplete && qualityComplete;
    files.push(Object.freeze({
      name: source.name, state: fully ? 'scanned' : 'partial', origin, dirtyTab, bytes: size,
      lexicalComplete, tasksComplete, qualityComplete, tasksObserved: taskScan.totalFound,
      tasksRetained: keptTasks.length, findingsRetained: keptFindings.length,
      lexicalLines: lex.complete ? lex.lines : null, lexicalTokens: lex.tokens.length,
    }));
  }
  if (!control.isCurrent()) return { kind: 'invalidated' };
  const observed = files.length;
  for (const source of plan.sources.slice(observed)) {
    files.push(unavailable(source.name, 'not-observed', 'none', false));
  }
  control.onProgress?.({ observed, total: plan.selected });
  if (!control.isCurrent()) return { kind: 'invalidated' };
  const taskCounts = Object.fromEntries(INSPECTION_TASK_KINDS.map(kind => [kind, 0])) as Record<ScarpTaskKind, number>;
  for (const task of tasks) taskCounts[task.kind]++;
  const qualityCounts = Object.fromEntries(QUALITY_RULES.map(rule => [rule, 0])) as Record<QualityRule, number>;
  for (const finding of findings) qualityCounts[finding.rule]++;
  const fullyInspected = files.filter(file => file.state === 'scanned').length;
  const partial = files.filter(file => file.state === 'partial').length;
  const unread = files.length - fullyInspected - partial;
  const status = control.isCancelled() ? 'cancelled' : 'completed';
  return { kind: 'report', report: Object.freeze({
    status, mode: plan.settings.mode, scope: plan.settings.scope, listed: plan.listed, selected: plan.selected,
    deferred: plan.deferred, excluded: plan.excluded, withheld: plan.withheld,
    listingLimited: plan.settings.listingLimited, bytes,
    files: Object.freeze(files), tasks: Object.freeze(tasks), findings: Object.freeze(findings),
    taskCounts: Object.freeze(taskCounts), qualityCounts: Object.freeze(qualityCounts),
    fullyInspected, partial, unread,
    complete: status === 'completed' && !plan.settings.listingLimited &&
      plan.deferred === 0 && plan.withheld === 0 && partial === 0 && unread === 0,
  }) };
}

export interface InspectionFilter {
  readonly query: string;
  readonly source: string;
  readonly taskKind: ScarpTaskKind | 'all';
  readonly priority: ScarpTaskPriority | 'all';
  readonly qualityRule: QualityRule | 'all';
  readonly severity: QualitySeverity | 'all';
  readonly fileState: InspectionState | 'all';
  readonly order: 'source' | 'priority';
}
export const DEFAULT_INSPECTION_FILTER: InspectionFilter = Object.freeze({
  query: '', source: '', taskKind: 'all', priority: 'all', qualityRule: 'all',
  severity: 'all', fileState: 'all', order: 'source',
});
const priorityOrder: Readonly<Record<ScarpTaskPriority, number>> = { high: 0, normal: 1, low: 2 };
function sortSource(a: { source: string; line: number; column: number }, b: { source: string; line: number; column: number }) {
  return (a.source < b.source ? -1 : a.source > b.source ? 1 : 0) || a.line - b.line || a.column - b.column;
}
export function filterInspection(report: ProjectInspectionReport, filter: InspectionFilter) {
  if (filter.query.length > 120 || /[\r\n]/.test(filter.query)) return { files: [], tasks: [], findings: [] };
  const query = filter.query.toLowerCase();
  const sourceMatch = (source: string) => !filter.source || source === filter.source;
  const contains = (value: string) => !query || value.toLowerCase().includes(query);
  const files = report.files.filter(file => sourceMatch(file.name) &&
    (filter.fileState === 'all' || file.state === filter.fileState) && contains(file.name));
  const tasks = report.tasks.filter(task => sourceMatch(task.source) &&
    (filter.taskKind === 'all' || task.kind === filter.taskKind) &&
    (filter.priority === 'all' || task.priority === filter.priority) &&
    contains([task.source, task.kind, task.description, task.owner ?? ''].join(' ')))
    .sort((a, b) => (filter.order === 'priority' ? priorityOrder[a.priority] - priorityOrder[b.priority] : 0) || sortSource(a, b));
  const findings = report.findings.filter(finding => sourceMatch(finding.source) &&
    (filter.qualityRule === 'all' || finding.rule === filter.qualityRule) &&
    (filter.severity === 'all' || finding.severity === filter.severity) &&
    contains([finding.source, QUALITY_LABELS[finding.rule], finding.message].join(' ')))
    .sort((a, b) => (filter.order === 'priority' ? Number(a.severity === 'style') - Number(b.severity === 'style') : 0) || sortSource(a, b));
  return { files, tasks, findings };
}

export function pageInspection<T>(rows: readonly T[], requested: number) {
  const pages = Math.max(1, Math.ceil(rows.length / INSPECTION_PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number.isSafeInteger(requested) ? requested : 1));
  return { pages, page, rows: rows.slice((page - 1) * INSPECTION_PAGE_SIZE, page * INSPECTION_PAGE_SIZE) };
}

/** Opening a file by label means opening the current unique listed source,
 * never jumping to an old coordinate or treating the report as a path grant.
 */
export function resolveInspectionSource(report: ProjectInspectionReport, label: string,
  listed: readonly ProjectSearchSource[]): string | null {
  if (!report.files.some(file => file.name === label) || !validRelativeLabel(label)) return null;
  const candidates = buildProjectScopeInventory(listed).sources.filter(source => source.name === label);
  return candidates.length === 1 ? candidates[0].path : null;
}

export function inspectionReportText(report: ProjectInspectionReport, includeLabels = false): string {
  const lines = [
    'Scarp Studio — listed source inspection',
    'Historical lexical observations, not compiler diagnostics or an atomic workspace snapshot.',
    'Status: ' + report.status,
    'Snapshot mode: ' + report.mode,
    'Listing known limited: ' + (report.listingLimited ? 'yes' : 'no'),
    'Listed / selected: ' + report.listed + ' / ' + report.selected,
    'Excluded / deferred / withheld: ' + report.excluded + ' / ' + report.deferred + ' / ' + report.withheld,
    'Fully inspected / partial / unread: ' + report.fullyInspected + ' / ' + report.partial + ' / ' + report.unread,
    'UTF-8 bytes analyzed: ' + report.bytes,
    'Coverage: ' + (report.complete ? 'complete for chosen listed scope' : 'incomplete'),
    'Retained comment tasks: ' + report.tasks.length,
    ...INSPECTION_TASK_KINDS.map(kind => kind + ': ' + report.taskCounts[kind]),
    'Retained quality findings: ' + report.findings.length,
    ...QUALITY_RULES.map(rule => QUALITY_LABELS[rule] + ': ' + report.qualityCounts[rule]),
    'Counts describe retained observations. No task text, owner names, source contents, edit instructions or native paths included.',
  ];
  if (includeLabels) {
    let units = lines.join('\n').length;
    for (const file of report.files) {
      const line = JSON.stringify(file.name) + ' — ' + INSPECTION_STATE_LABELS[file.state] +
        '; ' + INSPECTION_ORIGIN_LABELS[file.origin] + '; tasks retained: ' + file.tasksRetained +
        '; findings retained: ' + file.findingsRetained;
      if (units + line.length + 1 > MAX_SCOPE_REPORT_UNITS - 100) {
        lines.push('Additional file labels omitted due to report size limit.');
        break;
      }
      units += line.length + 1;
      lines.push(line);
    }
  }
  return lines.join('\n');
}
export const INSPECTION_READ_LIMITS = Object.freeze({
  files: MAX_PROJECT_SEARCH_FILES, fileBytes: MAX_PROJECT_SEARCH_READ_BYTES, totalBytes: MAX_PROJECT_SEARCH_TOTAL_BYTES,
});
