import { useMemo, useState } from 'react';
import type { StudioProblem } from '../model/problems';
import { buildProblemReport, DEFAULT_PROBLEM_REVIEW, pageProblemReview, reviewCurrentProblems,
  type ProblemReportOptions, type ProblemReviewOptions } from '../model/problemReview';

interface Props {
  problems: readonly StudioProblem[];
  stale: boolean;
  busy: boolean;
  onNavigate: (problem: StudioProblem) => void;
  onShowOutput: () => void;
}

function ProblemRow({ problem, busy, onNavigate }: Pick<Props, 'busy' | 'onNavigate'> & { problem: StudioProblem }) {
  return <li className="problem-row">
    <div className="problem-row-heading">
      <span className="problem-error">Error</span>
      <strong>{problem.code ?? (problem.kind === 'test' ? 'Test failure' : 'Compiler diagnostic')}</strong>
      <span className="problem-kind">{problem.kind === 'test' ? 'Test' : 'Compiler'}</span>
    </div>
    <div className="problem-message">{problem.message}</div>
    {problem.location && <div className="problem-location">{problem.location}</div>}
    {problem.help && <div className="problem-help">{problem.help}</div>}
    {problem.target ? <button type="button" disabled={busy} onClick={() => onNavigate(problem)}>
      {problem.target.kind === 'source' ? 'Go to source location' : 'Open listed test source'}
    </button> : <span className="problem-location">Source navigation unavailable for this diagnostic.</span>}
  </li>;
}

export function ProblemsPanel({ problems, stale, busy, onNavigate, onShowOutput }: Props) {
  const [options, setOptions] = useState<ProblemReviewOptions>(DEFAULT_PROBLEM_REVIEW);
  const [page, setPage] = useState(1);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportOptions, setReportOptions] = useState<ProblemReportOptions>({ includeLocations: false, includeHelp: false });
  const review = useMemo(() => reviewCurrentProblems(problems, stale, options), [problems, stale, options]);
  const visible = pageProblemReview(review, page);
  const report = useMemo(() => reportOpen && !stale && !busy ? buildProblemReport(review, reportOptions) : null,
    [review, reportOpen, reportOptions, stale, busy]);
  function update(next: Partial<ProblemReviewOptions>) {
    setOptions(previous => ({ ...previous, ...next })); setPage(1); setReportOpen(false);
  }
  function reset() { setOptions(DEFAULT_PROBLEM_REVIEW); setPage(1); setReportOpen(false); }
  // A changed current problem collection requires a new report review.
  const [priorProblems, setPriorProblems] = useState(problems);
  const [priorStale, setPriorStale] = useState(stale);
  const [priorBusy, setPriorBusy] = useState(busy);
  if (priorProblems !== problems || priorStale !== stale || priorBusy !== busy) {
    setPriorProblems(problems); setPriorStale(stale); setPriorBusy(busy);
    setReportOpen(false); setPage(1);
  }
  return <section className="problems-panel" aria-label="Current compiler problems">
    <div className="problems-toolbar">
      <label htmlFor="studio-problem-kind">Kind</label>
      <select id="studio-problem-kind" value={options.kind} onChange={event => {
        const value = event.target.value;
        if (value === 'all' || value === 'compiler' || value === 'test') update({ kind: value });
      }}>
        <option value="all">All ({review.scanned})</option>
        <option value="compiler">Compiler ({review.compiler})</option>
        <option value="test">Failed tests ({review.tests})</option>
      </select>
      <input type="search" aria-label="Filter problems" placeholder="Filter code, message or source…" value={options.query}
        maxLength={160} onChange={event => update({ query: event.target.value })} />
      <label>Navigation<select aria-label="Filter problem navigation availability" value={options.navigation} onChange={event => {
        const value = event.target.value;
        if (value === 'all' || value === 'available' || value === 'unavailable') update({ navigation: value });
      }}>
        <option value="all">All navigation states</option>
        <option value="available">Available ({review.available})</option>
        <option value="unavailable">Unavailable ({review.unavailable})</option>
      </select></label>
      <label>Group<select aria-label="Group problems by" value={options.grouping} onChange={event => {
        const value = event.target.value;
        if (value === 'none' || value === 'kind' || value === 'code') update({ grouping: value });
      }}>
        <option value="none">No grouping</option><option value="kind">Kind</option><option value="code">Kind and code</option>
      </select></label>
      <label>Order<select aria-label="Sort problems by" value={options.order} onChange={event => {
        const value = event.target.value;
        if (value === 'original' || value === 'code' || value === 'location') update({ order: value });
      }}>
        <option value="original">Original order</option><option value="code">Diagnostic code</option><option value="location">Location</option>
      </select></label>
      <button type="button" onClick={reset}>Clear filter</button>
    </div>
    <p role="status" className="problems-summary">{stale ? 'Results are historical. Save and rerun to refresh problems.'
      : review.matching + ' of ' + review.scanned + ' current problem(s)' + (review.limited ? ' in indexed subset' : '')}</p>
    {review.limited && <p role="status">Limited review: first {review.scanned} of {review.total} current problems indexed.</p>}
    {review.matching === 0 ? <div className="problems-empty">
      <strong>{stale ? 'Stale results' : review.scanned ? 'No matching problems' : 'No current structured problems'}</strong>
      <p>{stale ? 'The previous output is still available.' : review.scanned ? 'Clear or adjust the filter.' : 'Run Verify or Run Tests for structured results. An empty list does not establish successful verification.'}</p>
      <button type="button" onClick={onShowOutput}>Show raw output</button>
    </div> : <>
      {visible.groups.map(group => <section className="problem-review-group" key={group.key}
        aria-label={group.label ?? 'Matching current problems'}>
        {group.label && <h3>{group.label} ({group.count})</h3>}
        <ul className="problems-list">
          {group.problems.map(problem => <ProblemRow key={problem.id} problem={problem} busy={busy} onNavigate={onNavigate} />)}
        </ul>
      </section>)}
      {visible.pages > 1 && <div className="activity-pagination">
        <button type="button" disabled={visible.page === 1} onClick={() => setPage(visible.page - 1)}>Previous problems</button>
        <span>Rows {visible.first}–{visible.last} of {review.matching} · page {visible.page}/{visible.pages}</span>
        <button type="button" disabled={visible.page === visible.pages} onClick={() => setPage(visible.page + 1)}>Next problems</button>
      </div>}
      <button type="button" disabled={busy || stale} aria-expanded={reportOpen}
        onClick={() => setReportOpen(value => !value)}>{reportOpen ? 'Hide problem report' : 'Review matching problem report'}</button>
      {report && <section className="problem-report" aria-label="Reviewed matching problem report">
        <p>Messages may include private information or paths. Omitting explicit locations does not redact messages. No automatic copy or file export.</p>
        <label><input type="checkbox" checked={reportOptions.includeLocations} onChange={event => setReportOptions(previous => ({ ...previous, includeLocations: event.target.checked }))} /> Include explicit locations</label>
        <label><input type="checkbox" checked={reportOptions.includeHelp} onChange={event => setReportOptions(previous => ({ ...previous, includeHelp: event.target.checked }))} /> Include diagnostic help</label>
        <p role="status">{report.included} included; {report.omitted} omitted matching rows.{review.limited && ' Review coverage is limited.'}</p>
        <textarea aria-label="Matching problem report text" readOnly rows={10} value={report.text} />
      </section>}
    </>}
  </section>;
}
