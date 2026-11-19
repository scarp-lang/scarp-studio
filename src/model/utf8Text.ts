/**
 * UTF-8 encoders replace isolated UTF-16 surrogates with U+FFFD by default.
 * Reject malformed JavaScript strings at the native I/O boundary instead of
 * silently changing the exact source text or the user's supplied stdin.
 *
 * Valid surrogate pairs (such as emoji) and non-ASCII BMP text are accepted.
 */
export function assertWellFormedUtf16(text: string, label: string): void {
  for (let index = 0; index < text.length; index++) {
    const unit = text.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new Error(label + ' contains an unpaired UTF-16 surrogate; UTF-8 encoding would change its text.');
      }
      index++;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      throw new Error(label + ' contains an unpaired UTF-16 surrogate; UTF-8 encoding would change its text.');
    }
  }
}

/** Adjust a bounded, UI-only UTF-16 preview range so neither edge cuts an
 * emoji / other supplementary Unicode scalar in half. The returned offsets
 * are still source offsets; callers may use them for display slicing only.
 * Monaco navigation and actual edit ranges must use their original offsets.
 */
export function unicodeSafePreviewBounds(
  text: string, requestedStart: number, requestedEnd: number,
): { start: number; end: number } {
  let start = requestedStart;
  let end = requestedEnd;
  const splitPair = (index: number): boolean => {
    if (index <= 0 || index >= text.length) return false;
    const preceding = text.charCodeAt(index - 1);
    const following = text.charCodeAt(index);
    return preceding >= 0xd800 && preceding <= 0xdbff &&
      following >= 0xdc00 && following <= 0xdfff;
  };
  if (splitPair(start)) start--;
  if (splitPair(end)) end++;
  return { start, end };
}
