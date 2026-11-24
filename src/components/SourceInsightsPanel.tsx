import { useMemo, useState } from 'react';
import type { StudioDocument } from '../model/documents';
import { scanScarpSource } from '../language/sourceLex';
import { summarizeScarpSource } from '../model/sourceSummary';
import {
  findScarpCommentTasks, filterScarpCommentTasks,
  sortScarpCommentTasks, currentTaskPosition, taskCounts,
  type ScarpCommentTask, type ScarpTaskKind, type ScarpTaskPriority,
} from '../model/commentTasks';

const VISIBLE_TASKS_PER_PAGE = 24;
export interface InsightNavigation {
  documentId: string;
  revision: number;
  source: string;
  line: number;
  column: number;
}
interface Props {
  document: StudioDocument | null;
  onNavigate: (target: InsightNavigation) => void;
  initiallyExpanded?: boolean;
}
const kinds: readonly (ScarpTaskKind | 'all')[] = [
  'all', 'TODO', 'FIXME', 'BUG', 'REVIEW', 'NOTE', 'HACK', 'XXX',
];
const priorities: readonly (ScarpTaskPriority | 'all')[] = [
  'all', 'high', 'normal', 'low',
];

export function SourceInsightsPanel({
  document, onNavigate, initiallyExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [kind, setKind] = useState<ScarpTaskKind | 'all'>('all');
  const [priority, setPriority] = useState<ScarpTaskPriority | 'all'>('all');
  const [query, setQuery] = useState('');
  const [ordering, setOrdering] = useState<'source' | 'priority'>('source');
  const [page, setPage] = useState(1);

  // Do not scan a large buffer at all while the panel is collapsed.
  // These are immutable, source-only computations, with strict token limits.
  const insight = useMemo(() => {
    if (!expanded || !document) return null;
    const lex = scanScarpSource(document.content);
    const summary = summarizeScarpSource(document.content, lex);
    const tasks = findScarpCommentTasks(document.content, lex);
    return { lex, summary, tasks };
  }, [expanded, document?.content, document?.id, document?.revision]);

  const filtered = useMemo(() => {
    if (!insight) return [];
    const matches = filterScarpCommentTasks(insight.tasks.tasks, {
      kind, priority, query,
    });
    return sortScarpCommentTasks(matches, ordering);
  }, [insight, kind, priority, query, ordering]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / VISIBLE_TASKS_PER_PAGE));
  const visiblePage = Math.min(page, totalPages);
  const visible = filtered.slice(
    (visiblePage - 1) * VISIBLE_TASKS_PER_PAGE,
    visiblePage * VISIBLE_TASKS_PER_PAGE,
  );

  function jump(task: ScarpCommentTask): void {
    if (!document) return;
    const target = currentTaskPosition(document.content, task);
    if (!target) return;
    onNavigate({
      documentId: document.id, revision: document.revision,
      source: document.content, line: target.line, column: target.column,
    });
  }

  return <section className="sidebar-section source-insights-panel" aria-label="Scarp source insights">
    <div className="sidebar-heading">SOURCE INSIGHTS</div>
    <button type="button" className="insights-toggle"
      aria-expanded={expanded} aria-controls="scarp-source-insights-body"
      onClick={() => setExpanded(current => !current)}>
      <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
      <span>{expanded ? 'Hide' : 'Analyze'} current source</span>
      <span className="insights-toggle-hint">{document ? document.name : 'No source'}</span>
    </button>
    <div id="scarp-source-insights-body" hidden={!expanded}>
      {!document && <p className="sidebar-note">Open a Scarp source to inspect its buffer.</p>}
      {insight && <div className="insights-body">
        <p className="insights-disclaimer">
          Approximate editor-only analysis. Not compiler diagnostics. No disk reads or writes.
        </p>
        {!insight.summary.complete && <p className="sidebar-note" role="status">
          Source exceeds an insight limit. The displayed analysis may be incomplete.
        </p>}
        <dl className="insights-metrics">
          <div><dt>Lines</dt><dd>{insight.summary.lines}</dd></div>
          <div><dt>Functions</dt><dd>{insight.summary.functions}</dd></div>
          <div><dt>Pure functions</dt><dd>{insight.summary.pureFunctions}</dd></div>
          <div><dt>Records</dt><dd>{insight.summary.records}</dd></div>
          <div><dt>Variants</dt><dd>{insight.summary.variants}</dd></div>
          <div><dt>Imports</dt><dd>{insight.summary.imports}</dd></div>
          <div><dt>Loops</dt><dd>{insight.summary.loops}</dd></div>
          <div><dt>Branches</dt><dd>{insight.summary.branches}</dd></div>
          <div><dt>Max block depth</dt><dd>{insight.summary.maxBlockDepth}</dd></div>
          <div><dt>Long lines</dt><dd>{insight.summary.longLines}</dd></div>
          <div><dt>Line endings</dt><dd>{insight.summary.lineEnding.toUpperCase()}</dd></div>
          <div><dt>Comments</dt><dd>{insight.summary.comments}</dd></div>
        </dl>
        {insight.summary.notes.length > 0 && <div className="insights-notes">
          <strong>Review notes</strong>
          <ul>{insight.summary.notes.map(note => <li key={note}>{note}</li>)}</ul>
        </div>}
        <div className="insights-task-header">
          <strong>COMMENT TASKS</strong>
          <span>{insight.tasks.tasks.length} listed</span>
        </div>
        {(() => {
          const counts = taskCounts(insight.tasks.tasks);
          return <p className="insights-priorities">
            {counts.high} high · {counts.normal} normal · {counts.low} low
          </p>;
        })()}
        {insight.tasks.message && <p className="sidebar-note" role="status">{insight.tasks.message}</p>}
        <div className="insights-filter">
          <input type="search" value={query} maxLength={120}
            aria-label="Filter source comment tasks"
            placeholder="Filter tasks…"
            onChange={event => { setQuery(event.target.value); setPage(1); }} />
          <select aria-label="Filter comment task kind" value={kind}
            onChange={event => {
              const selected = event.target.value;
              if (kinds.includes(selected as ScarpTaskKind | 'all')) {
                setKind(selected as ScarpTaskKind | 'all');
                setPage(1);
              }
            }}>
            {kinds.map(item => <option key={item} value={item}>{item === 'all' ? 'All tasks' : item}</option>)}
          </select>
          <select aria-label="Filter comment task priority" value={priority}
            onChange={event => {
              const selected = event.target.value;
              if (priorities.includes(selected as ScarpTaskPriority | 'all')) {
                setPriority(selected as ScarpTaskPriority | 'all');
                setPage(1);
              }
            }}>
            {priorities.map(item => <option key={item} value={item}>{item === 'all' ? 'All priorities' : item}</option>)}
          </select>
          <select aria-label="Order comment tasks" value={ordering}
            onChange={event => {
              if (event.target.value === 'source' || event.target.value === 'priority') {
                setOrdering(event.target.value as 'source' | 'priority');
                setPage(1);
              }
            }}>
            <option value="source">Source order</option>
            <option value="priority">Priority order</option>
          </select>
        </div>
        <p className="insights-task-count" role="status">
          {filtered.length} matching task{filtered.length === 1 ? '' : 's'}
        </p>
        <div className="insights-task-list">
          {visible.map(task => <button type="button"
            key={task.id} className={'insights-task insights-task-' + task.priority}
            title={'Jump to comment at line ' + task.line}
            onClick={() => jump(task)}>
            <span className="insights-task-title">
              <strong>{task.kind}</strong>
              {task.owner && <span>({task.owner})</span>}
              <span className="outline-line">:{task.line}</span>
            </span>
            <span className="insights-task-description">{task.description}</span>
          </button>)}
          {!filtered.length && <p className="sidebar-note">
            {insight.tasks.tasks.length ? 'No tasks match the filters.' : 'No TODO, FIXME, BUG, NOTE or other comment tasks.'}
          </p>}
        </div>
        {totalPages > 1 && <div className="insights-pages">
          <button type="button" disabled={visiblePage === 1}
            onClick={() => setPage(current => Math.max(1, current - 1))}>Previous</button>
          <span>Page {visiblePage} / {totalPages}</span>
          <button type="button" disabled={visiblePage === totalPages}
            onClick={() => setPage(current => Math.min(totalPages, current + 1))}>Next</button>
        </div>}
      </div>}
    </div>
  </section>;
}
