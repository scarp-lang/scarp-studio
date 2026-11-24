import { scanScarpSource } from '../language/sourceLex';
import { isDirty, isScarpPath, sameFilePath, type StudioDocument } from './documents';
import { safeRelativeScarpSourceName } from './folderListing';
import { summarizeScarpSource } from './sourceSummary';
import { findScarpCommentTasks, type ScarpCommentTask } from './commentTasks';

/** Read-only workspace summary based ONLY on supplied open editor documents.
 * This does not recursively crawl the source tree or infer compiler semantics.
 */
export const MAX_WORKSPACE_INSIGHT_SOURCES = 40;
export const MAX_WORKSPACE_INSIGHT_UNITS = 2 * 1024 * 1024;
export const MAX_WORKSPACE_INSIGHT_WARNINGS = 160;
export const MAX_WORKSPACE_INSIGHT_TASK_SAMPLES = 4;

export type WorkspaceReviewKind =
  'incomplete' | 'dirty' | 'mixed-newline' | 'mixed-indent' | 'trailing-space' |
  'long-lines' | 'unbalanced-braces' | 'unterminated-string' | 'task-high' |
  'duplicate-path' | 'not-listed' | 'source-budget';

export type WorkspaceReviewLevel = 'information' | 'review';
export interface ListedWorkspaceInsightSource { name: string; path: string }
export interface WorkspaceInsightProjectRoot { directory: string; path: string }
export interface WorkspaceSourceReview {
  kind: WorkspaceReviewKind;
  level: WorkspaceReviewLevel;
  message: string;
  documentId: string;
  documentName: string;
}
export interface OpenSourceInsight {
  documentId: string;
  documentName: string;
  relativeName: string | null;
  projectDirectory: string | null;
  modified: boolean;
  active: boolean;
  lineCount: number | null;
  functionCount: number | null;
  recordCount: number | null;
  variantCount: number | null;
  importCount: number | null;
  commentCount: number | null;
  commentTasks: number | null;
  highPriorityTasks: number | null;
  longLines: number | null;
  complete: boolean;
  warnings: WorkspaceSourceReview[];
  taskSamples: Pick<ScarpCommentTask, 'kind'|'description'|'line'>[];
}
export interface WorkspaceTotals {
  openTabs: number;
  analyzedTabs: number;
  modifiedTabs: number;
  filesInExplorer: number;
  filesOutsideExplorer: number;
  totalLines: number;
  functions: number;
  records: number;
  variants: number;
  imports: number;
  comments: number;
  tasks: number;
  highPriorityTasks: number;
  longLines: number;
  reviewWarnings: number;
}
export interface WorkspaceProjectSummary {
  directory: string;
  label: string;
  openFiles: number;
  modifiedFiles: number;
  reviewWarnings: number;
  taskCount: number;
}
export interface WorkspaceInsightReport {
  entries: OpenSourceInsight[];
  warnings: WorkspaceSourceReview[];
  projects: WorkspaceProjectSummary[];
  totals: WorkspaceTotals;
  complete: boolean;
  notes: string[];
}
export interface WorkspaceInsightFilter {
  scope: 'all' | 'modified' | 'review' | 'tasks';
  search: string;
  order: 'active' | 'name' | 'warnings' | 'tasks';
}

const review = (
  kind: WorkspaceReviewKind, level: WorkspaceReviewLevel,
  message: string, document: StudioDocument,
): WorkspaceSourceReview => ({
  kind, level, message,
  documentId: document.id, documentName: document.name,
});
const sortName = (a: OpenSourceInsight, b: OpenSourceInsight): number =>
  (a.relativeName ?? a.documentName).localeCompare(
    b.relativeName ?? b.documentName, 'en', { numeric: true });

/** Select the deepest discovered manifest root whose source-relative name
 * prefixes this original Explorer listing entry. No guessed native path is
 * created and no compiler is invoked.
 */
export function projectDirectoryForListedSource(
  sourceName: string,
  projectRoots: readonly WorkspaceInsightProjectRoot[],
): string | null {
  if (!safeRelativeScarpSourceName(sourceName)) return null;
  const matches = projectRoots.filter(root =>
    root.directory === '' || (root.directory !== '' &&
      sourceName.startsWith(root.directory + '/')));
  if (!matches.length) return null;
  return matches.sort((a,b) => b.directory.length-a.directory.length)[0].directory;
}
function listedSourceForDocument(
  document: StudioDocument,
  listed: readonly ListedWorkspaceInsightSource[],
): ListedWorkspaceInsightSource | null {
  if (!document.path || !isScarpPath(document.path)) return null;
  return listed.find(entry => safeRelativeScarpSourceName(entry.name) &&
    sameFilePath(entry.path, document.path!)) ?? null;
}

