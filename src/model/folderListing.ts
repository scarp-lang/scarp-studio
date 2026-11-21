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
  return {
    names: names.slice(0, MAX_DISPLAYED_SCARP_FILES),
    truncated: entries.length > MAX_INSPECTED_FOLDER_ENTRIES ||
      names.length > MAX_DISPLAYED_SCARP_FILES,
  };
}
