import type { StudioDocument } from './documents';

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
  matchText: string;
  offset: number;
  line: number;
  /** 1-based UTF-16 position, matching Monaco's column convention. */
  column: number;
  preview: string;
}

export interface OpenFileSearchResult {
  hits: OpenFileSearchHit[];
  skippedDocuments: number;
  truncated: boolean;
  error: string | null;
}

function quoteForRegex(query: string): string {
  return query.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

function isIdentifierCodePoint(char: string): boolean {
  return /[\p{L}\p{N}_]/u.test(char);
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

function linePreview(content: string, start: number, lineStart: number, matchLength: number): string {
  const endOfLine = content.indexOf('\n', start);
  const lineEnd = endOfLine < 0 ? content.length : endOfLine;
  const snippetStart = Math.max(lineStart, start - 40);
  const snippetEnd = Math.min(lineEnd, start + matchLength + 60);
  return (snippetStart > lineStart ? '…' : '') +
    content.slice(snippetStart, snippetEnd).replace(/\r$/, '') +
    (snippetEnd < lineEnd ? '…' : '');
}

/** Validate the exact buffer and selected range at the time of navigation. */
export function isCurrentSearchHit(
  document: StudioDocument | undefined,
  hit: OpenFileSearchHit,
): boolean {
  return document?.id === hit.documentId &&
    document.content === hit.sourceContent &&
    document.content.slice(hit.offset, hit.offset + hit.matchText.length) === hit.matchText;
}

export function searchOpenFiles(
  documents: readonly StudioDocument[],
  query: string,
  options: SearchOptions,
): OpenFileSearchResult {
  const empty: OpenFileSearchResult = {
    hits: [], skippedDocuments: 0, truncated: false, error: null,
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
    let newlineCursor = 0;
    for (const match of content.matchAll(regex)) {
      candidatesExamined++;
      if (candidatesExamined > MAX_SEARCH_CANDIDATES) {
        return { hits, skippedDocuments, truncated: true, error: null };
      }
      if (options.wholeWord && !isWholeWord(content, match.index, match.index + match[0].length)) {
        continue;
      }
      while (true) {
        const nextNewline = content.indexOf('\n', newlineCursor);
        if (nextNewline === -1 || nextNewline >= match.index) break;
        line++;
        lineStart = nextNewline + 1;
        newlineCursor = lineStart;
      }
      hits.push({
        documentId: document.id,
        documentName: document.name,
        sourceContent: content,
        matchText: match[0],
        offset: match.index,
        line,
        column: match.index - lineStart + 1,
        preview: linePreview(content, match.index, lineStart, match[0].length),
      });
      if (hits.length >= MAX_SEARCH_RESULTS) {
        truncated = true;
        return { hits, skippedDocuments, truncated, error: null };
      }
    }
  }
  return { hits, skippedDocuments, truncated, error: null };
}
