import type { StudioDocument } from './documents';
import { sourceLineAt } from './sourceLines';

/** Session-only, snapshot-aware Scarp editor bookmarks.
 * No disk persistence, arbitrary path access or implicit source changes.
 * Ambiguous or edited anchor lines are stale rather than guessed.
 */
export const MAX_STUDIO_BOOKMARKS = 120;
export const MAX_BOOKMARKS_PER_DOCUMENT = 40;
export const MAX_BOOKMARK_SOURCE_UNITS = 512 * 1024;
export const MAX_BOOKMARK_SOURCE_LINES = 2400;
export const MAX_BOOKMARK_ANCHOR_UNITS = 240;
export const MAX_BOOKMARK_LABEL_UNITS = 88;

export interface SourceBookmark {
  id: string;
  documentId: string;
  documentName: string;
  originalLine: number;
  originalColumn: number;
  anchor: string;
  label: string;
  revision: number;
}
export type BookmarkStatus =
  'current' | 'relocated' | 'stale' | 'closed' | 'unavailable';
export interface BookmarkLocation {
  status: BookmarkStatus;
  line: number | null;
  column: number | null;
  reason: string | null;
}
export interface ResolvedBookmark {
  bookmark: SourceBookmark;
  location: BookmarkLocation;
}
export interface BookmarkFilters {
  scope: 'all' | 'active';
  status: BookmarkStatus | 'all';
  query: string;
  order: 'created' | 'source';
}

function lineStarts(source: string): number[] | null {
  if (source.length > MAX_BOOKMARK_SOURCE_UNITS) return null;
  const starts = [0];
  for (let i = 0; i < source.length; i++) {
    const unit = source.charCodeAt(i);
    if (unit === 13) {
      if (source.charCodeAt(i + 1) === 10) i++;
      starts.push(i + 1);
    } else if (unit === 10) {
      starts.push(i + 1);
    }
    if (starts.length > MAX_BOOKMARK_SOURCE_LINES) return null;
  }
  return starts;
}

function lineText(source: string, starts: readonly number[], index: number): string {
  if (index < 0 || index >= starts.length) return '';
  const start = starts[index];
  let end = index + 1 < starts.length ? starts[index + 1] : source.length;
  if (end > start && source.charCodeAt(end - 1) === 10) end--;
  if (end > start && source.charCodeAt(end - 1) === 13) end--;
  return source.slice(start, end);
}
function safeLineAnchor(anchor: string): boolean {
  return !!anchor.trim() && anchor.length <= MAX_BOOKMARK_ANCHOR_UNITS &&
    !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(anchor);
}
function safeLabel(line: string): string {
  return line.replace(/[\x00-\x1f\x7f]/g, ' ').trim()
    .slice(0, MAX_BOOKMARK_LABEL_UNITS);
}

/** A bookmark is created from the current exact document and cursor only.
 * The caller provides a monotonically increasing session sequence number.
 * Repeating a bookmark at the same line is rejected.
 */
export function createSourceBookmark(
  documents: readonly StudioDocument[],
  existing: readonly SourceBookmark[],
  documentId: string,
  line: number,
  column: number,
  sequence: number,
): SourceBookmark {
  const document = documents.find(item => item.id === documentId);
  if (!document) throw new Error('No open Scarp source for this bookmark.');
  if (!Number.isSafeInteger(line) || line < 1 ||
      !Number.isSafeInteger(column) || column < 1 ||
      !Number.isSafeInteger(sequence) || sequence < 0) {
    throw new Error('Bookmark position must be a valid source coordinate.');
  }
  if (existing.length >= MAX_STUDIO_BOOKMARKS) {
    throw new Error('Bookmark limit reached: remove an older bookmark first.');
  }
  if (existing.filter(item => item.documentId === documentId).length >=
      MAX_BOOKMARKS_PER_DOCUMENT) {
    throw new Error('Maximum 40 bookmarks per Scarp source.');
  }
  const starts = lineStarts(document.content);
  if (!starts || line > starts.length) {
    throw new Error('Bookmark source exceeds a safe size or line limit.');
  }
  const anchor = lineText(document.content, starts, line - 1);
  if (!safeLineAnchor(anchor)) {
    throw new Error('Choose a non-empty source line under 240 UTF-16 units.');
  }
  if (column > anchor.length + 1) {
    throw new Error('Bookmark column is outside the selected line.');
  }
  if (existing.some(item => item.documentId === documentId &&
      item.originalLine === line && item.anchor === anchor)) {
    throw new Error('This source line is already bookmarked.');
  }
  return {
    id: 'bookmark:' + sequence + ':' + documentId + ':' + line,
    documentId, documentName: document.name,
    originalLine: line, originalColumn: column, anchor,
    label: safeLabel(anchor), revision: document.revision,
  };
}

