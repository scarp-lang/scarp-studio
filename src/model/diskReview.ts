import { isUnchangedSnapshot } from './editorState';
import type { StudioDocument } from './documents';
import { lineBreakWidth, nextLineBreak } from './sourceLines';
import { unicodeSafePreviewBounds, utf8ByteLength } from './utf8Text';

/** A bounded, read-only three-way preview. This is NOT a patch/merge engine:
 * disk snapshots can change immediately after inspection and may not be
 * silently used to approve a later Save or Reload. Those actions must reread
 * the scoped source and enforce their own independent safety guards.
 */
export type DiskReviewStatus =
  | 'unchanged'
  | 'external-change'
  | 'conflict'
  | 'disk-matches-editor';

export interface DiskReview {
  status: DiskReviewStatus;
  diskBytes: number;
  editorDirty: boolean;
  /** First mismatching line relative to the last loaded/saved source. */
  externalLine: number | null;
  /** First mismatch relative to the current editor buffer. */
  editorLine: number | null;
  savedExcerpt: string | null;
  diskExcerpt: string | null;
  editorExcerpt: string | null;
}

const PREVIEW_BEFORE = 42;
const PREVIEW_AFTER = 66;

function firstDifference(left: string, right: string): number | null {
  if (left === right) return null;
  const common = Math.min(left.length, right.length);
  let index = 0;
  while (index < common && left.charCodeAt(index) === right.charCodeAt(index)) index++;
  return index;
}

function firstDifferentLine(content: string, offset: number): number {
  let line = 1;
  let start = 0;
  for (;;) {
    const end = nextLineBreak(content, start);
    if (end < 0 || end >= offset) return line;
    const next = end + lineBreakWidth(content, end);
    if (next > offset) return line;
    start = next;
    line++;
  }
}

function excerpt(content: string, offset: number): string {
  if (!content.length) return '(empty file)';
  const { start, end } = unicodeSafePreviewBounds(
    content,
    Math.max(0, offset - PREVIEW_BEFORE),
    Math.min(content.length, offset + PREVIEW_AFTER),
  );
  const text = content.slice(start, end)
    .replace(/\r\n|\r|\n/g, ' ↵ ')
    .replace(/\t/g, ' ⇥ ');
  return (start > 0 ? '…' : '') + (text || '(end of file)') +
    (end < content.length ? '…' : '');
}

/** Compare the last saved snapshot, current buffer and a separately read
 * on-disk snapshot without mutating either side. The excerpts and byte counts
 * are UI-only. No arbitrary multiline diff allocation is required.
 */
export function inspectDiskSnapshot(document: StudioDocument, diskContent: string): DiskReview {
  const external = firstDifference(document.savedContent, diskContent);
  const editor = firstDifference(document.content, diskContent);
  const editorDirty = document.content !== document.savedContent;
  const status: DiskReviewStatus = external === null
    ? 'unchanged'
    : editor === null
      ? 'disk-matches-editor'
      : editorDirty
        ? 'conflict'
        : 'external-change';
  return {
    status,
    diskBytes: utf8ByteLength(diskContent),
    editorDirty,
    externalLine: external === null ? null : firstDifferentLine(document.savedContent, external),
    editorLine: editor === null ? null : firstDifferentLine(document.content, editor),
    savedExcerpt: external === null ? null : excerpt(document.savedContent, external),
    diskExcerpt: external === null
      ? (editor === null ? null : excerpt(diskContent, editor))
      : excerpt(diskContent, external),
    editorExcerpt: editor === null ? null : excerpt(document.content, editor),
  };
}

/** In-flight native reads cannot return a comparison for a later tab, a
 * replaced file path or an A→B→A edit that restored byte-identical content.
 */
export function isCurrentDiskReview(
  snapshot: StudioDocument, activeDocument: StudioDocument | null,
): boolean {
  return activeDocument !== null && isUnchangedSnapshot(activeDocument, snapshot);
}
