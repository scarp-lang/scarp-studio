import { useState, useSyncExternalStore } from 'react';
import type { StudioDocument } from '../model/documents';
import { MAX_TRAIL_ENTRIES, TRAIL_REASON_LABELS, reviewTrailMove, reviewTrailSelection, trailEntryStatus,
  type NavigationTrailStore, type TrailMove } from '../model/navigationTrail';

interface Props {
  store: NavigationTrailStore;
  documents: readonly StudioDocument[];
  activeId: string | null;
  busy: boolean;
  onMark: () => boolean;
  onMove: (move: TrailMove) => boolean;
}
export function NavigationTrailPanel({ store, documents, activeId, busy, onMark, onMove }: Props) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState('');
  const [clearRevision, setClearRevision] = useState<number | null>(null);
  const [currentOnly, setCurrentOnly] = useState(false);
  const back = expanded ? reviewTrailMove(state, 'back', documents) : null;
  const forward = expanded ? reviewTrailMove(state, 'forward', documents) : null;
  const entries = state.entries.map((entry, index) => ({ entry, index, status: trailEntryStatus(entry, documents) }));
  const currentCount = entries.filter(item => item.status === 'current').length;
  function move(plan: TrailMove | null) {
    if (!plan || busy) return;
    setNotice(onMove(plan) ? '' : 'The navigation location changed. Choose a current location.');
    setClearRevision(null);
  }
  return <section className="sidebar-section navigation-trail" aria-label="Session navigation trail">
    <div className="sidebar-heading">NAVIGATION TRAIL</div>
    <button type="button" className="insights-toggle" aria-expanded={expanded}
      aria-controls="navigation-trail-body" onClick={() => setExpanded(value => !value)}>
      <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
      <span>{expanded ? 'Hide navigation trail' : 'Explore navigation trail'}</span>
    </button>
    {expanded && <div id="navigation-trail-body" className="insights-body">
      <p className="insights-disclaimer">Session-only requested editor jumps and marked cursor positions.
        Edited or closed sources cannot be replayed. No source text is retained.</p>
      <div className="trail-actions">
        <button type="button" disabled={busy || !back} onClick={() => move(back)}>Back in navigation trail</button>
        <button type="button" disabled={busy || !forward} onClick={() => move(forward)}>Forward in navigation trail</button>
        <button type="button" disabled={busy || !activeId} onClick={() => {
          setNotice(onMark() ? 'Cursor location recorded.' : 'Choose a current editor cursor position.');
          setClearRevision(null);
        }}>Mark current cursor</button>
      </div>
      <p className="navigation-trail-current" role="status">
        {state.index < 0 ? 'No recorded location' : 'Selected location ' + (state.index + 1) + ' of ' + state.entries.length}
      </p>
      <small>{currentCount} current / {state.entries.length} recorded (limit {MAX_TRAIL_ENTRIES})</small>
      <label><input type="checkbox" checked={currentOnly} onChange={event => setCurrentOnly(event.target.checked)} />
        Show current locations only</label>
      <ol className="trail-list">
        {entries.filter(item => !currentOnly || item.status === 'current').map(({ entry, index, status }) =>
          <li key={entry.id}>
            <button type="button" disabled={busy || status !== 'current'} aria-current={index === state.index ? 'location' : undefined}
              onClick={() => move(reviewTrailSelection(state, entry.id, documents))}>
              <strong>{entry.documentName}:{entry.line}:{entry.column}</strong>
              <span>{TRAIL_REASON_LABELS[entry.reason]} · {status === 'current' ? 'Current' :
                status === 'closed' ? 'Closed tab' : 'Source changed'}</span>
            </button>
          </li>)}
      </ol>
      {!entries.length && <p className="insights-disclaimer">Navigate to an editor symbol or mark the current cursor to begin.</p>}
      {entries.length > 0 && clearRevision === null && <button type="button" disabled={busy}
        onClick={() => setClearRevision(state.revision)}>Review clear navigation trail</button>}
      {clearRevision !== null && <div className="trail-confirm" role="group" aria-label="Confirm clear navigation trail">
        <p>Remove all recorded cursor locations? Open buffers and bookmarks are unchanged.</p>
        <button type="button" disabled={busy || clearRevision !== state.revision} onClick={() => {
          setNotice(store.clear(clearRevision) ? 'Navigation trail cleared.' : 'The trail changed.');
          setClearRevision(null);
        }}>Confirm clear navigation trail</button>
        <button type="button" onClick={() => setClearRevision(null)}>Cancel</button>
        {clearRevision !== state.revision && <small>New locations were recorded; review again.</small>}
      </div>}
      {notice && <p role="status">{notice}</p>}
    </div>}
  </section>;
}
