import { useMemo, useState } from 'react';
import type { LedgerComparison } from '../model/manifestLedgerComparison';
import { LEDGER_COMPARISON_LABELS, LEDGER_COMPARISON_STATES } from '../model/manifestLedgerComparison';
import {
  analyzeLedgerEvidence, DEFAULT_EVIDENCE_FILTER, evidenceAnalysisText,
  evidenceCoverage, filterEvidenceGroups,
  type EvidenceCoverage, type EvidenceDelta, type EvidenceFilter,
  type EvidenceGroup, type EvidenceGrouping, type EvidenceOrder,
} from '../model/manifestLedgerEvidence';
import { pageManifest } from '../model/projectSourceManifest';

const COVERAGE_LABELS: Record<Exclude<EvidenceCoverage, 'all'>, string> = {
  complete: 'Every selected file freshly comparable',
  partial: 'Partially comparable',
  unobserved: 'No refreshed observations',
};
const ORDERS: readonly { value: EvidenceOrder; label: string }[] = [
  { value: 'changed', label: 'Changed files first' },
  { value: 'incomplete', label: 'Missing fresh evidence first' },
  { value: 'byte-movement', label: 'Absolute byte movement' },
  { value: 'line-movement', label: 'Absolute editor line movement' },
  { value: 'label', label: 'Group label' },
];
const signed = (value: number) => value > 0 ? '+' + value : String(value);

function DeltaDetails({ label, delta }: { label: string; delta: EvidenceDelta }) {
  return <div>
    <strong>{label}</strong>
    {delta.measured === 0 ? <p>No comparable measurements.</p> : <dl className="project-scope-stats">
      <div><dt>Measured files</dt><dd>{delta.measured}</dd></div>
      <div><dt>Net delta</dt><dd>{signed(delta.net)}</dd></div>
      <div><dt>Absolute movement</dt><dd>{delta.movement}</dd></div>
      <div><dt>Increased</dt><dd>{delta.increased}</dd></div>
      <div><dt>Decreased</dt><dd>{delta.decreased}</dd></div>
      <div><dt>Same length</dt><dd>{delta.stable}</dd></div>
    </dl>}
  </div>;
}

function GroupDetails({ group }: { group: EvidenceGroup }) {
  const coverage = evidenceCoverage(group);
  return <>
    <p>{COVERAGE_LABELS[coverage]}</p>
    <dl className="project-scope-stats">
      <div><dt>Selected</dt><dd>{group.selected}</dd></div>
      <div><dt>Refreshed</dt><dd>{group.refreshed}</dd></div>
      <div><dt>Comparable</dt><dd>{group.comparable}</dd></div>
      <div><dt>Changed digest</dt><dd>{group.changed}</dd></div>
      <div><dt>Not freshly comparable</dt><dd>{group.incomplete}</dd></div>
      <div><dt>Retained without digest</dt><dd>{group.retainedWithoutDigest}</dd></div>
    </dl>
    {group.selected > 0 && <label>Fresh comparable evidence ({group.comparable} of {group.selected})
      <progress value={group.comparable} max={group.selected}/>
    </label>}
    <DeltaDetails label="Bytes" delta={group.bytes}/>
    <DeltaDetails label="Editor lines" delta={group.lines}/>
    <details>
      <summary>All evidence states</summary>
      <dl className="project-scope-stats">{LEDGER_COMPARISON_STATES.map(state => <div key={state}>
        <dt>{LEDGER_COMPARISON_LABELS[state]}</dt><dd>{group.counts[state]}</dd>
      </div>)}</dl>
    </details>
  </>;
}

