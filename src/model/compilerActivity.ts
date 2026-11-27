import { nativeExitCode, type NativeOutcome } from '../services/nativeOutcome';
import { unicodeSafePreviewBounds } from './utf8Text';
import type { ScarpMode } from '../services/compiler';
import type { ScarpProjectAction } from '../services/project';

export const MAX_ACTIVITY_RECORDS = 40;
export const MAX_ACTIVITY_OUTPUT_UNITS = 32 * 1024;
export const MAX_ACTIVITY_TOTAL_OUTPUT_UNITS = 256 * 1024;
export const MAX_ACTIVITY_TARGET_UNITS = 120;
export const MAX_ACTIVITY_FILTER_UNITS = 120;
export const SOURCE_ACTIVITY_COMMANDS = ['exec', 'verify'] as const;
export const PROJECT_ACTIVITY_COMMANDS = ['info', 'verify', 'list-tests', 'run-tests', 'run', 'inspect-symbols', 'inspect-references'] as const;
export type ActivityMode = 'off' | 'metadata' | 'output';
export type ActivityCommand =
  | { readonly scope: 'source'; readonly action: ScarpMode }
  | { readonly scope: 'project'; readonly action: ScarpProjectAction };
export type ActivityOutcome = 'returned' | 'exit-zero' | 'exit-nonzero' | 'invocation-error' | 'cancelled';
export const OUTCOME_LABELS: Readonly<Record<ActivityOutcome, string>> = Object.freeze({
  returned: 'Returned (exit status unavailable)', 'exit-zero': 'Exit 0',
  'exit-nonzero': 'Nonzero exit', 'invocation-error': 'Invocation error', cancelled: 'Native cancellation reported',
});
export interface ActivityStart {
  readonly command: ActivityCommand;
  /** Display basename only. Do not pass executable paths or source contents. */
  readonly target: string;
  readonly timestamp: number;
}
export interface ActivityToken {
  readonly id: number;
  readonly epoch: number;
}
interface ActiveActivity {
  readonly token: ActivityToken;
  readonly command: ActivityCommand;
  readonly target: string;
  readonly startedAt: number;
  readonly retainOutput: boolean;
  readonly stopRequested: boolean;
}
export interface ActivityCompletion {
  readonly timestamp: number;
  readonly outcome: 'returned' | 'invocation-error';
  readonly exitCode: number | null;
  readonly staleAtCompletion: boolean;
  readonly inputChanged: boolean;
  readonly output: string;
  readonly nativeOutcome?: NativeOutcome;
}
export interface ActivityRecord {
  readonly id: number;
  readonly command: ActivityCommand;
  readonly target: string;
  readonly startedAt: number;
  readonly finishedAt: number;
  readonly elapsedMs: number | null;
  readonly outcome: ActivityOutcome;
  readonly exitCode: number | null;
  readonly staleAtCompletion: boolean;
  readonly inputChanged: boolean;
  readonly stopRequested: boolean;
  readonly output: string | null;
  readonly outputTruncated: boolean;
  readonly outputOriginalUnits: number | null;
  readonly nativeOutputTruncated: boolean | null;
}
export interface ActivityState {
  readonly mode: ActivityMode;
  readonly records: readonly ActivityRecord[];
  readonly revision: number;
  readonly pending: boolean;
  readonly retainedOutputUnits: number;
  readonly droppedRecords: number;
}
export interface ActivityClearReview {
  readonly revision: number;
  readonly recordIds: readonly number[];
  readonly cancelPending: boolean;
}
export interface ActivityFilter {
  readonly query: string;
  readonly scope: 'all' | 'source' | 'project';
  readonly outcome: 'all' | ActivityOutcome;
  readonly changedOnly: boolean;
  readonly outputOnly: boolean;
}
export const DEFAULT_ACTIVITY_FILTER: ActivityFilter = Object.freeze({
  query: '', scope: 'all', outcome: 'all', changedOnly: false, outputOnly: false,
});

