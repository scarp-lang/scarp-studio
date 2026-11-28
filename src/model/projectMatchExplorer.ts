import { sameFilePath } from './documents';
import { safeRelativeScarpSourceName } from './folderListing';
import { MAX_SEARCH_RESULTS, MAX_SEARCH_QUERY_UNITS } from './openFileSearch';
import { MAX_PROJECT_SEARCH_READ_BYTES, MAX_PROJECT_SEARCH_TOTAL_BYTES, type ProjectSearchHit, type ProjectSearchResult } from './projectSearch';
import { nextLineBreak, lineBreakWidth } from './sourceLines';
import { unicodeSafePreviewBounds, utf8ByteLength } from './utf8Text';
import { MAX_SCOPE_REPORT_UNITS, type ScopedSearchSummary } from './projectSearchScope';
import { validRelativeLabel } from './projectSearchComparison';

export const PROJECT_MATCH_PAGE_SIZE = 20;
export const PROJECT_MATCH_FILTER_LIMIT = 120;
export const PROJECT_MATCH_MAX_LINE = MAX_PROJECT_SEARCH_READ_BYTES + 1;
const CONTEXT_BEFORE = 60;
const CONTEXT_AFTER = 80;
export type MatchOrigin = 'open-buffer' | 'disk';
export type MatchCoverage = 'fully-scanned' | 'partial' | 'unknown';

export interface ProjectMatchContext {
  readonly before: string;
  readonly match: string;
  readonly after: string;
  readonly leadingOmitted: boolean;
  readonly trailingOmitted: boolean;
}
export interface ProjectMatchRow {
  /** Index into the exact original result; never a filtered-row index. */
  readonly index: number;
  readonly name: string;
  readonly offset: number;
  readonly line: number;
  readonly column: number;
  readonly revision: number;
  readonly origin: MatchOrigin;
  readonly coverage: MatchCoverage;
  readonly context: ProjectMatchContext;
}
export interface ProjectMatchGroup {
  readonly name: string;
  readonly origin: MatchOrigin;
  readonly coverage: MatchCoverage;
  readonly count: number;
  readonly firstLine: number;
  readonly lastLine: number;
}
export interface ProjectMatchInventory {
  readonly rows: readonly ProjectMatchRow[];
  readonly groups: readonly ProjectMatchGroup[];
  readonly incomplete: boolean;
  readonly totalListedFiles: number;
  readonly scannedFiles: number;
  readonly skippedFiles: number;
  readonly deferredFiles: number;
}
export type MatchExplorerResult<T> = { readonly ok: true; readonly value: T } |
  { readonly ok: false; readonly error: string };
