import { useMemo, useState } from 'react';
import type { StudioDocument } from '../model/documents';
import type { InsightNavigation } from './SourceInsightsPanel';
import { analyzeSourceQuality, DEFAULT_QUALITY_FILTER, filterQualityFindings, planQualityCleanup,
  qualityReportText, QUALITY_LABELS, QUALITY_RULES, type QualityCleanupPlan, type QualityFinding,
  type QualityFilter, type QualityScope } from '../model/sourceQuality';

const PAGE_SIZE = 20;
interface Props {
  documents: readonly StudioDocument[];
  activeId: string | null;
  busy: boolean;
  undoAvailable: boolean;
  onNavigate: (target: InsightNavigation) => void;
  onApply: (plan: QualityCleanupPlan) => boolean;
  onUndo: () => void;
}
export function SourceQualityPanel({ documents, activeId, busy, undoAvailable, onNavigate, onApply, onUndo }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [scope, setScope] = useState<QualityScope>('active');
  const [filter, setFilter] = useState<QualityFilter>(DEFAULT_QUALITY_FILTER);
  const [selection, setSelection] = useState<readonly string[]>([]);
  const [page, setPage] = useState(1);
  const [plan, setPlan] = useState<QualityCleanupPlan | null>(null);
  const [notice, setNotice] = useState('');
  const [showReport, setShowReport] = useState(false);
  // A captured document-array identity prevents selections from silently
  // targeting another revision of the same offset after a source edit.
  const [selectionSource, setSelectionSource] = useState<{ documents: readonly StudioDocument[]; activeId: string | null } | null>(null);
  const report = useMemo(() => expanded ? analyzeSourceQuality(documents, activeId, scope) : null,
    [expanded, documents, activeId, scope]);
  const visible = useMemo(() => report ? filterQualityFindings(report.findings, filter) : [], [report, filter]);
  const selectionCurrent = selectionSource?.documents === documents && (scope === 'open' || selectionSource.activeId === activeId);
  const selected = selectionCurrent ? selection : [];
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageFindings = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const stale = !!plan && (!selectionCurrent || (scope === 'active' && plan.activeId !== activeId));
  const canSelect = !!report?.complete && !busy;
  function clear() {
    setSelection([]); setSelectionSource(null); setPlan(null); setNotice('');
  }
  function updateSelection(ids: readonly string[]) {
    setSelectionSource({ documents, activeId }); setSelection(ids); setPlan(null); setNotice('');
  }
  function updateFilter(next: Partial<QualityFilter>) {
    setFilter(old => ({ ...old, ...next })); setPage(1); setPlan(null); setNotice('');
  }
  function navigate(finding: QualityFinding) {
    const doc = documents.find(item => item.id === finding.documentId && item.revision === finding.revision);
    if (doc) onNavigate({ documentId: doc.id, revision: doc.revision, source: doc.content,
      line: finding.line, column: finding.column });
  }
  function preview() {
    if (!report) return;
    const result = planQualityCleanup(report, selected);
    setPlan(result.ok ? result.value : null);
    setNotice(result.ok ? '' : result.error);
  }
  function confirm() {
    if (!plan || stale || !onApply(plan)) {
      setPlan(null); setNotice('Cleanup could not be applied. Review the current buffer again.'); return;
    }
    clear();
    setNotice('Cleanup applied to editor buffers. Review, undo or save manually.');
  }
  return <section className="sidebar-section quality-panel" aria-label="Source quality workbench">
    <div className="sidebar-heading">SOURCE QUALITY</div>
    <button type="button" className="insights-toggle" aria-expanded={expanded} aria-controls="quality-workbench-body"
      onClick={() => { setExpanded(value => !value); clear(); }}>
      <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
      <span>{expanded ? 'Hide source quality' : 'Inspect source quality'}</span>
    </button>
    <div id="quality-workbench-body" hidden={!expanded}>
      {expanded && report && <div className="insights-body">
        <p className="insights-disclaimer">Editor-only observations, not Scarp compiler diagnostics. Only open buffers are analyzed.</p>
        <label>Scope
          <select aria-label="Source quality scope" value={scope} onChange={event => {
            const value = event.target.value;
            if (value === 'active' || value === 'open') { setScope(value); setPage(1); clear(); }
          }}>
            <option value="active">Current buffer</option>
            <option value="open">All open buffers</option>
          </select>
        </label>
        <dl className="insights-metrics">
          <div><dt>Buffers</dt><dd>{report.files.length}</dd></div>
          <div><dt>Review</dt><dd>{report.findings.filter(item => item.severity === 'review').length}</dd></div>
          <div><dt>Style</dt><dd>{report.findings.filter(item => item.severity === 'style').length}</dd></div>
          <div><dt>Cleanup candidates</dt><dd>{report.complete ? report.findings.filter(item => item.edit).length : 0}</dd></div>
        </dl>
        {!report.complete && <p role="status">Coverage limited. Cleanup disabled. {report.omittedDocuments} omitted buffer(s).</p>}
        {report.files.filter(file => !file.complete).map(file => <p className="sidebar-note" key={file.document.id}>{file.document.name}: {file.reason}</p>)}
        <div className="insights-filter">
          <input type="search" aria-label="Search quality findings" placeholder="Find observations…" value={filter.query}
            maxLength={120} onChange={event => updateFilter({ query: event.target.value })} />
          <select aria-label="Quality finding rule" value={filter.rule} onChange={event => {
            const value = event.target.value as QualityFilter['rule'];
            if (value === 'all' || QUALITY_RULES.includes(value)) updateFilter({ rule: value });
          }}>
            <option value="all">All rules</option>
            {QUALITY_RULES.map(rule => <option key={rule} value={rule}>{QUALITY_LABELS[rule]}</option>)}
          </select>
          <select aria-label="Quality finding severity" value={filter.severity} onChange={event => {
            const value = event.target.value;
            if (value === 'all' || value === 'review' || value === 'style') updateFilter({ severity: value });
          }}>
            <option value="all">All observations</option>
            <option value="review">Needs review</option>
            <option value="style">Style</option>
          </select>
          <label><input type="checkbox" checked={filter.fixableOnly} onChange={event => updateFilter({ fixableOnly: event.target.checked })} /> Cleanup candidates only</label>
        </div>
        <p role="status">{visible.length} matching · {selected.length} selected</p>
        <div className="quality-actions">
          <button type="button" disabled={!canSelect || !visible.some(item => item.edit)} onClick={() =>
            updateSelection([...new Set([...selected, ...visible.filter(item => item.edit).map(item => item.id)])])}>Select matching cleanup</button>
          <button type="button" disabled={!selected.length} onClick={() => updateSelection([])}>Clear selection</button>
        </div>
        <div className="quality-findings">
          {pageFindings.map(finding => <div className="quality-finding" key={finding.id}>
            <input type="checkbox" aria-label={'Select ' + QUALITY_LABELS[finding.rule] + ' at ' + finding.documentName + ':' + finding.line + ':' + finding.column}
              disabled={!canSelect || !finding.edit} checked={selected.includes(finding.id)} onChange={event =>
                updateSelection(event.target.checked ? [...selected, finding.id] : selected.filter(id => id !== finding.id))} />
            <button type="button" className="insights-task" disabled={busy} onClick={() => navigate(finding)}>
              <strong>{QUALITY_LABELS[finding.rule]}</strong>
              <span className="outline-line">{finding.documentName}:{finding.line}:{finding.column}</span>
              <span className="insights-task-description">{finding.message}</span>
            </button>
          </div>)}
          {!visible.length && <p className="sidebar-note">No matching observations within this analysis scope.</p>}
        </div>
        {pageCount > 1 && <div className="insights-pages">
          <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
          <span>Page {currentPage} / {pageCount}</span>
          <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button>
        </div>}
        <button type="button" disabled={!canSelect || !selected.length} onClick={preview}>Review selected cleanup</button>
        {plan && <div className="transfer-review" role="group" aria-label="Confirm source quality cleanup">
          <strong>{plan.selectedIds.length} cleanup finding(s) across {plan.changes.length} buffer(s)</strong>
          <ul>{plan.changes.map(change => <li key={change.id}>{change.snapshot.name}: {change.findingCount} change(s)</li>)}</ul>
          <p>Only selected trailing spaces/tabs and final newlines may change. No disk write. Auto Save holds these exact snapshots until manual save or further edits.</p>
          {stale && <p role="alert">Buffers changed. Review cleanup again.</p>}
          <button type="button" disabled={busy || stale} onClick={confirm}>Confirm cleanup</button>
          <button type="button" onClick={() => { setPlan(null); setNotice(''); }}>Cancel cleanup review</button>
        </div>}
        <button type="button" disabled={busy || !undoAvailable} onClick={onUndo}>Undo last quality cleanup</button>
        <button type="button" aria-expanded={showReport} onClick={() => setShowReport(value => !value)}>{showReport ? 'Hide quality report' : 'Show copyable quality report'}</button>
        {showReport && <label>Local report (contains document names)
          <textarea aria-label="Source quality report" readOnly rows={8} value={qualityReportText(report, visible)} />
        </label>}
        {notice && <p role="status">{notice}</p>}
      </div>}
    </div>
  </section>;
}
