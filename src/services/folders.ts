import { join } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import { readDir } from '@tauri-apps/plugin-fs';
import { readScarpSource } from './sourceRead';
import { isScarpPath, sameFilePath } from '../model/documents';
import {
  collectTopLevelScarpNames, collectBrowseableScarpFolders,
  selectBalancedScarpProjectNames, safeRelativeScarpDirectory, safeRelativeScarpSourceName,
  MAX_DISPLAYED_SCARP_FILES,
  MAX_SCANNED_SCARP_DIRECTORIES, MAX_SCARP_FOLDER_DEPTH,
  type ScarpProjectNameGroup,
} from '../model/folderListing';

export interface FolderFile {
  name: string;
  path: string;
}
/** Manifest roots discovered from safe, already-read directory entries. */
export interface ScarpProjectRoot {
  directory: string;
  path: string;
}
export interface ScarpFolderScan {
  path: string;
  files: FolderFile[];
  /** Safe relative folder names include empty folders. */
  directories: string[];
  /** Discovered project roots; only directories with a regular manifest qualify. */
  projectRoots: ScarpProjectRoot[];
  truncated: boolean;
  unavailableFolders: string[];
}
export async function chooseSourceFolder(): Promise<ScarpFolderScan | null> {
  // A native directory picker grants a non-recursive FS scope by default.
  // Request recursion explicitly so Tauri permits readDir/open in nested
  // practice projects. The user-selected root remains the only dynamic scope.
  const path = await open({ directory: true, recursive: true, multiple: false,
    title: 'Choose Scarp workspace folder' });
  if (typeof path !== 'string') return null;
  return scanSourceFolder(path);
}

/** Bounded breadth-first scanning from the native user-selected root.
 * Only validated non-symlink entries returned by readDir are ever joined.
 * No arbitrary filesystem roots, file-content scans or execution on open.
 * The Tauri native filesystem scope remains the actual permission boundary.
 */
export async function scanSourceFolder(path: string): Promise<ScarpFolderScan> {
  const queue: { directory: string; absolute: string; depth: number }[] = [
    { directory: '', absolute: path, depth: 0 },
  ];
  const directoryPaths = new Map<string, string>([['', path]]);
  const directories: string[] = [];
  const projectRoots: ScarpProjectRoot[] = [];
  const groups: ScarpProjectNameGroup[] = [];
  const unavailableFolders: string[] = [];
  let truncated = false;

  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    let entries: Awaited<ReturnType<typeof readDir>>;
    try {
      entries = await readDir(current.absolute);
    } catch (error) {
      if (!current.directory) throw error;
      unavailableFolders.push(current.directory);
      continue;
    }
    // Metadata-only manifest detection: never parse or execute a project
    // manifest when opening a workspace. The native compiler independently
    // validates the selected root and its manifest on explicit project action.
    if (entries.some(entry => entry.isFile && !entry.isSymlink &&
        (entry.name === 'scarp.project' || entry.name === 'Scarp.project'))) {
      projectRoots.push({ directory: current.directory, path: current.absolute });
    }
    const listing = collectTopLevelScarpNames(entries);
    groups.push({ directory: current.directory, names: listing.names });
    truncated ||= listing.truncated;
    const children = collectBrowseableScarpFolders(entries);
    if (current.depth >= MAX_SCARP_FOLDER_DEPTH) {
      if (children.length) truncated = true;
      continue;
    }
    for (const name of children) {
      // Count discovered directory slots even when native join fails. Otherwise
      // failing paths never enter the queue and can bypass the 64-slot cap.
      if (directories.length + 1 >= MAX_SCANNED_SCARP_DIRECTORIES) {
        truncated = true;
        break;
      }
      const relative = current.directory ? current.directory + '/' + name : name;
      if (!safeRelativeScarpDirectory(relative)) {
        truncated = true;
        continue;
      }
      directories.push(relative);
      try {
        const childPath = await join(current.absolute, name);
        directoryPaths.set(relative, childPath);
        queue.push({ directory: relative, absolute: childPath, depth: current.depth + 1 });
      } catch {
        unavailableFolders.push(relative);
      }
    }
  }

  const available = groups.reduce((sum, group) => sum + group.names.length, 0);
  truncated ||= available > MAX_DISPLAYED_SCARP_FILES;
  const names = selectBalancedScarpProjectNames(groups);
  const resolved = await Promise.all(names.map(async (name): Promise<FolderFile | null> => {
    // Keep the scan and Explorer's relative-name validation aligned, including
    // the full nested path length. An omitted source makes the scan partial.
    if (!safeRelativeScarpSourceName(name)) return null;
    const slash = name.lastIndexOf('/');
    const directory = slash < 0 ? '' : name.slice(0, slash);
    const parent = directoryPaths.get(directory);
    if (!parent) throw new Error('The Scarp Explorer listing is inconsistent.');
    try {
      return { name, path: await join(parent, name.slice(slash + 1)) };
    } catch {
      // A single native path resolution failure must not hide valid siblings.
      return null;
    }
  }));
  const files = resolved.filter((file): file is FolderFile => file !== null);
  truncated ||= files.length !== resolved.length;
  return { path, files, directories, projectRoots, truncated, unavailableFolders };
}

/** Only currently listed Scarp paths can be opened through the Explorer. */
export async function readFolderSource(
  path: string, selectedFiles: readonly FolderFile[],
): Promise<string> {
  if (!isScarpPath(path)) throw new Error('Only .srp files can be opened.');
  const selected = selectedFiles.find(file => sameFilePath(file.path, path));
  if (!selected) throw new Error('Choose a Scarp file from the current folder listing.');
  return readScarpSource(selected.path);
}
