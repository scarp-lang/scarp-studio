/** Fixed Studio limits smaller than the Scarp CLI defaults.
 * A Run receives only this explicit, session-local UTF-8 snapshot.
 * Native Rust repeats every check; UI validation is not a security boundary.
 */
export const MAX_INPUT_BYTES = 16 * 1024;
export const MAX_INPUT_LINE_BYTES = 4096;
export const MAX_INPUT_LINES = 256;

export function programInputBytes(input: string): number {
  return new TextEncoder().encode(input).byteLength;
}

/** Keep CRLF, whitespace and final unterminated lines unchanged. */
export function validateProgramInput(input: string): void {
  const bytes = new TextEncoder().encode(input);
  if (bytes.byteLength > MAX_INPUT_BYTES) {
    throw new Error('Program input exceeds Studio\'s 16 KiB UTF-8 limit.');
  }
  if (!bytes.length) return;
  let lineBytes = 0;
  let lines = 1;
  for (const byte of bytes) {
    lineBytes += 1;
    if (lineBytes > MAX_INPUT_LINE_BYTES) {
      throw new Error('Program input line exceeds 4096 UTF-8 bytes including CR/LF.');
    }
    if (byte === 10) {
      lineBytes = 0;
      if (++lines > MAX_INPUT_LINES && bytes[bytes.length - 1] !== 10) {
        throw new Error('Program input exceeds 256 lines.');
      }
    }
  }
  // A terminal LF does not create a new supplied line.
  const suppliedLines = bytes[bytes.length - 1] === 10 ? lines - 1 : lines;
  if (suppliedLines > MAX_INPUT_LINES) {
    throw new Error('Program input exceeds 256 lines.');
  }
}
