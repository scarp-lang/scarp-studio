import { join } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import { readDir } from '@tauri-apps/plugin-fs';
import { readScarpSource } from './sourceRead';
import { isScarpPath } from '../model/documents';

export interface FolderFile {
  name: string;
  path: string;
}

export async function chooseSourceFolder(): Promise<{
  path: string;
  files: FolderFile[];
} | null> {
  const path = await open({ directory: true, multiple: false, title: 'Choose Scarp folder' });
  if (typeof path !== 'string') return null;
  const entries = await readDir(path);
  const files: FolderFile[] = [];
  for (const entry of entries) {
    if (entry.isFile && isScarpPath(entry.name)) {
      files.push({ name: entry.name, path: await join(path, entry.name) });
    }
  }
  files.sort((left, right) => left.name.localeCompare(right.name));
  return { path, files };
}

export async function readFolderSource(path: string): Promise<string> {
  if (!isScarpPath(path)) throw new Error('Only .srp files can be opened.');
  return readScarpSource(path);
}
