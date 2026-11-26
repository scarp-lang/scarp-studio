import {
  diffStudioPreferences, sameStudioPreferences, reviewStudioPreferences, studioReviewIsCurrent,
  exportStudioPreferences, importStudioPreferences, PORTABLE_GROUPS,
  type PortableGroup, type StudioPortablePreferences, type StudioPreferenceChange, type StudioTransferReview,
} from './studioPreferenceTransfer';
import { profileError, type ProfileResult } from './intelliSenseProfileTransfer';

export const MAX_PREFERENCE_HISTORY_ENTRIES = 32;
export const PREFERENCE_HISTORY_COALESCE_MS = 600;
export interface PreferenceHistoryEntry {
  readonly id: number;
  readonly recordedAt: number;
  readonly before: StudioPortablePreferences;
  readonly after: StudioPortablePreferences;
  readonly changes: readonly StudioPreferenceChange[];
}
export interface PreferenceHistoryState {
  readonly entries: readonly PreferenceHistoryEntry[];
  readonly revision: number;
  readonly current: StudioPortablePreferences;
}
export interface HistoryRestorePlan {
  readonly historyRevision: number;
  readonly entryId: number;
  readonly endpoint: 'before' | 'after';
  readonly review: StudioTransferReview;
}
function canonical(value: StudioPortablePreferences): StudioPortablePreferences {
  const checked = importStudioPreferences(exportStudioPreferences(value));
  if (!checked.ok) throw Error(checked.error);
  return checked.value;
}
function changeKeys(changes: readonly StudioPreferenceChange[]): string {
  return changes.map(change => change.group + ':' + change.key).join('|');
}
function sameSingleField(a: readonly StudioPreferenceChange[], b: readonly StudioPreferenceChange[]): boolean {
  return a.length === 1 && b.length === 1 && changeKeys(a) === changeKeys(b);
}
function freezeEntry(id: number, recordedAt: number, before: StudioPortablePreferences, after: StudioPortablePreferences): PreferenceHistoryEntry {
  return Object.freeze({ id, recordedAt, before, after, changes: Object.freeze(diffStudioPreferences(before, after).map(change => Object.freeze(change))) });
}
export function reviewHistoryRestore(state: PreferenceHistoryState, entryId: number, endpoint: 'before' | 'after',
  current: StudioPortablePreferences, groups: readonly PortableGroup[]): ProfileResult<HistoryRestorePlan> {
  const entry = state.entries.find(item => item.id === entryId);
  if (!entry || !sameStudioPreferences(state.current, current)) return profileError('History or active preferences changed. Try again.');
  if (endpoint !== 'before' && endpoint !== 'after') return profileError('Unknown history endpoint.');
  const review = reviewStudioPreferences(current, entry[endpoint], groups);
  if (!review.groups.length) return profileError('Choose a preference category to restore.');
  return { ok: true, value: Object.freeze({ historyRevision: state.revision, entryId, endpoint, review }) };
}
export function historyRestoreIsCurrent(plan: HistoryRestorePlan, state: PreferenceHistoryState,
  current: StudioPortablePreferences): boolean {
  if (plan.historyRevision !== state.revision || !sameStudioPreferences(state.current, current) ||
      !studioReviewIsCurrent(plan.review, current)) return false;
  const entry = state.entries.find(item => item.id === plan.entryId);
  if (!entry) return false;
  const expected = reviewStudioPreferences(current, entry[plan.endpoint], plan.review.groups);
  return sameStudioPreferences(expected.target, plan.review.target);
}

/** Session-only, bounded portable preference history. No localStorage,
 * source text, workspace paths, compiler approvals, shortcuts or Auto Save
 * enablement. IDs never repeat, including after clear. */
export function createPreferenceHistory(initial: StudioPortablePreferences) {
  let nextId = 1;
  let state: PreferenceHistoryState = Object.freeze({ entries: Object.freeze([]), revision: 0, current: canonical(initial) });
  const listeners = new Set<() => void>();
  const getSnapshot = () => state;
  function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  function publish(entries: readonly PreferenceHistoryEntry[], current: StudioPortablePreferences) {
    state = Object.freeze({ entries: Object.freeze([...entries]), current, revision: state.revision + 1 });
    for (const listener of [...listeners]) listener();
  }
  function record(value: StudioPortablePreferences, timestamp: number): boolean {
    if (sameStudioPreferences(state.current, value)) return false;
    const after = canonical(value);
    const before = state.current;
    const changes = diffStudioPreferences(before, after);
    const previous = state.entries.at(-1);
    const at = Number.isSafeInteger(timestamp) && timestamp >= 0 ? timestamp : 0;
    const coalesce = previous && at >= previous.recordedAt && at - previous.recordedAt <= PREFERENCE_HISTORY_COALESCE_MS &&
      sameSingleField(previous.changes, changes) && sameStudioPreferences(previous.after, before);
    if (coalesce) {
      // New revision and ID even for a merged entry: pending reviews cannot
      // accidentally confirm an earlier intermediate slider position.
      const replacement = freezeEntry(nextId++, at, previous.before, after);
      publish(replacement.changes.length ? [...state.entries.slice(0, -1), replacement] : state.entries.slice(0, -1), after);
    } else {
      const entry = freezeEntry(nextId++, at, before, after);
      publish([...state.entries, entry].slice(-MAX_PREFERENCE_HISTORY_ENTRIES), after);
    }
    return true;
  }
  function clear(expectedRevision: number, current: StudioPortablePreferences): boolean {
    if (expectedRevision !== state.revision || !sameStudioPreferences(current, state.current)) return false;
    if (state.entries.length) publish([], state.current);
    return true;
  }
  function review(id: number, endpoint: 'before' | 'after', current: StudioPortablePreferences, groups = PORTABLE_GROUPS as readonly PortableGroup[]) {
    return reviewHistoryRestore(state, id, endpoint, current, groups);
  }
  function canRestore(plan: HistoryRestorePlan, current: StudioPortablePreferences) {
    return historyRestoreIsCurrent(plan, state, current);
  }
  return { getSnapshot, subscribe, record, clear, review, canRestore };
}
