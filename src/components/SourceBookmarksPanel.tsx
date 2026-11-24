import { useMemo, useState } from 'react';
import type { StudioDocument } from '../model/documents';
import {
  resolveSourceBookmarks, filterSourceBookmarks,
  type SourceBookmark, type BookmarkStatus,
} from '../model/sourceBookmarks';

interface Props {
  documents: readonly StudioDocument[];
  bookmarks: readonly SourceBookmark[];
  activeId: string | null;
  busy: boolean;
  cursor: { line: number; column: number };
  onAdd: () => void;
  onRemove: (id: string) => void;
  onNavigate: (id: string) => void;
  initiallyExpanded?: boolean;
}
const pageSize = 24;
const statusFilters: readonly (BookmarkStatus | 'all')[] = [
  'all', 'current', 'relocated', 'stale', 'closed', 'unavailable',
];
export function SourceBookmarksPanel({
  documents, bookmarks, activeId, busy, cursor,
  onAdd, onRemove, onNavigate, initiallyExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [scope, setScope] = useState<'all'|'active'>('active');
  const [status, setStatus] = useState<BookmarkStatus|'all'>('all');
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<'created'|'source'>('source');
  const [page, setPage] = useState(1);
  // Closed panel does not scan source lines. All results use only immutable
  // in-memory source buffers and never fetch closed files from disk.
  const resolved = useMemo(() => expanded
    ? resolveSourceBookmarks(bookmarks, documents) : [],
  [expanded, bookmarks, documents]);
  const filtered = useMemo(() => filterSourceBookmarks(
    resolved, activeId, { scope, status, query, order },
  ), [resolved, activeId, scope, status, query, order]);
  const pages = Math.max(1, Math.ceil(filtered.length/pageSize));
  const currentPage = Math.min(page,pages);
  const shown = filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);
  const canAdd = !!activeId && documents.some(doc => doc.id === activeId);
  return <section className="sidebar-section bookmarks-panel"
    aria-label="Scarp source bookmarks">
    <div className="sidebar-heading">BOOKMARKS</div>
    <button type="button" className="insights-toggle" aria-expanded={expanded}
      aria-controls="scarp-source-bookmarks-body"
      onClick={() => setExpanded(value => !value)}>
      <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
      <span>{expanded ? 'Hide bookmarks' : 'Show session bookmarks'}</span>
      <span className="insights-toggle-hint">{bookmarks.length}</span>
    </button>
    <div id="scarp-source-bookmarks-body" hidden={!expanded}>
      <div className="bookmarks-content">
        <p className="insights-disclaimer">
          Session-only anchors. No disk storage. Changed or ambiguous lines
          cannot be navigated until the bookmark is recreated.
        </p>
        <div className="bookmarks-toolbar">
          <button type="button" disabled={busy || !canAdd}
            onClick={onAdd} title="Bookmark current source line without editing it">
            Add line {cursor.line}
          </button>
          <span>{bookmarks.length} total</span>
        </div>
        <div className="bookmarks-filters">
          <input type="search" maxLength={120} value={query}
            aria-label="Filter source bookmarks"
            placeholder="Find bookmarks…"
            onChange={event => { setQuery(event.target.value); setPage(1); }}/>
          <select value={scope} aria-label="Bookmark source scope"
            onChange={event => {
              if (event.target.value === 'all' || event.target.value === 'active') {
                setScope(event.target.value as 'all'|'active'); setPage(1);
              }
            }}>
            <option value="active">Current tab</option><option value="all">All open/closed tabs</option>
          </select>
          <select value={status} aria-label="Bookmark freshness"
            onChange={event => {
              const next = event.target.value;
              if (statusFilters.includes(next as BookmarkStatus|'all')) {
                setStatus(next as BookmarkStatus|'all'); setPage(1);
              }
            }}>
            {statusFilters.map(item =>
              <option value={item} key={item}>{item === 'all' ? 'All states' : item}</option>)}
          </select>
          <select value={order} aria-label="Bookmark order"
            onChange={event => {
              if (event.target.value === 'source' || event.target.value === 'created') {
                setOrder(event.target.value as 'source'|'created'); setPage(1);
              }
            }}>
            <option value="source">Source order</option>
            <option value="created">Creation order</option>
          </select>
        </div>
        <p className="insights-task-count" role="status">{filtered.length} matching bookmarks</p>
        <div className="bookmarks-list">
          {shown.map(entry => {
            const accessible = entry.location.status === 'current' ||
              entry.location.status === 'relocated';
            return <div key={entry.bookmark.id} className="bookmarks-row">
              <div className="bookmarks-header">
                <span title={entry.bookmark.documentName}>{entry.bookmark.documentName}</span>
                <span className={'bookmarks-status bookmarks-status-' + entry.location.status}>
                  {entry.location.status}
                </span>
              </div>
              <div className="bookmarks-label">{entry.bookmark.label}</div>
              <div className="bookmarks-actions">
                <button type="button" disabled={busy || !accessible}
                  onClick={() => onNavigate(entry.bookmark.id)}
                  title={entry.location.reason ?? 'Navigate to bookmarked source line'}>
                  Go to line {entry.location.line ?? '—'}
                </button>
                <button type="button" disabled={busy}
                  onClick={() => onRemove(entry.bookmark.id)}
                  title="Remove this session bookmark">Remove</button>
              </div>
              {entry.location.reason && <p className="bookmarks-reason">{entry.location.reason}</p>}
            </div>;
          })}
          {!filtered.length && <p className="sidebar-note">
            {bookmarks.length ? 'No bookmarks match these filters.' : 'No session bookmarks. Add one at your cursor.'}
          </p>}
        </div>
        {pages > 1 && <div className="insights-pages">
          <button type="button" disabled={currentPage === 1}
            onClick={() => setPage(p => Math.max(1,p-1))}>Previous</button>
          <span>Page {currentPage} / {pages}</span>
          <button type="button" disabled={currentPage === pages}
            onClick={() => setPage(p => Math.min(pages,p+1))}>Next</button>
        </div>}
      </div>
    </div>
  </section>;
}
