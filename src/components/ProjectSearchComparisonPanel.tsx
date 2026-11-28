import { useMemo, useRef, useState } from 'react';
import type { SearchOptions } from '../model/openFileSearch';
import type { ScopedSearchSummary } from '../model/projectSearchScope';
import {
  captureSearchObservation, compareSearchObservations, filterSearchComparison, pageSearchComparison,
  searchComparisonEvidence, searchComparisonDelta, searchObservationComparisonReport,
  SEARCH_COMPARISON_FILTERS, SEARCH_COMPARISON_LABELS, SEARCH_COMPARISON_STATES, MAX_SEARCH_OBSERVATIONS,
  type SearchObservation, type SearchComparisonFilter, type SearchObservationComparison,
} from '../model/projectSearchComparison';

interface StoredObservation {
  readonly id: number;
  readonly observation: SearchObservation;
}
interface Props {
  readonly current: { readonly query: string; readonly options: SearchOptions; readonly summary: ScopedSearchSummary } | null;
  readonly busy: boolean;
}
function filterLabel(filter: SearchComparisonFilter): string {
  return filter === 'all' ? 'All file labels' : filter === 'changed'
    ? 'Changes and incomplete evidence' : SEARCH_COMPARISON_LABELS[filter];
}

export function SearchComparisonDetails({ comparison }: { comparison: SearchObservationComparison }) {
  const [filter, setFilter] = useState<SearchComparisonFilter>('all');
  const [requestedPage, setRequestedPage] = useState(1);
  const [includeLabels, setIncludeLabels] = useState(false);
  const filtered = useMemo(() => filterSearchComparison(comparison, filter), [comparison, filter]);
  const page = pageSearchComparison(filtered, requestedPage);
  const report = useMemo(() => searchObservationComparisonReport(comparison, includeLabels), [comparison, includeLabels]);
  return <div className="project-search-comparison-details">
    <p>Paired by exact relative source labels only. Counts are observations, not proof of semantic edits or
      filesystem additions/deletions. Separate searches are not an atomic workspace snapshot.</p>
    {(comparison.earlierIncomplete || comparison.currentIncomplete) && <p role="status">
      At least one scope was incomplete. A missing match or label must not be treated as a deletion.
    </p>}
    <dl className="project-scope-stats">
      <div><dt>Comparable file labels</dt><dd>{comparison.comparableFiles}</dd></div>
      <div><dt>Observed count delta</dt><dd>{comparison.comparableFiles
        ? (comparison.observedDelta > 0 ? '+' : '') + comparison.observedDelta : 'Not established'}</dd></div>
      <div><dt>Snapshot origin changes</dt><dd>{comparison.originChanges}</dd></div>
      <div><dt>Earlier/current deferred</dt><dd>{comparison.earlierDeferred} / {comparison.currentDeferred}</dd></div>
      {SEARCH_COMPARISON_STATES.map(state => <div key={state}>
        <dt>{SEARCH_COMPARISON_LABELS[state]}</dt><dd>{comparison.counts[state]}</dd>
      </div>)}
    </dl>
    <label>Comparison filter<select aria-label="Search observation filter" value={filter} onChange={event => {
      const selected = SEARCH_COMPARISON_FILTERS.find(option => option === event.target.value);
      if (selected) { setFilter(selected); setRequestedPage(1); }
    }}>
      {SEARCH_COMPARISON_FILTERS.map(option => <option key={option} value={option}>{filterLabel(option)}</option>)}
    </select></label>
    <p role="status">{filtered.length ? page.first + '–' + page.last : '0'} of {filtered.length} file labels.</p>
    <div className="project-scope-inventory">
      <table>
        <caption>Observed search differences</caption>
        <thead><tr><th>Relative source label</th><th>Earlier observation</th><th>Current observation</th>
          <th>Count difference</th><th>Evidence</th></tr></thead>
        <tbody>{page.rows.map(row => <tr key={row.name}>
          <td><code dir="auto">{row.name}</code></td>
          <td>{searchComparisonEvidence(row.before)}</td>
          <td>{searchComparisonEvidence(row.after)}</td>
          <td>{searchComparisonDelta(row)}</td>
          <td>{SEARCH_COMPARISON_LABELS[row.state]}{row.originChanged && ' · origin changed'}</td>
        </tr>)}</tbody>
      </table>
      {!page.rows.length && <p>No file labels match this comparison filter.</p>}
    </div>
    <div className="project-scope-fields">
      <button type="button" disabled={page.page <= 1} onClick={() => setRequestedPage(page.page - 1)}>Previous comparison page</button>
      <span>Page {page.page} of {page.pages}</span>
      <button type="button" disabled={page.page >= page.pages} onClick={() => setRequestedPage(page.page + 1)}>Next comparison page</button>
    </div>
    <label><input type="checkbox" checked={includeLabels} onChange={event => setIncludeLabels(event.target.checked)}/>
      Include relative source labels in comparison report</label>
    <label>Copyable comparison report<textarea aria-label="Search observation comparison report" readOnly rows={9} value={report}/></label>
    <p>Reports exclude search queries, filename filters, absolute paths and source text.
      Only opt in to labels when it is appropriate to share them.</p>
  </div>;
}

