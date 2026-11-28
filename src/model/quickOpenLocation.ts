import type { StudioDocument } from './documents';
import { parseLineLocation } from './navigation';

export interface QuickOpenLocation {
  readonly line: number;
  readonly column: number;
}

export type QuickOpenLocationRequest =
  | { readonly kind: 'none' }
  | { readonly kind: 'valid'; readonly location: QuickOpenLocation }
  | { readonly kind: 'invalid'; readonly error: string };

export const MAX_QUICK_OPEN_LOCATION_UNITS = 19;

export function parseQuickOpenLocation(text: string): QuickOpenLocationRequest {
  if (text.length > MAX_QUICK_OPEN_LOCATION_UNITS || /[\x00-\x1f\x7f]/.test(text)) {
    return { kind: 'invalid', error: 'Enter a positive line or line:column, using up to nine digits per number.' };
  }
  if (!text.trim()) return { kind: 'none' };
  const location = parseLineLocation(text);
  return location ? { kind: 'valid', location } : {
    kind: 'invalid', error: 'Enter a positive line or line:column, using up to nine digits per number.',
  };
}

export interface QuickOpenLocationTarget {
  readonly documentId: string;
  readonly revision: number;
  readonly source: string;
  readonly line: number;
  readonly column: number;
  readonly clamped: boolean;
}

/** Resolve a one-based position from the actual current editor snapshot.
 * Treat CRLF as one newline and count UTF-16 columns like Monaco. Stop
 * scanning at the requested line instead of allocating a line array. */
export function quickOpenLocationTarget(
  document: StudioDocument,
  location: QuickOpenLocation,
): QuickOpenLocationTarget | null {
  if (!Number.isSafeInteger(location.line) || location.line < 1 ||
      !Number.isSafeInteger(location.column) || location.column < 1 ||
      !Number.isSafeInteger(document.revision) || document.revision < 0) return null;
  const content = document.content;
  let line = 1;
  let start = 0;
  let end = 0;

  while (end < content.length) {
    const unit = content.charCodeAt(end);
    if (unit !== 10 && unit !== 13) { end++; continue; }
    if (line === location.line) break;
    end++;
    if (unit === 13 && content.charCodeAt(end) === 10) end++;
    line++;
    start = end;
  }

  const maxColumn = end - start + 1;
  let column = Math.min(maxColumn, location.column);
  // Never place a cursor inside a UTF-16 surrogate pair.
  const index = start + column - 1;
  if (index > start && index < end) {
    const before = content.charCodeAt(index - 1);
    const after = content.charCodeAt(index);
    if (before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff) column--;
  }
  return Object.freeze({
    documentId: document.id, revision: document.revision, source: content,
    line, column, clamped: line !== location.line || column !== location.column,
  });
}
