import { currentActiveDocument, isUnchangedSnapshot, type EditorState, type BufferReplacement } from './editorState';
import { splitSnapshotLines, type DiffLineEnding, type SnapshotLine } from './sourceDiff';
import { nextLineBreak, lineBreakWidth } from './sourceLines';
import { assertScarpSourceText } from './sourceLimits';
import { assertWellFormedUtf16 } from './utf8Text';
import type { StudioDocument } from './documents';

export const MAX_RANGE_SOURCE_UNITS = 512 * 1024;
export const MAX_RANGE_LINES = 80;
export const MAX_RANGE_PREVIEW_UNITS = 24 * 1024;
export const MAX_RANGE_LINE_UNITS = 320;
export const MAX_RANGE_AFFIX_UNITS = 80;
export const RANGE_OPERATIONS = ['sort-ascending', 'sort-descending', 'reverse', 'indent', 'outdent',
  'prefix', 'suffix', 'trim-horizontal', 'deduplicate'] as const;
export type RangeOperation = typeof RANGE_OPERATIONS[number];
export const RANGE_LABELS: Readonly<Record<RangeOperation, string>> = Object.freeze({
  'sort-ascending': 'Sort lines ascending', 'sort-descending': 'Sort lines descending',
  reverse: 'Reverse line order', indent: 'Indent nonempty lines', outdent: 'Outdent one indentation step',
  prefix: 'Add literal prefix', suffix: 'Add literal suffix', 'trim-horizontal': 'Trim trailing spaces and tabs',
  deduplicate: 'Remove exact duplicate lines',
});
export interface RangeRequest {
  readonly first: number;
  readonly last: number;
  readonly operation: RangeOperation;
  readonly caseSensitive: boolean;
  readonly indentWidth: number;
  readonly affix: string;
}
export const DEFAULT_RANGE_REQUEST: RangeRequest = Object.freeze({
  first: 1, last: 1, operation: 'sort-ascending', caseSensitive: true, indentWidth: 2, affix: '',
});
export interface RangePreviewLine {
  readonly number: number;
  readonly text: string;
  readonly ending: DiffLineEnding;
}
export interface LineRangePlan {
  readonly sessionRevision: number;
  readonly document: StudioDocument;
  readonly request: RangeRequest;
  readonly before: readonly RangePreviewLine[];
  readonly after: readonly RangePreviewLine[];
  readonly changedRows: number;
  readonly removedRows: number;
  readonly change: BufferReplacement;
}
type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const failed = (error: string): Result<never> => ({ ok: false, error });

