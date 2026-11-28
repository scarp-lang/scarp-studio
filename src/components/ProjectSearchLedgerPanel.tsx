import { useMemo, useState } from 'react';
import type { SearchOptions } from '../model/openFileSearch';
import {
  buildProjectScopeInventory, SEARCH_COVERAGE_LABELS, searchCoverageOrigin,
  type ProjectSearchScope, type ScopedSearchSummary,
} from '../model/projectSearchScope';
import type { ProjectSearchSource } from '../model/projectSearch';
import { captureSearchObservation } from '../model/projectSearchComparison';
import {
  checkSearchLedgerContext, createSearchBatchLedger, nextSearchLedgerBatch,
  recordSearchLedgerBatch, removeSearchLedgerBatch, searchBatchLedgerReport,
  summarizeSearchBatchLedger, SEARCH_LEDGER_STATUS_LABELS,
  type SearchBatchLedger, type SearchLedgerSummary, type LedgerStatus,
} from '../model/projectSearchLedger';

interface Props {
  readonly listed: readonly ProjectSearchSource[];
  readonly query: string;
  readonly options: SearchOptions;
  readonly scope: ProjectSearchScope;
  readonly current: ScopedSearchSummary | null;
  readonly busy: boolean;
  readonly onScopeChange: (scope: ProjectSearchScope) => void;
}

type StatusFilter = 'all' | LedgerStatus;
const filters: readonly StatusFilter[] = ['all', 'unrecorded', 'incomplete', 'fully-scanned'];
const PAGE_SIZE = 10;

interface DetailsProps {
  readonly summary: SearchLedgerSummary;
  readonly canNavigate: boolean;
  readonly busy: boolean;
  readonly onSelectBatch: (index: number) => void;
  readonly onRemoveBatch: (index: number) => void;
}

export function SearchLedgerDetails({ summary, canNavigate, busy, onSelectBatch, onRemoveBatch }: DetailsProps) {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [requestedPage, setPage] = useState(1);
  const [expandedBatch, setExpandedBatch] = useState<number | null>(null);
  const [includeLabels, setIncludeLabels] = useState(false);
  const rows = summary.batches.filter(batch => filter === 'all' || batch.status === filter);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, requestedPage));
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const next = nextSearchLedgerBatch(summary);
  const report = useMemo(() => searchBatchLedgerReport(summary, includeLabels), [summary, includeLabels]);
  return <div className="project-search-ledger-details">
    <p>Independent observations only. Fully scanned labels may have changed since their recorded search.
      No combined or current workspace coverage is asserted.</p>
    <dl className="project-scope-stats">
      <div><dt>Eligible planned labels</dt><dd>{summary.candidates}</dd></div>
      <div><dt>Fully scanned in recorded observations</dt><dd>{summary.fullyScanned}</dd></div>
      <div><dt>Recorded but not fully scanned</dt><dd>{summary.incomplete}</dd></div>
      <div><dt>No recorded observation</dt><dd>{summary.unrecorded}</dd></div>
      <div><dt>Recorded batches</dt><dd>{summary.recordedBatches} / {summary.totalBatches}</dd></div>
      <div><dt>Excluded / withheld listing entries</dt><dd>{summary.excluded} / {summary.withheld}</dd></div>
    </dl>
    <button type="button" disabled={!canNavigate || busy || next === null}
      onClick={() => { if (next !== null) onSelectBatch(next); }}>Select next pending batch</button>
    {next === null && <p>Every planned label was fully scanned in its recorded observation.
      This does not establish current workspace coverage.</p>}
    <label>Ledger batch filter<select aria-label="Search ledger batch filter" value={filter} onChange={event => {
      const value = filters.find(item => item === event.target.value);
      if (value) { setFilter(value); setPage(1); setExpandedBatch(null); }
    }}>
      <option value="all">All batches</option>
      {filters.filter((item): item is LedgerStatus => item !== 'all').map(item =>
        <option key={item} value={item}>{SEARCH_LEDGER_STATUS_LABELS[item]}</option>)}
    </select></label>
    <p role="status">{rows.length} matching batches · page {page} of {pages}</p>
    <div className="project-scope-inventory">
      {visible.map(batch => <div key={batch.index} className="project-search-ledger-batch">
        <p><strong>Batch {batch.index}</strong> · {SEARCH_LEDGER_STATUS_LABELS[batch.status]}
          {' '}· {batch.fullyScanned} fully scanned · {batch.incomplete} incomplete · {batch.unrecorded} unrecorded</p>
        <div className="project-scope-fields">
          <button type="button" disabled={!canNavigate || busy} onClick={() => onSelectBatch(batch.index)}>
            Select batch {batch.index}
          </button>
          <button type="button" aria-expanded={expandedBatch === batch.index}
            onClick={() => setExpandedBatch(value => value === batch.index ? null : batch.index)}>
            {expandedBatch === batch.index ? 'Hide planned labels' : 'Review planned labels'}
          </button>
          {batch.status !== 'unrecorded' && <button type="button" disabled={busy}
            onClick={() => onRemoveBatch(batch.index)}>Remove observation for batch {batch.index}</button>}
        </div>
        {expandedBatch === batch.index && <ul>{batch.labels.map(label => {
          const row = batch.rows.find(item => item.name === label);
          return <li key={label}><code dir="auto">{label}</code> · {row
            ? SEARCH_COVERAGE_LABELS[row.state] + ' · ' + searchCoverageOrigin(row) : 'No observation'}</li>;
        })}</ul>}
      </div>)}
      {!visible.length && <p>No batches match this filter.</p>}
    </div>
    <div className="project-scope-fields">
      <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous ledger page</button>
      <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next ledger page</button>
    </div>
    <label><input type="checkbox" checked={includeLabels} onChange={event => setIncludeLabels(event.target.checked)}/>
      Include relative source labels in ledger report</label>
    <label>Copyable batch ledger report<textarea aria-label="Search batch ledger report" readOnly rows={10} value={report}/></label>
    <p>Reports exclude native paths, source text, query and filename filters. Relative source labels may contain
      private information when explicitly included.</p>
  </div>;
}

