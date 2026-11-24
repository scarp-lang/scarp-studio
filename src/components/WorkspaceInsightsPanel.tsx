import { useMemo, useState } from 'react';
import type { StudioDocument } from '../model/documents';
import {
  inspectScarpWorkspace, filterWorkspaceInsightEntries,
  workspaceInsightNavigationTarget,
  type ListedWorkspaceInsightSource, type WorkspaceInsightProjectRoot,
  type WorkspaceInsightFilter,
} from '../model/workspaceInsights';

interface Props {
  documents: readonly StudioDocument[];
  listed: readonly ListedWorkspaceInsightSource[];
  roots: readonly WorkspaceInsightProjectRoot[];
  activeId: string | null;
  busy: boolean;
  onActivate: (id: string) => void;
  initiallyExpanded?: boolean;
}
const PAGE_SIZE = 16;
const scopes: readonly WorkspaceInsightFilter['scope'][] =
  ['all','modified','review','tasks'];
const orders: readonly WorkspaceInsightFilter['order'][] =
  ['active','name','warnings','tasks'];

export function WorkspaceInsightsPanel({
  documents, listed, roots, activeId, busy, onActivate,
  initiallyExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [scope, setScope] = useState<WorkspaceInsightFilter['scope']>('all');
  const [order, setOrder] = useState<WorkspaceInsightFilter['order']>('active');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const report = useMemo(() => expanded
    ? inspectScarpWorkspace(documents, listed, roots, activeId)
    : null, [expanded, documents, listed, roots, activeId]);
  const filtered = useMemo(() => !report ? [] :
    filterWorkspaceInsightEntries(report.entries, { scope, order, search }),
  [report, scope, order, search]);
  const pages = Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const currentPage = Math.min(page,pages);
  const shown = filtered.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);

  return <section className="sidebar-section workspace-insights-panel"
    aria-label="Scarp open workspace overview">
    <div className="sidebar-heading">WORKSPACE OVERVIEW</div>
    <button type="button" className="insights-toggle" aria-expanded={expanded}
      aria-controls="studio-workspace-insights-body"
      onClick={() => setExpanded(v => !v)}>
      <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
      <span>{expanded ? 'Hide overview' : 'Analyze open files'}</span>
      <span className="insights-toggle-hint">{documents.length} tabs</span>
    </button>
    <div id="studio-workspace-insights-body" hidden={!expanded}>
      {report && <div className="workspace-insights-content">
        <p className="insights-disclaimer">
          Read-only open-buffer summary. Not compiler diagnostics, a repository
          audit, or a disk-wide file inventory.
        </p>
        {!report.complete && <p className="sidebar-note" role="status">
          Workspace analysis is incomplete due to fixed safety budgets.
        </p>}
        <dl className="insights-metrics">
          <div><dt>Open tabs</dt><dd>{report.totals.openTabs}</dd></div>
          <div><dt>Analyzed</dt><dd>{report.totals.analyzedTabs}</dd></div>
          <div><dt>Modified</dt><dd>{report.totals.modifiedTabs}</dd></div>
          <div><dt>In Explorer</dt><dd>{report.totals.filesInExplorer}</dd></div>
          <div><dt>Functions</dt><dd>{report.totals.functions}</dd></div>
          <div><dt>Records</dt><dd>{report.totals.records}</dd></div>
          <div><dt>Variants</dt><dd>{report.totals.variants}</dd></div>
          <div><dt>Imports</dt><dd>{report.totals.imports}</dd></div>
          <div><dt>Comment tasks</dt><dd>{report.totals.tasks}</dd></div>
          <div><dt>Review notes</dt><dd>{report.totals.reviewWarnings}</dd></div>
        </dl>
        {report.projects.length > 0 && <div className="workspace-project-overview">
          <strong>Open sources by project</strong>
          {report.projects.map(project => <div className="workspace-project-row"
            key={project.directory}>
            <span>{project.label}</span>
            <span>{project.openFiles} tabs · {project.modifiedFiles} modified</span>
          </div>)}
        </div>}
        {report.notes.map(note =>
          <p key={note} className="sidebar-note" role="status">{note}</p>)}
        <div className="workspace-insights-filters">
          <input type="search" aria-label="Filter open workspace source summaries"
            maxLength={120} placeholder="Filter open files…" value={search}
            onChange={event => { setSearch(event.target.value); setPage(1); }}/>
          <select value={scope} aria-label="Workspace insights source scope"
            onChange={event => {
              const next = event.target.value;
              if (scopes.includes(next as WorkspaceInsightFilter['scope'])) {
                setScope(next as WorkspaceInsightFilter['scope']); setPage(1);
              }
            }}>
            <option value="all">All open files</option>
            <option value="modified">Modified</option>
            <option value="review">Review notes</option>
            <option value="tasks">Comment tasks</option>
          </select>
          <select value={order} aria-label="Workspace insights sort order"
            onChange={event => {
              const next = event.target.value;
              if (orders.includes(next as WorkspaceInsightFilter['order'])) {
                setOrder(next as WorkspaceInsightFilter['order']); setPage(1);
              }
            }}>
            <option value="active">Active first</option>
            <option value="name">Filename</option>
            <option value="warnings">Review warnings</option>
            <option value="tasks">Task count</option>
          </select>
        </div>
        <p className="insights-task-count" role="status">
          {filtered.length} matching open source summaries
        </p>
        <div className="workspace-source-overview">
          {shown.map(entry => <div key={entry.documentId}
            className={'workspace-source-row' + (entry.active ? ' selected' : '')}>
            <button type="button"
              disabled={busy || workspaceInsightNavigationTarget(entry,documents) === null}
              onClick={() => {
                const id = workspaceInsightNavigationTarget(entry,documents);
                if (id && !busy) onActivate(id);
              }} title="Activate this already-open Scarp source tab">
              <span>{entry.relativeName ?? entry.documentName}</span>
              <span>{entry.modified ? '● modified' : 'Saved snapshot'}</span>
            </button>
            <div className="workspace-source-summary">
              {entry.lineCount ?? '—'} lines · {entry.functionCount ?? '—'} funcs ·
              {' '}{entry.commentTasks ?? '—'} tasks
              {entry.projectDirectory !== null && <span> · project {entry.projectDirectory || 'root'}</span>}
            </div>
            {entry.warnings.slice(0,3).map(w =>
              <p key={w.kind} className="workspace-source-warning">{w.message}</p>)}
            {entry.warnings.length > 3 && <p className="workspace-source-warning">
              {entry.warnings.length-3} more review notes in source insights.
            </p>}
          </div>)}
          {!filtered.length && <p className="sidebar-note">
            {report.entries.length ? 'No files match these filters.' : 'No open Scarp sources to inspect.'}
          </p>}
        </div>
        {pages > 1 && <div className="insights-pages">
          <button type="button" disabled={currentPage === 1}
            onClick={() => setPage(p => Math.max(1,p-1))}>Previous</button>
          <span>Page {currentPage} / {pages}</span>
          <button type="button" disabled={currentPage === pages}
            onClick={() => setPage(p => Math.min(pages,p+1))}>Next</button>
        </div>}
      </div>}
    </div>
  </section>;
}
