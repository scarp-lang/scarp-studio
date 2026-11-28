/** Session-only recency for open document IDs. No filenames, source text
 * or native paths are persisted. A closed tab is removed from the history. */
export const MAX_RECENT_QUICK_OPEN_TABS = 100;

export interface QuickOpenRecency {
  readonly ids: readonly string[];
}

export const EMPTY_QUICK_OPEN_RECENCY: QuickOpenRecency = Object.freeze({
  ids: Object.freeze([]),
});

export function updateQuickOpenRecency(
  previous: QuickOpenRecency,
  openIds: readonly string[],
  activeId: string | null,
): QuickOpenRecency {
  const open = new Set(openIds);
  const seen = new Set<string>();
  const ids: string[] = [];

  function add(id: string) {
    if (!open.has(id) || seen.has(id) || ids.length >= MAX_RECENT_QUICK_OPEN_TABS) return;
    ids.push(id);
    seen.add(id);
  }

  if (activeId !== null) add(activeId);
  for (const id of previous.ids) add(id);
  if (previous.ids.length === ids.length && previous.ids.every((id, index) => id === ids[index])) {
    return previous;
  }
  return Object.freeze({ ids: Object.freeze(ids) });
}

export function quickOpenRecencyRanks(recency: QuickOpenRecency): ReadonlyMap<string, number> {
  const ranks = new Map<string, number>();
  for (const id of recency.ids.slice(0, MAX_RECENT_QUICK_OPEN_TABS)) {
    if (!ranks.has(id)) ranks.set(id, ranks.size);
  }
  return ranks;
}
