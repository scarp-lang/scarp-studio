import type { StudioDocument } from './documents';
import { lineBreakWidth, nextLineBreak } from './sourceLines';
import { unicodeSafePreviewBounds } from './utf8Text';

/** Only already-open editor buffers are searched. No filesystem permissions
 * or background file reads are needed. All limits are deliberate UI budgets.
 */
export const MAX_SEARCH_DOCUMENTS = 32;
export const MAX_SEARCH_CONTENT_UNITS = 1_000_000;
export const MAX_SEARCH_QUERY_UNITS = 120;
export const MAX_SEARCH_RESULTS = 200;
// Also cap candidate matches rejected by whole-word filtering to avoid UI freezes.
export const MAX_SEARCH_CANDIDATES = 10_000;

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
}

export interface OpenFileSearchHit {
  documentId: string;
  documentName: string;
  /** Exact buffer snapshot: clicking after any edit cannot jump to stale text. */
  sourceContent: string;
  /** A matching string after intervening edits is still a stale search hit. */
  sourceRevision: number;
  matchText: string;
  offset: number;
  line: number;
  /** 1-based UTF-16 position, matching Monaco's column convention. */
  column: number;
  preview: string;
}

export interface OpenFileSearchResult {
  hits: OpenFileSearchHit[];
  /** Buffers scanned to completion; partially scanned buffers count as skipped. */
  searchedDocuments: number;
  skippedDocuments: number;
  truncated: boolean;
  error: string | null;
}

function quoteForRegex(query: string): string {
  return query.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

function isIdentifierCodePoint(char: string): boolean {
  // Unicode ID_Continue includes combining marks, connector punctuation and
  // joiners. Splitting an identifier between a base letter and a mark can
  // make whole-word Replace All accidentally alter only part of a name.
  return /[\p{ID_Continue}]/u.test(char);
}

function previousCharacter(content: string, index: number): string {
  if (index <= 0) return '';
  const last = content.charCodeAt(index - 1);
  return last >= 0xdc00 && last <= 0xdfff && index > 1
    ? content.slice(index - 2, index)
    : content.slice(index - 1, index);
}

function isWholeWord(content: string, start: number, end: number): boolean {
  const before = previousCharacter(content, start);
  const nextCodePoint = content.codePointAt(end);
  const after = nextCodePoint === undefined ? '' : String.fromCodePoint(nextCodePoint);
  return (!before || !isIdentifierCodePoint(before)) &&
    (!after || !isIdentifierCodePoint(after));
}

/** Source navigation stays at the exact Monaco UTF-16 match offset.
 * Only its display snippet is extended to avoid splitting Unicode scalars.
 */
function linePreview(
  content: string, start: number, lineStart: number, lineEnd: number, matchLength: number,
): string {
  const { start: snippetStart, end: snippetEnd } = unicodeSafePreviewBounds(
    content, Math.max(lineStart, start - 40),
    Math.min(lineEnd, start + matchLength + 60),
  );
  return (snippetStart > lineStart ? '…' : '') +
    content.slice(snippetStart, snippetEnd) +
    (snippetEnd < lineEnd ? '…' : '');
}

/** Validate the exact buffer and selected range at the time of navigation. */
export function isCurrentSearchHit(
  document: StudioDocument | undefined,
  hit: OpenFileSearchHit,
): boolean {
  return document?.id === hit.documentId &&
    document.content === hit.sourceContent &&
    document.revision === hit.sourceRevision &&
    document.content.slice(hit.offset, hit.offset + hit.matchText.length) === hit.matchText;
}

export function searchOpenFiles(
  documents: readonly StudioDocument[],
  query: string,
  options: SearchOptions,
): OpenFileSearchResult {
  const empty: OpenFileSearchResult = {
    hits: [], searchedDocuments: 0, skippedDocuments: 0, truncated: false, error: null,
  };
  if (query.length === 0) return empty;
  if (query.length > MAX_SEARCH_QUERY_UNITS) {
    return { ...empty, error: 'Search is limited to 120 characters.' };
  }
  if (query.includes('\n') || query.includes('\r')) {
    return { ...empty, error: 'Search for one line of text at a time.' };
  }

  const flags = options.caseSensitive ? 'gu' : 'giu';
  const regex = new RegExp(quoteForRegex(query), flags);
  const hits: OpenFileSearchHit[] = [];
  let skippedDocuments = Math.max(0, documents.length - MAX_SEARCH_DOCUMENTS);
  let truncated = documents.length > MAX_SEARCH_DOCUMENTS;
  let candidatesExamined = 0;
  let searchedDocuments = 0;
  const incomplete = (): OpenFileSearchResult => ({
    hits, searchedDocuments, skippedDocuments: documents.length - searchedDocuments,
    truncated: true, error: null,
  });

  for (const document of documents.slice(0, MAX_SEARCH_DOCUMENTS)) {
    const content = document.content;
    if (content.length > MAX_SEARCH_CONTENT_UNITS) {
      skippedDocuments++;
      truncated = true;
      continue;
    }
    regex.lastIndex = 0;
    let line = 1;
    let lineStart = 0;
    // Advance once per source line, not once per hit: this is linear even
    // when many matches occur on one long line.
    let nextEnd = nextLineBreak(content, 0);
    for (const match of content.matchAll(regex)) {
      candidatesExamined++;
      if (candidatesExamined > MAX_SEARCH_CANDIDATES) {
        return incomplete();
      }
      if (options.wholeWord && !isWholeWord(content, match.index, match.index + match[0].length)) {
        continue;
      }
      while (nextEnd >= 0 && nextEnd < match.index) {
        line++;
        lineStart = nextEnd + lineBreakWidth(content, nextEnd);
        nextEnd = nextLineBreak(content, lineStart);
      }
      hits.push({
        documentId: document.id,
        documentName: document.name,
        sourceContent: content,
        sourceRevision: document.revision,
        matchText: match[0],
        offset: match.index,
        line,
        column: match.index - lineStart + 1,
        preview: linePreview(
          content, match.index, lineStart,
          nextEnd < 0 ? content.length : nextEnd, match[0].length,
        ),
      });
      // Do not declare a complete, exactly-at-limit result truncated.
      // Discover the first *additional* accepted hit before stopping, while
      // still exposing no more than MAX_SEARCH_RESULTS hits to the UI.
      if (hits.length > MAX_SEARCH_RESULTS) {
        hits.pop();
        return incomplete();
      }
    }
    searchedDocuments++;
  }
  return { hits, searchedDocuments, skippedDocuments, truncated, error: null };
}
