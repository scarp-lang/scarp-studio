import { isDirty, isScarpPath, sameFilePath, type StudioDocument } from './documents';
import { validWorkspaceRoot } from './workspaceSessions';

export const MAX_RECENTLY_CLOSED = 20;
export interface RecentlyClosedSource {
  sequence: number;
  path: string;
  name: string;
}
export interface RecentlyClosedState {
  entries: readonly RecentlyClosedSource[];
  nextSequence: number;
}
export const emptyRecentlyClosed: RecentlyClosedState = { entries: [], nextSequence: 1 };

function isSavedScarpSource(document: StudioDocument): document is StudioDocument & { path: string } {
  return document.path !== null && isScarpPath(document.path) &&
    validWorkspaceRoot(document.path) && !isDirty(document);
}

/** Observe committed editor transitions, including future bulk closures.
 * Only clean named sources enter history; explicitly discarded edits and
 * untitled/recovered copies are never retained. No source text is stored.
 */
export function reconcileRecentlyClosed(
  state: RecentlyClosedState,
  before: readonly StudioDocument[], after: readonly StudioDocument[],
  previouslyActiveId: string | null,
): RecentlyClosedState {
  const remainingIds = new Set(after.map(document => document.id));
  const openPaths = after.flatMap(document => document.path === null ? [] : [document.path]);
  const stillClosed = (path: string) => !openPaths.some(open => sameFilePath(open, path));
  const retained = state.entries.filter(entry => stillClosed(entry.path));
  const removed = before.filter(document => !remainingIds.has(document.id) && isSavedScarpSource(document));
  // Put the formerly active tab first when closing several tabs together;
  // otherwise use reverse editor order for a predictable last-closed order.
  const candidates = removed.reverse().sort((a, b) =>
    Number(b.id === previouslyActiveId) - Number(a.id === previouslyActiveId));
  let sequence = state.nextSequence;
  const added: RecentlyClosedSource[] = [];
  for (const document of candidates) {
    if (!isSavedScarpSource(document) || !stillClosed(document.path) ||
        added.some(entry => sameFilePath(entry.path, document.path))) continue;
    added.push({ sequence: sequence++, name: document.name, path: document.path });
  }
  const entries = [...added, ...retained.filter(old =>
    !added.some(entry => sameFilePath(entry.path, old.path)))].slice(0, MAX_RECENTLY_CLOSED);
  if (!added.length && entries.length === state.entries.length &&
      entries.every((entry, index) => entry === state.entries[index])) return state;
  return { entries, nextSequence: sequence };
}

/** Exact entry identity avoids stale clicks from an earlier close/reopen
 * cycle, even if the path and display name are identical again. */
export function forgetRecentlyClosed(
  state: RecentlyClosedState, entry: RecentlyClosedSource,
): RecentlyClosedState {
  if (!state.entries.includes(entry)) return state;
  return { ...state, entries: state.entries.filter(item => item !== entry) };
}

export function clearRecentlyClosed(state: RecentlyClosedState): RecentlyClosedState {
  return state.entries.length ? { ...state, entries: [] } : state;
}

export type ReopenClosedDecision =
  | { kind: 'stale' | 'ambiguous' }
  | { kind: 'activate'; documentId: string }
  | { kind: 'read'; path: string };

export function resolveRecentlyClosed(
  state: RecentlyClosedState, entry: RecentlyClosedSource, documents: readonly StudioDocument[],
): ReopenClosedDecision {
  if (!state.entries.includes(entry) || !isScarpPath(entry.path) || !validWorkspaceRoot(entry.path)) {
    return { kind: 'stale' };
  }
  const matches = documents.filter(document =>
    document.path !== null && sameFilePath(document.path, entry.path));
  if (matches.length > 1) return { kind: 'ambiguous' };
  if (matches.length === 1) return { kind: 'activate', documentId: matches[0].id };
  return { kind: 'read', path: entry.path };
}
