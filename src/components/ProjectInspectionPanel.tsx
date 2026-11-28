import { useMemo, useRef, useState } from 'react';
import { ProjectSearchScopeControls } from './ProjectSearchScopeControls';
import { ProjectInspectionComparisonPanel } from './ProjectInspectionComparisonPanel';
import { DEFAULT_PROJECT_SEARCH_SCOPE, type ProjectSearchScope } from '../model/projectSearchScope';
import { QUALITY_LABELS, QUALITY_RULES, type QualityRule } from '../model/sourceQuality';
import type { ScarpTaskKind, ScarpTaskPriority } from '../model/commentTasks';
import type { ProjectSearchSource } from '../model/projectSearch';
import { visibleMatchContext } from '../model/projectMatchExplorer';
import {
  DEFAULT_INSPECTION_FILTER, INSPECTION_READ_LIMITS, INSPECTION_TASK_KINDS,
  INSPECTION_STATES, INSPECTION_STATE_LABELS, INSPECTION_ORIGIN_LABELS,
  prepareProjectInspection, filterInspection, pageInspection, inspectionReportText,
  type InspectionSettings, type ProjectInspectionPlan, type ProjectInspectionReport,
  type InspectionMode, type InspectionControl, type InspectionExecution,
  type InspectionProgress, type InspectionFilter,
} from '../model/projectInspection';

interface Props {
  listed: readonly ProjectSearchSource[];
  listingLimited: boolean;
  available: boolean;
  busy: boolean;
  onRun: (plan: ProjectInspectionPlan, settings: InspectionSettings, control: InspectionControl) => Promise<InspectionExecution>;
  onOpen: (report: ProjectInspectionReport, label: string) => void;
}