export function parseRangeLine(value: string): number | null {
  if (!/^[0-9]{1,7}$/.test(value.trim())) return null;
  const number = Number(value.trim());
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}
function canonicalRequest(request: RangeRequest): RangeRequest | null {
  if (!Number.isSafeInteger(request.first) || !Number.isSafeInteger(request.last) ||
      request.first < 1 || request.last < request.first || request.last - request.first + 1 > MAX_RANGE_LINES ||
      !RANGE_OPERATIONS.includes(request.operation) || typeof request.caseSensitive !== 'boolean' ||
      !Number.isSafeInteger(request.indentWidth) || request.indentWidth < 1 || request.indentWidth > 8 ||
      typeof request.affix !== 'string') return null;
  const usesAffix = request.operation === 'prefix' || request.operation === 'suffix';
  if (usesAffix) {
    if (!request.affix.length || request.affix.length > MAX_RANGE_AFFIX_UNITS ||
        /[\x00-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/.test(request.affix)) return null;
    try { assertWellFormedUtf16(request.affix, 'Line affix'); } catch { return null; }
  }
  // Ignore unrelated controls so they cannot silently change an operation.
  return Object.freeze({ first: request.first, last: request.last, operation: request.operation,
    caseSensitive: request.operation === 'sort-ascending' || request.operation === 'sort-descending' ? request.caseSensitive : true,
    indentWidth: request.operation === 'indent' || request.operation === 'outdent' ? request.indentWidth : 2,
    affix: usesAffix ? request.affix : '' });
}
function compareText(left: string, right: string, sensitive: boolean): number {
  const a = sensitive ? left : left.toLowerCase();
  const b = sensitive ? right : right.toLowerCase();
  // Stable sort: equal comparison keys retain their original order.
  return a < b ? -1 : a > b ? 1 : 0;
}
function removeIndent(text: string, width: number): string {
  if (text.startsWith('\t')) return text.slice(1);
  let count = 0;
  while (count < width && text[count] === ' ') count++;
  return text.slice(count);
}
function transform(lines: readonly string[], request: RangeRequest): string[] {
  switch (request.operation) {
    case 'sort-ascending': return [...lines].sort((a, b) => compareText(a, b, request.caseSensitive));
    case 'sort-descending': return [...lines].sort((a, b) => compareText(b, a, request.caseSensitive));
    case 'reverse': return [...lines].reverse();
    case 'indent': return lines.map(line => line.length ? ' '.repeat(request.indentWidth) + line : line);
    case 'outdent': return lines.map(line => removeIndent(line, request.indentWidth));
    case 'prefix': return lines.map(line => request.affix + line);
    case 'suffix': return lines.map(line => line + request.affix);
    case 'trim-horizontal': return lines.map(line => line.replace(/[ \t]+$/, ''));
    case 'deduplicate': return [...new Set(lines)];
  }
}
function rangeText(lines: readonly RangePreviewLine[]): string {
  return lines.map(line => line.text + line.ending).join('');
}
function exactPreviewAllowed(lines: readonly RangePreviewLine[]): boolean {
  let units = 0;
  for (const line of lines) {
    if (line.text.length > MAX_RANGE_LINE_UNITS) return false;
    units += line.text.length + line.ending.length;
    if (units > MAX_RANGE_PREVIEW_UNITS) return false;
  }
  return true;
}
/**
 * Explicit whole-line text transformations, not formatting, refactoring,
 * semantic analysis or Scarp compiler validation. All text outside the
 * reviewed contiguous range remains byte-for-byte unchanged.
 *
 * Existing line-ending slots are retained in position, even on reordering.
 * If deduplication shortens the range, the first remaining interior slots
 * are retained and the final selected boundary separator is preserved.
 */
export function planLineRange(editor: EditorState, request: RangeRequest): Result<LineRangePlan> {
  const document = currentActiveDocument(editor);
  if (!document) return failed('Open a source buffer first.');
  const normalized = canonicalRequest(request);
  if (!normalized) return failed('Choose a valid range of up to 80 lines and valid operation options.');
  if (document.content.length > MAX_RANGE_SOURCE_UNITS) return failed('Source exceeds the line-tool inspection limit.');
  try { assertScarpSourceText(document.content); } catch { return failed('Source contains unsupported text.'); }
  // Walk preceding lines without allocating their text or objects. Even
  // a half-megabyte file consisting only of line endings stays bounded.
  const selected: SnapshotLine[] = [];
  let start = 0;
  for (let number = 1; number <= normalized.last; number++) {
    const breakAt = nextLineBreak(document.content, start);
    const end = breakAt < 0 ? document.content.length : breakAt;
    const width = breakAt < 0 ? 0 : lineBreakWidth(document.content, breakAt);
    if (number >= normalized.first) {
      if (end - start > MAX_RANGE_LINE_UNITS) return failed('The selected lines exceed the complete preview limit. Choose a smaller range.');
      if (start === document.content.length && number > 1) {
        return failed('Exclude the terminal empty editor line to preserve the existing final newline.');
      }
      selected.push({ index: number, start, end: end + width,
        text: document.content.slice(start, end),
        ending: document.content.slice(end, end + width) as DiffLineEnding });
    }
    if (number < normalized.last && width === 0) return failed('The selected range extends beyond the current buffer.');
    start = end + width;
  }
  const before = selected.map(line => Object.freeze({ number: line.index, text: line.text, ending: line.ending }));
  if (!exactPreviewAllowed(before)) return failed('The selected lines exceed the complete preview limit. Choose a smaller range.');
  const transformed = transform(before.map(line => line.text), normalized);
  const after = transformed.map((text, i) => Object.freeze({
    number: normalized.first + i, text,
    ending: i === transformed.length - 1 ? before.at(-1)!.ending : before[i].ending,
  }));
  if (!exactPreviewAllowed(after)) return failed('Transformed lines exceed the complete preview limit.');
  const replacement = rangeText(after);
  const oldRange = rangeText(before);
  if (replacement === oldRange) return failed('The requested transformation would not change the selected text.');
  const prefix = document.content.slice(0, selected[0].start);
  const suffix = document.content.slice(selected.at(-1)!.end);
  // Empty transformed lines between CR and LF slots could accidentally
  // fuse two separators into one CRLF. Reparse the bounded replacement
  // and refuse any result that disagrees with its complete reviewed rows.
  const reparsed = splitSnapshotLines(replacement);
  if (after.at(-1)!.ending !== '') reparsed.pop();
  if (reparsed.length !== after.length || reparsed.some((line, i) =>
      line.text !== after[i].text || line.ending !== after[i].ending) ||
      (prefix.endsWith('\r') && replacement.startsWith('\n')) ||
      (replacement.endsWith('\r') && suffix.startsWith('\n'))) {
    return failed('Transformation would merge adjacent CR and LF separators. Choose a smaller range or normalize line endings first.');
  }
  const content = prefix + replacement + suffix;
  try { assertScarpSourceText(content); } catch { return failed('Transformed source exceeds Studio limits or contains unsupported text.'); }
  const snapshot = Object.freeze({ ...document });
  const change = Object.freeze({ id: document.id, snapshot, content });
  const changedRows = after.filter((line, index) => line.text !== before[index]?.text || line.ending !== before[index]?.ending).length;
  return { ok: true, value: Object.freeze({
    sessionRevision: editor.sessionRevision, document: snapshot, request: normalized,
    before: Object.freeze(before), after: Object.freeze(after),
    changedRows, removedRows: before.length - after.length, change,
  }) };
}
function sameLines(a: readonly RangePreviewLine[], b: readonly RangePreviewLine[]): boolean {
  return a.length === b.length && a.every((line, i) => line.number === b[i].number &&
    line.text === b[i].text && line.ending === b[i].ending);
}
export function lineRangePlanIsCurrent(plan: LineRangePlan, editor: EditorState): boolean {
  const current = currentActiveDocument(editor);
  if (!current || editor.sessionRevision !== plan.sessionRevision ||
      !isUnchangedSnapshot(current, plan.document) ||
      !isUnchangedSnapshot(current, plan.change.snapshot) || plan.change.id !== current.id) return false;
  const fresh = planLineRange(editor, plan.request);
  if (!fresh.ok) return false;
  const expected = fresh.value;
  return expected.change.content === plan.change.content && expected.changedRows === plan.changedRows &&
    expected.removedRows === plan.removedRows && sameLines(expected.before, plan.before) && sameLines(expected.after, plan.after);
}
export function rangeEndingLabel(ending: DiffLineEnding): string {
  return ending === '\r\n' ? 'CRLF' : ending === '\r' ? 'CR' : ending === '\n' ? 'LF' : 'EOF';
}

/** Quoted display text makes empty rows and literal "(empty)" distinct,
 * preserves whitespace, and exposes control/directional characters. */
export function visibleRangeText(text: string): string {
  return JSON.stringify(text).replace(/[\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,
    char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'));
}
