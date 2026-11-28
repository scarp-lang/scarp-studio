import { useMemo, useState } from 'react';
import type { ManifestLedger, ManifestLedgerRow } from '../model/manifestBatchLedger';
import {
  compareLedgerObservations, filterLedgerComparison, ledgerComparisonText,
  DEFAULT_LEDGER_COMPARISON_FILTER, LEDGER_COMPARISON_STATES, LEDGER_COMPARISON_LABELS,
  type LedgerComparisonFilter, type LedgerComparisonState,
} from '../model/manifestLedgerComparison';
import { pageManifest, MANIFEST_STATE_LABELS } from '../model/projectSourceManifest';
import { INSPECTION_ORIGIN_LABELS } from '../model/projectInspection';

interface Props {
  ledger: ManifestLedger;
  baseline: ManifestLedger | null;
  busy: boolean;
  onCapture: () => void;
  onClear: () => void;
}

function Observation({ row, reveal }: { row: ManifestLedgerRow; reveal: boolean }) {
  return <div>
    <span>{row.sequence === null ? 'No receipt' : 'Receipt ' + row.sequence}</span>
    {' · '}{row.file ? MANIFEST_STATE_LABELS[row.file.state] : 'Not observed'}
    {row.file && <>
      {' · '}{INSPECTION_ORIGIN_LABELS[row.file.origin]}
      {row.file.bytes !== null && <> · {row.file.bytes} bytes</>}
    </>}
    {reveal && row.file?.digest && <code className="manifest-digest">{row.file.digest}</code>}
  </div>;
}

function signed(delta: number): string {
  return delta > 0 ? '+' + delta : String(delta);
}