const control = /[\x00-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
function validMode(value: string): value is ActivityMode {
  return value === 'off' || value === 'metadata' || value === 'output';
}
function validTime(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000;
}
function safeTarget(value: string): string {
  // Defense in depth: callers pass basenames, but a mistakenly supplied
  // absolute path must never become a retained history metadata field.
  const basename = value.split(/[\\/]/).filter(Boolean).at(-1) ?? '';
  const clean = basename.replace(control, '�').trim();
  const { end } = unicodeSafePreviewBounds(clean, 0, Math.min(clean.length, MAX_ACTIVITY_TARGET_UNITS));
  return clean.slice(0, end) || 'Unnamed target';
}
function canonicalCommand(command: ActivityCommand): ActivityCommand | null {
  if (command.scope === 'source' && SOURCE_ACTIVITY_COMMANDS.includes(command.action)) {
    return Object.freeze({ scope: 'source', action: command.action });
  }
  if (command.scope === 'project' && PROJECT_ACTIVITY_COMMANDS.includes(command.action)) {
    return Object.freeze({ scope: 'project', action: command.action });
  }
  return null;
}
function outcomeFor(completion: ActivityCompletion, code: number | null): ActivityOutcome {
  if (completion.outcome === 'invocation-error') return 'invocation-error';
  if (completion.nativeOutcome?.cancelled === true) return 'cancelled';
  return code === null ? 'returned' : code === 0 ? 'exit-zero' : 'exit-nonzero';
}
function outputSize(records: readonly ActivityRecord[]): number {
  return records.reduce((sum, record) => sum + (record.output?.length ?? 0), 0);
}
function removeOutput(record: ActivityRecord): ActivityRecord {
  return record.output === null ? record : Object.freeze({ ...record, output: null,
    outputTruncated: false, outputOriginalUnits: null });
}
export function activityCommandLabel(command: ActivityCommand): string {
  if (command.scope === 'source') return command.action === 'exec' ? 'Run source' : 'Verify source';
  const labels: Record<ScarpProjectAction, string> = {
    info: 'Project info', verify: 'Verify project', 'list-tests': 'List project tests',
    'run-tests': 'Run project tests', run: 'Run project',
    'inspect-symbols': 'Inspect project symbols', 'inspect-references': 'Inspect project references',
  };
  return labels[command.action];
}
function boundedOutput(output: string): { text: string; truncated: boolean } {
  if (output.length <= MAX_ACTIVITY_OUTPUT_UNITS) return { text: output, truncated: false };
  // Keep both ends for useful diagnostics, but never claim the missing middle
  // is preserved. Avoid cutting valid surrogate pairs at either boundary.
  const half = Math.floor((MAX_ACTIVITY_OUTPUT_UNITS - 80) / 2);
  const first = unicodeSafePreviewBounds(output, 0, half).end;
  const last = unicodeSafePreviewBounds(output, output.length - half, output.length).start;
  return { text: output.slice(0, first) + '\n\n[Middle of output omitted by history limit]\n\n' + output.slice(last), truncated: true };
}
export function createActivityClearReview(state: ActivityState): ActivityClearReview {
  return Object.freeze({ revision: state.revision, recordIds: Object.freeze(state.records.map(record => record.id)),
    cancelPending: state.pending });
}
export function activityClearIsCurrent(review: ActivityClearReview, state: ActivityState): boolean {
  return review.revision === state.revision && review.cancelPending === state.pending &&
    review.recordIds.length === state.records.length && review.recordIds.every((id, i) => id === state.records[i].id);
}

/**
 * An opt-in, session-only journal for compiler INVOCATIONS, not proof of
 * compiler correctness. No source, stdin, executable paths, raw project
 * roots, structured test reports, or navigation snapshots are retained.
 * Optional output is raw compiler output and can itself contain private
 * information; it is never enabled automatically.
 *
 * Clear/disable invalidates pending tokens, so an in-flight native response
 * cannot repopulate erased history. A privacy downgrade strips all prior
 * output and prevents ongoing output capture. Nothing executes from here.
 */
export function createCompilerActivityStore() {
  let epoch = 0;
  let nextId = 1;
  let active: ActiveActivity | null = null;
  let state: ActivityState = Object.freeze({
    mode: 'off', records: Object.freeze([]), revision: 0, pending: false,
    retainedOutputUnits: 0, droppedRecords: 0,
  });
  const listeners = new Set<() => void>();
  const getSnapshot = () => state;
  function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  function publish(mode: ActivityMode, records: readonly ActivityRecord[], droppedRecords = state.droppedRecords) {
    state = Object.freeze({ mode, records: Object.freeze([...records]), revision: state.revision + 1,
      pending: active !== null, retainedOutputUnits: outputSize(records), droppedRecords });
    for (const listener of [...listeners]) listener();
  }
  function setMode(mode: ActivityMode): boolean {
    if (!validMode(mode) || mode === state.mode) return false;
    if (mode === 'off') {
      epoch++;
      active = null;
      publish('off', [], 0);
      return true;
    }
    if (mode === 'metadata') {
      if (active) active = Object.freeze({ ...active, retainOutput: false });
      publish(mode, state.records.map(removeOutput));
    } else publish(mode, state.records);
    return true;
  }
  function start(input: ActivityStart): ActivityToken | null {
    if (state.mode === 'off' || active || !validTime(input.timestamp)) return null;
    const command = canonicalCommand(input.command);
    if (!command) return null;
    const token = Object.freeze({ id: nextId++, epoch });
    active = Object.freeze({ token, command, target: safeTarget(input.target), startedAt: input.timestamp,
      retainOutput: state.mode === 'output', stopRequested: false });
    publish(state.mode, state.records);
    return token;
  }
  function markStopRequested(token: ActivityToken | null): boolean {
    if (!token || !active || active.token !== token || active.stopRequested) return false;
    active = Object.freeze({ ...active, stopRequested: true });
    publish(state.mode, state.records);
    return true;
  }
  function finish(token: ActivityToken | null, completion: ActivityCompletion): ActivityRecord | null {
    if (!token || !active || active.token !== token || token.epoch !== epoch || state.mode === 'off') return null;
    const started = active;
    active = null;
    const timeValid = validTime(completion.timestamp);
    const finishedAt = timeValid ? completion.timestamp : started.startedAt;
    const elapsedMs = timeValid && finishedAt >= started.startedAt ? finishedAt - started.startedAt : null;
    const native = completion.outcome === 'returned' ? completion.nativeOutcome : undefined;
    const exitCode = completion.outcome !== 'returned' ? null
      : native ? nativeExitCode(native.exitCode)
      : started.command.scope === 'project' ? nativeExitCode(completion.exitCode) : null;
    const retain = started.retainOutput && state.mode === 'output';
    const preview = retain ? boundedOutput(completion.output) : null;
    const record = Object.freeze({
      id: token.id, command: started.command, target: started.target,
      startedAt: started.startedAt, finishedAt, elapsedMs, outcome: outcomeFor(completion, exitCode),
      exitCode, staleAtCompletion: completion.staleAtCompletion || native?.sourceStale === true, inputChanged: completion.inputChanged,
      stopRequested: started.stopRequested, output: preview?.text ?? null,
      outputTruncated: preview?.truncated ?? false, outputOriginalUnits: retain ? completion.output.length : null,
      nativeOutputTruncated: native?.outputTruncated ?? null,
    });
    const all = [...state.records, record];
    const records = all.slice(-MAX_ACTIVITY_RECORDS);
    let units = outputSize(records);
    // Prefer keeping recent metadata. Strip the oldest captured output when
    // the aggregate output budget is reached; do not pretend it is retained.
    for (let i = 0; i < records.length && units > MAX_ACTIVITY_TOTAL_OUTPUT_UNITS; i++) {
      units -= records[i].output?.length ?? 0;
      records[i] = removeOutput(records[i]);
    }
    publish(state.mode, records, state.droppedRecords + all.length - records.length);
    return record;
  }
  function clear(review: ActivityClearReview): boolean {
    if (!activityClearIsCurrent(review, state)) return false;
    if (!state.records.length && !active) return true;
    epoch++;
    active = null;
    publish(state.mode, [], 0);
    return true;
  }
  return { getSnapshot, subscribe, setMode, start, finish, markStopRequested, clear };
}
export function filterActivity(records: readonly ActivityRecord[], filter: ActivityFilter): ActivityRecord[] {
  const terms = filter.query.slice(0, MAX_ACTIVITY_FILTER_UNITS).trim().toLowerCase().split(/\s+/).filter(Boolean);
  return records.filter(record => {
    if (filter.scope !== 'all' && record.command.scope !== filter.scope) return false;
    if (filter.outcome !== 'all' && record.outcome !== filter.outcome) return false;
    if (filter.changedOnly && !record.staleAtCompletion && !record.inputChanged) return false;
    if (filter.outputOnly && record.output === null) return false;
    // Deliberately do not search private captured output.
    const search = [record.target, activityCommandLabel(record.command), OUTCOME_LABELS[record.outcome]].join(' ').toLowerCase();
    return terms.every(term => search.includes(term));
  });
}
export interface ActivitySummary {
  readonly returned: number;
  readonly exitZero: number;
  readonly exitNonzero: number;
  readonly invocationErrors: number;
  readonly cancelled: number;
  readonly nativeTruncated: number;
  readonly changed: number;
  readonly stopRequests: number;
}
export function summarizeActivity(records: readonly ActivityRecord[]): ActivitySummary {
  return {
    returned: records.filter(record => record.outcome === 'returned').length,
    exitZero: records.filter(record => record.outcome === 'exit-zero').length,
    exitNonzero: records.filter(record => record.outcome === 'exit-nonzero').length,
    invocationErrors: records.filter(record => record.outcome === 'invocation-error').length,
    cancelled: records.filter(record => record.outcome === 'cancelled').length,
    nativeTruncated: records.filter(record => record.nativeOutputTruncated === true).length,
    changed: records.filter(record => record.staleAtCompletion || record.inputChanged).length,
    stopRequests: records.filter(record => record.stopRequested).length,
  };
}
/** Metadata-only export, even when optional raw output retention is enabled. */
export function activityMetadataReport(state: ActivityState, records: readonly ActivityRecord[]): string {
  return [
    'Scarp Studio compiler activity — historical invocation metadata',
    'No source text, input, executable paths or raw output included.',
    'Records shown: ' + records.length + '; older records discarded: ' + state.droppedRecords,
    ...records.map(record => [
      new Date(record.startedAt).toISOString(),
      activityCommandLabel(record.command),
      JSON.stringify(record.target),
      OUTCOME_LABELS[record.outcome],
      record.elapsedMs === null ? 'duration unknown' : record.elapsedMs + ' ms',
      record.staleAtCompletion ? 'source/project changed during invocation' : '',
      record.inputChanged ? 'input changed during invocation' : '',
      record.stopRequested ? 'stop signal requested (outcome not inferred)' : '',
      record.nativeOutputTruncated === true ? 'native output truncated' : '',
    ].filter(Boolean).join(' | ')),
  ].join('\n');
}