export function ManifestLedgerEvidencePanel({ comparison }: { comparison: LedgerComparison }) {
  const [expanded, setExpanded] = useState(false);
  const [grouping, setGrouping] = useState<EvidenceGrouping>('folder');
  const [filter, setFilter] = useState(DEFAULT_EVIDENCE_FILTER);
  const [page, setPage] = useState(1);
  const [exportOpen, setExportOpen] = useState(false);
  const [includeLabels, setIncludeLabels] = useState(false);
  const analysis = useMemo(() => expanded ? analyzeLedgerEvidence(comparison, grouping) : null,
    [comparison, grouping, expanded]);
  const groups = useMemo(() => analysis ? filterEvidenceGroups(analysis, filter) : [],
    [analysis, filter]);
  const visible = pageManifest(groups, page);
  const report = useMemo(() => exportOpen && analysis ? evidenceAnalysisText(analysis, includeLabels) : '',
    [analysis, includeLabels, exportOpen]);

  function resetFilters() {
    setFilter(DEFAULT_EVIDENCE_FILTER);
    setPage(1);
  }

  function patchFilter(patch: Partial<EvidenceFilter>) {
    setFilter(previous => ({ ...previous, ...patch }));
    setPage(1);
  }

  function closeExport() {
    setExportOpen(false);
    setIncludeLabels(false);
  }

  return <section aria-label="Grouped ledger comparison evidence">
    <button type="button" aria-expanded={expanded} onClick={() => {
      setExpanded(!expanded);
      resetFilters();
      closeExport();
    }}>{expanded ? 'Hide' : 'Analyze'} grouped comparison evidence</button>
    {expanded && analysis && <>
      <p>Find folders and batches needing another observation, or inspect where comparable changes occurred.
        Each source belongs to exactly one group. Nested folders are separate from their parents.</p>
      <p>Retained files are not freshly checked. Net and absolute length changes are historical file
        measurements, not Git additions or deletions.</p>
      <section aria-label="Total evidence coverage">
        <h4>All selected sources</h4>
        <GroupDetails group={analysis.total}/>
      </section>
      <label>Group sources by<select value={grouping} onChange={event => {
        const next = event.target.value;
        if (next !== 'folder' && next !== 'batch') return;
        setGrouping(next);
        resetFilters();
        closeExport();
      }}>
        <option value="folder">Direct parent folder</option>
        <option value="batch">Reviewed batch</option>
      </select></label>
      <label>Filter group labels<input type="search" maxLength={120} value={filter.query}
        onChange={event => patchFilter({ query: event.target.value })}/></label>
      <label>Evidence coverage<select value={filter.coverage} onChange={event => {
        const next = event.target.value;
        if (next === 'all' || next === 'complete' || next === 'partial' || next === 'unobserved') {
          patchFilter({ coverage: next });
        }
      }}>
        <option value="all">All groups</option>
        <option value="complete">Fully comparable</option>
        <option value="partial">Partially comparable</option>
        <option value="unobserved">Not refreshed</option>
      </select></label>
      <label>Group order<select value={filter.order} onChange={event => {
        const next = ORDERS.find(order => order.value === event.target.value);
        if (next) patchFilter({ order: next.value });
      }}>{ORDERS.map(order => <option key={order.value} value={order.value}>{order.label}</option>)}</select></label>
      <label><input type="checkbox" checked={filter.changedOnly}
        onChange={event => patchFilter({ changedOnly: event.target.checked })}/>Groups with changed digests only</label>
      <button type="button" onClick={resetFilters}>Reset group filters</button>
      <p role="status">{groups.length} of {analysis.groups.length} groups · Page {visible.page} of {visible.pages}</p>
      {!groups.length && <p>No groups match the selected evidence filters.</p>}
      <div className="project-scope-inventory">
        <ul>{visible.rows.map(group => <li key={group.key}>
          <h4><code dir="auto">{group.label}</code></h4>
          <GroupDetails group={group}/>
        </li>)}</ul>
      </div>
      <button type="button" disabled={visible.page === 1} onClick={() => setPage(visible.page - 1)}>Previous group page</button>
      <button type="button" disabled={visible.page === visible.pages} onClick={() => setPage(visible.page + 1)}>Next group page</button>
      <button type="button" aria-expanded={exportOpen} onClick={() => {
        if (exportOpen) closeExport();
        else setExportOpen(true);
      }}>{exportOpen ? 'Hide' : 'Review'} grouped evidence report</button>
      {exportOpen && <>
        <p>The export includes totals for the full comparison, regardless of presentation filters.
          Relative group labels are excluded unless explicitly enabled.</p>
        <label><input type="checkbox" checked={includeLabels} onChange={event => setIncludeLabels(event.target.checked)}/>
          Include group labels and group statistics</label>
        <textarea aria-label="Grouped evidence report" readOnly rows={10} value={report}/>
      </>}
    </>}
  </section>;
}