export function ProjectInspectionReview({ plan, busy, onConfirm, onCancel }: {
  plan: ProjectInspectionPlan; busy: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const [labels, setLabels] = useState(false);
  return <section className="project-scope-coverage" aria-label="Review listed source inspection">
    <p><strong>Review source inspection</strong></p>
    <p>{plan.settings.mode === 'working' ? 'Working buffers take precedence over disk files.' : 'Saved disk snapshots only; unsaved edits ignored.'}</p>
    <p>Selected {plan.selected} of {plan.listed} listed sources · {plan.excluded} excluded ·
      {' '}{plan.deferred} deferred · {plan.withheld} withheld.</p>
    {plan.settings.listingLimited && <p role="status">The Explorer listing itself is known to be limited.</p>}
    <p>No files are modified. Quality findings are lexical/editor hints, not compiler diagnostics.
      Task descriptions remain in session memory but are omitted from copied reports.</p>
    <button type="button" aria-expanded={labels} onClick={() => setLabels(value => !value)}>
      {labels ? 'Hide inspection labels' : 'Review inspection labels'}
    </button>
    {labels && <div className="project-scope-inventory"><ul>{plan.sources.map(source =>
      <li key={source.name}><code dir="auto">{source.name}</code></li>)}</ul></div>}
    <button type="button" disabled={busy} onClick={onConfirm}>Confirm source inspection</button>
    <button type="button" onClick={onCancel}>Cancel inspection review</button>
  </section>;
}

type InspectionView = 'files' | 'tasks' | 'quality';
function InspectionFilters({ report, view, filter, onChange }: {
  report: ProjectInspectionReport; view: InspectionView; filter: InspectionFilter;
  onChange: (patch: Partial<InspectionFilter>) => void;
}) {
  return <div className="project-scope-fields">
    <label>Filter observations<input type="search" maxLength={120} aria-label="Filter listed inspection observations"
      value={filter.query} onChange={event => onChange({ query: event.target.value })}/></label>
    <label>Source label<select aria-label="Inspection source label" value={filter.source}
      onChange={event => onChange({ source: event.target.value })}>
      <option value="">All inspected labels</option>
      {report.files.map(file => <option key={file.name} value={file.name}>{file.name}</option>)}
    </select></label>
    {view === 'files' && <label>Coverage<select aria-label="Inspection file coverage" value={filter.fileState}
      onChange={event => {
        const value = event.target.value;
        if (value === 'all' || INSPECTION_STATES.includes(value as InspectionFilter['fileState'] & typeof INSPECTION_STATES[number]))
          onChange({ fileState: value as InspectionFilter['fileState'] });
      }}>
      <option value="all">All file states</option>
      {INSPECTION_STATES.map(state => <option key={state} value={state}>{INSPECTION_STATE_LABELS[state]}</option>)}
    </select></label>}
    {view === 'tasks' && <>
      <label>Marker<select aria-label="Inspection task marker" value={filter.taskKind} onChange={event => {
        const value = event.target.value;
        if (value === 'all' || INSPECTION_TASK_KINDS.includes(value as ScarpTaskKind)) onChange({ taskKind: value as ScarpTaskKind | 'all' });
      }}><option value="all">All marker kinds</option>
        {INSPECTION_TASK_KINDS.map(kind => <option key={kind} value={kind}>{kind}</option>)}
      </select></label>
      <label>Priority<select aria-label="Inspection task priority" value={filter.priority} onChange={event => {
        const value = event.target.value;
        if (['all','high','normal','low'].includes(value)) onChange({ priority: value as ScarpTaskPriority | 'all' });
      }}>
        <option value="all">Any priority</option><option value="high">High</option>
        <option value="normal">Normal</option><option value="low">Low</option>
      </select></label>
    </>}
    {view === 'quality' && <>
      <label>Rule<select aria-label="Inspection quality rule" value={filter.qualityRule} onChange={event => {
        const value = event.target.value;
        if (value === 'all' || QUALITY_RULES.includes(value as QualityRule)) onChange({ qualityRule: value as QualityRule | 'all' });
      }}><option value="all">All quality rules</option>
        {QUALITY_RULES.map(rule => <option key={rule} value={rule}>{QUALITY_LABELS[rule]}</option>)}
      </select></label>
      <label>Severity<select aria-label="Inspection quality severity" value={filter.severity} onChange={event => {
        const value = event.target.value;
        if (value === 'all' || value === 'review' || value === 'style') onChange({ severity: value });
      }}><option value="all">Any severity</option><option value="review">Review</option><option value="style">Style</option></select></label>
    </>}
    {view !== 'files' && <label>Order<select aria-label="Inspection observation order" value={filter.order}
      onChange={event => { const value = event.target.value; if (value === 'source' || value === 'priority') onChange({ order: value }); }}>
      <option value="source">Source and position</option><option value="priority">Priority first</option>
    </select></label>}
  </div>;
}

export function ProjectInspectionResults({ report, busy, onOpen }: {
  report: ProjectInspectionReport; busy: boolean; onOpen: (label: string) => void;
}) {
  const [view, setView] = useState<InspectionView>('files');
  const [filter, setFilter] = useState(DEFAULT_INSPECTION_FILTER);
  const [page, setPage] = useState(1);
  const [showReport, setShowReport] = useState(false);
  const [includeLabels, setIncludeLabels] = useState(false);
  const filtered = useMemo(() => filterInspection(report, filter), [report, filter]);
  const files = pageInspection(filtered.files, page);
  const tasks = pageInspection(filtered.tasks, page);
  const findings = pageInspection(filtered.findings, page);
  const current = view === 'files' ? files : view === 'tasks' ? tasks : findings;
  const count = view === 'files' ? filtered.files.length : view === 'tasks' ? filtered.tasks.length : filtered.findings.length;
  const output = useMemo(() => showReport ? inspectionReportText(report, includeLabels) : '',
    [showReport, report, includeLabels]);
  return <section className="project-scope-coverage listed-inspection-results" aria-label="Listed source inspection results">
    <p role="status"><strong>Inspection {report.status}</strong> · {report.complete ? 'Complete for chosen listed scope' : 'Incomplete coverage'}</p>
    <p>Historical observations from {report.mode === 'working' ? 'working buffers and disk' : 'saved disk files'}.
      Opening a source opens its current unique Explorer entry, not the old observation coordinate.</p>
    <dl className="project-scope-stats">
      <div><dt>Selected sources</dt><dd>{report.selected}</dd></div>
      <div><dt>Fully inspected</dt><dd>{report.fullyInspected}</dd></div>
      <div><dt>Partial</dt><dd>{report.partial}</dd></div>
      <div><dt>Unread</dt><dd>{report.unread}</dd></div>
      <div><dt>Deferred / withheld</dt><dd>{report.deferred} / {report.withheld}</dd></div>
      <div><dt>Retained tasks</dt><dd>{report.tasks.length}</dd></div>
      <div><dt>Retained findings</dt><dd>{report.findings.length}</dd></div>
      <div><dt>Analyzed bytes</dt><dd>{report.bytes}</dd></div>
    </dl>
    {report.listingLimited && <p>The Explorer listing was limited when this inspection ran.</p>}
    <label>Observation view<select aria-label="Listed inspection view" value={view} onChange={event => {
      const value = event.target.value;
      if (value === 'files' || value === 'tasks' || value === 'quality') { setView(value); setPage(1); }
    }}><option value="files">File coverage</option><option value="tasks">Comment tasks</option><option value="quality">Quality findings</option></select></label>
    <InspectionFilters report={report} view={view} filter={filter}
      onChange={patch => { setFilter(previous => ({ ...previous, ...patch })); setPage(1); }}/>
    <button type="button" onClick={() => { setFilter(DEFAULT_INSPECTION_FILTER); setPage(1); }}>Reset inspection filters</button>
    <p role="status">{count} matching observations · Page {current.page} of {current.pages}</p>
    <div className="project-scope-inventory">
      {view === 'files' && <ul>{files.rows.map(file => <li key={file.name}>
        <strong><code dir="auto">{file.name}</code></strong>
        <p>{INSPECTION_STATE_LABELS[file.state]} · {INSPECTION_ORIGIN_LABELS[file.origin]}{file.dirtyTab ? ' · dirty tab exists' : ''}</p>
        <p>Lexical: {file.lexicalComplete ? 'complete' : 'not complete'} · Tasks: {file.tasksComplete ? 'complete' : 'not complete'} ·
          {' '}Quality: {file.qualityComplete ? 'complete' : 'not complete'}</p>
        <p>{file.tasksRetained} retained tasks · {file.findingsRetained} findings
          {file.bytes !== null && ' · ' + file.bytes + ' bytes'}
          {file.lexicalLines !== null && ' · ' + file.lexicalLines + ' lexical lines'}</p>
        <button type="button" disabled={busy} onClick={() => onOpen(file.name)}>Open current listed source</button>
      </li>)}</ul>}
      {view === 'tasks' && <ul>{tasks.rows.map(task => <li key={task.id}>
        <strong>{task.kind} · {task.priority}</strong>
        <p><code dir="auto">{task.source}:{task.line}:{task.column}</code></p>
        <p>{visibleMatchContext(task.description)}{task.owner && ' · Owner: ' + visibleMatchContext(task.owner)}</p>
        <button type="button" disabled={busy} onClick={() => onOpen(task.source)}>Open current listed source</button>
      </li>)}</ul>}
      {view === 'quality' && <ul>{findings.rows.map(finding => <li key={finding.id}>
        <strong>{QUALITY_LABELS[finding.rule]} · {finding.severity}</strong>
        <p><code dir="auto">{finding.source}:{finding.line}:{finding.column}</code></p>
        <p>{finding.message}</p>
        <button type="button" disabled={busy} onClick={() => onOpen(finding.source)}>Open current listed source</button>
      </li>)}</ul>}
      {!count && <p>No retained observations match the filters.</p>}
    </div>
    <div className="project-scope-fields">
      <button type="button" disabled={current.page === 1} onClick={() => setPage(current.page - 1)}>Previous inspection page</button>
      <button type="button" disabled={current.page === current.pages} onClick={() => setPage(current.page + 1)}>Next inspection page</button>
    </div>
    <button type="button" aria-expanded={showReport} onClick={() => setShowReport(value => !value)}>
      {showReport ? 'Hide inspection report' : 'Review inspection report'}
    </button>
    {showReport && <>
      <label><input type="checkbox" checked={includeLabels} onChange={event => setIncludeLabels(event.target.checked)}/>
        Include relative source labels in inspection report</label>
      <label>Copyable inspection report<textarea aria-label="Listed source inspection report" readOnly rows={10} value={output}/></label>
      <p>Reports exclude task descriptions, owners, native paths, source text and cleanup edits.</p>
    </>}
  </section>;
}

export function ProjectInspectionPanel({ listed, listingLimited, available, busy, onRun, onOpen }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [scope, setScope] = useState<ProjectSearchScope>(DEFAULT_PROJECT_SEARCH_SCOPE);
  const [mode, setMode] = useState<InspectionMode>('working');
  const [review, setReview] = useState<ProjectInspectionPlan | null>(null);
  const [result, setResult] = useState<ProjectInspectionReport | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<InspectionProgress | null>(null);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [notice, setNotice] = useState('');
  const active = useRef<{ cancelled: boolean } | null>(null);
  const settings = { scope, mode, listingLimited };
  const blocked = busy || running || !available;
  function preview() {
    if (blocked) return;
    const p = prepareProjectInspection(listed, settings);
    if (p.ok) { setReview(p.value); setNotice(''); }
    else { setReview(null); setNotice(p.error); }
  }
  async function run() {
    if (!review || blocked || active.current) return;
    const token = { cancelled: false };
    active.current = token;
    const plan = review;
    setReview(null); setResult(null); setNotice(''); setRunning(true); setProgress(null); setCancelRequested(false);
    try {
      const response = await onRun(plan, settings, {
        isCurrent: () => active.current === token,
        isCancelled: () => token.cancelled,
        onProgress: value => { if (active.current === token) setProgress(value); },
      });
      if (response.kind === 'report') setResult(response.report);
      else setNotice('Inspection invalidated. Review the current source scope again.');
    } catch {
      setNotice('Inspection could not complete. Review the current source scope again.');
    } finally {
      active.current = null;
      setRunning(false); setProgress(null); setCancelRequested(false);
    }
  }
  return <section className="sidebar-section listed-inspection-panel" aria-label="Listed project source inspection">
    <div className="sidebar-heading">LISTED SOURCE INSPECTION</div>
    <button type="button" className="insights-toggle" aria-expanded={expanded} disabled={running}
      onClick={() => { setExpanded(!expanded); if (expanded) setReview(null); }}>{expanded ? 'Hide listed source inspection' : 'Inspect listed source quality and tasks'}</button>
    {expanded && <>
      <p>Read-only lexical analysis of up to {INSPECTION_READ_LIMITS.files} already-listed Scarp files and
        {' '}{INSPECTION_READ_LIMITS.totalBytes / 1024 / 1024} MiB of source. No compiler execution or cleanup occurs.</p>
      {!available && <p>Choose a workspace folder in the desktop application.</p>}
      <label>Snapshot mode<select aria-label="Listed inspection snapshot mode" value={mode} disabled={blocked}
        onChange={event => {
          const value = event.target.value;
          if (value === 'working' || value === 'saved') { setMode(value); setReview(null); }
        }}>
        <option value="working">Working buffers and disk</option><option value="saved">Saved disk only</option>
      </select></label>
      <ProjectSearchScopeControls listed={listed} scope={scope} busy={blocked}
        onChange={next => { setScope(next); setReview(null); }}/>
      <button type="button" disabled={blocked} onClick={preview}>Review listed source inspection</button>
      {review && <ProjectInspectionReview plan={review} busy={blocked} onConfirm={() => void run()} onCancel={() => setReview(null)}/>}
      {running && <div role="status">
        <p>{progress ? progress.observed + ' / ' + progress.total + ' source observations' : 'Starting inspection'}</p>
        <button type="button" disabled={cancelRequested} onClick={() => {
          if (active.current) active.current.cancelled = true;
          setCancelRequested(true);
        }}>{cancelRequested ? 'Inspection cancellation requested' : 'Cancel source inspection'}</button>
      </div>}
      {notice && <p role="alert">{notice}</p>}
    </>}
    <ProjectInspectionComparisonPanel current={result} busy={blocked} visible={expanded}/>
    {expanded && <>
      {result && <><ProjectInspectionResults report={result} busy={blocked} onOpen={label => onOpen(result, label)}/>
        <button type="button" disabled={running} onClick={() => setResult(null)}>Dismiss inspection results</button></>}
    </>}
  </section>;
}
