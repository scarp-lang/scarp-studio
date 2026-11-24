/** Monaco treats CRLF as one line ending and lone CR/LF as line endings.
 * Keep source-coordinate logic independent of OS-specific file newlines.
 * All offsets are UTF-16 code units to match Monaco's editor model.
 */

/** Returns the next CR/LF offset, or -1 if no line ending remains. */
export function nextLineBreak(source: string, from: number): number {
  // A pair of indexOf calls repeatedly scans to EOF for the absent line
  // ending on LF-only or CR-only documents. Scan each code unit once
  // between successive breaks instead, keeping multi-line traversal linear.
  for (let index = Math.max(0, from); index < source.length; index++) {
    const unit = source.charCodeAt(index);
    if (unit === 10 || unit === 13) return index;
  }
  return -1;
}

/** Called only on a CR or LF offset returned by nextLineBreak. */
export function lineBreakWidth(source: string, offset: number): 1 | 2 {
  return source[offset] === '\r' && source[offset + 1] === '\n' ? 2 : 1;
}

/** Return one-based line text without CR/LF and without allocating every line.
 * A trailing line separator creates a valid empty final line.
 */
export function sourceLineAt(source: string, lineNumber: number): string | null {
  if (!Number.isSafeInteger(lineNumber) || lineNumber < 1) return null;
  let start = 0;
  for (let line = 1; line < lineNumber; line++) {
    const end = nextLineBreak(source, start);
    if (end < 0) return null;
    start = end + lineBreakWidth(source, end);
  }
  const end = nextLineBreak(source, start);
  return source.slice(start, end < 0 ? source.length : end);
}
