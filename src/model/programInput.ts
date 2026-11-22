import { assertWellFormedUtf16, utf8ByteLength } from './utf8Text';

/** Fixed Studio limits smaller than the Scarp CLI defaults.
 * A Run receives only this explicit, session-local UTF-8 snapshot.
 * Native Rust repeats every check; UI validation is not a security boundary.
 */
export const MAX_INPUT_BYTES = 16 * 1024;
export const MAX_INPUT_LINE_BYTES = 4096;
export const MAX_INPUT_LINES = 256;

export function programInputBytes(input: string): number {
  return utf8ByteLength(input);
}

export function programInputValidationError(input: string): string | null {
  try {
    validateProgramInput(input);
    return null;
  } catch (caught) {
    return caught instanceof Error ? caught.message : 'Program input is invalid.';
  }
}

/** Keep CRLF, whitespace and final unterminated lines unchanged. */
export function validateProgramInput(input: string): void {
  // A UTF-8 encoding cannot be smaller than the number of UTF-16 code units
  // of a well-formed string. Avoid a large pre-validation allocation if
  // input reaches this boundary outside the textarea's maxLength guard.
  if (input.length > MAX_INPUT_BYTES) {
    throw new Error('Program input exceeds Studio\'s 16 KiB UTF-8 limit.');
  }
  // TextEncoder silently replaces lone surrogates unless rejected first.
  assertWellFormedUtf16(input, 'Program input');
  // Live input validation must reject oversized Unicode before allocating.
  if (utf8ByteLength(input) > MAX_INPUT_BYTES) {
    throw new Error('Program input exceeds Studio\'s 16 KiB UTF-8 limit.');
  }
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
