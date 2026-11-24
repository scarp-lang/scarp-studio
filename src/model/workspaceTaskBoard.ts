import type { StudioDocument } from './documents';
import {
  findScarpCommentTasks, currentTaskPosition, type ScarpCommentTask,
  type ScarpTaskKind, type ScarpTaskPriority,
} from './commentTasks';

/** Source-only project task board. This is never a GitHub issue generator,
 * filesystem crawler or compiler implementation. All entries come from
 * currently open in-memory editor tabs with bounded scan budgets.
 */
export const MAX_TASK_BOARD_DOCUMENTS = 24;
export const MAX_TASK_BOARD_SOURCE_UNITS = 1536 * 1024;
export const MAX_TASK_BOARD_ENTRIES = 300;
export const MAX_TASK_BOARD_QUERY_UNITS = 120;

export interface WorkspaceTaskEntry {
  id: string;
  documentId: string;
  documentName: string;
  revision: number;
  task: ScarpCommentTask;
}
export interface WorkspaceTaskReport {
  tasks: WorkspaceTaskEntry[];
  complete: boolean;
  documentsExamined: number;
  documentsSkipped: number;
  totalDocuments: number;
  totalFound: number;
  high: number;
  normal: number;
  low: number;
  note: string | null;
}
export interface WorkspaceTaskFilters {
  query: string;
  scope: 'all' | 'active';
  activeId: string | null;
  priority: ScarpTaskPriority | 'all';
  kind: ScarpTaskKind | 'all';
  sort: 'source' | 'priority';
}
export interface WorkspaceTaskGroup {
  documentId: string;
  documentName: string;
  tasks: WorkspaceTaskEntry[];
}
export interface WorkspaceTaskNavigation {
  documentId: string;
  revision: number;
  source: string;
  line: number;
  column: number;
}
const priorityOrder: Record<ScarpTaskPriority, number> = {
  high: 0, normal: 1, low: 2,
};

export function scanWorkspaceCommentTasks(
  documents: readonly StudioDocument[],
): WorkspaceTaskReport {
  const bounded = documents.slice(0, MAX_TASK_BOARD_DOCUMENTS);
  const result: WorkspaceTaskEntry[] = [];
  let units = 0, complete = documents.length <= MAX_TASK_BOARD_DOCUMENTS;
  let examined = 0, skipped = documents.length - bounded.length, totalFound = 0;
  let high = 0, normal = 0, low = 0;
  for (const document of bounded) {
    if (units + document.content.length > MAX_TASK_BOARD_SOURCE_UNITS) {
      skipped++;
      complete = false;
      continue;
    }
    units += document.content.length;
    examined++;
    const scan = findScarpCommentTasks(document.content);
    if (!scan.complete) complete = false;
    totalFound += scan.totalFound;
    for (const task of scan.tasks) {
      if (result.length >= MAX_TASK_BOARD_ENTRIES) {
        complete = false;
        continue;
      }
      result.push({
        id: document.id + ':' + task.id,
        documentId: document.id,
        documentName: document.name,
        revision: document.revision,
        task,
      });
      if (task.priority === 'high') high++;
      else if (task.priority === 'normal') normal++;
      else low++;
    }
  }
  return {
    tasks: result, complete, documentsExamined: examined,
    documentsSkipped: skipped, totalDocuments: documents.length,
    totalFound, high, normal, low,
    note: complete ? null
      : 'Task inventory is incomplete; source, file, or task limits were reached.',
  };
}

export function filterWorkspaceTasks(
  tasks: readonly WorkspaceTaskEntry[],
  options: WorkspaceTaskFilters,
): WorkspaceTaskEntry[] {
  if (options.query.length > MAX_TASK_BOARD_QUERY_UNITS ||
      /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(options.query)) return [];
  const query = options.query.trim().toLowerCase();
  const filtered = tasks.filter(entry =>
    (options.scope === 'all' || entry.documentId === options.activeId) &&
    (options.kind === 'all' || entry.task.kind === options.kind) &&
    (options.priority === 'all' || entry.task.priority === options.priority) &&
    (!query || (entry.documentName + ' ' + entry.task.description + ' ' +
      entry.task.kind + ' ' + (entry.task.owner ?? '')).toLowerCase().includes(query)));
  return [...filtered].sort((a, b) => options.sort === 'priority'
    ? priorityOrder[a.task.priority] - priorityOrder[b.task.priority] ||
      a.documentName.localeCompare(b.documentName) ||
      a.task.line - b.task.line
    : a.documentName.localeCompare(b.documentName) ||
      a.task.line - b.task.line || a.task.column - b.task.column);
}

export function groupWorkspaceTasks(
  tasks: readonly WorkspaceTaskEntry[],
): WorkspaceTaskGroup[] {
  const groups = new Map<string, WorkspaceTaskGroup>();
  for (const item of tasks) {
    let group = groups.get(item.documentId);
    if (!group) {
      group = {documentId:item.documentId,documentName:item.documentName,tasks:[]};
      groups.set(item.documentId,group);
    }
    group.tasks.push(item);
  }
  return [...groups.values()];
}

/** Resolve only the exact current open document generation, then recheck
 * that the marker remains inside a true line comment at the same position.
 * This is safe across tab switches and A -> B -> A editor text revisions.
 */
export function currentWorkspaceTaskTarget(
  entry: WorkspaceTaskEntry,
  documents: readonly StudioDocument[],
): WorkspaceTaskNavigation | null {
  const current = documents.find(document => document.id === entry.documentId);
  if (!current || current.revision !== entry.revision) return null;
  const target = currentTaskPosition(current.content, entry.task);
  return target ? {
    documentId:current.id,revision:current.revision,
    source:current.content,line:target.line,column:target.column,
  } : null;
}
