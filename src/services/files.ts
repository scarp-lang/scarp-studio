import { open, save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { assertScarpSourceText } from '../model/sourceLimits';
import { readScarpSource } from './sourceRead';
import type { StudioDocument } from '../model/documents';
import { isDirty, isScarpPath, sameFilePath } from '../model/documents';
import { isCurrentSaveAllSource } from '../model/saveSnapshotGuard';

const scarpFilter = [{ name: 'Scarp source', extensions: ['srp'] }];

/** The native picker only selects a path. Never read its bytes before
 * checking whether an existing editor tab already owns that path: the file
 * might have been changed, moved or deleted while the tab has unsaved work.
 */
export async function pickSourcePath(): Promise<string | null> {
  const path = await open({ title: 'Open Scarp source', multiple: false, filters: scarpFilter });
  if (typeof path !== 'string') return null;
  if (!isScarpPath(path)) throw new Error('Only .srp files can be opened.');
  return path;
}

/** Returns null on user cancellation, or the written path on success. */
export async function writeSourceFile(
  document: StudioDocument,
  forceSaveAs: boolean,
  otherOpenPaths: readonly string[] | (() => readonly string[]),
  isSnapshotCurrent?: () => boolean,
): Promise<string | null> {
  assertScarpSourceText(document.content);
  // Native Save As dialogs and preflight disk reads yield control to the UI.
  // Abort if the original editor snapshot is no longer the user's current
  // save intent. A later edit must not trigger an older write.
  const requireCurrentSnapshot = () => {
    if (isSnapshotCurrent && !isSnapshotCurrent()) {
      throw new Error(
        'The Scarp tab or source changed while preparing Save. No file was written. ' +
        'Review your latest edits and retry Save or Save As.',
      );
    }
  };
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
  requireCurrentSnapshot();
  // Save As is asynchronous: another file may have opened while the native
  // chooser was on screen. Resolve occupied paths only after it closes.
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
    const diskContent = await readScarpSource(path);
    if (diskContent !== document.savedContent) {
      throw new Error(
        'This file changed on disk since it was opened or saved. ' +
        'Use Save As with a different filename to preserve both versions.',
      );
    }
  }
  // The previous on-disk snapshot check is asynchronous too. Keystrokes or
  // another tab activation during its read must not race an old save to disk.
  requireCurrentSnapshot();
  await writeTextFile(path, document.content);
  // A successful write call does not prove that the file still contains this
  // snapshot: an external editor, sync client or filesystem race can alter
  // the path before Studio records it as clean. This read is bounded, validates
  // UTF-8, and uses a single native file handle (see readScarpSource).
  // Never mark the tab saved if the resulting bytes cannot be verified.
  let diskAfterWrite: string;
  try {
    diskAfterWrite = await readScarpSource(path);
  } catch (caught) {
    const detail = caught instanceof Error ? caught.message : String(caught);
    throw new Error(
      'The write returned but the saved Scarp file could not be verified on disk. ' +
      'Keep the source open and inspect the destination before retrying or using Save As. ' +
      'Reason: ' + detail,
    );
  }
  if (diskAfterWrite !== document.content) {
    throw new Error(
      'The destination changed during or immediately after saving: its disk contents ' +
      'do not match the source snapshot Studio wrote. The source was NOT marked saved; ' +
      'inspect the destination and use Save As to preserve your edits.',
    );
  }
  return path;
}

/** Save All is deliberately sequential: each native Save As dialog must resolve
 * before another opens. Re-read each live document just before saving it so
 * edits made while an earlier chooser was open are never silently lost.
 *
 * The editor owns the saved state; this function never closes or switches tabs.
 * Cancellation stops the batch, preserving both completed saves and remaining
 * dirty documents. A failure stops at the first unsafe write.
 */
export async function saveAllModifiedSources(
  documentIds: readonly string[],
  getDocument: (id: string) => StudioDocument | undefined,
  getOtherOpenPaths: (id: string) => readonly string[],
  onSaved: (document: StudioDocument, path: string) => void,
): Promise<{ saved: number; cancelled: boolean }> {
  let saved = 0;
  const seen = new Set<string>();
  for (const id of documentIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const document = getDocument(id);
    if (!document || !isDirty(document)) continue;
    let path: string | null;
    try {
      // Even after the chooser returns, resolve currently occupied paths.
      path = await writeSourceFile(
        document, false, () => getOtherOpenPaths(id),
        () => isCurrentSaveAllSource(document, getDocument(id)),
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        'Save All stopped at ' + document.name + ' after ' + saved +
        ' successful save(s): ' + reason,
      );
    }
    if (path === null) return { saved, cancelled: true };
    // Mark only the content snapshot actually written, not newer edits.
    onSaved(document, path);
    saved += 1;
  }
  return { saved, cancelled: false };
}
