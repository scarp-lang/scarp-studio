import { useState } from 'react';
import { MAX_RECOVERY_DRAFTS, MAX_RECOVERY_SOURCE_UNITS, type RecoveryCheckpoint } from '../model/draftRecovery';
import type { RecoveryView } from '../model/draftRecoveryJournal';

interface Props {
  view: RecoveryView;
  blocked: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onRestore: (checkpoint: RecoveryCheckpoint) => void;
  onDiscard: (checkpoint: RecoveryCheckpoint) => void;
  onCheckpoint: () => void;
}

function checkpointDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export function DraftRecoveryPanel({
  view, blocked, onEnable, onDisable, onRestore, onDiscard, onCheckpoint,
}: Props) {
  const [showNames, setShowNames] = useState(false);
  const [confirmation, setConfirmation] = useState<'disable' | 'discard' | null>(null);
  const previous = view.previous;
  const canManage = !blocked && view.available;
  return (
    <section className="draft-recovery-panel" aria-label="Local draft recovery">
      <div className="draft-recovery-heading">
        <strong>Local draft recovery</strong>
        <span className="draft-recovery-state">
          {view.blocked ? 'Review required' : view.paused ? 'Paused' : view.enabled ? 'On' : 'Off'}
        </span>
      </div>
      <p className="draft-recovery-explanation">
        Optional local copies of unsaved Scarp source, stored in this desktop profile.
        Off by default. Not encrypted, not a backup, and never written to your original source files.
      </p>
      {!view.available && <p className="draft-recovery-warning" role="status">
        Recovery storage is unavailable in this session.
      </p>}
      {view.error && <p className="draft-recovery-warning" role="alert">{view.error}</p>}
      {previous ? (
        <div className="draft-recovery-review">
          <p role="status"><strong>{previous.drafts.length} draft(s) from a previous session</strong></p>
          <p>Checkpoint: {checkpointDate(previous.createdAt)}. New automatic checkpoints are paused until review.</p>
          <button type="button" onClick={() => setShowNames(!showNames)} aria-expanded={showNames}>
            {showNames ? 'Hide draft names' : 'Review draft names'}
          </button>
          {showNames && (
            <ul className="draft-recovery-list">
              {previous.drafts.map((draft, index) => (
                <li key={index}><span>{draft.name}</span><span>{draft.content.length.toLocaleString()} UTF-16 units</span></li>
              ))}
            </ul>
          )}
          <div className="draft-recovery-actions">
            <button type="button" disabled={!canManage || view.blocked || view.paused}
              onClick={() => { setConfirmation(null); onRestore(previous); }}>Restore as unsaved copies</button>
            <button type="button" disabled={!canManage || view.blocked || view.paused}
              onClick={() => setConfirmation('discard')}>Discard previous drafts</button>
          </div>
          <p>Restore creates new untitled tabs only; save them explicitly using the normal Save dialog.</p>
        </div>
      ) : view.enabled ? (
        <div className="draft-recovery-review">
          <p role="status">{view.checkpointTime === null ? 'No current draft checkpoint.' :
            'Last checkpoint: ' + checkpointDate(view.checkpointTime) + ' · ' + view.checkpointCount + ' draft(s)'}</p>
          <p>Up to {MAX_RECOVERY_DRAFTS} unsaved tabs and {MAX_RECOVERY_SOURCE_UNITS / 1024} Ki UTF-16 units total.
            If a checkpoint fails, the previous complete copy may remain; save your files normally.</p>
          <button type="button" disabled={!canManage || view.blocked || view.paused}
            onClick={onCheckpoint}>Checkpoint now</button>
        </div>
      ) : null}
      <div className="draft-recovery-actions">
        {!view.enabled && !view.blocked && (
          <button type="button" disabled={!canManage || view.paused} onClick={onEnable}>Enable local recovery</button>
        )}
        {(view.enabled || view.blocked || view.paused) && (
          <button type="button" disabled={!canManage} onClick={() => setConfirmation('disable')}>
            Turn off and remove local recovery
          </button>
        )}
      </div>
      {confirmation && (
        <div className="draft-recovery-confirm" role="group" aria-label="Confirm recovery data removal">
          <p>{confirmation === 'discard'
            ? 'Permanently discard the previous-session recovery copies? Current editor tabs are unchanged.'
            : 'Turn recovery off and remove its local copies? Current editor tabs and source files are unchanged.'}</p>
          <button type="button" disabled={!canManage} onClick={() => {
            const action = confirmation;
            setConfirmation(null);
            if (action === 'discard' && previous) onDiscard(previous);
            else if (action === 'disable') onDisable();
          }}>Confirm removal</button>
          <button type="button" onClick={() => setConfirmation(null)}>Cancel</button>
        </div>
      )}
    </section>
  );
}
