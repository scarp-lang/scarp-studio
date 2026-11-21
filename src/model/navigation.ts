/** Bounded, deterministic matching for keyboard-driven Studio navigation. */
export interface NavigationEntry {
  id: string;
  label: string;
  detail?: string;
}

export function filterNavigationEntries<T extends NavigationEntry>(
  entries: readonly T[],
  query: string,
  limit = 40,
): T[] {
  if (!Number.isSafeInteger(limit) || limit <= 0) return [];
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return entries.slice(0, limit);

  const matches: Array<{ entry: T; rank: number; index: number }> = [];
  entries.forEach((entry, index) => {
    const label = entry.label.toLocaleLowerCase();
    const detail = (entry.detail ?? '').toLocaleLowerCase();
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