function diagnosticsForSource(
  document: StudioDocument,
  metrics: ReturnType<typeof summarizeScarpSource>,
  lexical: ReturnType<typeof scanScarpSource>,
  highTasks: number,
): WorkspaceSourceReview[] {
  const result: WorkspaceSourceReview[] = [];
  if (isDirty(document)) result.push(review(
    'dirty','information','Source has unsaved editor changes.',document));
  if (!metrics.complete) result.push(review(
    'incomplete','review','Source analysis reached a safety budget.',document));
  if (metrics.lineEnding === 'mixed') result.push(review(
    'mixed-newline','review','Mixed CRLF, CR or LF line endings.',document));
  if (metrics.mixedIndentLines > 0) result.push(review(
    'mixed-indent','review','Some indentation mixes spaces and tabs.',document));
  if (metrics.trailingWhitespaceLines > 0) result.push(review(
    'trailing-space','information','Trailing whitespace occurs in this source.',document));
  if (metrics.longLines > 0) result.push(review(
    'long-lines','information','Some source lines are longer than 120 UTF-16 units.',document));
  if (metrics.unmatchedOpeningBraces || metrics.unmatchedClosingBraces) {
    result.push(review('unbalanced-braces','review',
      'Brace count appears unbalanced; only the compiler can validate syntax.',document));
  }
  if (lexical.issues.some(issue => issue.kind === 'unterminated-string')) {
    result.push(review('unterminated-string','review',
      'Possible unterminated string literal.',document));
  }
  if (highTasks > 0) result.push(review(
    'task-high','information',highTasks + ' high-priority comment task(s).',document));
  return result;
}

/** Aggregate only open, bounded editor buffers. A truncated report is never
 * presented as complete. A source with unavailable metrics is still listed
 * and stays navigable as an open editor tab.
 */
