import { useMemo, useState } from 'react';
import type { StudioDocument } from '../model/documents';
import {
  scanWorkspaceCommentTasks, filterWorkspaceTasks, currentWorkspaceTaskTarget,
} from '../model/workspaceTaskBoard';
import type { InsightNavigation } from './SourceInsightsPanel';
import type { ScarpTaskKind, ScarpTaskPriority } from '../model/commentTasks';

interface Props {
  documents: readonly StudioDocument[];
  activeId: string | null;
  busy: boolean;
  onNavigate: (target: InsightNavigation) => void;
  initiallyExpanded?: boolean;
}
const PAGE_SIZE = 24;
const kindOptions: readonly (ScarpTaskKind | 'all')[] = [
  'all','TODO','FIXME','BUG','REVIEW','NOTE','HACK','XXX',
];
const priorityOptions: readonly (ScarpTaskPriority | 'all')[] =
  ['all','high','normal','low'];
export function WorkspaceTaskBoard({
  documents, activeId, busy, onNavigate, initiallyExpanded = false,
}: Props) {
  const [expanded,setExpanded] = useState(initiallyExpanded);
  const [query,setQuery] = useState('');
  const [scope,setScope] = useState<'all'|'active'>('all');
  const [kind,setKind] = useState<ScarpTaskKind | 'all'>('all');
  const [priority,setPriority] = useState<ScarpTaskPriority | 'all'>('all');
  const [sort,setSort] = useState<'source'|'priority'>('priority');
  const [page,setPage] = useState(1);
  const report = useMemo(() => expanded
    ? scanWorkspaceCommentTasks(documents) : null,[expanded,documents]);
  const filtered = useMemo(() => !report ? [] :
    filterWorkspaceTasks(report.tasks,{
      query,scope,activeId,kind,priority,sort,
    }),[report,query,scope,activeId,kind,priority,sort]);
  const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const displayedPage=Math.min(page,pages);
  const visible=filtered.slice((displayedPage-1)*PAGE_SIZE,
    displayedPage*PAGE_SIZE);

  return <section className="sidebar-section workspace-task-board"
    aria-label="Scarp open workspace comment tasks">
    <div className="sidebar-heading">WORKSPACE TASKS</div>
    <button type="button" className="insights-toggle"
      aria-expanded={expanded} aria-controls="studio-workspace-task-board"
      onClick={()=>setExpanded(value=>!value)}>
      <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
      <span>{expanded ? 'Hide task board' : 'Review open-file TODOs'}</span>
    </button>
    <div id="studio-workspace-task-board" hidden={!expanded}>
      {report && <div className="workspace-task-content">
        <p className="insights-disclaimer">
          Read-only comment markers in already-open Scarp tabs.
          No GitHub issue creation, native disk search or source edits.
        </p>
        {!report.complete && <p className="sidebar-note" role="status">
          {report.note}
        </p>}
        <div className="workspace-task-stats" role="status">
          <span>{report.tasks.length} listed tasks</span>
          <span>{report.high} high · {report.normal} normal · {report.low} low</span>
        </div>
        <p className="insights-disclaimer">
          {report.documentsExamined} open buffers scanned ·
          {report.documentsSkipped} skipped
        </p>
        <div className="workspace-task-filters">
          <input type="search" value={query} maxLength={120}
            aria-label="Search workspace comment tasks"
            placeholder="Search task text or file…"
            onChange={event=>{setQuery(event.target.value);setPage(1);}}/>
          <select value={scope} aria-label="Workspace task scope"
            onChange={event=>{
              if(event.target.value==='all'||event.target.value==='active'){
                setScope(event.target.value as 'all'|'active');setPage(1);
              }
            }}>
            <option value="all">All open tabs</option>
            <option value="active">Current tab only</option>
          </select>
          <select value={kind} aria-label="Workspace task marker kind"
            onChange={event=>{
              const next=event.target.value;
              if(kindOptions.includes(next as ScarpTaskKind|'all')){
                setKind(next as ScarpTaskKind|'all');setPage(1);
              }
            }}>
            {kindOptions.map(item=><option value={item} key={item}>
              {item==='all'?'All kinds':item}
            </option>)}
          </select>
          <select value={priority} aria-label="Workspace task priority"
            onChange={event=>{
              const next=event.target.value;
              if(priorityOptions.includes(next as ScarpTaskPriority|'all')){
                setPriority(next as ScarpTaskPriority|'all');setPage(1);
              }
            }}>
            {priorityOptions.map(item=><option value={item} key={item}>
              {item==='all'?'All priorities':item}
            </option>)}
          </select>
          <select value={sort} aria-label="Workspace task ordering"
            onChange={event=>{
              if(event.target.value==='source'||event.target.value==='priority'){
                setSort(event.target.value as 'source'|'priority');setPage(1);
              }
            }}>
            <option value="priority">Priority first</option>
            <option value="source">Filename and line</option>
          </select>
        </div>
        <p role="status" className="insights-task-count">
          {filtered.length} matching comment tasks
        </p>
        <div className="workspace-task-list">
          {visible.map(entry=><div key={entry.id}
            className={'workspace-task-row workspace-task-'+entry.task.priority}>
            <div className="workspace-task-header">
              <strong>{entry.task.kind}</strong>
              <span>{entry.documentName}:{entry.task.line}</span>
            </div>
            <div className="workspace-task-text">
              {entry.task.description}
              {entry.task.owner && <span> · {entry.task.owner}</span>}
            </div>
            <button type="button" disabled={busy ||
              currentWorkspaceTaskTarget(entry,documents)===null}
              title="Go to exact comment in current open source snapshot"
              onClick={()=>{
                const target=currentWorkspaceTaskTarget(entry,documents);
                if(target && !busy)onNavigate(target);
              }}>
              Go to task
            </button>
          </div>)}
          {!visible.length && <p className="sidebar-note">
            {report.tasks.length ? 'No tasks match these filters.' : 'No comment tasks in open Scarp buffers.'}
          </p>}
        </div>
        {pages>1 && <div className="insights-pages">
          <button type="button" disabled={displayedPage===1}
            onClick={()=>setPage(p=>Math.max(1,p-1))}>Previous</button>
          <span>Page {displayedPage} / {pages}</span>
          <button type="button" disabled={displayedPage===pages}
            onClick={()=>setPage(p=>Math.min(pages,p+1))}>Next</button>
        </div>}
      </div>}
    </div>
  </section>;
}
