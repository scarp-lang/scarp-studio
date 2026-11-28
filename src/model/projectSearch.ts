import { isDirty, isScarpPath, sameFilePath, type StudioDocument } from './documents';
import { searchOpenFiles, type OpenFileSearchHit, type SearchOptions } from './openFileSearch';
import { utf8ByteLength } from './utf8Text';
import { projectSourceBuffersChanged } from './projectSourceState';
import { safeRelativeScarpSourceName } from './folderListing';

/** A completed project search should survive switching tabs and opening the
 * result's own source, so users can inspect several matches without rescanning.
 * In-project buffer mutations, Save As, close/reopen or replacements invalidate
 * its snapshot. Project selection/refresh and changed search options are
 * separately invalidated by the editor. In-flight searches still reject any
 * whole-editor session change, even when completed results could be retained.
 */
export function editorChangeInvalidatesProjectSearch(
  before: readonly StudioDocument[],
  after: readonly StudioDocument[],
  selectedProjectPath: string | null,
): boolean {
  return selectedProjectPath !== null &&
    projectSourceBuffersChanged(before, after, selectedProjectPath);
}


/** Explicit read-only search of ONLY the already-listed Scarp project sources.
 * A deliberately small I/O budget is distinct from the normal 4 MiB editor
 * limit. Only the selected Explorer listing is searched; no additional
 * recursive crawling or on-disk replacements occur during a search.
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

export const PROJECT_SEARCH_FILE_STATES = ['scanned','file-limit','read-failed','byte-limit','content-limit','invalid-listing'] as const;
export type ProjectSearchFileState = typeof PROJECT_SEARCH_FILE_STATES[number];
export interface ProjectSearchFileEvidence {
  readonly name:string;
  readonly path:string;
  readonly state:ProjectSearchFileState;
  readonly origin:'open-buffer'|'disk'|null;
}
export interface ProjectSearchResult {
  /** One row per bounded listing entry; absent on older or empty reports. */
  fileEvidence?: readonly ProjectSearchFileEvidence[];
  hits: ProjectSearchHit[];
  /** Selected project sources scanned to completion in memory. */
  searchedFiles: number;
  /** Files not fully scanned, including partially scanned and inaccessible files. */
  skippedFiles: number;
  totalListedFiles: number;
  truncated: boolean;
  error: string | null;
}

/** Divide the capped, already-scoped listing fairly by actual directory.
 * Preserve the familiar root/src/tests/examples priority while giving every
 * additional Scarp practice folder its own search turn. */
function sourceGroup(name: string): string {
  const lastSlash = name.lastIndexOf('/');
  return lastSlash < 0 ? '' : name.slice(0, lastSlash);
}

/** Round-robin the project root, standard subfolders, and all validated
 * nested practice folders. Within each group, prefer listed dirty buffers
 * before main.srp and other clean sources. Never construct native paths from
 * filenames; the only paths used are the originals from the Explorer listing.
 */
