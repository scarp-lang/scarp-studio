import { isScarpPath, sameFilePath, type StudioDocument } from './documents';
import { searchOpenFiles, type OpenFileSearchHit, type SearchOptions } from './openFileSearch';
import { utf8ByteLength } from './utf8Text';

/** Explicit read-only search of ONLY the already-listed Scarp project sources.
 * A deliberately small I/O budget is distinct from the normal 4 MiB editor
 * limit. We never recursively crawl or apply replacements to files on disk.
 */
export const MAX_PROJECT_SEARCH_FILES = 24;
export const MAX_PROJECT_SEARCH_READ_BYTES = 512 * 1024;
export const MAX_PROJECT_SEARCH_TOTAL_BYTES = 2 * 1024 * 1024;
const MAX_LISTED_SOURCES = 200;

export interface ProjectSearchSource {
  name: string;
  path: string;
}

export interface ProjectSearchHit {
  path: string;
  name: string;
  fromOpenTab: boolean;
  match: OpenFileSearchHit;
}

export interface ProjectSearchResult {
  hits: ProjectSearchHit[];
  /** Selected project sources actually searched in memory. */
  searchedFiles: number;
  /** Files omitted by limits, unsafe entries, or inaccessible source reads. */
  skippedFiles: number;
  totalListedFiles: number;
  truncated: boolean;
  error: string | null;
}

function sourceGroup(name: string): number {
  if (name.startsWith('src/')) return 1;
  if (name.startsWith('tests/')) return 2;
  if (name.startsWith('examples/')) return 3;
  return 0;
}

const safeListedName = /^(?:(?:src|tests|examples)\/)?[^/\\\0]+\.srp$/i;

/** Round-robin the project root, src, tests and examples to avoid a crowded
 * directory hiding every other category. Prefer each group's main.srp first.
 * This only selects among files already authorized in the Explorer listing.
 */
export function selectProjectSearchSources(
  listed: readonly ProjectSearchSource[],
): ProjectSearchSource[] {
  const groups: ProjectSearchSource[][] = [[], [], [], []];
  const seen: string[] = [];
  for (const source of listed.slice(0, MAX_LISTED_SOURCES)) {
    if (!safeListedName.test(source.name) || !isScarpPath(source.path) ||
        seen.some((path) => sameFilePath(path, source.path))) continue;
    seen.push(source.path);
    groups[sourceGroup(source.name)].push(source);
  }
  const ordered = groups.map((group) => [
    ...group.filter((source) => source.name.toLowerCase().split('/').at(-1) === 'main.srp'),
    ...group.filter((source) => source.name.toLowerCase().split('/').at(-1) !== 'main.srp'),
  ]);
  const next = [0, 0, 0, 0];
  const selected: ProjectSearchSource[] = [];
  let hasMore = true;
  while (hasMore && selected.length < MAX_PROJECT_SEARCH_FILES) {
    hasMore = false;
    for (let index = 0; index < ordered.length && selected.length < MAX_PROJECT_SEARCH_FILES; index++) {
      if (next[index] >= ordered[index].length) continue;
      selected.push(ordered[index][next[index]++]);
      hasMore = true;
    }
  }
  return selected;
}

/** Search takes an injected scoped, size-bounded reader and cancellation
 * predicate, so unit tests need no Tauri runtime. Disk errors are reported as
 * skipped sources; they cannot widen permissions or fall back to arbitrary paths.
 *
 * Open tabs always win over disk content. In particular an unsaved edit is
 * searched in its live buffer without rereading/overwriting it.
 */
export async function searchListedProjectSources(
  listed: readonly ProjectSearchSource[],
  openDocuments: readonly StudioDocument[],
  query: string,
  options: SearchOptions,
  readSource: (path: string, maxBytes: number) => Promise<string>,
  isCurrent: () => boolean = () => true,
): Promise<ProjectSearchResult | null> {
  const empty: ProjectSearchResult = {
    hits: [], searchedFiles: 0, skippedFiles: 0,
    totalListedFiles: listed.length, truncated: false, error: null,
  };
  const queryValidation = searchOpenFiles([], query, options);
  if (queryValidation.error) return { ...empty, error: queryValidation.error };
  if (!query) return empty;

  const selected = selectProjectSearchSources(listed);
  let skipped = listed.length - selected.length;
  let truncated = skipped > 0;
  let totalBytes = 0;
  const snapshots: StudioDocument[] = [];
  const mapping = new Map<string, { path: string; name: string; fromOpenTab: boolean }>();

  for (let index = 0; index < selected.length; index++) {
    if (!isCurrent()) return null;
    const source = selected[index];
    const open = openDocuments.find((item) =>
      item.path !== null && sameFilePath(item.path, source.path));
    let content: string;
    if (open) {
      content = open.content;
    } else {
      try {
        content = await readSource(source.path, MAX_PROJECT_SEARCH_READ_BYTES);
      } catch {
        if (!isCurrent()) return null;
        skipped++;
        truncated = true;
        continue;
      }
    }
    if (!isCurrent()) return null;
    // Enforce the cap again for an open buffer or an incorrectly implemented
    // read adapter, not merely through the Tauri source-read contract.
    // Both limits count actual UTF-8 bytes, not just UTF-16 code units.
    // This prevents Hindi/emoji content from multiplying memory/I/O budgets.
    const sourceBytes = content.length <= MAX_PROJECT_SEARCH_READ_BYTES
      ? utf8ByteLength(content) : MAX_PROJECT_SEARCH_READ_BYTES + 1;
    if (sourceBytes > MAX_PROJECT_SEARCH_READ_BYTES) {
      skipped++;
      truncated = true;
      continue;
    }
    if (totalBytes + sourceBytes > MAX_PROJECT_SEARCH_TOTAL_BYTES) {
      skipped += selected.length - index;
      truncated = true;
      break;
    }
    totalBytes += sourceBytes;
    const document: StudioDocument = open ?? {
      id: 'project-search:' + index,
      name: source.name,
      path: source.path,
      content,
      savedContent: content,
      revision: 0,
    };
    snapshots.push(document);
    mapping.set(document.id, {
      path: source.path, name: source.name, fromOpenTab: open !== undefined,
    });
  }
  if (!isCurrent()) return null;
  const result = searchOpenFiles(snapshots, query, options);
  return {
    hits: result.hits.flatMap((hit) => {
      const source = mapping.get(hit.documentId);
      return source ? [{ ...source, match: hit }] : [];
    }),
    searchedFiles: snapshots.length,
    skippedFiles: skipped + result.skippedDocuments,
    totalListedFiles: listed.length,
    truncated: truncated || result.truncated,
    error: result.error,
  };
}
