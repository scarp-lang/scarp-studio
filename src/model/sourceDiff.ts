import { unicodeSafePreviewBounds } from './utf8Text';

/** Snapshot-only line diff for Scarp Studio's Working Changes panel.
 *
 * This module never reads disk, writes files, executes a compiler, or resolves
 * filesystem paths. It compares only the editor's savedContent and content.
 * The dynamic-programming budget is explicit to avoid blocking typing on
 * very large files. A limited result never masquerades as a complete diff.
 */
export const MAX_DIFF_SOURCE_UNITS = 512 * 1024;
export const MAX_DIFF_SOURCE_LINES = 2400;
export const MAX_DIFF_DYNAMIC_CELLS = 400_000;
export const MAX_DIFF_HUNKS = 32;
export const MAX_DIFF_PREVIEW_LINES = 400;
export const MAX_DIFF_LINE_PREVIEW_UNITS = 240;
export const DIFF_CONTEXT_LINES = 2;

export type DiffLineKind = 'context' | 'added' | 'removed';
export type DiffStatus = 'clean' | 'ready' | 'limited';
export type DiffLineEnding = '' | '\n' | '\r' | '\r\n';

export interface SnapshotLine {
  text: string;
  ending: DiffLineEnding;
  index: number;
  start: number;
  end: number;
}
export interface DiffLine {
  kind: DiffLineKind;
  beforeLine: number | null;
  afterLine: number | null;
  preview: string;
  previewTruncated: boolean;
  endingChanged: boolean;
}
export interface SourceDiffHunk {
  id: string;
  beforeStart: number;
  beforeCount: number;
  afterStart: number;
  afterCount: number;
  navigateLine: number;
  lines: DiffLine[];
}
export interface SourceDiffReport {
  status: DiffStatus;
  beforeLines: number;
  afterLines: number;
  addedLines: number | null;
  removedLines: number | null;
  hunkCount: number | null;
  hunks: SourceDiffHunk[];
  message: string | null;
  truncated: boolean;
  sourceIdentical: boolean;
}
interface EditStep {
  kind: DiffLineKind;
  before: SnapshotLine | null;
  after: SnapshotLine | null;
}

export function splitSnapshotLines(text: string): SnapshotLine[] {
  const lines: SnapshotLine[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const unit = text.charCodeAt(index);
    if (unit !== 10 && unit !== 13) continue;
    const end = index;
    const ending: DiffLineEnding = unit === 13
      ? text.charCodeAt(index + 1) === 10 ? '\r\n' : '\r'
      : '\n';
    if (ending === '\r\n') index++;
    lines.push({
      index: lines.length + 1,
      text: text.slice(start, end),
      ending,
      start,
      end: index + 1,
    });
    start = index + 1;
  }
  lines.push({
    index: lines.length + 1,
    text: text.slice(start),
    ending: '',
    start,
    end: text.length,
  });
  return lines;
}
export function identicalSnapshotLines(a: SnapshotLine, b: SnapshotLine): boolean {
  return a.text === b.text && a.ending === b.ending;
}
function compactLine(
  kind: DiffLineKind,
  before: SnapshotLine | null,
  after: SnapshotLine | null,
): DiffLine {
  const source = after ?? before;
  const text = source?.text ?? '';
  return {
    kind,
    beforeLine: before?.index ?? null,
    afterLine: after?.index ?? null,
    preview: text.slice(0, unicodeSafePreviewBounds(text, 0, Math.min(text.length, MAX_DIFF_LINE_PREVIEW_UNITS)).end),
    previewTruncated: text.length > MAX_DIFF_LINE_PREVIEW_UNITS,
    endingChanged: before !== null && after !== null &&
      before.ending !== after.ending,
  };
}
function changedReport(
  beforeLines: number, afterLines: number,
  reason: string, sourceIdentical = false,
): SourceDiffReport {
  return {
    status: 'limited',
    beforeLines, afterLines,
    addedLines: null, removedLines: null, hunkCount: null,
    hunks: [], message: reason, truncated: true,
    sourceIdentical,
  };
}
function cleanReport(lineCount: number): SourceDiffReport {
  return {
    status: 'clean', beforeLines: lineCount, afterLines: lineCount,
    addedLines: 0, removedLines: 0, hunkCount: 0,
    hunks: [], message: null, truncated: false, sourceIdentical: true,
  };
}

/** Find the longest common prefix and suffix before allocating a bounded
 * LCS matrix. A common 2,000-line unchanged project file with one local
 * edit therefore uses only a tiny dynamic-programming window.
 */
function matchingWindow(
  before: readonly SnapshotLine[], after: readonly SnapshotLine[],
): { prefix: number; oldEnd: number; newEnd: number } {
  let prefix = 0;
  while (prefix < before.length && prefix < after.length &&
      identicalSnapshotLines(before[prefix], after[prefix])) prefix++;
  let oldEnd = before.length, newEnd = after.length;
  while (oldEnd > prefix && newEnd > prefix &&
      identicalSnapshotLines(before[oldEnd - 1], after[newEnd - 1])) {
    oldEnd--;
    newEnd--;
  }
  return { prefix, oldEnd, newEnd };
}