export function selectProjectSearchSources(
  listed: readonly ProjectSearchSource[],
  preferredPaths: readonly string[] = [],
): ProjectSearchSource[] {
  const groups = new Map<string, ProjectSearchSource[]>();
  const seen: string[] = [];
  for (const source of listed.slice(0, MAX_LISTED_SOURCES)) {
    if (!safeRelativeScarpSourceName(source.name) || !isScarpPath(source.path) ||
        seen.some(path => sameFilePath(path, source.path))) continue;
    seen.push(source.path);
    const directory = sourceGroup(source.name);
    const existing = groups.get(directory) ?? [];
    existing.push(source);
    groups.set(directory, existing);
  }
  const priority = ['', 'src', 'tests', 'examples'];
  const directories = [...groups.keys()].sort((a, b) => {
    const p = priority.indexOf(a);
    const q = priority.indexOf(b);
    if (p >= 0 || q >= 0) {
      if (p < 0) return 1;
      if (q < 0) return -1;
      return p - q;
    }
    return a.localeCompare(b, 'en', { numeric: true });
  });
  const isPreferred = (source: ProjectSearchSource): boolean =>
    preferredPaths.some(path => sameFilePath(path, source.path));
  const isMain = (source: ProjectSearchSource): boolean =>
    source.name.toLowerCase().split('/').at(-1) === 'main.srp';
  const ordered = directories.map(directory => {
    const group = groups.get(directory)!;
    return [
      ...group.filter(isPreferred),
      ...group.filter(source => !isPreferred(source) && isMain(source)),
      ...group.filter(source => !isPreferred(source) && !isMain(source)),
    ];
  });
  const next = ordered.map(() => 0);
  const selected: ProjectSearchSource[] = [];
  let hasMore = true;
  while (hasMore && selected.length < MAX_PROJECT_SEARCH_FILES) {
    hasMore = false;
    for (let i = 0; i < ordered.length && selected.length < MAX_PROJECT_SEARCH_FILES; i++) {
      if (next[i] >= ordered[i].length) continue;
      selected.push(ordered[i][next[i]++]);
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

  const selected = selectProjectSearchSources(
    listed,
    openDocuments.filter((document) => document.path !== null && isDirty(document))
      .map((document) => document.path!),
  );
  const evidence = listed.slice(0, MAX_LISTED_SOURCES).map(source => ({
    name:source.name,path:source.path,
    state:'file-limit' as ProjectSearchFileState,origin:null as ProjectSearchFileEvidence['origin'],
  }));
  // The selector returns original source objects. Keep row identity even
  // when an old caller supplies duplicate labels or native path aliases.
  const bySource=new Map<ProjectSearchSource,number>();
  listed.slice(0,MAX_LISTED_SOURCES).forEach((source,index)=>{
    if(!bySource.has(source))bySource.set(source,index);
    if(!safeRelativeScarpSourceName(source.name)||!isScarpPath(source.path)||
      listed.slice(0,index).some(other=>sameFilePath(other.path,source.path)))evidence[index].state='invalid-listing';
  });
  function mark(source:ProjectSearchSource,state:ProjectSearchFileState,origin:ProjectSearchFileEvidence['origin']=null){
    const index=bySource.get(source);
    if(index!==undefined)evidence[index]={name:source.name,path:source.path,state,origin};
  }
  let skipped = listed.length - selected.length;
  let truncated = skipped > 0;
  let totalBytes = 0;
  const snapshots: StudioDocument[] = [];
  const mapping = new Map<string, { path: string; name: string; fromOpenTab: boolean }>();
  const scannedSources=new Map<string,ProjectSearchSource>();

  for (let index = 0; index < selected.length; index++) {
    if (!isCurrent()) return null;
    // Stop before another native read once the aggregate budget is consumed.
    const remainingBytes = MAX_PROJECT_SEARCH_TOTAL_BYTES - totalBytes;
    if (remainingBytes === 0) {
      skipped += selected.length - index;
      for(const source of selected.slice(index))mark(source,'byte-limit');
      truncated = true;
      break;
    }
    const source = selected[index];
    // Allow the bounded scoped reader to reject a source that exceeds the
    // remaining budget before reading its contents from disk.
    const readLimit = Math.min(MAX_PROJECT_SEARCH_READ_BYTES, remainingBytes);
    const open = openDocuments.find((item) =>
      item.path !== null && sameFilePath(item.path, source.path));
    let content: string;
    if (open) {
      content = open.content;
    } else {
      try {
        content = await readSource(source.path, readLimit);
      } catch {
        if (!isCurrent()) return null;
        skipped++;
        mark(source,'read-failed','disk');
        truncated = true;
        continue;
      }
    }
    if (!isCurrent()) return null;
    // Independently enforce both UTF-8 byte budgets for open buffers and
    // even an incorrect native read adapter, without allocating encoded data.
    const sourceBytes = content.length <= readLimit
      ? utf8ByteLength(content) : readLimit + 1;
    if (sourceBytes > readLimit) {
      // A later, smaller source may still fit within remaining capacity.
      mark(source,'byte-limit',open?'open-buffer':'disk');
      skipped++;
      truncated = true;
      continue;
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
    scannedSources.set(document.id,source);
    mark(source,'content-limit',open?'open-buffer':'disk');
    mapping.set(document.id, {
      path: source.path, name: source.name, fromOpenTab: open !== undefined,
    });
  }
  if (!isCurrent()) return null;
  const result = searchOpenFiles(snapshots, query, options, id=>{
    const source=scannedSources.get(id);
    const origin=mapping.get(id);
    if(source&&origin)mark(source,'scanned',origin.fromOpenTab?'open-buffer':'disk');
  });
  return {
    fileEvidence:Object.freeze(evidence.map(row=>Object.freeze(row))),
    hits: result.hits.flatMap((hit) => {
      const source = mapping.get(hit.documentId);
      return source ? [{ ...source, match: hit }] : [];
    }),
    searchedFiles: result.searchedDocuments,
    skippedFiles: skipped + result.skippedDocuments,
    totalListedFiles: listed.length,
    truncated: truncated || result.truncated,
    error: result.error,
  };
}
