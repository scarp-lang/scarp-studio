import type { ScarpCompletion } from './assist';
import { MAX_ASSIST_SCAN_UNITS } from './assist';

export interface CompletionInsertion {
  insertText: string;
  asSnippet: boolean;
}

/** Plan insertion from the suffix after the exact identifier replacement range.
 * This never edits the suffix itself. Preserve an existing argument list,
 * generic argument list, or terminator rather than generating a duplicate.
 * Only inspect the same bounded line; no speculative cross-file parsing. */
export function planCatalogInsertion(item: ScarpCompletion, following: string): CompletionInsertion {
  const suffix = following.length <= MAX_ASSIST_SCAN_UNITS ? following.trimStart() : '';
  const simpleName = /^[A-Za-z_][A-Za-z_0-9]*$/.test(item.label);
  if (simpleName && item.kind === 'function' &&
      item.insertText.startsWith(item.label + '(') && suffix.startsWith('(')) {
    return { insertText: item.label, asSnippet: false };
  }
  if (simpleName && item.insertText.startsWith(item.label + '<') && suffix.startsWith('<')) {
    return { insertText: item.label, asSnippet: false };
  }
  let insertText = item.insertText;
  if (suffix.startsWith(';') && insertText.endsWith(';')) insertText = insertText.slice(0, -1);
  // Only treat actual placeholder-bearing insertions as Monaco snippets.
  // Plain keywords and no-argument calls do not need snippet parsing.
  return { insertText, asSnippet: /\$(?:\d+|\{\d+(?::|\}))/.test(insertText) };
}