export function ProjectSearchLedgerPanel({ listed, query, options, scope, current, busy, onScopeChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [ledger, setLedger] = useState<SearchBatchLedger | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const inventory = useMemo(() => buildProjectScopeInventory(listed), [listed]);
  const candidate = useMemo(() => current ? captureSearchObservation(query, options, current) : null,
    [query, options.caseSensitive, options.wholeWord, current]);
  const context = ledger ? checkSearchLedgerContext(ledger, inventory, query, options, scope) : null;
  const summary = useMemo(() => ledger ? summarizeSearchBatchLedger(ledger) : null, [ledger]);
  const batch = candidate?.ok ? candidate.value.batch : undefined;
  const alreadyRecorded = ledger?.records.some(record => record.index === batch?.index) ?? false;
  const canRecord = !!batch && !!candidate?.ok && (!ledger || !!context?.ok) && !busy;

  function record() {
    if (!canRecord || !candidate?.ok) return;
    const result = ledger
      ? recordSearchLedgerBatch(ledger, inventory, candidate.value, alreadyRecorded)
      : createSearchBatchLedger(inventory, candidate.value);
    if (!result.ok) { setError(result.error); return; }
    setLedger(result.value);
    setConfirmClear(false);
    setError('');
    setNotice('Recorded independent observation for batch ' + candidate.value.batch!.index + '.');
  }
  function selectBatch(index: number) {
    if (!ledger || !context?.ok || busy || !ledger.batches.some(item => item.index === index)) return;
    onScopeChange({ ...scope, batch: index });
    setNotice('Selected batch ' + index + '. Run Search Project explicitly to obtain a new observation.');
    setError('');
  }
  function removeBatch(index: number) {
    if (!ledger || busy) return;
    const result = removeSearchLedgerBatch(ledger, index);
    if (!result.ok) { setError(result.error); return; }
    setLedger(result.value);
    setNotice('Removed recorded observation for batch ' + index + '.');
    setError('');
  }
  return <section className="project-scope-coverage" aria-label="Project search batch ledger">
    <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
      {expanded ? 'Hide search batch ledger' : 'Track search batch coverage'}
    </button>
    {expanded && <>
      <p>Start from a completed numbered batch. Track the same query, filters and eligible relative labels
        across separate searches. Recording never reads a source or changes a file.</p>
      <p>The ledger remains in memory while the search workbench is open for this workspace.
        It does not combine match counts or retain source snapshots.</p>
      <button type="button" disabled={!canRecord} onClick={record}>{!ledger
        ? 'Start ledger from current batch' : alreadyRecorded
          ? 'Replace recorded batch with current observation' : 'Record current batch observation'}</button>
      {!batch && <p>Choose a numbered batch and run Search Project before recording.</p>}
      {candidate && !candidate.ok && <p role="alert">{candidate.error}</p>}
      {context && !context.ok && <p role="alert">{context.error}</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {ledger && summary && <>
        <SearchLedgerDetails summary={summary} canNavigate={!!context?.ok} busy={busy}
          onSelectBatch={selectBatch} onRemoveBatch={removeBatch}/>
        <button type="button" disabled={busy || confirmClear} onClick={() => setConfirmClear(true)}>Clear search batch ledger</button>
        {confirmClear && <div role="group" aria-label="Confirm clearing search batch ledger">
          <p>Remove all recorded batch observations and the saved label plan? Source files and search results are unaffected.</p>
          <button type="button" disabled={busy} onClick={() => {
            setLedger(null); setConfirmClear(false); setError(''); setNotice('Search batch ledger cleared.');
          }}>Confirm clear ledger</button>
          <button type="button" onClick={() => setConfirmClear(false)}>Cancel clear ledger</button>
        </div>}
      </>}
    </>}
  </section>;
}