const fail = (error: string): MatchExplorerResult<never> => ({ ok: false, error });
function count(value: number, max = Number.MAX_SAFE_INTEGER): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= max;
}
function compareLabel(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function origin(hit: ProjectSearchHit): MatchOrigin { return hit.fromOpenTab ? 'open-buffer' : 'disk'; }

interface PendingGroup {
  readonly name: string;
  readonly path: string;
  readonly source: string;
  readonly documentId: string;
  readonly revision: number;
  readonly origin: MatchOrigin;
  readonly coverage: MatchCoverage;
  readonly entries: { index: number; hit: ProjectSearchHit }[];
}

/** Build a bounded presentation inventory from the exact search snapshot.
 * Validate offsets and coordinates in a single forward pass per source.
 * Only small context strings enter the view; no full source, native path or
 * editor identity is retained in its rows or reports.
 */
export function buildProjectMatchInventory(
  result: ProjectSearchResult, summary: ScopedSearchSummary,
): MatchExplorerResult<ProjectMatchInventory> {
  if (result.error || result.hits.length > MAX_SEARCH_RESULTS || result.hits.length !== summary.hits ||
      !count(result.totalListedFiles) || !count(result.searchedFiles) || !count(result.skippedFiles) ||
      result.searchedFiles + result.skippedFiles !== result.totalListedFiles ||
      result.totalListedFiles !== summary.inScope || result.searchedFiles !== summary.searched ||
      result.skippedFiles !== summary.skipped) return fail('Search result counts do not match the reviewed coverage.');

  const expected = new Map(summary.rows.map(row => [row.name, row]));
  if (expected.size !== summary.rows.length || expected.size !== summary.matchingFiles) {
    return fail('Search match groups are inconsistent.');
  }
  const evidence = new Map((summary.fileCoverage ?? []).map(row => [row.name, row]));
  if (summary.fileCoverage && evidence.size !== summary.fileCoverage.length) return fail('Duplicate file coverage labels.');
  const pending = new Map<string, PendingGroup>();
  let totalBytes = 0;

  for (const [index, hit] of result.hits.entries()) {
    const match = hit.match;
    const group = expected.get(hit.name);
    if (!group || !safeRelativeScarpSourceName(hit.name) || !validRelativeLabel(hit.name) ||
        group.openBuffer !== hit.fromOpenTab || !count(match.offset, MAX_PROJECT_SEARCH_READ_BYTES) ||
        !count(match.line, PROJECT_MATCH_MAX_LINE) || match.line < 1 ||
        !count(match.column, PROJECT_MATCH_MAX_LINE) || match.column < 1 ||
        !count(match.sourceRevision) || typeof match.documentId !== 'string' ||
        typeof match.sourceContent !== 'string' || match.sourceContent.length > MAX_PROJECT_SEARCH_READ_BYTES ||
        typeof match.matchText !== 'string' || !match.matchText || match.matchText.length > MAX_SEARCH_QUERY_UNITS ||
        /[\r\n]/.test(match.matchText) ||
        match.sourceContent.slice(match.offset, match.offset + match.matchText.length) !== match.matchText) {
      return fail('A displayed occurrence has invalid source or coordinate evidence.');
    }
    const file = evidence.get(hit.name);
    if (summary.fileCoverage && (!file || file.hits !== group.hits ||
        file.origin !== origin(hit) || (file.state !== 'scanned' && file.state !== 'content-limit'))) {
      return fail('Displayed matches disagree with per-file coverage.');
    }
    const existing = pending.get(hit.name);
    if (existing) {
      if (!sameFilePath(existing.path, hit.path) || existing.source !== match.sourceContent ||
          existing.documentId !== match.documentId || existing.revision !== match.sourceRevision ||
          existing.origin !== origin(hit)) return fail('A matching label contains mixed source snapshots.');
      existing.entries.push({ index, hit });
    } else {
      const bytes = utf8ByteLength(match.sourceContent);
      totalBytes += bytes;
      if (bytes > MAX_PROJECT_SEARCH_READ_BYTES || totalBytes > MAX_PROJECT_SEARCH_TOTAL_BYTES) {
        return fail('Displayed source snapshots exceed the review budget.');
      }
      pending.set(hit.name, {
        name: hit.name, path: hit.path, source: match.sourceContent,
        documentId: match.documentId, revision: match.sourceRevision, origin: origin(hit),
        coverage: !file ? 'unknown' : file.state === 'scanned' ? 'fully-scanned' : 'partial',
        entries: [{ index, hit }],
      });
    }
  }
  if (pending.size !== expected.size) return fail('Displayed source groups do not match coverage.');

  const rows: ProjectMatchRow[] = [];
  const groups: ProjectMatchGroup[] = [];
  for (const group of pending.values()) {
    if (group.entries.length !== expected.get(group.name)?.hits) return fail('A source match count is inconsistent.');
    const sorted = [...group.entries].sort((a, b) => a.hit.match.offset - b.hit.match.offset);
    let line = 1;
    let lineStart = 0;
    let nextEnd = nextLineBreak(group.source, 0);
    let priorEnd = 0;
    for (const { index, hit } of sorted) {
      const match = hit.match;
      const end = match.offset + match.matchText.length;
      if (match.offset < priorEnd) return fail('Displayed occurrences overlap or repeat.');
      priorEnd = end;
      while (nextEnd >= 0 && nextEnd < match.offset) {
        line++;
        lineStart = nextEnd + lineBreakWidth(group.source, nextEnd);
        nextEnd = nextLineBreak(group.source, lineStart);
      }
      const lineEnd = nextEnd < 0 ? group.source.length : nextEnd;
      if (match.offset < lineStart || end > lineEnd || line !== match.line ||
          match.column !== match.offset - lineStart + 1) {
        return fail('A displayed occurrence does not agree with its exact source coordinates.');
      }
      const bounds = unicodeSafePreviewBounds(group.source,
        Math.max(lineStart, match.offset - CONTEXT_BEFORE), Math.min(lineEnd, end + CONTEXT_AFTER));
      rows.push(Object.freeze({
        index, name: group.name, offset: match.offset, line: match.line, column: match.column,
        revision: group.revision, origin: group.origin, coverage: group.coverage,
        context: Object.freeze({
          before: group.source.slice(bounds.start, match.offset),
          match: match.matchText,
          after: group.source.slice(end, bounds.end),
          leadingOmitted: bounds.start > lineStart, trailingOmitted: bounds.end < lineEnd,
        }),
      }));
    }
    groups.push(Object.freeze({
      name: group.name, origin: group.origin, coverage: group.coverage, count: sorted.length,
      firstLine: sorted[0].hit.match.line, lastLine: sorted[sorted.length - 1].hit.match.line,
    }));
  }
  rows.sort((a, b) => a.index - b.index);
  groups.sort((a, b) => compareLabel(a.name, b.name));
  return { ok: true, value: Object.freeze({
    rows: Object.freeze(rows), groups: Object.freeze(groups),
    incomplete: summary.incomplete, totalListedFiles: result.totalListedFiles,
    scannedFiles: result.searchedFiles, skippedFiles: result.skippedFiles,
    deferredFiles: summary.batch?.deferred ?? 0,
  }) };
}

/** Render controls and isolated UTF-16 units visibly without changing the
 * original search range. Unicode scalars are preserved for normal previews.
 */
export function visibleMatchContext(text: string): string {
  let visible = '';
  for (const character of text) {
    const code = character.codePointAt(0)!;
    if (character === '\t') visible += '\\t';
    else if (code <= 0x1f || (code >= 0x7f && code <= 0x9f) ||
      (code >= 0xd800 && code <= 0xdfff) ||
      /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/.test(character)) {
      visible += '\\u' + code.toString(16).padStart(4, '0');
    } else visible += character;
  }
  return visible;
}

export interface ProjectMatchFilter {
  readonly source: string;
  readonly origin: 'all' | MatchOrigin;
  readonly coverage: 'all' | MatchCoverage;
  /** Literal filter over the bounded context, not another source search. */
  readonly context: string;
  readonly lineFrom: string;
  readonly lineTo: string;
  readonly sort: 'search-order' | 'source' | 'file-density';
}
export const DEFAULT_PROJECT_MATCH_FILTER: ProjectMatchFilter = Object.freeze({
  source: '', origin: 'all', coverage: 'all', context: '', lineFrom: '', lineTo: '', sort: 'search-order',
});
export const MATCH_ORIGIN_LABELS: Readonly<Record<MatchOrigin, string>> = Object.freeze({
  'open-buffer': 'Open buffer at search', disk: 'Disk snapshot at search',
});
export const MATCH_COVERAGE_LABELS: Readonly<Record<MatchCoverage, string>> = Object.freeze({
  'fully-scanned': 'Fully scanned source', partial: 'Partial source scan', unknown: 'Per-file coverage unavailable',
});
function parseLine(value: string): number | null | undefined {
  if (value === '') return null;
  if (!/^[0-9]{1,7}$/.test(value)) return undefined;
  const number = Number(value);
  return number >= 1 && number <= PROJECT_MATCH_MAX_LINE ? number : undefined;
}
export function filterProjectMatchInventory(
  inventory: ProjectMatchInventory, filter: ProjectMatchFilter,
): MatchExplorerResult<readonly ProjectMatchRow[]> {
  if (filter.source && !inventory.groups.some(group => group.name === filter.source)) {
    return fail('Choose a source label from the displayed matches.');
  }
  if (!['all', 'disk', 'open-buffer'].includes(filter.origin) ||
      !['all', 'fully-scanned', 'partial', 'unknown'].includes(filter.coverage) ||
      !['search-order', 'source', 'file-density'].includes(filter.sort) ||
      filter.context.length > PROJECT_MATCH_FILTER_LIMIT || /[\r\n]/.test(filter.context)) {
    return fail('The match filter is invalid.');
  }
  const from = parseLine(filter.lineFrom);
  const to = parseLine(filter.lineTo);
  if (from === undefined || to === undefined || (from !== null && to !== null && from > to)) {
    return fail('Enter a valid inclusive line range.');
  }
  const needle = filter.context.toLowerCase();
  const rows = inventory.rows.filter(row => {
    const snippet = row.context.before + row.context.match + row.context.after;
    return (!filter.source || row.name === filter.source) &&
      (filter.origin === 'all' || filter.origin === row.origin) &&
      (filter.coverage === 'all' || filter.coverage === row.coverage) &&
      (from === null || row.line >= from) && (to === null || row.line <= to) &&
      (!needle || snippet.toLowerCase().includes(needle));
  });
  const bySource = (a: ProjectMatchRow, b: ProjectMatchRow) =>
    compareLabel(a.name, b.name) || a.offset - b.offset || a.index - b.index;
  if (filter.sort === 'source') rows.sort(bySource);
  else if (filter.sort === 'file-density') {
    const sizes = new Map(inventory.groups.map(group => [group.name, group.count]));
    rows.sort((a, b) => (sizes.get(b.name) ?? 0) - (sizes.get(a.name) ?? 0) || bySource(a, b));
  }
  return { ok: true, value: Object.freeze(rows) };
}
export function pageProjectMatchRows(rows: readonly ProjectMatchRow[], requested: number) {
  const pages = Math.max(1, Math.ceil(rows.length / PROJECT_MATCH_PAGE_SIZE));
  const page = Math.max(1, Math.min(pages, Number.isSafeInteger(requested) ? requested : 1));
  const start = (page - 1) * PROJECT_MATCH_PAGE_SIZE;
  return { page, pages, first: rows.length ? start + 1 : 0,
    last: Math.min(rows.length, start + PROJECT_MATCH_PAGE_SIZE),
    rows: rows.slice(start, start + PROJECT_MATCH_PAGE_SIZE) };
}
export function adjacentProjectMatch(rows: readonly ProjectMatchRow[], index: number, direction: -1 | 1): ProjectMatchRow | null {
  const position = rows.findIndex(row => row.index === index);
  return position < 0 ? null : rows[position + direction] ?? null;
}

/** Recover only the original hit after rechecking its immutable displayed
 * identity. The actual navigation handler independently rechecks live/disk
 * source snapshots and current project authorization.
 */
export function resolveReviewedProjectMatch(result: ProjectSearchResult, row: ProjectMatchRow): ProjectSearchHit | null {
  const hit = result.hits[row.index];
  if (!hit || hit.name !== row.name || origin(hit) !== row.origin || hit.match.offset !== row.offset ||
      hit.match.line !== row.line || hit.match.column !== row.column ||
      hit.match.sourceRevision !== row.revision || hit.match.matchText !== row.context.match ||
      hit.match.sourceContent.slice(row.offset, row.offset + row.context.match.length) !== row.context.match) return null;
  return hit;
}

/** Counts describe the displayed and filtered rows only. Context strings,
 * content queries, native paths and full source snapshots are never exported.
 */
export function projectMatchExplorerReport(
  inventory: ProjectMatchInventory, rows: readonly ProjectMatchRow[], includeLocations = false,
): string {
  const lines = [
    'Scarp Studio — displayed project match review',
    'Only displayed search results are included; filters do not read or rescan source files.',
    'Scope coverage: ' + (inventory.incomplete ? 'incomplete' : 'complete for selected listed sources'),
    'Selected listed sources: ' + inventory.totalListedFiles,
    'Fully scanned sources: ' + inventory.scannedFiles,
    'Not fully scanned: ' + inventory.skippedFiles,
    'Deferred to other batches: ' + inventory.deferredFiles,
    'All displayed matches: ' + inventory.rows.length,
    'Filtered displayed matches: ' + rows.length,
    'Filtered source labels: ' + new Set(rows.map(row => row.name)).size,
    'Filtered open-buffer matches: ' + rows.filter(row => row.origin === 'open-buffer').length,
    'Filtered disk matches: ' + rows.filter(row => row.origin === 'disk').length,
    'Filtered partial-scan matches: ' + rows.filter(row => row.coverage === 'partial').length,
    'Filtered unknown-coverage matches: ' + rows.filter(row => row.coverage === 'unknown').length,
    'No query, match text, context, source snapshots or native paths are included.',
  ];
  if (includeLocations) {
    let length = lines.join('\n').length;
    for (const row of rows) {
      const line = JSON.stringify(row.name) + ':' + row.line + ':' + row.column +
        ' — ' + MATCH_ORIGIN_LABELS[row.origin] + '; ' + MATCH_COVERAGE_LABELS[row.coverage];
      if (length + line.length + 1 > MAX_SCOPE_REPORT_UNITS - 100) {
        lines.push('Additional locations omitted from report due to size limit.'); break;
      }
      lines.push(line); length += line.length + 1;
    }
  }
  return lines.join('\n');
}
