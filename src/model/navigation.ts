/** Bounded, deterministic matching for keyboard-driven Studio navigation. */
export interface NavigationEntry {
  id: string;
  label: string;
  detail?: string;
}

/** Quick Open is interactive; never normalize an unbounded pasted query on
 * every keystroke. Preserve a complete UTF-16 surrogate pair at the limit. */
export const MAX_NAVIGATION_QUERY_UNITS = 256;

export function boundedNavigationQuery(query: string): string {
  if (query.length <= MAX_NAVIGATION_QUERY_UNITS) return query;
  const prefix = query.slice(0, MAX_NAVIGATION_QUERY_UNITS);
  const end = prefix.charCodeAt(prefix.length - 1);
  return end >= 0xd800 && end <= 0xdbff ? prefix.slice(0, -1) : prefix;
}

export function filterNavigationEntries<T extends NavigationEntry>(
  entries: readonly T[],
  query: string,
  limit = 40,
): T[] {
  if (!Number.isSafeInteger(limit) || limit <= 0 ||
      query.length > MAX_NAVIGATION_QUERY_UNITS) return [];
  // Use locale-independent Unicode case folding: a Turkish Windows UI
  // locale must not make ASCII FILE fail to match File.srp.
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return entries.slice(0, limit);

  const matches: Array<{ entry: T; rank: number; index: number }> = [];
  entries.forEach((entry, index) => {
    const label = entry.label.toLowerCase();
    const detail = (entry.detail ?? '').toLowerCase();
    if (!terms.every((term) => label.includes(term) || detail.includes(term))) return;
    const rank = label === terms.join(' ') ? 0
      : label.startsWith(terms[0]) ? 1
      : label.includes(terms[0]) ? 2
      : 3;
    matches.push({ entry, rank, index });
  });
  matches.sort((left, right) => left.rank - right.rank || left.index - right.index);
  return matches.slice(0, limit).map(({ entry }) => entry);
}

/** Parse a one-based line or line:column without admitting unsafe numbers. */
export function parseLineLocation(value: string): { line: number; column: number } | null {
  const match = /^([1-9][0-9]{0,8})(?::([1-9][0-9]{0,8}))?$/.exec(value.trim());
  if (!match) return null;
  const line = Number(match[1]);
  const column = Number(match[2] ?? '1');
  return Number.isSafeInteger(line) && Number.isSafeInteger(column)
    ? { line, column }
    : null;
}

export function clampLineLocation(
  location: { line: number; column: number },
  lineCount: number,
  maxColumn: (line: number) => number,
): { line: number; column: number } {
  const line = Math.max(1, Math.min(location.line, lineCount));
  return { line, column: Math.max(1, Math.min(location.column, maxColumn(line))) };
}

/** Cycle only through currently open tabs, including untitled documents. */
export function cycleTabId(
  ids: readonly string[],
  activeId: string | null,
  direction: 1 | -1,
): string | null {
  if (!ids.length) return null;
  const current = activeId === null ? -1 : ids.indexOf(activeId);
  if (current === -1) return direction === 1 ? ids[0] : ids[ids.length - 1];
  return ids[(current + direction + ids.length) % ids.length];
}


/** WAI-ARIA-style tablist keyboard movement. Invalid/stale tab IDs and other
 * keys never activate another document. The UI owns focus and reducer state;
 * this helper performs no side effects or file reads.
 */
export function keyboardTabTarget(
  ids: readonly string[], focusedId: string, key: string,
): string | null {
  const current = ids.indexOf(focusedId);
  if (current === -1) return null;
  if (key === 'Home') return ids[0];
  if (key === 'End') return ids[ids.length - 1];
  if (key === 'ArrowRight') return ids[(current + 1) % ids.length];
  if (key === 'ArrowLeft') return ids[(current + ids.length - 1) % ids.length];
  return null;
}
