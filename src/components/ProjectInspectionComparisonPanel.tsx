import { useMemo, useRef, useState } from 'react';
import { QUALITY_RULES, QUALITY_LABELS } from '../model/sourceQuality';
import { INSPECTION_TASK_KINDS, INSPECTION_STATE_LABELS, INSPECTION_ORIGIN_LABELS,
  type ProjectInspectionReport } from '../model/projectInspection';
import {
  captureInspectionBaseline, compareInspectionBaselines, filterInspectionComparison, pageInspectionComparison,
  inspectionDeltaLabel, inspectionComparisonReport, MAX_INSPECTION_BASELINES,
  type InspectionBaseline, type InspectionComparison, type InspectionComparisonFilter,
} from '../model/projectInspectionComparison';

interface RecordEntry { readonly id: number; readonly baseline: InspectionBaseline }
const filters: readonly InspectionComparisonFilter[] = ['all', 'changed', 'uncertain', 'earlier-only', 'current-only'];
const filterLabels: Readonly<Record<InspectionComparisonFilter,string>> = {
  all: 'All paired labels', changed: 'Observed count or origin changes', uncertain: 'Incomplete or missing evidence',
  'earlier-only': 'Earlier selection only', 'current-only': 'Current selection only',
};

export function InspectionComparisonDetails({ data }: { data: InspectionComparison }) {
  const [filter, setFilter] = useState<InspectionComparisonFilter>('all');
  const [page, setPage] = useState(1);
  const [showRules, setShowRules] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [labels, setLabels] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const rows = useMemo(() => filterInspectionComparison(data, filter), [data, filter]);
  const visible = pageInspectionComparison(rows, page);
  const selected = rows.find(row => row.name === detail);
  const report = useMemo(() => showReport ? inspectionComparisonReport(data, labels) : '', [data, labels, showReport]);
  return <section className="project-scope-coverage" aria-label="Source inspection comparison details">
    <p>Paired by exact relative label. Task and quality counts are compared independently only when both observations
      have complete evidence for that analysis. Lower counts do not prove that specific issues were resolved.</p>
    {(!data.earlierComplete || !data.currentComplete) && <p role="status">At least one scope was incomplete.</p>}
    <dl className="project-scope-stats">
      <div><dt>Comparable task labels</dt><dd>{data.comparableTaskFiles}</dd></div>
      <div><dt>Task count change</dt><dd>{inspectionDeltaLabel(data.taskTotals)}</dd></div>
      <div><dt>Comparable quality labels</dt><dd>{data.comparableQualityFiles}</dd></div>
      <div><dt>Quality count change</dt><dd>{inspectionDeltaLabel(data.qualityTotals)}</dd></div>
      <div><dt>Earlier-only / current-only</dt><dd>{data.earlierOnly} / {data.currentOnly}</dd></div>
      <div><dt>Origin changes</dt><dd>{data.originChanges}</dd></div>
    </dl>
    <button type="button" aria-expanded={showRules} onClick={() => setShowRules(value => !value)}>
      {showRules ? 'Hide inspection rule totals' : 'Review inspection rule totals'}
    </button>
    {showRules && <div className="project-scope-inventory">
      <table><caption>Task kinds across comparable task labels</caption><thead><tr><th>Kind</th><th>Count change</th></tr></thead>
        <tbody>{INSPECTION_TASK_KINDS.map(kind => <tr key={kind}><td>{kind}</td>
          <td>{inspectionDeltaLabel(data.comparableTaskFiles ? data.taskRules[kind] : null)}</td></tr>)}</tbody></table>
      <table><caption>Quality rules across comparable quality labels</caption><thead><tr><th>Rule</th><th>Count change</th></tr></thead>
        <tbody>{QUALITY_RULES.map(rule => <tr key={rule}><td>{QUALITY_LABELS[rule]}</td>
          <td>{inspectionDeltaLabel(data.comparableQualityFiles ? data.qualityRules[rule] : null)}</td></tr>)}</tbody></table>
    </div>}
    <label>Comparison filter<select aria-label="Inspection comparison filter" value={filter}
      onChange={event => {
        const value = filters.find(item => item === event.target.value);
        if (value) { setFilter(value); setPage(1); setDetail(null); }
      }}>
      {filters.map(item => <option key={item} value={item}>{filterLabels[item]}</option>)}
    </select></label>
    <p role="status">{rows.length} matching labels · page {visible.page} of {visible.pages}</p>
    <div className="project-scope-inventory"><ul>{visible.rows.map(row => <li key={row.name}>
      <strong><code dir="auto">{row.name}</code></strong>
      <p>Tasks: {inspectionDeltaLabel(row.taskDelta)} · Quality: {inspectionDeltaLabel(row.qualityDelta)}</p>
      <p>{!row.before ? 'Current selection only' : !row.after ? 'Earlier selection only' :
        INSPECTION_STATE_LABELS[row.before.state] + ' → ' + INSPECTION_STATE_LABELS[row.after.state]}
        {row.originChanged && ' · source origin changed'}</p>
      <button type="button" aria-expanded={detail === row.name} onClick={() => setDetail(value => value === row.name ? null : row.name)}>
        {detail === row.name ? 'Hide file comparison details' : 'Review file comparison details'}
      </button>
      {selected?.name === row.name && <div>
        <p>Earlier origin: {selected.before ? INSPECTION_ORIGIN_LABELS[selected.before.origin] : 'Not selected'} ·
          {' '}Current origin: {selected.after ? INSPECTION_ORIGIN_LABELS[selected.after.origin] : 'Not selected'}</p>
        <dl>{INSPECTION_TASK_KINDS.map(kind => <div key={kind}><dt>{kind}</dt>
          <dd>{inspectionDeltaLabel(selected.taskChanges?.[kind] ?? null)}</dd></div>)}</dl>
        <dl>{QUALITY_RULES.map(rule => <div key={rule}><dt>{QUALITY_LABELS[rule]}</dt>
          <dd>{inspectionDeltaLabel(selected.qualityChanges?.[rule] ?? null)}</dd></div>)}</dl>
      </div>}
    </li>)}</ul>{!rows.length && <p>No file labels match this comparison filter.</p>}</div>
    <div className="project-scope-fields">
      <button type="button" disabled={visible.page === 1} onClick={() => setPage(visible.page - 1)}>Previous inspection comparison page</button>
      <button type="button" disabled={visible.page === visible.pages} onClick={() => setPage(visible.page + 1)}>Next inspection comparison page</button>
    </div>
    <button type="button" aria-expanded={showReport} onClick={() => setShowReport(value => !value)}>
      {showReport ? 'Hide inspection comparison report' : 'Review inspection comparison report'}
    </button>
    {showReport && <>
      <label><input type="checkbox" checked={labels} onChange={event => setLabels(event.target.checked)}/>
        Include relative file labels in comparison report</label>
      <label>Copyable comparison report<textarea aria-label="Inspection comparison report" readOnly rows={10} value={report}/></label>
      <p>Default reports contain counts only. Neither report contains task descriptions, owners, source text or native paths.</p>
    </>}
  </section>;
}

