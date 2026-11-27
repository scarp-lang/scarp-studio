import { useMemo, useState } from 'react';
import type { StudioDocument } from '../model/documents';
import type { InsightNavigation } from './SourceInsightsPanel';
import { buildWorkspaceSymbolIndex, searchWorkspaceSymbols, repeatedWorkspaceSymbolNames, workspaceCallCandidates,
  currentSymbolLocation, workspaceSymbolReport, DEFAULT_SYMBOL_FILTER, SYMBOL_KINDS, SYMBOL_KIND_LABELS,
  SYMBOL_COVERAGE_LABELS, CALL_STATUS_LABELS, MAX_SYMBOL_QUERY, type SymbolLocation, type SymbolFilter,
  type SymbolOrder, type SymbolSearchScope, type WorkspaceSymbol, type CallCandidateStatus } from '../model/workspaceSymbols';

const PAGE = 20;
type View = 'declarations' | 'repeated' | 'calls';
const CALL_STATUSES = Object.keys(CALL_STATUS_LABELS) as CallCandidateStatus[];
interface Props {
  documents: readonly StudioDocument[];
  activeId: string | null;
  busy: boolean;
  onNavigate: (location: InsightNavigation) => void;
  initiallyExpanded?: boolean;
}
export function WorkspaceSymbolsPanel({ documents, activeId, busy, onNavigate, initiallyExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [scope, setScope] = useState<SymbolSearchScope>('open');
  const [view, setView] = useState<View>('declarations');
  const [filter, setFilter] = useState<SymbolFilter>(DEFAULT_SYMBOL_FILTER);
  const [order, setOrder] = useState<SymbolOrder>('source');
  const [page, setPage] = useState(1);
  const [callStatus, setCallStatus] = useState<CallCandidateStatus | 'all'>('all');
  const [detail, setDetail] = useState<{ name: string; view: View } | null>(null);
  const [detailPage, setDetailPage] = useState(1);
  const [reportOpen, setReportOpen] = useState(false);
  const index = useMemo(() => expanded ? buildWorkspaceSymbolIndex(documents, activeId, scope) : null,
    [expanded, documents, activeId, scope]);
  const symbols = useMemo(() => index ? searchWorkspaceSymbols(index, filter, order) : [], [index, filter, order]);
  const groups = useMemo(() => index && view === 'repeated' ? repeatedWorkspaceSymbolNames(index) : [], [index, view]);
  const calls = useMemo(() => index && view === 'calls' ? workspaceCallCandidates(index) : [], [index, view]);
  const query = filter.query.trim().toLowerCase();
  const filteredGroups = groups.filter(group => group.name.toLowerCase().includes(query) ||
    group.symbols.some(symbol => symbol.documentName.toLowerCase().includes(query)));
  const filteredCalls = calls.filter(group => (callStatus === 'all' || group.status === callStatus) &&
    (group.name.toLowerCase().includes(query) || group.calls.some(call => call.documentName.toLowerCase().includes(query))));
  const count = view === 'declarations' ? symbols.length : view === 'repeated' ? filteredGroups.length : filteredCalls.length;
  const pages = Math.max(1, Math.ceil(count / PAGE));
  const current = Math.min(page, pages);
  const start = (current - 1) * PAGE;
  const selectedRepeated = detail?.view === 'repeated' ? filteredGroups.find(group => group.name === detail.name) : undefined;
  const selectedCall = detail?.view === 'calls' ? filteredCalls.find(group => group.name === detail.name) : undefined;
  const selectedSites = selectedRepeated?.symbols ?? selectedCall?.calls ?? [];
  const sitePages = Math.max(1, Math.ceil(selectedSites.length / PAGE));
  const sitePage = Math.min(detailPage, sitePages);
  function resetNavigation() { setPage(1); setDetail(null); setDetailPage(1); }
  function updateFilter(value: Partial<SymbolFilter>) { setFilter(previous => ({ ...previous, ...value })); resetNavigation(); }
  function navigate(item: SymbolLocation) {
    if (!index || busy) return;
    const target = currentSymbolLocation(index, item, documents);
    if (target) onNavigate(target);
  }
  function symbolRow(item: WorkspaceSymbol) {
    return <button key={item.id} type="button" className="symbol-entry insights-task" disabled={busy}
      onClick={() => navigate(item)} title={'Go to ' + item.name + ' in the current buffer'}>
      <span className="symbol-title"><strong>{item.name}</strong><small>{SYMBOL_KIND_LABELS[item.kind]}</small></span>
      <span className="outline-line">{item.documentName}:{item.line}:{item.column}</span>
      <span className="insights-task-description">{item.scope}{item.visibility === 'public' ? ' · pub' : ''}{item.pure ? ' · pure' : ''}</span>
      {item.header && <code>{item.header}</code>}
    </button>;
  }
  function openDetails(name: string) { setDetail({ name, view }); setDetailPage(1); }
  return <section className="sidebar-section workspace-symbols" aria-label="Workspace symbol explorer">
    <div className="sidebar-heading">WORKSPACE SYMBOLS</div>
    <button type="button" className="insights-toggle" aria-expanded={expanded} aria-controls="workspace-symbol-body"
      onClick={() => { setExpanded(value => !value); resetNavigation(); }}>
      <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
      <span>{expanded ? 'Hide workspace symbols' : 'Explore workspace symbols'}</span>
    </button>
    <div id="workspace-symbol-body" hidden={!expanded}>
      {expanded && index && <div className="insights-body">
        <p className="insights-disclaimer">Lexical inventory of open Scarp buffers. Not compiler symbol resolution, unused-code analysis or semantic rename.</p>
        <label>Scope<select aria-label="Workspace symbol scope" value={scope} onChange={event => {
          const next = event.target.value;
          if (next === 'active' || next === 'open') { setScope(next); resetNavigation(); }
        }}>
          <option value="open">All open buffers</option><option value="active">Current buffer</option>
        </select></label>
        <dl className="insights-metrics">
          <div><dt>Buffers</dt><dd>{index.files.length}/{index.selectedDocuments}</dd></div>
          <div><dt>Declarations</dt><dd>{index.symbols.length}</dd></div>
          <div><dt>Call-like sites</dt><dd>{index.calls.length}</dd></div>
        </dl>
        {!index.complete && <div role="status">
          <p>Limited inventory; {index.omittedDocuments} omitted buffer(s). Missing names do not imply missing declarations.</p>
          <ul>{index.files.filter(file => !file.complete).map(file => <li key={file.document.id}>
            {file.document.name}: {file.reasons.map(reason => SYMBOL_COVERAGE_LABELS[reason]).join(', ')}
          </li>)}</ul>
        </div>}
        <div className="symbol-view-buttons" role="group" aria-label="Symbol inventory view">
          {(['declarations', 'repeated', 'calls'] as const).map(mode => <button key={mode} type="button"
            aria-pressed={view === mode} onClick={() => { setView(mode); resetNavigation(); }}>
            {mode === 'declarations' ? 'Declarations' : mode === 'repeated' ? 'Repeated names' : 'Call sites'}
          </button>)}
        </div>
        <input type="search" aria-label="Search workspace symbols" maxLength={MAX_SYMBOL_QUERY}
          placeholder="Name or file…" value={filter.query} onChange={event => updateFilter({ query: event.target.value })} />
        {view === 'declarations' && <div className="insights-filter">
          <select aria-label="Workspace symbol kind" value={filter.kind} onChange={event => {
            const next = event.target.value as SymbolFilter['kind'];
            if (next === 'all' || SYMBOL_KINDS.includes(next)) updateFilter({ kind: next });
          }}>
            <option value="all">All declaration kinds</option>
            {SYMBOL_KINDS.map(kind => <option key={kind} value={kind}>{SYMBOL_KIND_LABELS[kind]}</option>)}
          </select>
          <select aria-label="Declaration nesting" value={filter.scope} onChange={event => {
            const next = event.target.value;
            if (next === 'all' || next === 'top-level' || next === 'nested') updateFilter({ scope: next });
          }}><option value="all">All scopes</option><option value="top-level">Top level</option><option value="nested">Nested</option></select>
          <select aria-label="Order workspace symbols" value={order} onChange={event => {
            const next = event.target.value;
            if (next === 'source' || next === 'name' || next === 'kind') { setOrder(next); resetNavigation(); }
          }}><option value="source">Source order</option><option value="name">Name order</option><option value="kind">Kind order</option></select>
          <label><input type="checkbox" checked={filter.publicOnly} onChange={event => updateFilter({ publicOnly: event.target.checked })}/> Public modifier only</label>
          <label><input type="checkbox" checked={filter.pureOnly} onChange={event => updateFilter({ pureOnly: event.target.checked })}/> Pure function modifier only</label>
        </div>}
        {view === 'repeated' && <p className="insights-disclaimer">Repeated spellings can be valid in different modules or nested scopes. This is not a duplicate-name error.</p>}
        {view === 'calls' && <>
          <p className="insights-disclaimer">Unqualified call-like identifiers grouped by spelling. Matching function names are candidates only; module and parameter scope are not resolved.</p>
          <select aria-label="Call candidate status" value={callStatus} onChange={event => {
            const next = event.target.value as CallCandidateStatus | 'all';
            if (next === 'all' || CALL_STATUSES.includes(next)) { setCallStatus(next); resetNavigation(); }
          }}><option value="all">All candidate statuses</option>
            {CALL_STATUSES.map(status => <option key={status} value={status}>{CALL_STATUS_LABELS[status]}</option>)}
          </select>
        </>}
        <p role="status">{count} matching {view === 'declarations' ? 'declaration(s)' : 'name group(s)'}</p>
        <div className="symbol-list">
          {view === 'declarations' && symbols.slice(start, start + PAGE).map(symbolRow)}
          {view === 'repeated' && filteredGroups.slice(start, start + PAGE).map(group =>
            <button key={group.name} type="button" className="insights-task" aria-pressed={selectedRepeated?.name === group.name}
              onClick={() => openDetails(group.name)}>
              <strong>{group.name}</strong><span>{group.symbols.length} declaration-like sites · {group.callCount} call-like sites</span>
            </button>)}
          {view === 'calls' && filteredCalls.slice(start, start + PAGE).map(group =>
            <button key={group.name} type="button" className="insights-task" aria-pressed={selectedCall?.name === group.name}
              onClick={() => openDetails(group.name)}>
              <strong>{group.name}</strong><span>{group.calls.length} call-like sites · {CALL_STATUS_LABELS[group.status]}</span>
            </button>)}
          {!count && <p className="sidebar-note">No matching items in this inventory.</p>}
        </div>
        {pages > 1 && <div className="insights-pages">
          <button type="button" disabled={current === 1} onClick={() => { setPage(current - 1); setDetail(null); }}>Previous</button>
          <span>Page {current}/{pages}</span>
          <button type="button" disabled={current === pages} onClick={() => { setPage(current + 1); setDetail(null); }}>Next</button>
        </div>}
        {(selectedRepeated || selectedCall) && <section className="symbol-detail" aria-label="Selected symbol name details">
          <strong>{selectedRepeated?.name ?? selectedCall?.name}</strong>
          <button type="button" onClick={() => setDetail(null)}>Close details</button>
          {selectedRepeated && selectedRepeated.symbols.slice((sitePage - 1) * PAGE, sitePage * PAGE).map(symbolRow)}
          {selectedCall && <>
            {selectedCall.calls.slice((sitePage - 1) * PAGE, sitePage * PAGE).map(call =>
              <button key={call.id} type="button" className="insights-task" disabled={busy} onClick={() => navigate(call)}>
                <strong>{call.documentName}:{call.line}:{call.column}</strong>
                <small>{index.symbols.find(symbol => symbol.id === call.enclosingSymbolId)?.name ?? 'Outside indexed function body'}</small>
              </button>)}
            <p>{selectedCall.declarations.length} observed declaration candidate(s). Inspect the Declarations view to navigate to them.</p>
          </>}
          {sitePages > 1 && <div className="insights-pages">
            <button type="button" disabled={sitePage === 1} onClick={() => setDetailPage(sitePage - 1)}>Previous sites</button>
            <span>{sitePage}/{sitePages}</span>
            <button type="button" disabled={sitePage === sitePages} onClick={() => setDetailPage(sitePage + 1)}>Next sites</button>
          </div>}
        </section>}
        <button type="button" aria-expanded={reportOpen} onClick={() => setReportOpen(value => !value)}>
          {reportOpen ? 'Hide symbol report' : 'Show copyable symbol report'}
        </button>
        {reportOpen && <label>Filtered declarations report (contains names)
          <textarea readOnly rows={8} aria-label="Workspace symbol report" value={workspaceSymbolReport(index, symbols)} />
        </label>}
      </div>}
    </div>
  </section>;
}
