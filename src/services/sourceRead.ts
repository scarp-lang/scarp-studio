import { readTextFile, stat } from '@tauri-apps/plugin-fs';
import { assertScarpSourceBytes, assertScarpSourceText } from '../model/sourceLimits';

/** Preflight metadata before the Tauri text-read operation, and verify again
 * after it returns. A file replaced or enlarged *during* read can still consume
 * memory in the underlying readTextFile call; native bounded streams are future work.
 */
export async function readScarpSource(path: string): Promise<string> {
  const info = await stat(path);
  if (!info.isFile) throw new Error('Scarp source must be a regular file.');
  assertScarpSourceBytes(info.size);
  const content = await readTextFile(path);
  assertScarpSourceText(content);
  return content;
}
