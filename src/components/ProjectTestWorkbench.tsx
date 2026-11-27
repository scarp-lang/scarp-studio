import { selectionCoverageLabel } from '../model/projectTestSelection';
import { useMemo, useState } from 'react';
import type { TestSourceListing } from '../model/projectTestNavigation';
import { buildTestTextReport, captureTestBaseline, compareProjectTestBaseline, DEFAULT_TEST_FILTER,
  MAX_TEST_QUERY, pageProjectTests, reviewProjectTests, reviewTestBaseline, TEST_PHASE_LABELS,
  TEST_TRANSITIONS, TRANSITION_LABELS, type TestBaseline, type TestBaselineReview,
  type TestFilter, type TestResultIdentity, type TestTransition } from '../model/projectTestWorkbench';

interface Props {
  result: TestResultIdentity;
  selection: TestSourceListing | null;
  historical: boolean;
  busy: boolean;
  baseline: TestBaseline | null;
  onBaseline: (value: TestBaseline | null) => void;
  onOpenSource: (path: string, folder: string) => void;
  onHide: () => void;
}

export function ProjectTestWorkbench({ result, selection, historical, busy, baseline, onBaseline, onOpenSource, onHide }: Props) {
  const [filter, setFilter] = useState<TestFilter>(DEFAULT_TEST_FILTER);
  const [page, setPage] = useState(1);
  const [reportOpen, setReportOpen] = useState(false);
  const [includeMessages, setIncludeMessages] = useState(false);
  const [baselineReview, setBaselineReview] = useState<TestBaselineReview | null>(null);
  const [clearReview, setClearReview] = useState<TestBaseline | null>(null);
  const [compare, setCompare] = useState(false);
  const [transition, setTransition] = useState<TestTransition | 'all'>('all');
  const [comparePage, setComparePage] = useState(1);
  const [notice, setNotice] = useState('');
  const review = useMemo(() => reviewProjectTests(result, selection, historical, filter), [result, selection, historical, filter]);
  const visible = pageProjectTests(review, page);
  const comparison = useMemo(() => compare ? compareProjectTestBaseline(baseline, result, historical) : null,
    [compare, baseline, result, historical]);
  const transitions = comparison?.ok ? comparison.value.rows.filter(row => transition === 'all' || row.transition === transition) : [];
  const comparePages = Math.max(1, Math.ceil(transitions.length / 12));
  const currentComparePage = Math.min(comparePage, comparePages);
  const report = reportOpen ? buildTestTextReport(result, review, includeMessages) : null;
  const staleCapture = baselineReview && (baselineReview.result !== result || baselineReview.previous !== baseline || historical);
  const [priorResult, setPriorResult] = useState(result);
  const [priorHistorical, setPriorHistorical] = useState(historical);
  if (priorResult !== result || priorHistorical !== historical) {
    setPriorResult(result); setPriorHistorical(historical); setBaselineReview(null);
    setReportOpen(false); setCompare(false); setPage(1); setComparePage(1);
  }
  function update(next: Partial<TestFilter>) {
    setFilter(previous => ({ ...previous, ...next })); setPage(1); setReportOpen(false);
  }
  return <section className="project-test-report project-test-workbench" aria-label="Scarp project test results">
    <header className="project-test-heading">
      <strong>{result.report.mode === 'list' ? 'DISCOVERED TESTS' : 'PROJECT TEST RESULTS'}</strong>
      <span>{result.report.discovered} total · {result.report.passed} passed · {result.report.failed} failed</span>
      <button type="button" onClick={onHide} title="Hide the structured project test summary">Hide</button>
    </header>
    <p role="status">{selectionCoverageLabel(result.report)}</p>
    {result.report.filter !== undefined && result.report.mode === 'run' && result.report.discovered === 0 && <p role="alert">No tests matched. Strict filtered execution did not pass.</p>}
    {historical && <p role="status">Historical results. Save changed sources and rerun before navigation or baseline comparison.</p>}
    {result.report.mode === 'list' && <p role="status">Discovery only. Listed tests have not been executed.</p>}
    <dl className="activity-metrics">
      <div><dt>Compilation failures</dt><dd>{review.compile}</dd></div>
      <div><dt>Fixture failures</dt><dd>{review.fixture}</dd></div>
      <div><dt>Runtime failures</dt><dd>{review.runtime}</dd></div>
      <div><dt>Listed source targets</dt><dd>{review.listed}/{review.total}</dd></div>
    </dl>
    <div className="test-workbench-filters">
      <input type="search" aria-label="Filter project tests" value={filter.query} maxLength={MAX_TEST_QUERY}
        placeholder="Path, code or message…" onChange={event => update({ query: event.target.value })}/>
      <select aria-label="Filter project test status" value={filter.status} onChange={event => {
        const value = event.target.value;
        if (value === 'all' || value === 'passed' || value === 'failed' || value === 'discovered') update({ status: value });
      }}><option value="all">All statuses</option><option value="passed">Passed</option>
        <option value="failed">Failed</option><option value="discovered">Discovered only</option></select>
      <select aria-label="Filter project test failure phase" value={filter.phase} onChange={event => {
        const value = event.target.value;
        if (value === 'all' || value === 'compile' || value === 'fixture' || value === 'runtime') update({ phase: value });
      }}><option value="all">All phases</option>
        {Object.entries(TEST_PHASE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select aria-label="Filter project test navigation" value={filter.navigation} onChange={event => {
        const value = event.target.value;
        if (value === 'all' || value === 'available' || value === 'unavailable') update({ navigation: value });
      }}><option value="all">All navigation states</option><option value="available">Listed source</option>
        <option value="unavailable">Source unavailable</option></select>
      <select aria-label="Group project tests" value={filter.grouping} onChange={event => {
        const value = event.target.value;
        if (value === 'none' || value === 'status' || value === 'phase' || value === 'code') update({ grouping: value });
      }}><option value="none">No grouping</option><option value="status">Status</option>
        <option value="phase">Failure phase</option><option value="code">Diagnostic code</option></select>
      <select aria-label="Sort project tests" value={filter.order} onChange={event => {
        const value = event.target.value;
        if (value === 'original' || value === 'path' || value === 'failures') update({ order: value });
      }}><option value="original">Original order</option><option value="path">Path</option><option value="failures">Failures first</option></select>
      <button type="button" onClick={() => { setFilter(DEFAULT_TEST_FILTER); setPage(1); setReportOpen(false); }}>Clear test filters</button>
    </div>
    <p role="status">{review.matched} of {review.total} matching tests</p>
    {visible.groups.map(group => <section className="test-workbench-group" key={group.key}>
      {group.label && <h3>{group.label} ({group.count})</h3>}
      <ul className="project-test-list">
        {group.rows.map(({ test, listed }) => <li key={test.path} className={'project-test-' + test.status}>
          <strong>{test.status === 'passed' ? 'PASS' : test.status === 'failed' ? 'FAIL' : 'TEST'}</strong>
          <span>{test.path}</span>
          <button type="button" className="project-test-open" disabled={busy || historical || !listed}
            onClick={() => onOpenSource(test.path, result.folder)}
            title="Open only if this test is in the current Scarp Explorer listing">Open Source</button>
          {test.message && <div className="project-test-error">
            <strong>{test.code || test.phase || 'Scarp test failure'}</strong>{' — ' + test.message}
            {test.help && <div>{test.help}</div>}
          </div>}
        </li>)}
      </ul>
    </section>)}
    {!review.matched && <p>{review.total ? 'No tests match the filters.' : 'No project tests were discovered.'}</p>}
    {visible.pages > 1 && <div className="activity-pagination">
      <button type="button" disabled={visible.page === 1} onClick={() => setPage(visible.page - 1)}>Previous tests</button>
      <span>Rows {visible.first}–{visible.last} of {review.matched}</span>
      <button type="button" disabled={visible.page === visible.pages} onClick={() => setPage(visible.page + 1)}>Next tests</button>
    </div>}
    <button type="button" aria-expanded={reportOpen} onClick={() => setReportOpen(value => !value)}>
      {reportOpen ? 'Hide test report' : 'Review matching test report'}
    </button>
    {report && <div className="test-workbench-report">
      <p>Relative test paths are included. Messages and help may contain private text or paths.</p>
      <label><input type="checkbox" checked={includeMessages} onChange={event => setIncludeMessages(event.target.checked)} /> Include messages and help</label>
      <p>{report.included} included; {report.omitted} omitted by size limit.</p>
      <textarea aria-label="Matching project test report" readOnly rows={8} value={report.text}/>
    </div>}
    <section className="test-workbench-baseline" aria-label="Session test baseline">
      <h3>Compare test runs</h3>
      <p>Explicit session-only baseline. Retains relative test paths, status, failure phase and code, not messages or help.
        Comparisons describe reported outcomes, not proof that the source or environment is unchanged.</p>
      {baseline && <p>Baseline: {baseline.cases.length} tests, captured {new Date(baseline.capturedAt).toLocaleTimeString()}.</p>}
      <div className="test-workbench-filters">
        <button type="button" disabled={busy || historical || result.report.mode !== 'run' || result.report.filter !== undefined} onClick={() => {
          setClearReview(null); setBaselineReview(reviewTestBaseline(result, baseline, historical)); setNotice('');
        }}>Review capture test baseline</button>
        <button type="button" disabled={busy || historical || !baseline || result.report.mode !== 'run' || result.report.filter !== undefined} aria-expanded={compare}
          onClick={() => { setCompare(value => !value); setComparePage(1); }}>
          {compare ? 'Hide test comparison' : 'Compare with test baseline'}
        </button>
        <button type="button" disabled={busy || !baseline} onClick={() => { setClearReview(baseline); setBaselineReview(null); }}>Review clear test baseline</button>
      </div>
      {baselineReview && <div className="transfer-review" role="group" aria-label="Confirm test baseline capture">
        <p>{baseline ? 'Replace existing baseline with' : 'Capture'} the {result.report.discovered} reported test outcomes? No command starts.</p>
        {staleCapture && <p role="alert">Report or baseline changed; review again.</p>}
        <button type="button" disabled={busy || !!staleCapture} onClick={() => {
          const next = captureTestBaseline(baselineReview, result, baseline, historical, Date.now());
          setBaselineReview(null);
          if (next) { onBaseline(next); setCompare(false); setNotice('Session test baseline captured.'); }
          else setNotice('Test baseline capture rejected; review again.');
        }}>Confirm test baseline capture</button>
        <button type="button" onClick={() => setBaselineReview(null)}>Cancel baseline capture</button>
      </div>}
      {clearReview && <div className="transfer-review" role="group" aria-label="Confirm clear test baseline">
        <p>Discard the session baseline? Current results remain unchanged.</p>
        <button type="button" disabled={busy || clearReview !== baseline} onClick={() => {
          onBaseline(null); setClearReview(null); setCompare(false); setNotice('Session test baseline cleared.');
        }}>Confirm clear test baseline</button>
        <button type="button" onClick={() => setClearReview(null)}>Cancel baseline clear</button>
      </div>}
      {comparison && (!comparison.ok ? <p role="status">{comparison.error}</p> : <>
        <dl className="activity-metrics">{TEST_TRANSITIONS.map(kind => <div key={kind}><dt>{TRANSITION_LABELS[kind]}</dt>
          <dd>{comparison.value.counts[kind]}</dd></div>)}</dl>
        <select aria-label="Filter test comparison transition" value={transition} onChange={event => {
          const value = event.target.value as TestTransition | 'all';
          if (value === 'all' || TEST_TRANSITIONS.includes(value)) { setTransition(value); setComparePage(1); }
        }}><option value="all">All transitions</option>{TEST_TRANSITIONS.map(kind =>
          <option key={kind} value={kind}>{TRANSITION_LABELS[kind]}</option>)}</select>
        <ul className="test-transition-list">{transitions.slice((currentComparePage - 1) * 12, currentComparePage * 12).map(row =>
          <li key={row.path}><strong>{row.path}</strong><span>{TRANSITION_LABELS[row.transition]}</span>
            <span>{row.before?.status ?? 'Not reported'} → {row.after?.status ?? 'Not reported'}</span>
            {row.transition === 'failure-changed' && <small>
              {row.before?.phase ?? '–'} / {row.before?.code ?? '–'} → {row.after?.phase ?? '–'} / {row.after?.code ?? '–'}
            </small>}
          </li>)}</ul>
        {!transitions.length && <p>No matching transitions.</p>}
        {comparePages > 1 && <div className="activity-pagination">
          <button type="button" disabled={currentComparePage === 1} onClick={() => setComparePage(currentComparePage - 1)}>Previous transitions</button>
          <span>Page {currentComparePage}/{comparePages}</span>
          <button type="button" disabled={currentComparePage === comparePages} onClick={() => setComparePage(currentComparePage + 1)}>Next transitions</button>
        </div>}
      </>)}
      {notice && <p role="status">{notice}</p>}
    </section>
  </section>;
}
