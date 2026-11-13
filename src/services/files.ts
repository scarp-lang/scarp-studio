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
  otherOpenPaths: readonly string[] | (() => readonly string[]),
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
  // A Save As chooser can stay open while another source is opened in a tab.
  // Query the *current* open paths only once the actual destination is known.
  const occupiedPaths = typeof otherOpenPaths === 'function'
    ? otherOpenPaths()
    : otherOpenPaths;
  if (occupiedPaths.some((otherPath) => sameFilePath(otherPath, path))) {
    throw new Error('That file is already open in another tab.');
  }

  // Refuse to overwrite changes made by another editor since this tab's last
  // successful read/save. A missing or inaccessible original fails closed.
  // Save As to a different path uses the OS dialog's overwrite confirmation.
  if (document.path !== null && sameFilePath(path, document.path)) {
    const diskContent = await readTextFile(path);
    if (diskContent !== document.savedContent) {
      throw new Error(
        'This file changed on disk since it was opened or saved. ' +
        'Use Save As with a different filename to preserve both versions.',
      );
    }
  }
  await writeTextFile(path, document.content);
  return path;
}
