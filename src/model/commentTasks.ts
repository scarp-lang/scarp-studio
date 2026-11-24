import {
  scanScarpSource, type InsightToken, type SourceLexResult,
} from '../language/sourceLex';

/** Read-only task references extracted strictly from Scarp line comments.
 * They are not executable directives or automatically created GitHub issues.
 */
export const MAX_SCARP_COMMENT_TASKS = 200;
export const MAX_TASK_LABEL_UNITS = 180;
export const MAX_TASK_OWNER_UNITS = 36;
export type ScarpTaskKind =
  'TODO' | 'FIXME' | 'BUG' | 'REVIEW' | 'NOTE' | 'HACK' | 'XXX';
export type ScarpTaskPriority = 'high' | 'normal' | 'low';

export interface ScarpCommentTask {
  id: string;
  kind: ScarpTaskKind;
  priority: ScarpTaskPriority;
  description: string;
  owner: string | null;
  line: number;
  column: number;
  offset: number;
  end: number;
  /** Complete source text is never stored inside a task. */
  marker: string;
}
export interface ScarpTaskScan {
  tasks: ScarpCommentTask[];
  totalFound: number;
  complete: boolean;
  message: string | null;
}
export interface TaskFilters {
  kind: ScarpTaskKind | 'all';
  priority: ScarpTaskPriority | 'all';
  query: string;
}
export interface TaskGroup {
  kind: ScarpTaskKind;
  tasks: ScarpCommentTask[];
}
const priorities: Record<ScarpTaskKind, ScarpTaskPriority> = {
  FIXME: 'high', BUG: 'high', XXX: 'high',
  TODO: 'normal', REVIEW: 'normal',
  NOTE: 'low', HACK: 'low',
};
const kinds: readonly ScarpTaskKind[] = [
  'FIXME', 'BUG', 'XXX', 'TODO', 'REVIEW', 'HACK', 'NOTE',
];
const validQuery = (query: string): boolean =>
  query.length <= 120 && !/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(query);
const safeLabel = (text: string): string =>
  text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .replace(/[ \t]+/g, ' ').trim().slice(0, MAX_TASK_LABEL_UNITS);

function parseTask(comment: InsightToken): ScarpCommentTask | null {
  if (comment.kind !== 'comment' || comment.previewTruncated ||
      !comment.text.startsWith('//')) return null;
  const body = comment.text.slice(2);
  // Only a standalone task word in the line comment qualifies. Requiring a
  // preceding boundary avoids e.g. METHOD TODOING, TODO_thing or BASETODO.
  const matches = /(?:^|[\s,;*-])(?<kind>TODO|FIXME|BUG|REVIEW|NOTE|HACK|XXX)\b/ig;
  const match = matches.exec(body);
  if (!match || !match.groups) return null;
  const kind = match.groups.kind.toUpperCase() as ScarpTaskKind;
  const markerInBody = match.index + match[0].lastIndexOf(match.groups.kind);
  const markerOffset = comment.start + 2 + markerInBody;
  let rest = body.slice(markerInBody + kind.length);
  let owner: string | null = null;
  const annotation = /^\s*[\[(]([A-Za-z_][A-Za-z_0-9-]{0,35})[\])]/.exec(rest);
  if (annotation) {
    owner = annotation[1].slice(0, MAX_TASK_OWNER_UNITS);
    rest = rest.slice(annotation[0].length);
  }
  const description = safeLabel(rest.replace(/^\s*[:—-]\s*/, ''));
  return {
    id: kind + ':' + markerOffset,
    kind,
    priority: priorities[kind],
    description: description || 'No task description',
    owner,
    line: comment.line,
    column: comment.column + 2 + markerInBody,
    offset: markerOffset,
    end: markerOffset + kind.length,
    marker: kind,
  };
}

/** Only source-content comments are considered. Fake TODO markers inside
 * quoted strings cannot create tasks. Any incomplete lex result is clearly
 * marked; the caller must not present it as a full task inventory.
 */
export function findScarpCommentTasks(
  source: string, lexical: SourceLexResult = scanScarpSource(source),
): ScarpTaskScan {
  const tasks: ScarpCommentTask[] = [];
  let totalFound = 0;
  for (const token of lexical.tokens) {
    if (token.kind !== 'comment') continue;
    const task = parseTask(token);
    if (!task) continue;
    totalFound++;
    if (tasks.length < MAX_SCARP_COMMENT_TASKS) tasks.push(task);
  }
  const complete = lexical.complete && totalFound <= MAX_SCARP_COMMENT_TASKS;
  return {
    tasks, totalFound, complete,
    message: !lexical.complete
      ? 'Source scan incomplete; some comment tasks may be unavailable.'
      : totalFound > MAX_SCARP_COMMENT_TASKS
        ? 'Task list limited to 200 entries; narrow your source.'
        : null,
  };
}

/** Task selection never authorizes arbitrary paths or cross-document reads.
 * Each navigation must be tied to the current in-memory source snapshot by
 * checking the exact marker position and its enclosing comment token.
 */
export function currentTaskPosition(
  source: string, task: ScarpCommentTask,
): { line: number; column: number } | null {
  if (!Number.isSafeInteger(task.offset) || task.offset < 0 ||
      source.slice(task.offset, task.end).toUpperCase() !== task.marker) return null;
  const scan = scanScarpSource(source);
  if (!scan.complete) return null;
  const comment = scan.tokens.find(token =>
    token.kind === 'comment' && token.start <= task.offset && token.end >= task.end);
  if (!comment) return null;
  const current = parseTask(comment);
  return current && current.id === task.id &&
    current.line === task.line && current.column === task.column
    ? { line: current.line, column: current.column } : null;
}

export function filterScarpCommentTasks(
  tasks: readonly ScarpCommentTask[], filters: TaskFilters,
): ScarpCommentTask[] {
  if (!validQuery(filters.query)) return [];
  const query = filters.query.trim().toLocaleLowerCase('en');
  return tasks.filter(task =>
    (filters.kind === 'all' || task.kind === filters.kind) &&
    (filters.priority === 'all' || task.priority === filters.priority) &&
    (!query || (task.description + ' ' + task.kind + ' ' +
      (task.owner ?? '')).toLocaleLowerCase('en').includes(query)));
}

export function taskPriorityRank(priority: ScarpTaskPriority): number {
  return priority === 'high' ? 0 : priority === 'normal' ? 1 : 2;
}
export function sortScarpCommentTasks(
  tasks: readonly ScarpCommentTask[], ordering: 'source' | 'priority',
): ScarpCommentTask[] {
  return [...tasks].sort((a, b) =>
    ordering === 'source'
      ? a.line - b.line || a.column - b.column
      : taskPriorityRank(a.priority) - taskPriorityRank(b.priority) ||
        a.line - b.line || a.column - b.column);
}
export function groupScarpCommentTasks(
  tasks: readonly ScarpCommentTask[],
): TaskGroup[] {
  return kinds.map(kind => ({
    kind, tasks: tasks.filter(task => task.kind === kind),
  })).filter(group => group.tasks.length > 0);
}
export function taskCounts(
  tasks: readonly ScarpCommentTask[],
): Record<ScarpTaskPriority, number> {
  const counts = { high: 0, normal: 0, low: 0 };
  for (const task of tasks) counts[task.priority]++;
  return counts;
}
