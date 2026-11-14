import { join } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import { readDir } from '@tauri-apps/plugin-fs';
import { readScarpSource } from './sourceRead';
import { isScarpPath, sameFilePath } from '../model/documents';
import {
  collectTopLevelScarpNames, MAX_DISPLAYED_SCARP_FILES, MAX_INSPECTED_FOLDER_ENTRIES,
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

export async function chooseSourceFolder(): Promise<{
  path: string;
  files: FolderFile[];
  truncated: boolean;
  unavailableFolders: string[];
} | null> {
  const path = await open({ directory: true, multiple: false, title: 'Choose Scarp folder' });
  if (typeof path !== 'string') return null;
  const entries = await readDir(path);
  const root = collectTopLevelScarpNames(entries);
  const files: FolderFile[] = await Promise.all(root.names.map(async (name) => ({
    name,
    path: await join(path, name),
  })));
  let truncated = root.truncated;
  const unavailableFolders: string[] = [];
  const inspected = entries.slice(0, MAX_INSPECTED_FOLDER_ENTRIES);
  for (const directoryName of SCARP_PROJECT_SUBFOLDERS) {
    const directory = inspected.find((entry) =>
      entry.name === directoryName && entry.isDirectory && !entry.isSymlink);
    if (!directory) continue;
    try {
      const subdir = await join(path, directoryName);
      const childListing = collectTopLevelScarpNames(await readDir(subdir));
      truncated ||= childListing.truncated;
      const childFiles = await Promise.all(childListing.names.map(async (name) => ({
        name: directoryName + '/' + name,
        path: await join(subdir, name),
      })));
      files.push(...childFiles);
    } catch {
      // A denied/removed directory must not silently masquerade as empty.
      // Other accessible Scarp files remain available in the Explorer.
      unavailableFolders.push(directoryName);
    }
  }
  files.sort((a, b) => a.name.localeCompare(b.name));
  truncated ||= files.length > MAX_DISPLAYED_SCARP_FILES;
  return {
    path,
    files: files.slice(0, MAX_DISPLAYED_SCARP_FILES),
    truncated,
    unavailableFolders,
  };
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
