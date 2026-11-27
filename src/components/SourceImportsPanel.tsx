import { useMemo, useState } from 'react';
import type { StudioDocument } from '../model/documents';
import { ImportDependencyPanel } from './ImportDependencyPanel';
import {
  buildScarpImportGraph, listedImportNavigationTarget, currentImportNavigationTarget,
  type ListedImportSource, type ImportStatus,
} from '../model/sourceImports';

interface Props {
  documents: readonly StudioDocument[];
  listed: readonly ListedImportSource[];
  activeId: string | null;
  busy: boolean;
  onOpen: (path: string) => void;
  initiallyExpanded?: boolean;
}
const statuses: readonly (ImportStatus | 'all')[] = [
  'all','open','listed','missing','unsafe','unrecognized','self','ambiguous',
];
const PAGE_SIZE = 24;

export function SourceImportsPanel({
  documents, listed, activeId, busy, onOpen, initiallyExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [status, setStatus] = useState<ImportStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const graph = useMemo(() => expanded
    ? buildScarpImportGraph(documents, listed) : null,
  [expanded, documents, listed]);
  const node = graph?.nodes.find(item => item.documentId === activeId) ?? null;
  const filtered = (node?.imports ?? []).filter(edge =>
    (status === 'all' || edge.status === status) &&
    (!query.trim() || (edge.specifier + ' ' + edge.alias + ' ' +
      edge.status).toLowerCase().includes(query.trim().toLowerCase())));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const displayedPage = Math.min(page, pages);
  const shown = filtered.slice((displayedPage - 1) * PAGE_SIZE,
    displayedPage * PAGE_SIZE);
  const relatedCycles = (graph?.cycles ?? []).filter(cycle =>
    activeId && cycle.includes(activeId));

  return <section className="sidebar-section imports-panel"
    aria-label="Scarp source imports">
    <div className="sidebar-heading">IMPORTS</div>
    <button type="button" className="insights-toggle"
      aria-expanded={expanded} aria-controls="scarp-source-imports-body"
      onClick={() => setExpanded(v => !v)}>
      <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
      <span>{expanded ? 'Hide imports' : 'Inspect listed imports'}</span>
    </button>
    <div id="scarp-source-imports-body" hidden={!expanded}>
      {graph && <div className="imports-content">
        <p className="insights-disclaimer">
          In-memory, editor-only navigation. Only current Explorer-listed
          sources can be opened. Not compiler module resolution.
        </p>
        <ImportDependencyPanel graph={graph} activeId={activeId} />
        {graph.limited && <p role="status" className="sidebar-note">
          Import graph is limited; some links or cycles may be omitted.
        </p>}
        {!node && <p className="sidebar-note">
          Open a source from the selected Scarp Explorer listing to inspect its imports.
        </p>}
        {node && <>
          <div className="imports-summary">
            <span>{node.imports.length} imports</span>
            <span>{node.imports.filter(edge => edge.status === 'open' || edge.status === 'listed').length} listed targets</span>
          </div>
          {relatedCycles.length > 0 && <p className="sidebar-note" role="status">
            Possible import cycle among open buffers. Confirm with the official compiler.
          </p>}
          <div className="imports-controls">
            <input type="search" value={query}
              aria-label="Filter Scarp imports" placeholder="Filter imports…"
              maxLength={120} onChange={event => { setQuery(event.target.value); setPage(1); }}/>
            <select aria-label="Filter import status" value={status}
              onChange={event => {
                const selected = event.target.value;
                if (statuses.includes(selected as ImportStatus | 'all')) {
                  setStatus(selected as ImportStatus | 'all'); setPage(1);
                }
              }}>
              {statuses.map(value => <option key={value} value={value}>
                {value === 'all' ? 'All statuses' : value}
              </option>)}
            </select>
          </div>
          <p className="insights-task-count">{filtered.length} matching imports</p>
          <div className="imports-list">
            {shown.map(edge => {
              const target = listedImportNavigationTarget(edge, listed);
              return <div className="imports-row" key={edge.id}>
                <div className="imports-row-main">
                  <span className="imports-path" title={edge.specifier}>{edge.specifier}</span>
                  <span className={'imports-status imports-status-' + edge.status}>{edge.status}</span>
                </div>
                {edge.alias && <span className="imports-alias">as {edge.alias} · line {edge.line}</span>}
                {edge.note && <span className="imports-note">{edge.note}</span>}
                {target && <button type="button" disabled={busy}
                  onClick={() => {
                    const currentTarget = currentImportNavigationTarget(edge, documents, listed);
                    if (!busy && currentTarget) onOpen(currentTarget);
                  }} title={'Open already-listed Scarp source ' + edge.targetRelativeName}>
                  Open Source
                </button>}
              </div>;
            })}
            {!filtered.length && <p className="sidebar-note">
              {node.imports.length ? 'No imports match the filters.' : 'No indexed literal Scarp imports in this source.'}
            </p>}
          </div>
          {pages > 1 && <div className="insights-pages">
            <button type="button" disabled={displayedPage === 1}
              onClick={() => setPage(p => Math.max(1,p-1))}>Previous</button>
            <span>Page {displayedPage} / {pages}</span>
            <button type="button" disabled={displayedPage === pages}
              onClick={() => setPage(p => Math.min(pages,p+1))}>Next</button>
          </div>}
        </>}
      </div>}
    </div>
  </section>;
}