export function ProjectInspectionComparisonPanel({ current, busy }: { current: ProjectInspectionReport | null; busy: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [records, setRecords] = useState<readonly RecordEntry[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [notice, setNotice] = useState('');
  const nextId = useRef(1);
  const candidate = useMemo(() => current ? captureInspectionBaseline(current) : null, [current]);
  const selected = records.find(record => record.id === selectedId);
  const comparison = useMemo(() => selected && candidate?.ok
    ? compareInspectionBaselines(selected.baseline, candidate.value) : null, [selected, candidate]);
  function record() {
    if (busy || !candidate?.ok || records.length >= MAX_INSPECTION_BASELINES) return;
    const id = nextId.current++;
    setRecords([...records, { id, baseline: candidate.value }]);
    setSelectedId(id); setConfirmClear(false); setNotice('Recorded inspection baseline ' + id + '.');
  }
  function remove() {
    const remaining = records.filter(record => record.id !== selectedId);
    setRecords(remaining); setSelectedId(remaining.at(-1)?.id ?? null);
    setConfirmClear(false); setNotice('Removed selected inspection baseline.');
  }
  return <section className="project-scope-coverage" aria-label="Listed inspection baseline library">
    <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
      {expanded ? 'Hide inspection comparisons' : 'Compare inspection baselines'}
    </button>
    {expanded && <>
      <p>Explicitly retain up to {MAX_INSPECTION_BASELINES} metadata-only baselines in this workspace session.
        Capture does not read any files. Run a new inspection with the same scope and mode to compare.</p>
      <button type="button" disabled={busy || !candidate?.ok || records.length >= MAX_INSPECTION_BASELINES} onClick={record}>
        Record current inspection baseline
      </button>
      {!candidate && <p>Run a listed source inspection to capture or compare a baseline.</p>}
      {candidate && !candidate.ok && <p role="alert">{candidate.error}</p>}
      <p role="status">{records.length} / {MAX_INSPECTION_BASELINES} baselines recorded. {notice}</p>
      {records.length >= MAX_INSPECTION_BASELINES && <p>Baseline capacity reached. Remove one before recording another.</p>}
      {records.length > 0 && <>
        <label>Earlier baseline<select aria-label="Earlier source inspection baseline" value={selectedId ?? ''}
          onChange={event => {
            const id = Number(event.target.value);
            if (records.some(record => record.id === id)) { setSelectedId(id); setConfirmClear(false); }
          }}>
          {records.map(record => <option key={record.id} value={record.id}>Baseline {record.id} · {record.baseline.mode} ·
            {' '}{record.baseline.selected} labels{record.baseline.complete ? '' : ' · incomplete scope'}</option>)}
        </select></label>
        <button type="button" disabled={busy || selectedId === null} onClick={remove}>Remove selected inspection baseline</button>
        <button type="button" disabled={busy || confirmClear} onClick={() => setConfirmClear(true)}>Clear inspection baselines</button>
        {confirmClear && <div role="group" aria-label="Confirm clearing inspection baselines">
          <p>Remove all recorded metadata? Current inspection results and source files are unaffected.</p>
          <button type="button" disabled={busy} onClick={() => {
            setRecords([]); setSelectedId(null); setConfirmClear(false); setNotice('Cleared inspection baselines.');
          }}>Confirm clear inspection baselines</button>
          <button type="button" onClick={() => setConfirmClear(false)}>Cancel clear inspection baselines</button>
        </div>}
      </>}
      {comparison && !comparison.ok && <p role="alert">{comparison.error}</p>}
      {comparison?.ok && <InspectionComparisonDetails key={selectedId} data={comparison.value}/>}
    </>}
  </section>;
}
