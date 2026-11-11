import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import type { StudioDocument } from '../model/documents';
import { isScarpPath, sameFilePath } from '../model/documents';

const scarpFilter = [{ name: 'Scarp source', extensions: ['srp'] }];

export async function pickSourceFile(): Promise<{ path: string; content: string } | null> {
  const path = await open({ title: 'Open Scarp source', multiple: false, filters: scarpFilter });
  if (typeof path !== 'string') return null;
  if (!isScarpPath(path)) throw new Error('Only .srp files can be opened.');
  return { path, content: await readTextFile(path) };
}

/** Returns null on user cancellation, or the written path on success. */
export async function writeSourceFile(
  document: StudioDocument,
  forceSaveAs: boolean,
  otherOpenPaths: string[],
): Promise<string | null> {
  let path = forceSaveAs ? null : document.path;
  if (!path) {
    path = await save({
      title: 'Save Scarp source',
      defaultPath: document.path || document.name,
      filters: scarpFilter,
    });
  }
  if (!path) return null;
  if (!isScarpPath(path)) throw new Error('Scarp source files must end in .srp.');
  if (otherOpenPaths.some((otherPath) => sameFilePath(otherPath, path))) {
    throw new Error('That file is already open in another tab.');
  }
  await writeTextFile(path, document.content);
  return path;
}