/** No DOM, no file I/O, no recursion. Build exact LCS steps only when the
 * trimmed matrix fits MAX_DIFF_DYNAMIC_CELLS. The matrix counts line
 * identities including their original line-ending bytes.
 */
function boundedSteps(
  before: readonly SnapshotLine[], after: readonly SnapshotLine[],
): EditStep[] | null {
  const { prefix, oldEnd, newEnd } = matchingWindow(before, after);
  const oldLength = oldEnd - prefix;
  const newLength = newEnd - prefix;
  if ((oldLength + 1) * (newLength + 1) > MAX_DIFF_DYNAMIC_CELLS) {
    return null;
  }
  const width = newLength + 1;
  const lengths = new Uint32Array((oldLength + 1) * width);
  // Intern full line identities once. The DP loop compares integers rather
  // than repeatedly comparing very long, nearly identical source strings.
  const identities = new Map<string, Map<DiffLineEnding, number>>();
  let nextIdentity = 1;
  const identity = (line: SnapshotLine): number => {
    let endings = identities.get(line.text);
    if (!endings) { endings = new Map(); identities.set(line.text, endings); }
    let id = endings.get(line.ending);
    if (id === undefined) { id = nextIdentity++; endings.set(line.ending, id); }
    return id;
  };
  const oldIds = before.slice(prefix, oldEnd).map(identity);
  const newIds = after.slice(prefix, newEnd).map(identity);
  for (let i = oldLength - 1; i >= 0; i--) {
    for (let j = newLength - 1; j >= 0; j--) {
      const index = i * width + j;
      lengths[index] = oldIds[i] === newIds[j]
        ? 1 + lengths[(i + 1) * width + j + 1]
        : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1]);
    }
  }
  const edits: EditStep[] = [];
  for (let i = 0; i < prefix; i++) {
    edits.push({ kind: 'context', before: before[i], after: after[i] });
  }
  let i = 0, j = 0;
  while (i < oldLength || j < newLength) {
    if (i < oldLength && j < newLength &&
        oldIds[i] === newIds[j]) {
      edits.push({
        kind: 'context', before: before[prefix + i], after: after[prefix + j],
      });
      i++; j++;
    } else if (i < oldLength &&
        (j >= newLength ||
         lengths[(i + 1) * width + j] >= lengths[i * width + j + 1])) {
      edits.push({
        kind: 'removed', before: before[prefix + i], after: null,
      });
      i++;
    } else {
      edits.push({
        kind: 'added', before: null, after: after[prefix + j],
      });
      j++;
    }
  }
  for (let offset = 0; offset < before.length - oldEnd; offset++) {
    edits.push({
      kind: 'context', before: before[oldEnd + offset],
      after: after[newEnd + offset],
    });
  }
  return edits;
}

/** Build context-expanded windows around changes. Nearby windows merge,
 * while distant changes become separate navigable hunks. The navigation
 * location is always a line in the CURRENT (after) buffer.
 */
function hunkWindows(steps: readonly EditStep[]): { start: number; end: number }[] {
  const windows: { start: number; end: number }[] = [];
  for (let index = 0; index < steps.length; index++) {
    if (steps[index].kind === 'context') continue;
    const start = Math.max(0, index - DIFF_CONTEXT_LINES);
    const end = Math.min(steps.length, index + DIFF_CONTEXT_LINES + 1);
    const previous = windows[windows.length - 1];
    if (previous && previous.end >= start) {
      previous.end = Math.max(previous.end, end);
    } else {
      windows.push({ start, end });
    }
  }
  return windows;
}
function makeHunk(
  steps: readonly EditStep[],
  start: number, end: number, number: number, afterCount: number,
): SourceDiffHunk {
  const window = steps.slice(start, end);
  const firstBefore = window.find(step => step.before !== null)?.before?.index ?? 1;
  const firstAfter = window.find(step => step.after !== null)?.after?.index ?? afterCount;
  const navigable = window.find(step => step.kind === 'added')?.after?.index ??
    window.find(step => step.after !== null)?.after?.index ?? afterCount;
  return {
    id: 'change-' + number + '-' + firstBefore + '-' + firstAfter,
    beforeStart: firstBefore,
    beforeCount: window.filter(step => step.before !== null).length,
    afterStart: firstAfter,
    afterCount: window.filter(step => step.after !== null).length,
    navigateLine: Math.max(1, Math.min(afterCount, navigable)),
    lines: window.map(step => compactLine(step.kind, step.before, step.after)),
  };
}

/** The report does not retain old source text; only bounded previews are
 * returned. Consumers can gate navigation on exact document revisions.
 */
