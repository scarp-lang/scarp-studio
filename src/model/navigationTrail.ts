import type { StudioDocument } from './documents';
import { sourceLineAt } from './sourceLines';

export const MAX_TRAIL_ENTRIES = 80;
export const MAX_TRAIL_SOURCE_UNITS = 512 * 1024;
export type TrailReason = 'origin' | 'insight' | 'declaration' | 'line' | 'search' | 'diagnostic' | 'marked';
export type TrailStatus = 'current' | 'changed' | 'closed';
export interface TrailLocation {
  readonly documentId: string;
  readonly documentName: string;
  readonly revision: number;
  readonly line: number;
  readonly column: number;
  readonly reason: TrailReason;
}
export interface TrailEntry extends TrailLocation {
  readonly id: number;
}
export interface TrailSnapshot {
  readonly entries: readonly TrailEntry[];
  readonly index: number;
  readonly revision: number;
}
export interface TrailTarget {
  documentId: string;
  revision: number;
  source: string;
  line: number;
  column: number;
}
export interface TrailMove {
  readonly stateRevision: number;
  readonly index: number;
  readonly id: number;
}
export type TrailDirection = 'back' | 'forward';

const REASONS: readonly TrailReason[] = ['origin', 'insight', 'declaration', 'line', 'search', 'diagnostic', 'marked'];
export const TRAIL_REASON_LABELS: Record<TrailReason, string> = {
  origin: 'Previous cursor',
  insight: 'Workspace insight',
  declaration: 'Declaration',
  line: 'Go to line',
  search: 'Open-buffer search',
  diagnostic: 'Diagnostic',
  marked: 'Marked cursor',
};

function validPosition(document: StudioDocument, line: number, column: number): boolean {
  if (document.content.length > MAX_TRAIL_SOURCE_UNITS ||
      !Number.isSafeInteger(line) || line < 1 ||
      !Number.isSafeInteger(column) || column < 1) return false;
  const text = sourceLineAt(document.content, line);
  return text !== null && column <= text.length + 1;
}
export function captureTrailLocation(
  document: StudioDocument, line: number, column: number, reason: TrailReason,
): TrailLocation | null {
  if (!validPosition(document, line, column) || !REASONS.includes(reason)) return null;
  if (!Number.isSafeInteger(document.revision) || document.revision < 0) return null;
  return Object.freeze({
    documentId: document.id, documentName: document.name,
    revision: document.revision, line, column, reason,
  });
}
export function sameTrailPosition(left: TrailLocation, right: TrailLocation): boolean {
  return left.documentId === right.documentId && left.revision === right.revision &&
    left.line === right.line && left.column === right.column;
}
export function trailEntryStatus(entry: TrailLocation, documents: readonly StudioDocument[]): TrailStatus {
  const document = documents.find(item => item.id === entry.documentId);
  if (!document) return 'closed';
  // Exact generations, never guess a location after edits or close/reopen.
  return document.revision === entry.revision ? 'current' : 'changed';
}
export function resolveTrailTarget(entry: TrailLocation, documents: readonly StudioDocument[]): TrailTarget | null {
  const document = documents.find(item => item.id === entry.documentId);
  if (!document || document.revision !== entry.revision ||
      !validPosition(document, entry.line, entry.column)) return null;
  return {
    documentId: document.id, revision: document.revision, source: document.content,
    line: entry.line, column: entry.column,
  };
}
export function reviewTrailSelection(state: TrailSnapshot, id: number, documents: readonly StudioDocument[]): TrailMove | null {
  const index = state.entries.findIndex(entry => entry.id === id);
  if (index < 0 || !resolveTrailTarget(state.entries[index], documents)) return null;
  return Object.freeze({ stateRevision: state.revision, index, id });
}
export function reviewTrailMove(state: TrailSnapshot, direction: TrailDirection, documents: readonly StudioDocument[]): TrailMove | null {
  const step = direction === 'back' ? -1 : 1;
  for (let index = state.index + step; index >= 0 && index < state.entries.length; index += step) {
    const entry = state.entries[index];
    // Stale records are preserved for inspection, but never used as destinations.
    if (trailEntryStatus(entry, documents) !== 'current') continue;
    if (!resolveTrailTarget(entry, documents)) continue;
    return Object.freeze({ stateRevision: state.revision, index, id: entry.id });
  }
  return null;
}
export function trailMoveTarget(state: TrailSnapshot, move: TrailMove, documents: readonly StudioDocument[]): TrailTarget | null {
  if (move.stateRevision !== state.revision || !Number.isSafeInteger(move.index)) return null;
  const entry = state.entries[move.index];
  if (!entry || entry.id !== move.id) return null;
  return resolveTrailTarget(entry, documents);
}

export function createNavigationTrailStore() {
  let nextId = 1;
  let state: TrailSnapshot = Object.freeze({ entries: Object.freeze([]), index: -1, revision: 0 });
  const listeners = new Set<() => void>();
  function publish(entries: readonly TrailEntry[], index: number) {
    state = Object.freeze({ entries: Object.freeze([...entries]), index, revision: state.revision + 1 });
    for (const listener of [...listeners]) listener();
  }
  function append(entries: TrailEntry[], location: TrailLocation) {
    const previous = entries.at(-1);
    if (previous && sameTrailPosition(previous, location)) return;
    // Select metadata explicitly: never retain the caller's source buffer or extras.
    entries.push(Object.freeze({
      id: nextId++, documentId: location.documentId, documentName: location.documentName,
      revision: location.revision, line: location.line, column: location.column, reason: location.reason,
    }));
  }
  function record(origin: TrailLocation | null, destination: TrailLocation, documents: readonly StudioDocument[]): boolean {
    if (!resolveTrailTarget(destination, documents) || !REASONS.includes(destination.reason)) return false;
    const current = state.entries[state.index];
    const usableOrigin = origin && resolveTrailTarget(origin, documents) && REASONS.includes(origin.reason) ? origin : null;
    if (current && sameTrailPosition(current, destination) &&
        (!usableOrigin || sameTrailPosition(usableOrigin, destination))) return false;
    const entries = state.entries.slice(0, state.index + 1);
    if (usableOrigin) append(entries, usableOrigin);
    append(entries, destination);
    const retained = entries.slice(-MAX_TRAIL_ENTRIES);
    publish(retained, retained.length - 1);
    return true;
  }
  function move(review: TrailMove, documents: readonly StudioDocument[]): TrailTarget | null {
    const target = trailMoveTarget(state, review, documents);
    if (!target) return null;
    if (review.index !== state.index) publish(state.entries, review.index);
    return target;
  }
  function clear(expectedRevision: number): boolean {
    if (state.revision !== expectedRevision) return false;
    if (!state.entries.length) return true;
    publish([], -1);
    return true;
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    record, move, clear,
  };
}
export type NavigationTrailStore = ReturnType<typeof createNavigationTrailStore>;
