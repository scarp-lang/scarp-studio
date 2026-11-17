import { assertScarpSourceText } from './sourceLimits';
import type { StudioDocument } from './documents';
import { searchOpenFiles, type SearchOptions } from './openFileSearch';
import type { BufferReplacement } from './editorState';

/** Literal, single-line replacements only; no regular expressions or disk writes. */
export const MAX_REPLACEMENT_TEXT_UNITS = 256;

export interface OpenFileReplaceChange extends BufferReplacement {
  documentName: string;
  matchCount: number;
  previewBefore: string;
  previewAfter: string;
}

export interface OpenFileReplacePlan {
  query: string;
  replacement: string;
  options: SearchOptions;
  totalReplacements: number;
  changes: OpenFileReplaceChange[];
}

/** Plan all changes against exact open-buffer snapshots.
 * Truncated search results are always rejected rather than silently applying
 * only the first part of a project-wide request. Disk files are never read.
 */
export function planOpenFileReplacement(
  documents: readonly StudioDocument[],
  query: string,
  replacement: string,
  options: SearchOptions,
): OpenFileReplacePlan {
  if (!query) throw new Error('Enter a search term before previewing replacements.');
  if (replacement.length > MAX_REPLACEMENT_TEXT_UNITS ||
      replacement.includes('\n') || replacement.includes('\r')) {
    throw new Error('Replacement text must be one line and at most 256 characters.');
  }
  const result = searchOpenFiles(documents, query, options);
  if (result.error) throw new Error(result.error);
  if (result.truncated) {
    throw new Error('Search results are incomplete. Narrow the search before replacing any text.');
  }
  const changes: OpenFileReplaceChange[] = [];
  let totalReplacements = 0;

  for (const document of documents) {
    // A replacement identical to the original match is a no-op; skip it.
    const hits = result.hits.filter((hit) =>
      hit.documentId === document.id && hit.matchText !== replacement);
    if (!hits.length) continue;
    const pieces: string[] = [];
    let cursor = 0;
    for (const hit of hits) {
      if (hit.sourceContent !== document.content || hit.offset < cursor ||
          document.content.slice(hit.offset, hit.offset + hit.matchText.length) !== hit.matchText) {
        throw new Error('Search results became stale. Preview replacements again.');
      }
      pieces.push(document.content.slice(cursor, hit.offset), replacement);
      cursor = hit.offset + hit.matchText.length;
    }
    pieces.push(document.content.slice(cursor));
    const content = pieces.join('');
    if (content === document.content) continue;
    assertScarpSourceText(content);
    const first = hits[0];
    const start = Math.max(0, first.offset - 32);
    const end = Math.min(document.content.length, first.offset + first.matchText.length + 44);
    const previewBefore = document.content.slice(start, end).replace(/[\r\n]+/g, ' ↵ ');
    const previewAfter = (
      document.content.slice(start, first.offset) + replacement +
      document.content.slice(first.offset + first.matchText.length, end)
    ).replace(/[\r\n]+/g, ' ↵ ');
    changes.push({
      id: document.id,
      snapshot: document,
      documentName: document.name,
      content,
      matchCount: hits.length,
      previewBefore,
      previewAfter,
    });
    totalReplacements += hits.length;
  }
  if (!changes.length) {
    throw new Error('No matching text would change in the currently open Scarp files.');
  }
  return {
    query,
    replacement,
    options: { ...options },
    totalReplacements,
    changes,
  };
}
