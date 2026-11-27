import { useMemo, useState, useSyncExternalStore } from 'react';
import {
  activityCommandLabel, activityMetadataReport, createActivityClearReview, activityClearIsCurrent,
  filterActivity, summarizeActivity, DEFAULT_ACTIVITY_FILTER, OUTCOME_LABELS, MAX_ACTIVITY_FILTER_UNITS,
  MAX_ACTIVITY_RECORDS, MAX_ACTIVITY_TOTAL_OUTPUT_UNITS, type ActivityFilter, type ActivityOutcome,
  type ActivityMode, type ActivityClearReview, type createCompilerActivityStore,
} from '../model/compilerActivity';

const PAGE = 12;
interface Props {
  store: ReturnType<typeof createCompilerActivityStore>;
  native: boolean;
}
const modes: { value: ActivityMode; label: string; description: string }[] = [
  { value: 'off', label: 'Off — clear and stop recording', description: 'Removes all existing activity and stops future capture, including results from active invocations.' },
  { value: 'metadata', label: 'Metadata only', description: 'Retains command name, target basename, time, available exit status and historical flags. Removes previously captured output.' },
  { value: 'output', label: 'Metadata and bounded output', description: 'Retains bounded raw output for future invocations. Output may include private text, paths or program replies.' },
];
export function CompilerActivityPanel({ store, native }: Props) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [modeReview, setModeReview] = useState<ActivityMode | null>(null);
  const [clearReview, setClearReview] = useState<ActivityClearReview | null>(null);
  const [filter, setFilter] = useState<ActivityFilter>(DEFAULT_ACTIVITY_FILTER);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showOutput, setShowOutput] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [notice, setNotice] = useState('');
  const records = useMemo(() => filterActivity(state.records, filter).reverse(), [state.records, filter]);
  const summary = useMemo(() => summarizeActivity(records), [records]);
  const pages = Math.max(1, Math.ceil(records.length / PAGE));
  const shownPage = Math.min(page, pages);
  const selected = records.find(record => record.id === selectedId);
  function changeFilter(next: Partial<ActivityFilter>) {
    setFilter(previous => ({ ...previous, ...next })); setPage(1); setSelectedId(null); setShowOutput(false);
  }
  function reviewMode(mode: ActivityMode) { setModeReview(mode); setClearReview(null); setNotice(''); }
  function confirmMode() {
    if (modeReview === null) return;
    const updated = store.setMode(modeReview);
    setModeReview(null); setSelectedId(null); setShowOutput(false); setShowReport(false);
    setNotice(updated ? 'Session activity setting updated.' : 'Activity mode unchanged.');
  }
  return <section className="compiler-activity-panel" aria-label="Compiler activity history">
    <header className="activity-header">
      <div><strong>Compiler activity history</strong>
        <p>Historical invocations only. Never a current source result or an automatic rerun.</p>
      </div>
      <span>{state.mode === 'off' ? 'Recording off' : state.mode === 'metadata' ? 'Metadata' : 'Metadata + output'}</span>
    </header>
    {!native && <p role="status">Compiler commands require the desktop app. No invocation records are simulated in this browser preview.</p>}
    <div className="activity-mode">
      <label htmlFor="compiler-activity-mode">Session recording mode</label>
      <select id="compiler-activity-mode" value={modeReview ?? state.mode} onChange={event => {
        const mode = event.target.value;
        if (mode === 'off' || mode === 'metadata' || mode === 'output') reviewMode(mode);
      }}>
        {modes.map(mode => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
      </select>
      {modeReview !== null && modeReview !== state.mode && <div className="transfer-review" role="group" aria-label="Confirm compiler activity mode">
        <p>{modes.find(mode => mode.value === modeReview)?.description}</p>
        <p>No history is saved to disk or automatically shared. Clearing history does not clear the current Output view.</p>
        <button type="button" onClick={confirmMode}>Confirm recording mode</button>
        <button type="button" onClick={() => setModeReview(null)}>Cancel recording mode</button>
      </div>}
    </div>
    <p role="status">{state.records.length}/{MAX_ACTIVITY_RECORDS} retained invocations · {state.retainedOutputUnits}/{MAX_ACTIVITY_TOTAL_OUTPUT_UNITS} retained output units
      {state.pending ? ' · One invocation being recorded' : ''}</p>
    {state.droppedRecords > 0 && <p>{state.droppedRecords} older invocation record(s) discarded by the session limit.</p>}
    {state.mode === 'off' && <p>Recording is off. Enable it explicitly before running a command to build session history.</p>}
    <div className="activity-filters">
      <input type="search" aria-label="Search compiler activity metadata" placeholder="Target or command…"
        value={filter.query} maxLength={MAX_ACTIVITY_FILTER_UNITS} onChange={event => changeFilter({ query: event.target.value })} />
      <select aria-label="Compiler activity scope" value={filter.scope} onChange={event => {
        const value = event.target.value;
        if (value === 'all' || value === 'source' || value === 'project') changeFilter({ scope: value });
      }}><option value="all">All commands</option><option value="source">Source commands</option><option value="project">Project commands</option></select>
      <select aria-label="Compiler activity outcome" value={filter.outcome} onChange={event => {
        const value = event.target.value as ActivityOutcome | 'all';
        if (value === 'all' || Object.hasOwn(OUTCOME_LABELS, value)) changeFilter({ outcome: value });
      }}><option value="all">All outcomes</option>
        {(Object.keys(OUTCOME_LABELS) as ActivityOutcome[]).map(outcome => <option key={outcome} value={outcome}>{OUTCOME_LABELS[outcome]}</option>)}
      </select>
      <label><input type="checkbox" checked={filter.changedOnly} onChange={event => changeFilter({ changedOnly: event.target.checked })}/> Changed during invocation</label>
      <label><input type="checkbox" checked={filter.outputOnly} onChange={event => changeFilter({ outputOnly: event.target.checked })}/> Retained output only</label>
      <button type="button" onClick={() => { setFilter(DEFAULT_ACTIVITY_FILTER); setPage(1); setSelectedId(null); setShowOutput(false); }}>Clear filters</button>
    </div>
    <dl className="activity-metrics">
      <div><dt>Matching</dt><dd>{records.length}</dd></div>
      <div><dt>Returned, unknown exit</dt><dd>{summary.returned}</dd></div>
      <div><dt>Exit 0</dt><dd>{summary.exitZero}</dd></div>
      <div><dt>Nonzero exit</dt><dd>{summary.exitNonzero}</dd></div>
      <div><dt>Invocation error</dt><dd>{summary.invocationErrors}</dd></div>
      <div><dt>Changed during run</dt><dd>{summary.changed}</dd></div>
      <div><dt>Stop requests</dt><dd>{summary.stopRequests}</dd></div>
    </dl>
    <div className="activity-records" aria-label="Historical compiler invocation records">
      {records.slice((shownPage - 1) * PAGE, shownPage * PAGE).map(record => <button type="button"
        key={record.id} className="activity-record" aria-pressed={selected?.id === record.id} onClick={() => {
          setSelectedId(record.id); setShowOutput(false);
        }}>
        <strong>{activityCommandLabel(record.command)} · {record.target}</strong>
        <span>{OUTCOME_LABELS[record.outcome]} · {new Date(record.startedAt).toLocaleTimeString()}</span>
        <small>{record.elapsedMs === null ? 'Duration unavailable' : record.elapsedMs + ' ms'}
          {record.staleAtCompletion || record.inputChanged ? ' · Changed during invocation' : ''}
          {record.stopRequested ? ' · Stop requested' : ''}
          {record.output !== null ? ' · Output retained' : ''}</small>
      </button>)}
      {!records.length && <p>No matching recorded invocations.</p>}
    </div>
    {pages > 1 && <div className="activity-pagination">
      <button type="button" disabled={shownPage === 1} onClick={() => setPage(shownPage - 1)}>Previous</button>
      <span>Page {shownPage}/{pages}</span>
      <button type="button" disabled={shownPage === pages} onClick={() => setPage(shownPage + 1)}>Next</button>
    </div>}
    {selected && <section className="activity-detail" aria-label="Selected historical invocation">
      <div className="activity-header"><strong>{activityCommandLabel(selected.command)} · {selected.target}</strong>
        <button type="button" onClick={() => { setSelectedId(null); setShowOutput(false); }}>Close details</button></div>
      <p>Historical record. It may not match the current source, compiler, project or input.</p>
      <dl className="activity-metrics">
        <div><dt>Started</dt><dd>{new Date(selected.startedAt).toLocaleString()}</dd></div>
        <div><dt>Finished</dt><dd>{new Date(selected.finishedAt).toLocaleString()}</dd></div>
        <div><dt>Outcome</dt><dd>{OUTCOME_LABELS[selected.outcome]}</dd></div>
        <div><dt>Exit code</dt><dd>{selected.exitCode ?? 'Unavailable'}</dd></div>
        <div><dt>Source/project changed</dt><dd>{selected.staleAtCompletion ? 'Observed' : 'Not observed during invocation'}</dd></div>
        <div><dt>Input changed</dt><dd>{selected.inputChanged ? 'Observed' : 'Not observed during invocation'}</dd></div>
        <div><dt>Stop request</dt><dd>{selected.stopRequested ? 'Signal requested; outcome not inferred' : 'Not recorded'}</dd></div>
      </dl>
      {selected.output !== null ? <>
        <button type="button" aria-expanded={showOutput} onClick={() => setShowOutput(value => !value)}>
          {showOutput ? 'Hide captured output' : 'Inspect captured output'}
        </button>
        {showOutput && <>
          <p>May contain private text. This output is not used for current diagnostics or navigation.
            {selected.outputTruncated ? ' Middle omitted; original length ' + selected.outputOriginalUnits + ' UTF-16 units.' : ''}</p>
          <textarea aria-label="Historical compiler output" readOnly rows={10} value={selected.output} />
        </>}
      </> : <p>Output not retained (metadata mode or retention limit).</p>}
    </section>}
    <div className="activity-actions">
      <button type="button" aria-expanded={showReport} onClick={() => setShowReport(value => !value)}>
        {showReport ? 'Hide metadata report' : 'Show metadata report'}
      </button>
      <button type="button" disabled={!state.records.length && !state.pending} onClick={() => {
        setClearReview(createActivityClearReview(state)); setModeReview(null); setNotice('');
      }}>Review clear history</button>
    </div>
    {showReport && <label>Read-only metadata report (includes target basenames)
      <textarea aria-label="Compiler activity metadata report" readOnly rows={8} value={activityMetadataReport(state, records)} />
    </label>}
    {clearReview && <div role="group" className="transfer-review" aria-label="Confirm clear compiler activity">
      <p>Clear all {clearReview.recordIds.length} historical records{clearReview.cancelPending ? ' and discard the active invocation’s future history entry' : ''}? This does not stop the compiler.</p>
      {!activityClearIsCurrent(clearReview, state) && <p role="alert">Activity changed. Review again.</p>}
      <button type="button" disabled={!activityClearIsCurrent(clearReview, state)} onClick={() => {
        const success = store.clear(clearReview); setClearReview(null); setSelectedId(null); setShowOutput(false);
        setNotice(success ? 'Session activity cleared.' : 'Activity changed. Review again.');
      }}>Confirm clear compiler activity</button>
      <button type="button" onClick={() => setClearReview(null)}>Cancel clear compiler activity</button>
    </div>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
