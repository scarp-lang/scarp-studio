import { assertWellFormedUtf16, utf8ByteLength } from './utf8Text';

/** Protect the early-alpha Monaco editor from accidentally loading huge sources. */
export const MAX_SCARP_SOURCE_BYTES = 4 * 1024 * 1024;

export function assertScarpSourceBytes(byteCount: number): void {
  if (!Number.isSafeInteger(byteCount) || byteCount < 0 || byteCount > MAX_SCARP_SOURCE_BYTES) {
    throw new Error('Scarp source exceeds the 4 MiB editor file limit.');
  }
}

export function assertScarpSourceText(content: string): void {
  // For every well-formed JavaScript string, UTF-8 byte count is at least
  // UTF-16 code-unit count. Refuse impossible-to-fit inputs before allocating
  // an entire Uint8Array for a large editor paste. This is only a cheap lower
  // bound: Hindi, emoji and other Unicode still need the exact byte check.
  assertScarpSourceBytes(content.length);
  assertWellFormedUtf16(content, 'Scarp source');
  // Full-length exact Unicode counting no longer allocates an encoded 4 MiB buffer.
  assertScarpSourceBytes(utf8ByteLength(content));
}