export function ManifestLedgerComparisonPanel({ ledger, baseline, busy, onCapture, onClear }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [review, setReview] = useState<'replace' | 'clear' | null>(null);
  const [reviewedLedger, setReviewedLedger] = useState<ManifestLedger | null>(null);
  const [filter, setFilter] = useState(DEFAULT_LEDGER_COMPARISON_FILTER);
  const [page, setPage] = useState(1);
  const [reveal, setReveal] = useState(false);
  const [report, setReport] = useState(false);
  const [reportLabels, setReportLabels] = useState(false);
  const [reportDigests, setReportDigests] = useState(false);
  const comparison = useMemo(() => baseline ? compareLedgerObservations(baseline, ledger) : null, [baseline, ledger]);
  const rows = useMemo(() => comparison?.ok ? filterLedgerComparison(comparison.value, filter) : [], [comparison, filter]);
  const visible = pageManifest(rows, page);
  const output = useMemo(() => report && comparison?.ok ?
    ledgerComparisonText(comparison.value, reportLabels, reportDigests) : '',
    [comparison, report, reportLabels, reportDigests]);

  function resetPresentation() {
    setReview(null);
    setReviewedLedger(null);
    setFilter(DEFAULT_LEDGER_COMPARISON_FILTER);
    setPage(1);
    setReveal(false);
    setReport(false);
    setReportLabels(false);
    setReportDigests(false);
  }

  function patchFilter(patch: Partial<LedgerComparisonFilter>) {
    setFilter(old => ({ ...old, ...patch }));
    setPage(1);
  }

  function beginCapture() {
    if (busy || !ledger.receipts.length) return;
    if (baseline) {
      setReview('replace');
      setReviewedLedger(ledger);
    } else {
      onCapture();
      resetPresentation();
    }
  }

  function confirm() {
    if (busy || reviewedLedger !== ledger) return;
    if (review === 'replace') onCapture();
    if (review === 'clear') onClear();
    resetPresentation();
  }

  return <section aria-label="Sequential ledger comparison">
    <button type="button" aria-expanded={expanded} onClick={() => {
      resetPresentation();
      setExpanded(!expanded);
    }}>{expanded ? 'Hide' : 'Review'} ledger observation comparison</button>
    {expanded && <>
      <p>Capture a session-only baseline of existing receipt metadata, then re-observe selected batches.
        Comparison reads no files. Unreplaced receipts are not new evidence.</p>
      <button type="button" disabled={busy || !ledger.receipts.length} onClick={beginCapture}>
        {baseline ? 'Review replacement comparison baseline' : 'Capture ledger comparison baseline'}
      </button>
      {baseline && <button type="button" disabled={busy} onClick={() => {
        setReview('clear');
        setReviewedLedger(ledger);
      }}>Review clearing comparison baseline</button>}
      {review && <section aria-label="Review ledger comparison baseline action">
        <p>{review === 'replace' ? 'Replace the earlier receipt baseline with the current observations?' :
          'Clear the comparison baseline? The active ledger is retained.'}</p>
        {reviewedLedger !== ledger && <p role="alert">Receipts changed during review. Cancel and review again.</p>}
        <button type="button" disabled={busy || reviewedLedger !== ledger} onClick={confirm}>Confirm comparison baseline action</button>
        <button type="button" onClick={() => { setReview(null); setReviewedLedger(null); }}>Cancel comparison baseline action</button>
      </section>}
      {!baseline && <p>No comparison baseline captured.</p>}
      {comparison && !comparison.ok && <p role="alert">{comparison.error}</p>}
      {comparison?.ok && <>
        <p>Baseline receipt {comparison.value.baselineSequence} · current receipt {comparison.value.currentSequence}.
          These are sequential observations, not simultaneous project snapshots.</p>
        <dl className="project-scope-stats">
          <div><dt>Refreshed batches</dt><dd>{comparison.value.refreshedBatches}</dd></div>
          <div><dt>Comparable refreshed labels</dt><dd>{comparison.value.comparableRows}</dd></div>
          {LEDGER_COMPARISON_STATES.map(state => <div key={state}>
            <dt>{LEDGER_COMPARISON_LABELS[state]}</dt><dd>{comparison.value.counts[state]}</dd>
          </div>)}
        </dl>
        <label>Filter comparison labels<input aria-label="Ledger comparison label filter" type="search"
          maxLength={120} value={filter.query} onChange={event => patchFilter({ query: event.target.value })}/></label>
        <label>Comparison evidence<select aria-label="Ledger comparison state" value={filter.state} onChange={event => {
          const state = event.target.value as LedgerComparisonState | 'all';
          if (state === 'all' || LEDGER_COMPARISON_STATES.includes(state)) patchFilter({ state });
        }}>
          <option value="all">All comparisons</option>
          {LEDGER_COMPARISON_STATES.map(state => <option key={state} value={state}>{LEDGER_COMPARISON_LABELS[state]}</option>)}
        </select></label>
        <label>Comparison batch<select aria-label="Ledger comparison batch" value={filter.batch ?? ''}
          onChange={event => patchFilter({ batch: event.target.value ? Number(event.target.value) : null })}>
          <option value="">All batches</option>
          {ledger.plan.batches.map(batch => <option key={batch.index} value={batch.index}>Batch {batch.index}</option>)}
        </select></label>
        <label><input type="checkbox" checked={reveal} onChange={event => setReveal(event.target.checked)}/>Reveal comparison digests locally</label>
        <button type="button" onClick={() => { setFilter(DEFAULT_LEDGER_COMPARISON_FILTER); setPage(1); }}>Reset comparison filters</button>
        <p>{rows.length} matching labels · Page {visible.page} of {visible.pages}</p>
        {!rows.length && <p>No matching comparison evidence.</p>}
        <div className="project-scope-inventory"><ul>{visible.rows.map(row => <li key={row.label}>
          <strong><code dir="auto">{row.label}</code></strong>
          <p>Batch {row.batch} · {LEDGER_COMPARISON_LABELS[row.state]}</p>
          <div>Earlier: <Observation row={row.previous} reveal={reveal}/></div>
          <div>Current: <Observation row={row.current} reveal={reveal}/></div>
          {row.byteDelta !== null && <p>Byte delta: {signed(row.byteDelta)}
            {row.lineDelta !== null && <> · Editor line delta: {signed(row.lineDelta)}</>}</p>}
        </li>)}</ul></div>
        <button type="button" disabled={visible.page === 1} onClick={() => setPage(visible.page - 1)}>Previous comparison page</button>
        <button type="button" disabled={visible.page === visible.pages} onClick={() => setPage(visible.page + 1)}>Next comparison page</button>
        <button type="button" aria-expanded={report} onClick={() => {
          setReport(!report); setReportLabels(false); setReportDigests(false);
        }}>{report ? 'Hide' : 'Review'} ledger comparison report</button>
        {report && <>
          <label><input type="checkbox" checked={reportLabels} onChange={event => setReportLabels(event.target.checked)}/>Include relative comparison labels</label>
          <label><input type="checkbox" checked={reportDigests} onChange={event => setReportDigests(event.target.checked)}/>Include comparison digest strings</label>
          <textarea aria-label="Ledger comparison report" readOnly rows={10} value={output}/>
        </>}
      </>}
    </>}
  </section>;
}
