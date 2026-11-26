import { useMemo, useState } from 'react';
import { sameFilePath, type StudioDocument } from '../model/documents';
import {
  captureWorkspaceSession, planWorkspaceRestore, MAX_REMEMBERED_WORKSPACES,
  MAX_WORKSPACE_SESSION_TABS, type CapturedWorkspaceSession, type WorkspaceListedSource,
  type WorkspaceRestorePlan, type WorkspaceSession,
} from '../model/workspaceSessions';
import type { WorkspaceSessionView } from '../model/workspaceSessionStore';

interface Props {
  root: string | null;
  files: readonly WorkspaceListedSource[];
  documents: readonly StudioDocument[];
  activeId: string | null;
  view: WorkspaceSessionView;
  busy: boolean;
  onRemember: (capture: CapturedWorkspaceSession, expected: WorkspaceSession | null) => void;
  onRestore: (session: WorkspaceSession, plan: WorkspaceRestorePlan) => void;
  onForget: (session: WorkspaceSession) => void;
  onClearAll: (sessions: readonly WorkspaceSession[]) => void;
  initiallyExpanded?: boolean;
}
type Confirmation =
  | { kind: 'replace'; capture: CapturedWorkspaceSession; expected: WorkspaceSession }
  | { kind: 'forget'; expected: WorkspaceSession }
  | { kind: 'clear'; sessions: readonly WorkspaceSession[] };

function omittedCount(capture: CapturedWorkspaceSession): number {
  return capture.omittedDirty + capture.omittedUntitled + capture.omittedUnlisted +
    capture.omittedAmbiguous + capture.omittedLimit;
}
function rowStatus(row: WorkspaceRestorePlan['rows'][number]): string {
  switch (row.kind) {
    case 'available': return 'Ready to open';
    case 'open': return row.modified ? 'Open · preserve edits' : 'Already open';
    case 'missing': return 'Not currently listed';
    case 'ambiguous': return 'Ambiguous · skipped';
  }
}

export function WorkspaceSessionPanel({
  root, files, documents, activeId, view, busy, onRemember, onRestore,
  onForget, onClearAll, initiallyExpanded = false,
}: Props) {
  const remembered = root === null ? null :
    view.sessions.find(session => sameFilePath(session.root, root)) ?? null;
  const [expanded, setExpanded] = useState(initiallyExpanded || remembered !== null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const capture = useMemo(() => expanded && root !== null
    ? captureWorkspaceSession(root, files, documents, activeId, 0) : null,
    [expanded, root, files, documents, activeId]);
  const plan = useMemo(() => expanded && root !== null && remembered !== null
    ? planWorkspaceRestore(remembered, root, files, documents) : null,
    [expanded, root, remembered, files, documents]);
  const disabled = busy || !view.available || view.blocked;

  function confirm(): void {
    const action = confirmation;
    if (!action || busy) return;
    setConfirmation(null);
    if (action.kind === 'replace') onRemember(action.capture, action.expected);
    else if (action.kind === 'forget') onForget(action.expected);
    else onClearAll(action.sessions);
  }

  return (
    <section className="sidebar-section workspace-session-panel" aria-label="Remembered workspace tabs">
      <div className="sidebar-heading">WORKSPACE SESSION</div>
      <button type="button" className="insights-toggle" aria-expanded={expanded}
        onClick={() => { setExpanded(!expanded); setConfirmation(null); }}>
        {expanded ? '▾ Hide' : '▸ Show'} remembered tabs
        {remembered && <span className="workspace-session-count"> · {remembered.names.length}</span>}
      </button>
      {expanded && <div className="workspace-session-body">
        <p className="sidebar-note">Remember clean, listed source tabs and the active file for a later visit.
          This stores the workspace path and relative filenames locally, not source contents.
          It never opens a folder automatically.</p>
        {!view.available && <p className="sidebar-note" role="status">Local desktop metadata storage is unavailable.</p>}
        {view.error && <p className="workspace-session-error" role="alert">{view.error}</p>}
        {root === null ? <p className="sidebar-note">Choose a workspace through the folder picker first.</p> : (
          <>
            {capture && <div className="workspace-session-capture">
              <p role="status"><strong>{capture.rememberedCount} clean listed tab(s) can be remembered.</strong></p>
              {omittedCount(capture) > 0 && <p className="sidebar-note">
                Omitted: {capture.omittedDirty} modified, {capture.omittedUntitled} untitled,
                {' '}{capture.omittedUnlisted} unlisted, {capture.omittedAmbiguous} ambiguous,
                {' '}{capture.omittedLimit} over the tab limit.
              </p>}
              <button type="button" disabled={disabled || capture.session === null}
                onClick={() => {
                  if (remembered) setConfirmation({ kind: 'replace', capture, expected: remembered });
                  else onRemember(capture, null);
                }}>{remembered ? 'Replace remembered tabs' : 'Remember current tabs'}</button>
            </div>}
            {remembered && <div className="workspace-session-review">
              <p><strong>{remembered.names.length} remembered tab(s)</strong></p>
              <p className="sidebar-note">Remembered {new Date(remembered.savedAt).toLocaleString()}.
                Restore opens the current disk contents of listed files and preserves existing open buffers.</p>
              {plan && !plan.ok && <p className="workspace-session-error" role="alert">{plan.error}</p>}
              {plan?.ok && <>
                <p role="status">{plan.value.newCount} to open · {plan.value.openCount} already open ·
                  {' '}{plan.value.missingCount} unlisted · {plan.value.ambiguousCount} ambiguous.</p>
                <ul className="workspace-session-rows">
                  {plan.value.rows.map(row => (
                    <li key={row.name} className={'workspace-session-row workspace-session-' + row.kind}>
                      <span title={row.name}>{row.name}</span>
                      <span>{rowStatus(row)}{row.name === remembered.active ? ' · active' : ''}</span>
                    </li>
                  ))}
                </ul>
                <button type="button" disabled={disabled || (!plan.value.newCount && plan.value.activePath === null)}
                  onClick={() => onRestore(remembered, plan.value)}>Restore listed tabs</button>
                {(plan.value.missingCount > 0 || plan.value.ambiguousCount > 0) &&
                  <p className="sidebar-note">Unlisted and ambiguous sources are skipped, never resolved from stored paths.</p>}
              </>}
              <button type="button" disabled={disabled}
                onClick={() => setConfirmation({ kind: 'forget', expected: remembered })}>Forget this workspace</button>
            </div>}
          </>
        )}
        <p className="sidebar-note" role="status">{view.sessions.length} / {MAX_REMEMBERED_WORKSPACES} workspaces remembered.
          Up to {MAX_WORKSPACE_SESSION_TABS} tabs per workspace.</p>
        {(view.sessions.length > 0 || view.blocked) &&
          <button type="button" disabled={busy || !view.available}
            onClick={() => setConfirmation({ kind: 'clear', sessions: view.sessions })}>Clear all remembered workspaces</button>}
        {confirmation && <div className="workspace-session-confirm" role="group" aria-label="Confirm workspace metadata change">
          <p>{confirmation.kind === 'replace' ? 'Replace the remembered tab list with this reviewed list?' :
            confirmation.kind === 'forget' ? 'Remove the saved metadata for this workspace?' :
            'Remove all remembered workspace metadata? No source files or open tabs are changed.'}</p>
          <button type="button" disabled={busy || (view.blocked && confirmation.kind !== 'clear')}
            onClick={confirm}>Confirm</button>
          <button type="button" onClick={() => setConfirmation(null)}>Cancel</button>
        </div>}
      </div>}
    </section>
  );
}
