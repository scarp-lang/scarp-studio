import { isScarpPath } from './documents';

/** Tauri's readDir materializes a whole immediate directory. These budgets bound
 * frontend processing and displayed results, not the native readDir allocation.
 */
export const MAX_INSPECTED_FOLDER_ENTRIES = 4096;
export const MAX_DISPLAYED_SCARP_FILES = 200;

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
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
  const visible = names.slice(0, MAX_DISPLAYED_SCARP_FILES);
  // Keep the conventional main.srp entrypoint available even if more than
  // 200 alphabetically earlier files occupy the same directory. This does
  // not inspect beyond the fixed 4096-entry budget or increase the file cap.
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

/** The Explorer displays at most 200 sources across the chosen root and the
 * three fixed project folders. Round-robin selection prevents a crowded root
 * (or one large tests folder) from hiding all sources in another directory.
 * Inputs are already sanitized and independently bounded by
 * collectTopLevelScarpNames; this is not a filesystem permission boundary.
 */
export interface ScarpProjectNameGroup {
  directory: '' | 'src' | 'tests' | 'examples';
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
