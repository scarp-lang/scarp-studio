import { describe, expect, it } from 'vitest';
import { createCompilerActivityStore, activityCommandLabel, activityMetadataReport, activityClearIsCurrent,
  createActivityClearReview, filterActivity, summarizeActivity, DEFAULT_ACTIVITY_FILTER,
  MAX_ACTIVITY_RECORDS, MAX_ACTIVITY_OUTPUT_UNITS, MAX_ACTIVITY_TOTAL_OUTPUT_UNITS, MAX_ACTIVITY_TARGET_UNITS,
  type ActivityCommand, type ActivityCompletion, type ActivityMode } from './compilerActivity';

const newStore = createCompilerActivityStore;
const source: ActivityCommand = { scope: 'source', action: 'exec' };
const project: ActivityCommand = { scope: 'project', action: 'run-tests' };
const completed = (patch: Partial<ActivityCompletion> = {}): ActivityCompletion => ({
  timestamp: 250, outcome: 'returned', exitCode: null, staleAtCompletion: false,
  inputChanged: false, output: 'private output', ...patch,
});
function record(store: ReturnType<typeof newStore>, command: ActivityCommand = source,
  patch: Partial<ActivityCompletion> = {}, target = 'main.srp', startedAt = 100) {
  const token = store.start({ command, target, timestamp: startedAt });
  if (!token) throw Error('No recording token');
  const item = store.finish(token, completed(patch));
  if (!item) throw Error('No activity record');
  return item;
}
function enabled(mode: ActivityMode = 'metadata') {
  const store = newStore();
  store.setMode(mode);
  return store;
}
describe('opt-in compiler activity privacy', () => {
  it('defaults off, retains no invocations and never fabricates a result', () => {
    const store = newStore();
    expect(store.getSnapshot()).toMatchObject({ mode: 'off', records: [], pending: false, retainedOutputUnits: 0 });
    expect(store.start({ command: source, target: 'main.srp', timestamp: 100 })).toBeNull();
    expect(store.finish(null, completed())).toBeNull();
    expect(store.getSnapshot().records).toEqual([]);
  });
  it('records only allowlisted command metadata with a basename and no raw output by default', () => {
    const store = enabled();
    const entry = record(store, source, { output: 'private text', exitCode: 0 }, 'C:\\private\\main.srp');
    expect(entry).toMatchObject({ id: 1, command: source, target: 'main.srp', startedAt: 100,
      finishedAt: 250, elapsedMs: 150, outcome: 'returned', exitCode: null,
      output: null, outputOriginalUnits: null, outputTruncated: false });
    expect(JSON.stringify(store.getSnapshot())).not.toContain('private');
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.command)).toBe(true);
    expect(Object.isFrozen(store.getSnapshot().records)).toBe(true);
  });
  it('does not retain unknown extra fields from a command object', () => {
    const store = enabled();
    const command = { ...source, executable: '/private/compiler', input: 'private input', source: 'secret source' };
    const entry = record(store, command);
    expect(entry.command).toEqual(source);
    expect(JSON.stringify(entry)).not.toContain('private');
    expect(JSON.stringify(entry)).not.toContain('secret');
  });
  it('requires the recording permission to be active when invocation starts', () => {
    const store = enabled();
    const token = store.start({ command: source, target: 'main.srp', timestamp: 100 });
    store.setMode('output');
    const result = store.finish(token, completed());
    expect(result?.output).toBeNull();
    expect(record(store).output).toBe('private output');
  });
  it('downgrades existing and pending output capture without resurrecting erased data', () => {
    const store = enabled('output');
    record(store);
    const token = store.start({ command: source, target: 'main.srp', timestamp: 100 });
    store.setMode('metadata');
    expect(store.getSnapshot().records[0].output).toBeNull();
    expect(store.getSnapshot().records[0].outputOriginalUnits).toBeNull();
    expect(store.getSnapshot().retainedOutputUnits).toBe(0);
    store.setMode('output');
    expect(store.finish(token, completed())?.output).toBeNull();
    expect(store.getSnapshot().records.every(item => item.output === null)).toBe(true);
  });
  it('disabling recording erases records and invalidates pending completion tokens', () => {
    const store = enabled('output');
    record(store);
    const token = store.start({ command: source, target: 'main.srp', timestamp: 100 });
    store.setMode('off');
    expect(store.getSnapshot()).toMatchObject({ mode: 'off', records: [], pending: false, retainedOutputUnits: 0 });
    store.setMode('output');
    expect(store.finish(token, completed())).toBeNull();
    expect(store.getSnapshot().records).toEqual([]);
    expect(record(store).id).toBeGreaterThan(2);
  });
  it('does not save raw output in metadata export or metadata search', () => {
    const store = enabled('output');
    const entry = record(store, project, { output: 'sensitive content', exitCode: 1 }, '/private/project');
    expect(filterActivity([entry], { ...DEFAULT_ACTIVITY_FILTER, query: 'sensitive' })).toEqual([]);
    const report = activityMetadataReport(store.getSnapshot(), [entry]);
    expect(report).toContain('Run project tests');
    expect(report).toContain('Nonzero exit');
    expect(report).not.toContain('sensitive content');
    expect(report).not.toContain('/private/');
  });
  it('bounds and sanitizes target labels without exposing parent paths or directional controls', () => {
    const store = enabled();
    const name = 'a'.repeat(MAX_ACTIVITY_TARGET_UNITS - 1) + '😀' + 'b';
    const entry = record(store, source, {}, '/private/' + name);
    expect(entry.target.startsWith('a')).toBe(true);
    expect(entry.target.endsWith('😀')).toBe(true);
    expect(entry.target.length).toBeLessThanOrEqual(MAX_ACTIVITY_TARGET_UNITS + 1);
    const controls = record(store, source, {}, 'C:\\private\\a\u202e\n.srp');
    expect(controls.target).not.toContain('\u202e');
    expect(controls.target).not.toContain('\n');
    expect(controls.target).not.toContain('private');
  });
});
describe('compiler activity native provenance', () => {
  it.each([0, 1, -1, 2147483647, 4294967295, null])('uses only a native project exit code (%j)', code => {
    const entry = record(enabled(), project, { exitCode: code });
    expect(entry.exitCode).toBe(code);
    expect(entry.outcome).toBe(code === null ? 'returned' : code === 0 ? 'exit-zero' : 'exit-nonzero');
  });
  it.each([NaN, Infinity, 0.5, -2147483649, 4294967296])('does not infer an exit status from invalid values (%j)', code => {
    const entry = record(enabled(), project, { exitCode: code, output: 'SUCCESS EXIT 0' });
    expect(entry.exitCode).toBeNull();
    expect(entry.outcome).toBe('returned');
  });
  it('does not claim successful source execution from output or an accidental supplied exit code', () => {
    const store = enabled();
    const entry = record(store, source, { exitCode: 0, output: 'All checks passed' });
    expect(entry.outcome).toBe('returned');
    expect(entry.exitCode).toBeNull();
  });
  it('distinguishes invocation rejection from process exit status', () => {
    const entry = record(enabled(), project, { outcome: 'invocation-error', exitCode: 0 });
    expect(entry.outcome).toBe('invocation-error');
    expect(entry.exitCode).toBeNull();
  });
  it('tracks only one actual invocation token and rejects forged or duplicate completions', () => {
    const store = enabled();
    const token = store.start({ command: source, target: 'main.srp', timestamp: 100 })!;
    expect(store.getSnapshot().pending).toBe(true);
    expect(store.start({ command: project, target: 'other', timestamp: 150 })).toBeNull();
    expect(store.finish({ ...token }, completed())).toBeNull();
    expect(store.finish(token, completed())).not.toBeNull();
    expect(store.finish(token, completed())).toBeNull();
    expect(store.getSnapshot().pending).toBe(false);
    expect(store.getSnapshot().records).toHaveLength(1);
  });
  it('records a stop signal without claiming the process stopped or failed', () => {
    const store = enabled();
    const token = store.start({ command: source, target: 'main.srp', timestamp: 100 })!;
    expect(store.markStopRequested(null)).toBe(false);
    expect(store.markStopRequested({ ...token })).toBe(false);
    expect(store.markStopRequested(token)).toBe(true);
    expect(store.markStopRequested(token)).toBe(false);
    const entry = store.finish(token, completed());
    expect(entry).toMatchObject({ stopRequested: true, outcome: 'returned' });
  });
  it('records observed source and input changes independently', () => {
    const store = enabled();
    const changed = record(store, source, { staleAtCompletion: true, inputChanged: false });
    const input = record(store, source, { staleAtCompletion: false, inputChanged: true });
    expect(changed.staleAtCompletion).toBe(true);
    expect(changed.inputChanged).toBe(false);
    expect(input.staleAtCompletion).toBe(false);
    expect(input.inputChanged).toBe(true);
    expect(summarizeActivity(store.getSnapshot().records).changed).toBe(2);
  });
  it('reports unknown duration on a backwards or invalid wall clock', () => {
    const store = enabled();
    expect(record(store, source, { timestamp: 99 }).elapsedMs).toBeNull();
    expect(record(store, source, { timestamp: NaN }).elapsedMs).toBeNull();
    expect(record(store, source, { timestamp: 100 }).elapsedMs).toBe(0);
    expect(store.start({ command: source, target: 'main.srp', timestamp: -1 })).toBeNull();
  });
  it('rejects unsupported command scopes and actions', () => {
    const store = enabled();
    expect(store.start({ command: { scope: 'source', action: 'shell' } as never, target: 'x', timestamp: 1 })).toBeNull();
    expect(store.start({ command: { scope: 'other', action: 'verify' } as never, target: 'x', timestamp: 1 })).toBeNull();
  });
});
describe('activity retention and explicit removal', () => {
  it('retains bounded output including useful beginning and ending without splitting emoji', () => {
    const store = enabled('output');
    const raw = 'BEGIN ' + '😀'.repeat(MAX_ACTIVITY_OUTPUT_UNITS) + ' END';
    const entry = record(store, source, { output: raw });
    expect(entry.output?.startsWith('BEGIN ')).toBe(true);
    expect(entry.output?.endsWith(' END')).toBe(true);
    expect(entry.output).toContain('Middle of output omitted');
    expect(entry.output?.length).toBeLessThanOrEqual(MAX_ACTIVITY_OUTPUT_UNITS);
    expect(entry.outputTruncated).toBe(true);
    expect(entry.outputOriginalUnits).toBe(raw.length);
    expect(new TextDecoder().decode(new TextEncoder().encode(entry.output!))).toBe(entry.output);
  });
  it('distinguishes empty retained output from no retained output', () => {
    const store = enabled('output');
    const entry = record(store, source, { output: '' });
    expect(entry.output).toBe('');
    expect(entry.outputOriginalUnits).toBe(0);
    expect(filterActivity([entry], { ...DEFAULT_ACTIVITY_FILTER, outputOnly: true })).toHaveLength(1);
  });
  it('strips old raw output before discarding metadata when total output budget is reached', () => {
    const store = enabled('output');
    const output = 'x'.repeat(MAX_ACTIVITY_OUTPUT_UNITS);
    const count = MAX_ACTIVITY_TOTAL_OUTPUT_UNITS / MAX_ACTIVITY_OUTPUT_UNITS + 2;
    for (let i = 0; i < count; i++) record(store, source, { output }, 'file' + i + '.srp');
    const state = store.getSnapshot();
    expect(state.records).toHaveLength(count);
    expect(state.records[0].output).toBeNull();
    expect(state.records[1].output).toBeNull();
    expect(state.records.at(-1)?.output).toBe(output);
    expect(state.retainedOutputUnits).toBe(MAX_ACTIVITY_TOTAL_OUTPUT_UNITS);
    expect(state.droppedRecords).toBe(0);
  });
  it('bounds metadata count, retains recent records and reports dropped count', () => {
    const store = enabled();
    for (let i = 0; i < MAX_ACTIVITY_RECORDS + 5; i++) record(store);
    const state = store.getSnapshot();
    expect(state.records).toHaveLength(MAX_ACTIVITY_RECORDS);
    expect(state.records[0].id).toBe(6);
    expect(state.records.at(-1)?.id).toBe(MAX_ACTIVITY_RECORDS + 5);
    expect(state.droppedRecords).toBe(5);
  });
  it('clear invalidates pending history without disabling recording mode', () => {
    const store = enabled('output');
    record(store);
    const token = store.start({ command: source, target: 'main.srp', timestamp: 100 });
    const review = createActivityClearReview(store.getSnapshot());
    expect(review.cancelPending).toBe(true);
    expect(store.clear(review)).toBe(true);
    expect(store.getSnapshot()).toMatchObject({ mode: 'output', records: [], pending: false });
    expect(store.finish(token, completed())).toBeNull();
    expect(record(store).id).toBeGreaterThan(2);
  });
  it('rejects stale clear review after completion or privacy changes', () => {
    const store = enabled();
    const token = store.start({ command: source, target: 'main.srp', timestamp: 100 });
    const review = createActivityClearReview(store.getSnapshot());
    store.finish(token, completed());
    expect(activityClearIsCurrent(review, store.getSnapshot())).toBe(false);
    expect(store.clear(review)).toBe(false);
    const another = createActivityClearReview(store.getSnapshot());
    store.setMode('output');
    expect(store.clear(another)).toBe(false);
    expect(store.getSnapshot().records).toHaveLength(1);
  });
  it('notifies subscribers on genuine state transitions and unsubscribes', () => {
    const store = newStore();
    let calls = 0;
    const off = store.subscribe(() => calls++);
    expect(store.setMode('off')).toBe(false);
    expect(calls).toBe(0);
    store.setMode('metadata');
    record(store);
    expect(calls).toBe(3);
    off();
    store.setMode('off');
    expect(calls).toBe(3);
  });
});
describe('activity filtering and historical report', () => {
  it('filters metadata by scope, outcome, search and observed changes', () => {
    const store = enabled('output');
    const a = record(store, source, { inputChanged: true }, 'alpha.srp');
    const b = record(store, project, { exitCode: 1 }, 'beta');
    const c = record(store, project, { exitCode: 0 }, 'gamma');
    const list = store.getSnapshot().records;
    expect(filterActivity(list, { ...DEFAULT_ACTIVITY_FILTER, query: 'ALPHA run' })).toEqual([a]);
    expect(filterActivity(list, { ...DEFAULT_ACTIVITY_FILTER, scope: 'project' })).toEqual([b,c]);
    expect(filterActivity(list, { ...DEFAULT_ACTIVITY_FILTER, outcome: 'exit-nonzero' })).toEqual([b]);
    expect(filterActivity(list, { ...DEFAULT_ACTIVITY_FILTER, changedOnly: true })).toEqual([a]);
    expect(summarizeActivity(list)).toMatchObject({ returned: 1, exitZero: 1, exitNonzero: 1, changed: 1 });
  });
  it('maps every supported native action to a distinct display label', () => {
    const commands: ActivityCommand[] = [
      { scope: 'source', action: 'exec' }, { scope: 'source', action: 'verify' },
      ...(['info','verify','list-tests','run-tests','run'] as const).map(action => ({ scope: 'project' as const, action })),
    ];
    expect(new Set(commands.map(activityCommandLabel)).size).toBe(commands.length);
  });
});
