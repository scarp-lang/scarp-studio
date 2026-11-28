import { useMemo, useRef, useState } from 'react';
import { buildProjectScopeInventory, planScopedProjectSearch, PROJECT_SEARCH_BATCH_SIZE,
  SEARCH_COVERAGE_LABELS, searchCoverageOrigin } from '../model/projectSearchScope';
import type { ProjectSearchSettings } from '../model/projectSearchPresets';
import type { ProjectSearchSource } from '../model/projectSearch';
import { MAX_SWEEP_BATCHES, MAX_SWEEP_BYTES, prepareSearchSweep, formatSearchSweepReport,
  sweepRows, pageSweepRows, type SearchSweepPlan, type SearchSweepReport, type SweepProgress,
  type SweepExecution, type SweepRowFilter, type SweepControl } from '../model/projectSearchSweep';

interface Props {
  listed: readonly ProjectSearchSource[];
  settings: ProjectSearchSettings;
  busy: boolean;
  available: boolean;
  onRun: (plan: SearchSweepPlan, control: SweepControl) => Promise<SweepExecution>;
}
export function SearchSweepReview({ plan, busy, onConfirm, onCancel }: {
  plan: SearchSweepPlan; busy: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const [showLabels, setShowLabels] = useState(false);
  return <section className="project-scope-coverage" aria-label="Review project search sweep">
    <p><strong>Review consecutive search batches</strong></p>
    <p>Query: <code dir="auto">{JSON.stringify(plan.settings.query)}</code></p>
    <p>{plan.settings.options.caseSensitive ? 'Case sensitive' : 'Ignore case'} ·
      {' '}{plan.settings.options.wholeWord ? 'Whole word' : 'Literal substring'}</p>
    <p>{plan.settings.scope.directory || 'Workspace root'} ·
      {' '}{plan.settings.scope.descendants ? 'Includes descendants' : 'Direct files only'}</p>
    <p>Filename contains: <code dir="auto">{JSON.stringify(plan.settings.scope.filename)}</code></p>
    <p>Batch range {plan.window.first}–{plan.window.last} of {plan.totalBatches} ·
      {' '}{plan.selected} selected labels · {plan.totalEligible - plan.selected} deferred ·
      {' '}{plan.withheld} withheld · {plan.excluded} excluded.</p>
    <p>Reads are sequential and individually bounded. The sweep does not modify files or
      retain text matches for replacement or navigation.</p>
    <button type="button" aria-expanded={showLabels} onClick={() => setShowLabels(value => !value)}>
      {showLabels ? 'Hide planned sweep labels' : 'Review planned sweep labels'}
    </button>
    {showLabels && <div className="project-scope-inventory">
      {plan.batches.map(batch => <div key={batch.batch!.index}>
        <strong>Batch {batch.batch!.index}</strong>
        <ul>{batch.sources.map(source => <li key={source.name}><code dir="auto">{source.name}</code></li>)}</ul>
      </div>)}
    </div>}
    <div className="project-scope-fields">
      <button type="button" disabled={busy} onClick={onConfirm}>Confirm and run sweep</button>
      <button type="button" onClick={onCancel}>Cancel sweep review</button>
    </div>
  </section>;
}

export function SearchSweepResults({ report }: { report: SearchSweepReport }) {
  const [filter, setFilter] = useState<SweepRowFilter>('all');
  const [page, setPage] = useState(1);
  const [showReport, setShowReport] = useState(false);
  const [includeLabels, setIncludeLabels] = useState(false);
  const rows = useMemo(() => sweepRows(report, filter), [report, filter]);
  const shown = pageSweepRows(rows, page);
  const output = useMemo(() => showReport ? formatSearchSweepReport(report, includeLabels) : '',
    [report, includeLabels, showReport]);
  return <section className="project-scope-coverage" aria-label="Project search sweep results">
    <p role="status"><strong>Sweep {report.status}</strong> · {report.batches.length} completed batch observations.</p>
    <dl className="project-scope-stats">
      <div><dt>Selected labels</dt><dd>{report.selected}</dd></div>
      <div><dt>Fully scanned</dt><dd>{report.fullyScanned}</dd></div>
      <div><dt>Recorded but incomplete</dt><dd>{report.incomplete}</dd></div>
      <div><dt>Unobserved labels</dt><dd>{report.unobserved}</dd></div>
      <div><dt>Deferred outside range</dt><dd>{report.deferred}</dd></div>
      <div><dt>Excluded / withheld</dt><dd>{report.excluded} / {report.withheld}</dd></div>
    </dl>
    <p>These are historical, sequential observations, not an atomic or current workspace snapshot.
      A failed or cancelled batch has no completed evidence. Run a regular batch search to navigate or replace matches.</p>
    <div className="project-scope-inventory"><table>
      <caption>Completed sweep batches</caption>
      <thead><tr><th>Batch</th><th>Fully scanned</th><th>Incomplete</th><th>Displayed matches</th></tr></thead>
      <tbody>{report.batches.map(batch => <tr key={batch.index}>
        <td>{batch.index}</td><td>{batch.fullyScanned}</td><td>{batch.skipped}</td><td>{batch.displayed}</td>
      </tr>)}</tbody>
    </table></div>
    <label>File evidence<select aria-label="Sweep file evidence filter" value={filter} onChange={event => {
      const value = event.target.value;
      if (value === 'all' || value === 'scanned' || value === 'incomplete' || value === 'matched') {
        setFilter(value); setPage(1);
      }
    }}>
      <option value="all">All recorded labels</option>
      <option value="scanned">Fully scanned labels</option>
      <option value="incomplete">Incomplete labels</option>
      <option value="matched">Labels with displayed matches</option>
    </select></label>
    <div className="project-scope-inventory"><table>
      <caption>Recorded source evidence</caption>
      <thead><tr><th>Batch</th><th>Label</th><th>Coverage</th><th>Origin</th><th>Displayed</th></tr></thead>
      <tbody>{shown.rows.map(({batch,evidence}) => <tr key={evidence.name}>
        <td>{batch}</td><td><code dir="auto">{evidence.name}</code></td>
        <td>{SEARCH_COVERAGE_LABELS[evidence.state]}</td><td>{searchCoverageOrigin(evidence)}</td><td>{evidence.hits}</td>
      </tr>)}</tbody>
    </table></div>
    {!rows.length && <p>No recorded labels match this filter.</p>}
    <div className="project-scope-fields">
      <button type="button" disabled={shown.page <= 1} onClick={() => setPage(shown.page - 1)}>Previous sweep page</button>
      <span>Page {shown.page} of {shown.pages}</span>
      <button type="button" disabled={shown.page >= shown.pages} onClick={() => setPage(shown.page + 1)}>Next sweep page</button>
    </div>
    <button type="button" aria-expanded={showReport} onClick={() => setShowReport(value => !value)}>
      {showReport ? 'Hide sweep report' : 'Review sweep report'}
    </button>
    {showReport && <>
      <label><input type="checkbox" checked={includeLabels} onChange={event => setIncludeLabels(event.target.checked)}/>
        Include relative source labels in sweep report</label>
      <label>Copyable sweep report<textarea aria-label="Project search sweep report" readOnly rows={10} value={output}/></label>
      <p>Reports exclude query, filters, native paths, source text and match locations. Labels are optional.</p>
    </>}
  </section>;
}

export function ProjectSearchSweepPanel({ listed, settings, busy, available, onRun }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [first, setFirst] = useState('1');
  const [last, setLast] = useState('1');
  const [review, setReview] = useState<SearchSweepPlan | null>(null);
  const [result, setResult] = useState<SearchSweepReport | null>(null);
  const [progress, setProgress] = useState<SweepProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [error, setError] = useState('');
  const active = useRef<{ cancelled: boolean } | null>(null);
  const inventory = useMemo(() => buildProjectScopeInventory(listed), [listed]);
  const base = useMemo(() => planScopedProjectSearch(inventory, { ...settings.scope, batch: undefined }),
    [inventory, settings.scope]);
  const count = base.ok ? Math.ceil(base.value.sources.length / PROJECT_SEARCH_BATCH_SIZE) : 0;
  const disabled = !available || busy || running;
  function preview() {
    if (disabled) return;
    const plan = prepareSearchSweep(listed, settings, { first: Number(first), last: Number(last) });
    if (!plan.ok) { setReview(null); setError(plan.error); return; }
    setReview(plan.value); setError('');
  }
  async function run() {
    if (disabled || !review || active.current) return;
    const token = { cancelled: false };
    active.current = token;
    setRunning(true); setCancelRequested(false); setResult(null); setError(''); setProgress(null);
    const plan = review;
    setReview(null);
    try {
      const executed = await onRun(plan, {
        isCurrent: () => active.current === token,
        isCancelled: () => token.cancelled,
        onProgress: value => { if (active.current === token) setProgress(value); },
      });
      if (executed.kind === 'report') setResult(executed.report);
      else setError('Search sweep was invalidated. No batch evidence was retained.');
    } catch {
      setError('Search sweep could not start or complete. Review the current scope again.');
    } finally {
      active.current = null;
      setRunning(false); setCancelRequested(false); setProgress(null);
    }
  }
  return <section className="project-scope-coverage" aria-label="Project search sweep">
    <button type="button" aria-expanded={expanded} disabled={running} onClick={() => setExpanded(value => !value)}>
      {expanded ? 'Hide search sweep' : 'Run reviewed batch sweep'}
    </button>
    {expanded && <>
      <p>Run a consecutive range of at most {MAX_SWEEP_BATCHES} numbered batches. The total read budget is at most
        {' '}{MAX_SWEEP_BYTES / (1024 * 1024)} MiB per sweep. The current single-batch selection does not restrict the range.</p>
      <p>{count} batches available in the current directory and filename scope.</p>
      {!available && <p>Choose a project in the desktop application to run a sweep.</p>}
      {!base.ok && <p role="alert">{base.error}</p>}
      <div className="project-scope-fields">
        <label>First batch<input aria-label="Sweep first batch" inputMode="numeric" maxLength={3} value={first}
          disabled={disabled} onChange={event => { setFirst(event.target.value); setReview(null); }}/></label>
        <label>Last batch<input aria-label="Sweep last batch" inputMode="numeric" maxLength={3} value={last}
          disabled={disabled} onChange={event => { setLast(event.target.value); setReview(null); }}/></label>
        <button type="button" disabled={disabled || !count} onClick={() => {
          setFirst('1'); setLast(String(Math.min(MAX_SWEEP_BATCHES, count))); setReview(null);
        }}>Select first available sweep window</button>
        <button type="button" disabled={disabled || !count} onClick={preview}>Review search sweep</button>
      </div>
      {review && <SearchSweepReview plan={review} busy={disabled} onConfirm={() => void run()} onCancel={() => setReview(null)}/>}
      {running && <div role="status">
        <p>{progress ? progress.finishedBatches + ' / ' + progress.totalBatches + ' batches completed' : 'Starting sweep'}
          {progress?.currentBatch != null && ' · scanning batch ' + progress.currentBatch}</p>
        <button type="button" disabled={cancelRequested} onClick={() => {
          if (active.current) active.current.cancelled = true;
          setCancelRequested(true);
        }}>{cancelRequested ? 'Cancellation requested' : 'Cancel active sweep'}</button>
        <p>Cancellation takes effect after the current bounded read returns.</p>
      </div>}
      {error && <p role="alert">{error}</p>}
      {result && <><SearchSweepResults report={result}/>
        <button type="button" disabled={running} onClick={() => setResult(null)}>Dismiss sweep results</button></>}
    </>}
  </section>;
}
