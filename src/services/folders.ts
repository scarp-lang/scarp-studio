import { join } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import { readDir } from '@tauri-apps/plugin-fs';
import { readScarpSource } from './sourceRead';
import { isScarpPath, sameFilePath } from '../model/documents';
import { collectTopLevelScarpNames } from '../model/folderListing';

export interface FolderFile {
  name: string;
  path: string;
}

/** The directory dialog supplies the runtime filesystem scope. This function
 * does not request recursive access and never follows a listed symlink.
 */
export async function chooseSourceFolder(): Promise<{
  path: string;
  files: FolderFile[];
  truncated: boolean;
} | null> {
  const path = await open({ directory: true, multiple: false, title: 'Choose Scarp folder' });
  if (typeof path !== 'string') return null;
  const listing = collectTopLevelScarpNames(await readDir(path));
  const files = await Promise.all(listing.names.map(async (name) => ({
    name,
    path: await join(path, name),
  })));
  return { path, files, truncated: listing.truncated };
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
