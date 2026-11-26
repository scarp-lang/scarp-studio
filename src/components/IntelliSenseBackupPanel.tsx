import { useState, useSyncExternalStore } from 'react';
import {
  BACKUP_CONFLICT_POLICIES, MAX_PROFILE_BACKUP_UNITS, backupReviewIsCurrent,
  exportSavedProfileBackup, reviewSavedProfileBackup, type BackupConflictPolicy, type BackupReview,
  type savedProfilesStore,
} from '../model/intelliSenseProfiles';

const policyLabels: Record<BackupConflictPolicy, string> = {
  keep: 'Keep existing profiles (default)',
  replace: 'Replace conflicting saved preferences',
  rename: 'Keep both under a new imported name',
};
const actionLabels = { add: 'Add', same: 'Already identical', keep: 'Keep existing',
  replace: 'Replace saved preferences', rename: 'Add renamed copy' };

export function IntelliSenseBackupPanel({ store }: { store: typeof savedProfilesStore }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [open, setOpen] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [raw, setRaw] = useState('');
  const [policy, setPolicy] = useState<BackupConflictPolicy>('keep');
  const [review, setReview] = useState<BackupReview | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const blocked = state.persistence === 'blocked';
  const stale = !!review && !backupReviewIsCurrent(review, state.profiles);
  const changes = review?.actions.filter(item => item.kind === 'add' || item.kind === 'replace' || item.kind === 'rename').length ?? 0;
  function clearReview() { setReview(null); setFeedback(null); }
  function preview() {
    clearReview();
    const live = store.getSnapshot();
    if (live.persistence === 'blocked') { setFeedback({ message: 'Reload blocked profile storage before importing.', error: true }); return; }
    const result = reviewSavedProfileBackup(live.profiles, raw, policy);
    if (result.ok) setReview(result.value);
    else setFeedback({ message: result.error, error: true });
  }
  function apply() {
    if (!review) return;
    const result = store.applyBackup(review);
    setReview(null);
    if (!result.ok) { setFeedback({ message: result.error, error: true }); return; }
    setFeedback({ message: store.getSnapshot().persistence === 'available'
      ? 'Saved-profile backup merged.' : 'Backup merged for this session; persistence is unavailable.', error: false });
  }
  return <section className="intellisense-backup-panel" aria-label="Saved-profile backup">
    <h3>Saved-profile backup</h3>
    <p>Transfer all named IntelliSense profiles as a collection. This does not apply them to the active editor or include source files, workspace paths or compiler approvals.</p>
    <button type="button" className="settings-reset" aria-expanded={open}
      aria-controls="intellisense-backup-content" onClick={() => { setOpen(value => !value); clearReview(); }}>
      {open ? 'Hide saved-profile backup' : 'Manage saved-profile backup'}
    </button>
    <div id="intellisense-backup-content" hidden={!open}>
      {open && <>
        <div className="profile-controls">
          <button type="button" className="settings-reset" disabled={blocked} aria-expanded={showExport && !blocked}
            onClick={() => setShowExport(value => !value)}>Export all saved profiles</button>
        </div>
        {showExport && !blocked && <div className="profile-transfer">
          <label htmlFor="intellisense-backup-export">Saved-profile backup JSON (select and copy)</label>
          <textarea id="intellisense-backup-export" readOnly rows={7} value={exportSavedProfileBackup(state.profiles)} />
        </div>}
        <div className="profile-transfer">
          <label htmlFor="intellisense-backup-import">Paste saved-profile backup JSON</label>
          <textarea id="intellisense-backup-import" rows={6} value={raw} disabled={blocked}
            maxLength={MAX_PROFILE_BACKUP_UNITS} onPaste={event => {
              const input = event.currentTarget;
              const length = raw.length - (input.selectionEnd - input.selectionStart) + event.clipboardData.getData('text/plain').length;
              if (length > MAX_PROFILE_BACKUP_UNITS) {
                event.preventDefault(); clearReview();
                setFeedback({ message: 'Backup is too large; paste was rejected.', error: true });
              }
            }} onChange={event => {
              if (event.target.value.length > MAX_PROFILE_BACKUP_UNITS) {
                clearReview(); setFeedback({ message: 'Backup is too large.', error: true }); return;
              }
              setRaw(event.target.value); clearReview();
            }} />
          <label htmlFor="intellisense-backup-policy">Conflicting profile names</label>
          <select id="intellisense-backup-policy" disabled={blocked} value={policy} onChange={event => {
            const next = BACKUP_CONFLICT_POLICIES.find(item => item === event.target.value);
            if (next) { setPolicy(next); clearReview(); }
          }}>{BACKUP_CONFLICT_POLICIES.map(item => <option key={item} value={item}>{policyLabels[item]}</option>)}</select>
          <div className="profile-controls">
            <button type="button" className="settings-reset" disabled={blocked || !raw.trim()} onClick={preview}>Review backup merge</button>
            <button type="button" className="settings-reset" onClick={() => { setRaw(''); clearReview(); }}>Clear backup input</button>
          </div>
        </div>
        {review && <div className="profile-review" role="group" aria-label="Confirm saved-profile backup merge">
          <strong>{changes} profile change(s) · {review.result.length} total after merge</strong>
          <ul className="backup-actions">
            {review.actions.map(action => <li key={action.name}>
              <strong>{actionLabels[action.kind]}: {action.name}</strong>
              {action.targetName !== action.name && <span>Target: {action.targetName}. </span>}
              {action.changedPreferences > 0 && <span>{action.changedPreferences} preference difference(s).</span>}
            </li>)}
          </ul>
          {!changes && <p>No saved profile would change. You can close this review.</p>}
          {stale && <p role="alert">Saved profiles changed. Review the backup again.</p>}
          <div className="profile-controls">
            <button type="button" className="settings-reset" disabled={!changes || stale || blocked} onClick={apply}>Confirm backup merge</button>
            <button type="button" className="settings-reset" onClick={clearReview}>Cancel backup review</button>
          </div>
        </div>}
        {feedback && <p role={feedback.error ? 'alert' : 'status'} className={feedback.error ? 'profile-error' : 'profile-status'}>{feedback.message}</p>}
      </>}
    </div>
  </section>;
}