export function compareScarpSnapshots(
  saved: string, current: string,
): SourceDiffReport {
  if (saved === current) {
    // Avoid splitting 4 MiB clean buffers merely to report no changes.
    const count = countSnapshotLines(saved);
    return cleanReport(count);
  }
  if (saved.length > MAX_DIFF_SOURCE_UNITS || current.length > MAX_DIFF_SOURCE_UNITS) {
    return changedReport(0, 0,
      'Changes preview unavailable: either buffer exceeds 512 Ki UTF-16 units.');
  }
  const oldCount = countSnapshotLines(saved), newCount = countSnapshotLines(current);
  if (oldCount > MAX_DIFF_SOURCE_LINES || newCount > MAX_DIFF_SOURCE_LINES) {
    return changedReport(oldCount, newCount,
      'Changes preview unavailable: more than 2,400 lines in a snapshot.');
  }
  const before = splitSnapshotLines(saved), after = splitSnapshotLines(current);
  const steps = boundedSteps(before, after);
  if (!steps) {
    return changedReport(before.length, after.length,
      'Changes preview unavailable: diff complexity exceeds the safe work budget.');
  }
  const windows = hunkWindows(steps);
  let shownLines = 0;
  const hunks: SourceDiffHunk[] = [];
  for (let index = 0; index < windows.length; index++) {
    if (hunks.length >= MAX_DIFF_HUNKS) break;
    const window = windows[index];
    if (shownLines + window.end - window.start > MAX_DIFF_PREVIEW_LINES) break;
    const hunk = makeHunk(steps, window.start, window.end, index + 1, after.length);
    shownLines += hunk.lines.length;
    hunks.push(hunk);
  }
  const truncated = hunks.length !== windows.length;
  return {
    status: 'ready',
    beforeLines: before.length,
    afterLines: after.length,
    addedLines: steps.filter(step => step.kind === 'added').length,
    removedLines: steps.filter(step => step.kind === 'removed').length,
    hunkCount: windows.length,
    hunks,
    truncated,
    sourceIdentical: false,
    message: truncated
      ? 'Only the first bounded change hunks are displayed; counts include all changes.'
      : null,
  };
}


/** Count line boundaries without allocating arrays of separators or rows. */
export function countSnapshotLines(text: string): number {
  let count = 1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\r') {
      if (text[i + 1] === '\n') i++;
      count++;
    } else if (text[i] === '\n') count++;
  }
  return count;
}
export interface SnapshotEditBlock {
  readonly id: number;
  readonly beforeStart: number;
  readonly beforeEnd: number;
  readonly afterStart: number;
  readonly afterEnd: number;
  readonly beforeLine: number;
  readonly afterLine: number;
  readonly beforeCount: number;
  readonly afterCount: number;
}
export type ExactSnapshotBlocks =
  | { readonly ok: true; readonly blocks: readonly SnapshotEditBlock[] }
  | { readonly ok: false; readonly error: string };
/** Exact contiguous non-context spans in the same bounded diff used by
 * Working Changes. Offsets refer to original strings including separators.
 * No text previews or caller-supplied patch coordinates are authoritative. */
export function exactSnapshotEditBlocks(beforeText: string, afterText: string): ExactSnapshotBlocks {
  if (beforeText === afterText) return { ok: true, blocks: [] };
  if (beforeText.length > MAX_DIFF_SOURCE_UNITS || afterText.length > MAX_DIFF_SOURCE_UNITS ||
      countSnapshotLines(beforeText) > MAX_DIFF_SOURCE_LINES ||
      countSnapshotLines(afterText) > MAX_DIFF_SOURCE_LINES) {
    return { ok: false, error: 'Exact comparison exceeds the source or line budget.' };
  }
  const before = splitSnapshotLines(beforeText), after = splitSnapshotLines(afterText);
  const steps = boundedSteps(before, after);
  if (!steps) return { ok: false, error: 'Exact comparison exceeds the diff complexity budget.' };
  let oldIndex = 0, newIndex = 0;
  let pending: { old: number; next: number } | null = null;
  const blocks: SnapshotEditBlock[] = [];
  const offset = (lines: readonly SnapshotLine[], i: number, size: number) => lines[i]?.start ?? size;
  function flush() {
    if (!pending) return;
    const block = {
      id: blocks.length + 1,
      beforeStart: offset(before, pending.old, beforeText.length),
      beforeEnd: offset(before, oldIndex, beforeText.length),
      afterStart: offset(after, pending.next, afterText.length),
      afterEnd: offset(after, newIndex, afterText.length),
      beforeLine: pending.old + 1, afterLine: pending.next + 1,
      beforeCount: oldIndex - pending.old, afterCount: newIndex - pending.next,
    };
    // The virtual empty EOF row may differ in the line-level sequence but
    // have no actual characters. It must not become a phantom text edit.
    if (beforeText.slice(block.beforeStart, block.beforeEnd) !== afterText.slice(block.afterStart, block.afterEnd)) {
      blocks.push(Object.freeze(block));
    }
    pending = null;
  }
  for (const step of steps) {
    if (step.kind === 'context') flush();
    else if (!pending) pending = { old: oldIndex, next: newIndex };
    if (step.before) oldIndex++;
    if (step.after) newIndex++;
  }
  flush();
  return { ok: true, blocks: Object.freeze(blocks) };
}
