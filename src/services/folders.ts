import { join } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import { readDir } from '@tauri-apps/plugin-fs';
import { readScarpSource } from './sourceRead';
import { isScarpPath, sameFilePath } from '../model/documents';
import {
  collectTopLevelScarpNames, selectBalancedScarpProjectNames,
  MAX_DISPLAYED_SCARP_FILES, type ScarpProjectNameGroup,
} from '../model/folderListing';

export interface FolderFile {
  name: string;
  path: string;
}

/** A fixed, Scarp-specific project view: no unbounded recursion or arbitrary
 * directory names. The user-selected dialog folder is the only search root.
 * Tauri FS scope is the ultimate access boundary for every read.
 */
const SCARP_PROJECT_SUBFOLDERS = ['src', 'tests', 'examples'] as const;

export interface ScarpFolderScan {
  path: string;
  files: FolderFile[];
  truncated: boolean;
  unavailableFolders: string[];
}

export async function chooseSourceFolder(): Promise<ScarpFolderScan | null> {
  const path = await open({ directory: true, multiple: false, title: 'Choose Scarp folder' });
  if (typeof path !== 'string') return null;
  return scanSourceFolder(path);
}

/** Re-scan only a folder previously selected by the user. No automatic
 * watchers, unbounded recursion or source-file content reads.
 * The caller owns the current selected-folder identity and Tauri scope.
 */
export async function scanSourceFolder(path: string): Promise<ScarpFolderScan> {
  const entries = await readDir(path);
  const root = collectTopLevelScarpNames(entries);
  const groups: ScarpProjectNameGroup[] = [{ directory: '', names: root.names }];
  const directoryPaths = new Map<string, string>();
  let truncated = root.truncated;
  const unavailableFolders: string[] = [];
  // The generic 4096-entry budget still bounds ordinary .srp candidates.
  // Check only these three fixed directory names across the already-read
  // root entries: otherwise a crowded root can hide the entire src/tests/
  // examples project structure simply due to filesystem enumeration order.
  // Never follow a symlink, recurse, or join an untrusted directory name.
  const namedDirectories = new Map<string, boolean>();
  for (const entry of entries) {
    if (SCARP_PROJECT_SUBFOLDERS.some((name) => name === entry.name) &&
        !namedDirectories.has(entry.name)) {
      namedDirectories.set(entry.name, entry.isDirectory && !entry.isSymlink);
      if (namedDirectories.size === SCARP_PROJECT_SUBFOLDERS.length) break;
    }
  }
  for (const directoryName of SCARP_PROJECT_SUBFOLDERS) {
    if (!namedDirectories.get(directoryName)) continue;
    try {
      const subdir = await join(path, directoryName);
      const childListing = collectTopLevelScarpNames(await readDir(subdir));
      truncated ||= childListing.truncated;
      groups.push({ directory: directoryName, names: childListing.names });
      directoryPaths.set(directoryName, subdir);
    } catch {
      // A denied/removed directory must not silently masquerade as empty.
      unavailableFolders.push(directoryName);
    }
  }

  // Selection is fair across populated directories and always bounded.
  // Build paths only for the selected entries, not up to 800 candidates.
  const availableNames = groups.reduce((sum, group) => sum + group.names.length, 0);
  truncated ||= availableNames > MAX_DISPLAYED_SCARP_FILES;
  const names = selectBalancedScarpProjectNames(groups);
  const files: FolderFile[] = await Promise.all(names.map(async (name) => {
    const separator = name.indexOf('/');
    const folder = separator < 0 ? path : directoryPaths.get(name.slice(0, separator));
    if (!folder) throw new Error('The Scarp Explorer listing is inconsistent.');
    return {
      name,
      path: await join(folder, separator < 0 ? name : name.slice(separator + 1)),
    };
  }));
  return { path, files, truncated, unavailableFolders };
}

/** A caller can read only a Scarp entry listed in the current chosen folder.
 * The native Tauri scope remains the actual permission boundary.
 */
export async function readFolderSource(
  path: string,
  selectedFiles: readonly FolderFile[],
): Promise<string> {
  if (!isScarpPath(path)) throw new Error('Only .srp files can be opened.');
  const selected = selectedFiles.find((file) => sameFilePath(file.path, path));
  if (!selected) {
    throw new Error('Choose a Scarp file from the current folder listing.');
  }
  return readScarpSource(selected.path);
}
