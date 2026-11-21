/** Protect the early-alpha Monaco editor from accidentally loading huge sources. */
export const MAX_SCARP_SOURCE_BYTES = 4 * 1024 * 1024;

export function assertScarpSourceBytes(byteCount: number): void {
  if (!Number.isSafeInteger(byteCount) || byteCount < 0 || byteCount > MAX_SCARP_SOURCE_BYTES) {
    throw new Error('Scarp source exceeds the 4 MiB editor file limit.');
  }
}

export function assertScarpSourceText(content: string): void {
  // UTF-16 character count is not UTF-8 byte count (notably for Hindi/emoji).
  assertScarpSourceBytes(new TextEncoder().encode(content).byteLength);
}