/** Parent keys this panel by selected workspace path and mounts it only for the
 * open search workbench. Captures never trigger a read or persist to storage.
 */
export function ProjectSearchComparisonPanel({ current, busy }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [records, setRecords] = useState<readonly StoredObservation[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [notice, setNotice] = useState('');
  const nextId = useRef(1);
  const candidate = useMemo(() => current
    ? captureSearchObservation(current.query, current.options, current.summary) : null, [current]);
  const earlier = records.find(record => record.id === selected);
  const comparison = useMemo(() => earlier && candidate?.ok
    ? compareSearchObservations(earlier.observation, candidate.value) : null, [earlier, candidate]);

  function record() {
    if (busy || !candidate?.ok || records.length >= MAX_SEARCH_OBSERVATIONS) return;
    const id = nextId.current++;
    setRecords([...records, { id, observation: candidate.value }]);
    setSelected(id);
    setConfirmClear(false);
    setNotice('Recorded observation ' + id + '. No source text or native paths retained.');
  }
  function remove() {
    if (selected === null) return;
    const remaining = records.filter(record => record.id !== selected);
    setRecords(remaining);
    setSelected(remaining.at(-1)?.id ?? null);
    setConfirmClear(false);
    setNotice('Removed the selected observation.');
  }
  return <section className="project-scope-coverage" aria-label="Project search observation comparison">
    <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
      {expanded ? 'Hide search observations' : 'Compare search observations'}
    </button>
    {expanded && <>
      <p>Explicitly record up to {MAX_SEARCH_OBSERVATIONS} completed search observations while this search workbench
        remains open. Observations are cleared when the workbench closes or the workspace changes.
        No disk writes or automatic searches occur.</p>
      <p>Saved observations retain the exact query and matching options only in memory, to reject incompatible
        comparisons. Source text and native paths are not retained.</p>
      <button type="button" disabled={busy || !candidate?.ok || records.length >= MAX_SEARCH_OBSERVATIONS}
        onClick={record}>Record current search observation</button>
      {records.length >= MAX_SEARCH_OBSERVATIONS && <p>Observation capacity reached. Remove an observation before recording another.</p>}
      {!candidate && <p>Run a new project search to record or compare an observation.</p>}
      {candidate && !candidate.ok && <p role="alert">{candidate.error}</p>}
      <p role="status">{records.length} / {MAX_SEARCH_OBSERVATIONS} observations recorded. {notice}</p>
      {records.length > 0 && <>
        <label>Earlier observation<select aria-label="Earlier search observation" value={selected ?? ''}
          onChange={event => {
            const id = Number(event.target.value);
            if (records.some(record => record.id === id)) { setSelected(id); setConfirmClear(false); }
          }}>
          {records.map(record => <option key={record.id} value={record.id}>Observation {record.id} · {record.observation.rows.length} selected labels
            {record.observation.incomplete ? ' · incomplete scope' : ''}</option>)}
        </select></label>
        <button type="button" disabled={selected === null} onClick={remove}>Remove selected observation</button>
        <button type="button" disabled={confirmClear} onClick={() => setConfirmClear(true)}>Clear search observations</button>
        {confirmClear && <div role="group" aria-label="Confirm clearing search observations">
          <p>Remove all recorded observations from this workbench? Current search results will remain unchanged.</p>
          <button type="button" onClick={() => {
            setRecords([]); setSelected(null); setConfirmClear(false); setNotice('All observations cleared.');
          }}>Confirm clear observations</button>
          <button type="button" onClick={() => setConfirmClear(false)}>Cancel clear</button>
        </div>}
      </>}
      {comparison && !comparison.ok && <p role="alert">{comparison.error}</p>}
      {comparison?.ok && <SearchComparisonDetails key={selected} comparison={comparison.value}/>}
    </>}
  </section>;
}
