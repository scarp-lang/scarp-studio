import { useState } from 'react';
import { MAX_RECENTLY_CLOSED, type RecentlyClosedSource } from '../model/recentlyClosed';

interface Props {
  entries: readonly RecentlyClosedSource[];
  busy: boolean;
  onReopen: (entry: RecentlyClosedSource) => void;
  onForget: (entry: RecentlyClosedSource) => void;
  onClear: (entries: readonly RecentlyClosedSource[]) => void;
  initiallyExpanded?: boolean;
}

export function RecentlyClosedPanel({
  entries, busy, onReopen, onForget, onClear, initiallyExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  return (
    <section className="sidebar-section recently-closed-panel" aria-label="Recently closed saved sources">
      <div className="sidebar-heading">RECENTLY CLOSED</div>
      <button type="button" className="insights-toggle" aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}>
        {expanded ? '▾ Hide' : '▸ Show'} closed sources · {entries.length}
      </button>
      {expanded && <div className="recently-closed-body">
        <p className="sidebar-note">
          Clean saved sources only. Reopen reads the current file from disk;
          discarded unsaved edits are not retained. History ends when Studio exits.
        </p>
        <button type="button" disabled={busy || !entries.length}
          onClick={() => { if (entries[0]) onReopen(entries[0]); }}>
          Reopen last closed (Ctrl+Shift+T)
        </button>
        {!entries.length && <p className="sidebar-note" role="status">No recently closed saved sources.</p>}
        <ul className="recently-closed-list">
          {entries.map(entry => (
            <li key={entry.sequence} className="recently-closed-row">
              <button type="button" className="recently-closed-open" disabled={busy}
                title={entry.path} aria-label={'Reopen ' + entry.path} onClick={() => onReopen(entry)}>
                <span>{entry.name}</span>
                <span className="recently-closed-path">{entry.path}</span>
              </button>
              <button type="button" className="recently-closed-forget" disabled={busy}
                title="Remove from history" aria-label={'Forget ' + entry.path}
                onClick={() => onForget(entry)}>×</button>
            </li>
          ))}
        </ul>
        {entries.length > 0 && <button type="button" disabled={busy} onClick={() => onClear(entries)}>
          Clear closed source history
        </button>}
        <p className="sidebar-note">{entries.length} / {MAX_RECENTLY_CLOSED} saved sources retained in this session.</p>
      </div>}
    </section>
  );
}