/** The original position is accepted when its full anchor line still
 * matches. Otherwise relocate only if EXACTLY one matching line remains.
 * Duplicate text is intentionally ambiguous after a move.
 */
export function resolveSourceBookmark(
  bookmark: SourceBookmark,
  documents: readonly StudioDocument[],
): BookmarkLocation {
  const document = documents.find(item => item.id === bookmark.documentId);
  if (!document) {
    return { status: 'closed', line: null, column: null,
      reason: 'The source tab is closed. Reopen it to create a new bookmark.' };
  }
  if (!safeLineAnchor(bookmark.anchor)) {
    return { status: 'stale', line: null, column: null,
      reason: 'Invalid or empty bookmark anchor.' };
  }
  const starts = lineStarts(document.content);
  if (!starts) {
    return { status: 'unavailable', line: null, column: null,
      reason: 'Source exceeds the bookmark analysis budget.' };
  }
  if (bookmark.originalLine <= starts.length &&
      lineText(document.content, starts, bookmark.originalLine - 1) === bookmark.anchor) {
    return {
      status: 'current', line: bookmark.originalLine,
      column: Math.min(bookmark.originalColumn, bookmark.anchor.length + 1),
      reason: null,
    };
  }
  let matchingLine: number | null = null;
  for (let index = 0; index < starts.length; index++) {
    if (lineText(document.content, starts, index) !== bookmark.anchor) continue;
    if (matchingLine !== null) {
      return { status: 'stale', line: null, column: null,
        reason: 'Multiple identical lines exist; select the desired line again.' };
    }
    matchingLine = index + 1;
  }
  if (matchingLine === null) {
    return { status: 'stale', line: null, column: null,
      reason: 'The original source line has changed or was removed.' };
  }
  return {
    status: 'relocated', line: matchingLine,
    column: Math.min(bookmark.originalColumn, bookmark.anchor.length + 1),
    reason: 'Bookmark moved with an unchanged unique source line.',
  };
}

export function resolveSourceBookmarks(
  bookmarks: readonly SourceBookmark[],
  documents: readonly StudioDocument[],
): ResolvedBookmark[] {
  return bookmarks.slice(0, MAX_STUDIO_BOOKMARKS).map(bookmark => ({
    bookmark, location: resolveSourceBookmark(bookmark, documents),
  }));
}
export function removeSourceBookmark(
  bookmarks: readonly SourceBookmark[], id: string,
): SourceBookmark[] {
  return bookmarks.filter(item => item.id !== id);
}
export function bookmarkTargetForCurrentSource(
  resolved: ResolvedBookmark,
  documents: readonly StudioDocument[],
): { documentId: string; revision: number; source: string; line: number; column: number } | null {
  const document = documents.find(item => item.id === resolved.bookmark.documentId);
  if (!document || (resolved.location.status !== 'current' &&
      resolved.location.status !== 'relocated') ||
      resolved.location.line === null || resolved.location.column === null) return null;
  // Resolve again against the latest immutable source snapshot. A renderer
  // or dialog may have changed the editor after the last list computation.
  const current = resolveSourceBookmark(resolved.bookmark, documents);
  if (current.line !== resolved.location.line ||
      current.column !== resolved.location.column) return null;
  return {
    documentId: document.id, revision: document.revision,
    source: document.content, line: current.line!, column: current.column!,
  };
}
export function filterSourceBookmarks(
  resolved: readonly ResolvedBookmark[],
  activeId: string | null,
  filters: BookmarkFilters,
): ResolvedBookmark[] {
  if (filters.query.length > 120) return [];
  const query = filters.query.trim().toLowerCase();
  const filtered = resolved.filter(entry =>
    (filters.scope === 'all' || entry.bookmark.documentId === activeId) &&
    (filters.status === 'all' || entry.location.status === filters.status) &&
    (!query || (entry.bookmark.label + ' ' + entry.bookmark.documentName)
      .toLowerCase().includes(query)));
  return filters.order === 'created' ? filtered :
    [...filtered].sort((a, b) =>
      a.bookmark.documentName.localeCompare(b.bookmark.documentName) ||
      (a.location.line ?? a.bookmark.originalLine) -
      (b.location.line ?? b.bookmark.originalLine));
}

/** Source Line accessor used by the official editor is also supported when
 * checking a single bookmark; this helper makes coordinate contract explicit.
 */
export function bookmarkSourceLine(
  document: StudioDocument, bookmark: SourceBookmark,
): string | null {
  const result = resolveSourceBookmark(bookmark, [document]);
  return result.line === null ? null : sourceLineAt(document.content, result.line);
}
