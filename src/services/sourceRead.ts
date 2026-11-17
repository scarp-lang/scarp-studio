import { open } from '@tauri-apps/plugin-fs';
import { isScarpPath } from '../model/documents';
import { assertScarpSourceBytes, MAX_SCARP_SOURCE_BYTES } from '../model/sourceLimits';

const READ_CHUNK_BYTES = 16 * 1024;

/** Load only user-authorized Tauri FS paths. The same open handle is stat'ed
 * and read in bounded chunks, so replacing or growing a file after metadata
 * inspection cannot allocate an unlimited native text-read buffer.
 *
 * Do not use `readTextFile`: its whole-file allocation happens before the
 * JavaScript-side 4 MiB check. Every path (Open, Reload, Explorer and external
 * modification detection before Save) goes through this reader.
 */
export async function readScarpSource(path: string): Promise<string> {
  if (!isScarpPath(path)) throw new Error('Only .srp sources may be read in Scarp Studio.');
  const file = await open(path, { read: true });
  try {
    const info = await file.stat();
    if (!info.isFile) throw new Error('Scarp source must be a regular file.');
    assertScarpSourceBytes(info.size);

    let bytesRead = 0;
    const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
    const pieces: string[] = [];
    for (;;) {
      // Request at most one more byte past the limit, to detect file growth
      // without loading the rest of the source or trusting stale metadata.
      const remaining = MAX_SCARP_SOURCE_BYTES - bytesRead;
      const buffer = new Uint8Array(Math.min(READ_CHUNK_BYTES, remaining + 1));
      const count = await file.read(buffer);
      if (count === null) break;
      if (!Number.isSafeInteger(count) || count <= 0 || count > buffer.byteLength) {
        throw new Error('Scarp source reader returned an invalid byte count.');
      }
      bytesRead += count;
      assertScarpSourceBytes(bytesRead);
      pieces.push(decoder.decode(buffer.subarray(0, count), { stream: true }));
    }
    // `fatal` rejects invalid or incomplete UTF-8, rather than silently
    // altering source text. ignoreBOM preserves an existing source BOM.
    pieces.push(decoder.decode());
    return pieces.join('');
  } finally {
    await file.close();
  }
}
