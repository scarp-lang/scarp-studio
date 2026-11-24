import { isScarpPath } from './documents';

/** Tauri's readDir materializes a whole immediate directory. These budgets bound
 * generic frontend source processing and displayed results, not native readDir
 * allocation. We additionally inspect only fixed trusted names (main.srp and
 * src/tests/examples) across the already-returned entry names. This keeps a
 * conventional entrypoint from vanishing arbitrarily at the 4096 cutoff.
 */
export const MAX_INSPECTED_FOLDER_ENTRIES = 4096;
export const MAX_DISPLAYED_SCARP_FILES = 200;

/** Limits for bounded browsing of a multi-project practice workspace. */
export const MAX_SCARP_FOLDER_DEPTH = 5;
export const MAX_SCANNED_SCARP_DIRECTORIES = 64;
const STANDARD_FOLDERS = ['src', 'tests', 'examples'] as const;
const SKIPPED_FOLDERS = new Set([
  '.git', '.hg', '.svn', 'node_modules', 'target', 'dist', 'build',
  '.venv', 'venv', 'vendor', '.next', 'coverage',
]);

function safePathSegment(segment: string): boolean {
  return !!segment && segment !== '.' && segment !== '..' &&
    !/[/\\\x00-\x1f]/.test(segment);
}
function safeBrowsableDirectorySegment(segment: string): boolean {
  return safePathSegment(segment) && !segment.startsWith('.') &&
    !SKIPPED_FOLDERS.has(segment.toLowerCase());
}

export function safeRelativeScarpDirectory(path: string): boolean {
  if (!path || path.length > 1024) return false;
  const segments = path.split('/');
  return segments.length <= MAX_SCARP_FOLDER_DEPTH &&
    segments.every(safeBrowsableDirectorySegment);
}

export function safeRelativeScarpSourceName(name: string): boolean {
  if (!name || name.length > 1024) return false;
  const segments = name.split('/');
  const basename = segments[segments.length - 1];
  return segments.length <= MAX_SCARP_FOLDER_DEPTH + 1 &&
    segments.slice(0, -1).every(safeBrowsableDirectorySegment) &&
    safePathSegment(basename) && isScarpPath(basename);
}

export function safeScarpDirectoryEntry(entry: FolderEntryCandidate & { isDirectory?: boolean }): boolean {
  return entry.isDirectory === true && entry.isFile === false && !entry.isSymlink &&
    safePathSegment(entry.name) && !entry.name.startsWith('.') &&
    !SKIPPED_FOLDERS.has(entry.name.toLowerCase());
}

/** Other directory names are examined within the normal 4096-entry budget.
 * Known project folders remain discoverable outside it as before. */
export function collectBrowseableScarpFolders(
  entries: readonly (FolderEntryCandidate & { isDirectory?: boolean })[],
): string[] {
  const result = new Set(entries.slice(0, MAX_INSPECTED_FOLDER_ENTRIES)
    .filter(safeScarpDirectoryEntry).map(entry => entry.name));
  for (const standard of STANDARD_FOLDERS) {
    const entry = entries.find(candidate =>
      candidate.name === standard && safeScarpDirectoryEntry(candidate));
    if (entry) result.add(standard);
  }
  return [...result].sort((a, b) => {
    const first = STANDARD_FOLDERS.indexOf(a as typeof STANDARD_FOLDERS[number]);
    const second = STANDARD_FOLDERS.indexOf(b as typeof STANDARD_FOLDERS[number]);
    if (first >= 0 || second >= 0) {
      if (first < 0) return 1;
      if (second < 0) return -1;
      return first - second;
    }
    return a.localeCompare(b, 'en', { numeric: true });
  });
}

export interface FolderEntryCandidate {
  name: string;
  isFile: boolean;
  isSymlink: boolean;
}

export interface FolderListing {
  names: string[];
  truncated: boolean;
}

/** Never use untrusted directory entry names to construct arbitrary paths. */
export function safeTopLevelSourceName(entry: FolderEntryCandidate): boolean {
  return entry.isFile && !entry.isSymlink &&
    entry.name !== '.' && entry.name !== '..' &&
    !/[/\\\0]/.test(entry.name) &&
    isScarpPath(entry.name);
}

export function collectTopLevelScarpNames(
  entries: readonly FolderEntryCandidate[],
): FolderListing {
  const inspected = entries.slice(0, MAX_INSPECTED_FOLDER_ENTRIES);
  const names = inspected
    .filter(safeTopLevelSourceName)
    .map((entry) => entry.name);
  // readDir has already materialized the full immediate directory. A cheap
  // fixed-name lookup outside the generic 4096-entry processing budget avoids
  // hiding main.srp merely because the OS enumerated it last. The extension,
  // symlink and name-safety checks remain identical to ordinary candidates.
  const main = entries.find((entry) =>
    entry.name.toLowerCase() === 'main.srp' && safeTopLevelSourceName(entry));
  if (main && !names.includes(main.name)) names.push(main.name);
  names.sort((a, b) => a.localeCompare(b));
  const visible = names.slice(0, MAX_DISPLAYED_SCARP_FILES);
  // Keep the conventional main.srp entrypoint available even if more than
  // 200 alphabetically earlier files occupy the same directory. This keeps
  // the display cap while allowing only the fixed-name safety exception.
  const entrypoint = names.find((name) => name.toLowerCase() === 'main.srp');
  if (entrypoint && !visible.includes(entrypoint)) {
    visible[visible.length - 1] = entrypoint;
    visible.sort((a, b) => a.localeCompare(b));
  }
  return {
    names: visible,
    truncated: entries.length > MAX_INSPECTED_FOLDER_ENTRIES ||
      names.length > MAX_DISPLAYED_SCARP_FILES,
  };
}

/** The Explorer displays at most 200 sources across the selected workspace's
 * bounded directory set. Round-robin selection prevents a crowded directory
 * from hiding all sources in another scanned directory.
 * Inputs are already sanitized and independently bounded by
 * collectTopLevelScarpNames; this is not a filesystem permission boundary.
 */
export interface ScarpProjectNameGroup {
  directory: string;
  names: readonly string[];
}

export function selectBalancedScarpProjectNames(
  groups: readonly ScarpProjectNameGroup[],
): string[] {
  // Give each visible main.srp first chance at a slot. A main.srp retained
  // by an individual folder's cap could still be crowded out by the combined
  // cap without this second priority pass.
  const ordered = groups.map((group) => {
    const main = group.names.find((name) => name.toLowerCase() === 'main.srp');
    return main ? [main, ...group.names.filter((name) => name !== main)] : group.names;
  });
  const next = groups.map(() => 0);
  const selected: string[] = [];
  let progressed = true;
  while (progressed && selected.length < MAX_DISPLAYED_SCARP_FILES) {
    progressed = false;
    for (let i = 0; i < groups.length && selected.length < MAX_DISPLAYED_SCARP_FILES; i++) {
      const group = groups[i];
      const index = next[i];
      if (index >= ordered[i].length) continue;
      const name = ordered[i][index];
      selected.push(group.directory ? group.directory + '/' + name : name);
      next[i] = index + 1;
      progressed = true;
    }
  }
  // Preserve the familiar alphabetical Explorer order after fair selection.
  return selected.sort((a, b) => a.localeCompare(b));
}