export function inspectScarpWorkspace(
  documents: readonly StudioDocument[],
  listing: readonly ListedWorkspaceInsightSource[],
  projectRoots: readonly WorkspaceInsightProjectRoot[],
  activeId: string | null,
): WorkspaceInsightReport {
  const known = listing.slice(0, 200).filter(entry =>
    safeRelativeScarpSourceName(entry.name) && isScarpPath(entry.path));
  const prioritized = [...documents].sort((a,b) =>
    Number(b.id === activeId)-Number(a.id === activeId));
  const entries: OpenSourceInsight[] = [];
  const warnings: WorkspaceSourceReview[] = [];
  const totals: WorkspaceTotals = {
    openTabs: documents.length, analyzedTabs: 0,
    modifiedTabs: documents.filter(isDirty).length,
    filesInExplorer: 0, filesOutsideExplorer: 0, totalLines: 0,
    functions: 0, records: 0, variants: 0, imports: 0,
    comments: 0, tasks: 0, highPriorityTasks: 0,
    longLines: 0, reviewWarnings: 0,
  };
  let allocatedUnits = 0;
  let complete = documents.length <= MAX_WORKSPACE_INSIGHT_SOURCES &&
    listing.length <= 200;
  const notes: string[] = [];
  const seenPaths: string[] = [];
  for (const document of prioritized.slice(0, MAX_WORKSPACE_INSIGHT_SOURCES)) {
    const listed = listedSourceForDocument(document, known);
    const modified = isDirty(document);
    if (listed) totals.filesInExplorer++;
    else totals.filesOutsideExplorer++;
    const warningsForSource: WorkspaceSourceReview[] = [];
    if (!listed && document.path) warningsForSource.push(review(
      'not-listed','information','Open file is outside the current Explorer listing.',document));
    if (document.path && seenPaths.some(path => sameFilePath(path,document.path!))) {
      warningsForSource.push(review(
        'duplicate-path','review','Multiple open editor tabs reference the same source path.',document));
    }
    if (document.path) seenPaths.push(document.path);
    const tooLarge = allocatedUnits + document.content.length > MAX_WORKSPACE_INSIGHT_UNITS;
    if (tooLarge) {
      complete = false;
      warningsForSource.push(review(
        'source-budget','review','Workspace-wide analysis budget was reached.',document));
      const entry: OpenSourceInsight = {
        documentId: document.id, documentName: document.name,
        relativeName: listed?.name ?? null,
        projectDirectory: listed
          ? projectDirectoryForListedSource(listed.name,projectRoots) : null,
        modified, active: document.id === activeId,
        lineCount: null, functionCount: null, recordCount: null,
        variantCount: null, importCount: null, commentCount: null,
        commentTasks: null, highPriorityTasks: null,
        longLines: null, complete: false,
        warnings: warningsForSource, taskSamples: [],
      };
      entries.push(entry);
      warnings.push(...warningsForSource);
      continue;
    }
    allocatedUnits += document.content.length;
    const lexical = scanScarpSource(document.content);
    const summary = summarizeScarpSource(document.content,lexical);
    const tasks = findScarpCommentTasks(document.content,lexical);
    if (!summary.complete || !tasks.complete) complete = false;
    warningsForSource.push(...diagnosticsForSource(
      document,summary,lexical,summary.tasks.high));
    const entry: OpenSourceInsight = {
      documentId: document.id, documentName: document.name,
      relativeName: listed?.name ?? null,
      projectDirectory: listed
        ? projectDirectoryForListedSource(listed.name,projectRoots) : null,
      modified, active: document.id === activeId,
      lineCount: summary.lines, functionCount: summary.functions,
      recordCount: summary.records, variantCount: summary.variants,
      importCount: summary.imports, commentCount: summary.comments,
      commentTasks: tasks.tasks.length,
      highPriorityTasks: summary.tasks.high,
      longLines: summary.longLines, complete: summary.complete && tasks.complete,
      warnings: warningsForSource,
      taskSamples: tasks.tasks.slice(0,MAX_WORKSPACE_INSIGHT_TASK_SAMPLES).map(
        task => ({ kind:task.kind, description:task.description, line:task.line })),
    };
    entries.push(entry);
    warnings.push(...warningsForSource);
    totals.analyzedTabs++;
    totals.totalLines += summary.lines;
    totals.functions += summary.functions;
    totals.records += summary.records;
    totals.variants += summary.variants;
    totals.imports += summary.imports;
    totals.comments += summary.comments;
    totals.tasks += tasks.tasks.length;
    totals.highPriorityTasks += summary.tasks.high;
    totals.longLines += summary.longLines;
  }
  const allWarnings = warnings.slice(0,MAX_WORKSPACE_INSIGHT_WARNINGS);
  if (warnings.length > MAX_WORKSPACE_INSIGHT_WARNINGS) complete = false;
  totals.reviewWarnings = warnings.filter(x => x.level === 'review').length;
  if (!complete) notes.push('Workspace analysis is limited. Totals exclude unanalyzed or omitted buffers.');
  if (documents.length > MAX_WORKSPACE_INSIGHT_SOURCES) {
    notes.push('Only the first 40 prioritized open editor tabs were inspected.');
  }
  if (listing.length > 200) notes.push('Current Explorer source inventory was capped.');
  const projectMap = new Map<string,WorkspaceProjectSummary>();
  for (const entry of entries) {
    const directory = entry.projectDirectory ?? '(standalone)';
    const current = projectMap.get(directory) ?? {
      directory, label: directory === '' ? 'Workspace project root'
        : directory === '(standalone)' ? 'Unassigned or standalone'
          : directory + '/',
      openFiles: 0, modifiedFiles: 0, reviewWarnings: 0, taskCount: 0,
    };
    current.openFiles++;
    if (entry.modified) current.modifiedFiles++;
    current.reviewWarnings += entry.warnings.filter(w => w.level === 'review').length;
    current.taskCount += entry.commentTasks ?? 0;
    projectMap.set(directory,current);
  }
  return {
    entries: entries.sort((a,b) => Number(b.active)-Number(a.active) || sortName(a,b)),
    warnings: allWarnings,
    projects: [...projectMap.values()].sort((a,b) => a.label.localeCompare(b.label)),
    totals, complete, notes,
  };
}

export function filterWorkspaceInsightEntries(
  entries: readonly OpenSourceInsight[],
  filter: WorkspaceInsightFilter,
): OpenSourceInsight[] {
  if (filter.search.length > 120) return [];
  const q = filter.search.trim().toLowerCase();
  const filtered = entries.filter(entry =>
    (filter.scope === 'all' ||
      (filter.scope === 'modified' && entry.modified) ||
      (filter.scope === 'review' && entry.warnings.some(w => w.level === 'review')) ||
      (filter.scope === 'tasks' && (entry.commentTasks ?? 0) > 0)) &&
    (!q || (entry.documentName + ' ' + (entry.relativeName ?? ''))
      .toLowerCase().includes(q)));
  return [...filtered].sort((a,b) => {
    if (filter.order === 'active') return Number(b.active)-Number(a.active) || sortName(a,b);
    if (filter.order === 'warnings') {
      return b.warnings.length-a.warnings.length || sortName(a,b);
    }
    if (filter.order === 'tasks') {
      return (b.commentTasks ?? -1)-(a.commentTasks ?? -1) || sortName(a,b);
    }
    return sortName(a,b);
  });
}

/** A click may only select an unchanged, already-open tab. There is no
 * path lookup, disk read, or permission escalation from the overview.
 */
export function workspaceInsightNavigationTarget(
  entry: OpenSourceInsight,
  documents: readonly StudioDocument[],
): string | null {
  return documents.some(document => document.id === entry.documentId)
    ? entry.documentId : null;
}
