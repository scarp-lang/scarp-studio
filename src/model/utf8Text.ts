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
