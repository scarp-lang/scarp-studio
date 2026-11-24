import { join } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import { readDir } from '@tauri-apps/plugin-fs';
import { readScarpSource } from './sourceRead';
import { isScarpPath, sameFilePath } from '../model/documents';
import {
  collectTopLevelScarpNames, collectBrowseableScarpFolders,
  selectBalancedScarpProjectNames, MAX_DISPLAYED_SCARP_FILES,
  MAX_SCANNED_SCARP_DIRECTORIES, MAX_SCARP_FOLDER_DEPTH,
  type ScarpProjectNameGroup,
} from '../model/folderListing';

export interface FolderFile {
  name: string;
  path: string;
}
export interface ScarpFolderScan {
  path: string;
  files: FolderFile[];
  /** Safe relative folder names include empty folders. */
  directories: string[];
  truncated: boolean;
  unavailableFolders: string[];
}
export async function chooseSourceFolder(): Promise<ScarpFolderScan | null> {
  const path = await open({ directory: true, multiple: false, title: 'Choose Scarp workspace folder' });
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
    const listing = collectTopLevelScarpNames(entries);
    groups.push({ directory: current.directory, names: listing.names });
    truncated ||= listing.truncated;
    const children = collectBrowseableScarpFolders(entries);
    if (current.depth >= MAX_SCARP_FOLDER_DEPTH) {
      if (children.length) truncated = true;
      continue;
    }
    for (const name of children) {
      if (queue.length >= MAX_SCANNED_SCARP_DIRECTORIES) {
        truncated = true;
        break;
      }
      const relative = current.directory ? current.directory + '/' + name : name;
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
  const files: FolderFile[] = await Promise.all(names.map(async name => {
    const slash = name.lastIndexOf('/');
    const directory = slash < 0 ? '' : name.slice(0, slash);
    const parent = directoryPaths.get(directory);
    if (!parent) throw new Error('The Scarp Explorer listing is inconsistent.');
    return { name, path: await join(parent, name.slice(slash + 1)) };
  }));
  return { path, files, directories, truncated, unavailableFolders };
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
