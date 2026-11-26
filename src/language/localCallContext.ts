/** Common conservative context rules for editor-only local function assistance.
 * This does not parse Scarp or establish semantic scope. Ambiguous contexts
 * deliberately suppress a local hint instead of guessing a compiler result.
 */
const declarationPrefixes = new Set([
  'funcra', 'new', 'record', 'variant', 'bind', 'var', 'import', 'as',
]);

export function blocksLocalFunctionName(previous: string): boolean {
  return declarationPrefixes.has(previous) || /[.:>]$/.test(previous);
}

/** A parenthesized expression following an expression terminator may be
 * an indirect invocation. Do not borrow the surrounding function's hint. */
export function blocksIndirectCall(previous: string): boolean {
  return previous === ')' || previous === ']' || previous === '"' ||
    /^[0-9]/.test(previous);
}
