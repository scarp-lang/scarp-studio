import { useState, useSyncExternalStore } from 'react';
import { type IntelliSensePreferences } from '../model/intelliSensePreferences';
import {
  MAX_PROFILE_TRANSFER_UNITS, exportIntelliSenseProfile, importIntelliSenseProfile,
  isCurrentProfileReview, reviewIntelliSenseProfile, type ProfileReview,
} from '../model/intelliSenseProfileTransfer';
import {
  MAX_PROFILE_NAME_UNITS, MAX_SAVED_PROFILES, normalizeProfileName, profileIdentity,
  savedProfilesStore, sameSavedProfile, type SavedIntelliSenseProfile,
} from '../model/intelliSenseProfiles';

type Pending =
  | { kind: 'apply'; review: ProfileReview; source: SavedIntelliSenseProfile | null; origin: string }
  | { kind: 'replace'; expected: SavedIntelliSenseProfile; review: ProfileReview }
  | { kind: 'delete'; expected: SavedIntelliSenseProfile }
  | { kind: 'discard' };

interface Props {
  preferences: Readonly<IntelliSensePreferences>;
  onApply: (preferences: IntelliSensePreferences) => void;
  store?: typeof savedProfilesStore;
}
export function IntelliSenseProfilePanel({ preferences, onApply, store = savedProfilesStore }: Props) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [name, setName] = useState('');
  const [selection, setSelection] = useState('');
  const [raw, setRaw] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  const selected = state.profiles.find(profile => profileIdentity(profile.name) === selection);
  const blocked = state.persistence === 'blocked';
  const review = pending?.kind === 'apply' || pending?.kind === 'replace' ? pending.review : null;
  const expected = pending?.kind === 'replace' || pending?.kind === 'delete' ? pending.expected
    : pending?.kind === 'apply' ? pending.source : null;
  const stale = pending?.kind === 'apply' && !isCurrentProfileReview(pending.review, preferences);
  // Replace review compares the selected saved profile with a captured current
  // configuration. The latter must still match the active preferences.
  const replaceStale = pending?.kind === 'replace' &&
    reviewIntelliSenseProfile(preferences, pending.review.target).changes.length !== 0;
  const profileStale = Boolean(expected && !state.profiles.some(profile => sameSavedProfile(profile, expected)));
  function feedback(message: string, error = false) { setNotice({ message, error }); }
  function resetReview() { setPending(null); setNotice(null); }
  function saveNew() {
    resetReview();
    const result = store.mutate({ kind: 'create', name, preferences });
    if (!result.ok) { feedback(result.error, true); return; }
    const savedName = normalizeProfileName(name);
    if (savedName) setSelection(profileIdentity(savedName));
    setName('');
    feedback('Saved current IntelliSense configuration as a named profile.');
  }
  function previewImport() {
    resetReview();
    const result = importIntelliSenseProfile(raw);
    if (!result.ok) { feedback(result.error, true); return; }
    setPending({ kind: 'apply', review: reviewIntelliSenseProfile(preferences, result.value), source: null, origin: 'Imported configuration' });
  }
  function confirm() {
    if (!pending) return;
    if (stale || replaceStale || profileStale) { feedback('The configuration changed. Review it again.', true); setPending(null); return; }
    if (pending.kind === 'apply') {
      onApply({ ...pending.review.target });
      setPending(null);
      feedback('Applied ' + pending.origin + '.');
      return;
    }
    const result = pending.kind === 'discard' ? store.discardBlocked() :
      pending.kind === 'delete' ? store.mutate({ kind: 'delete', expected: pending.expected }) :
        store.mutate({ kind: 'replace', expected: pending.expected, preferences: pending.review.target });
    setPending(null);
    if (!result.ok) { feedback(result.error, true); return; }
    if (pending.kind === 'delete' || pending.kind === 'discard') setSelection('');
    feedback(pending.kind === 'replace' ? 'Saved profile replaced.' : pending.kind === 'delete' ? 'Saved profile removed.' : 'Unreadable profile record discarded.');
  }
  return (
    <section className="intellisense-section intellisense-profile-panel" aria-label="Saved IntelliSense profiles">
      <h3>Saved IntelliSense profiles</h3>
      <p>Save a reusable snapshot of the current configuration. Named profiles are independent of active settings and preference resets.</p>
      <p role="status">{state.profiles.length} / {MAX_SAVED_PROFILES} profiles
        {state.persistence === 'session-only' && ' · Session only; changes may not survive restart.'}
        {blocked && ' · Profile storage blocked.'}</p>
      {blocked && <div className="profile-error">
        <p>Saved profile data is unreadable or was modified outside this session. Reload before editing. An unreadable record can be discarded only after confirmation.</p>
        <div className="profile-controls">
          <button type="button" className="settings-reset" onClick={() => {
            resetReview(); const result = store.reload();
            feedback(result.ok ? 'Reloaded saved profiles.' : result.error, !result.ok);
          }}>Reload saved profiles</button>
          <button type="button" className="settings-reset" onClick={() => { resetReview(); setPending({ kind: 'discard' }); }}>Review discard unreadable record</button>
        </div>
      </div>}
      <div className="settings-control-row">
        <label htmlFor="intellisense-profile-name">New profile name</label>
        <input id="intellisense-profile-name" type="text" value={name} maxLength={MAX_PROFILE_NAME_UNITS}
          disabled={blocked} onChange={event => { setName(event.target.value); resetReview(); }} />
      </div>
      <button className="settings-reset" type="button" disabled={blocked || !name.trim() || state.profiles.length >= MAX_SAVED_PROFILES}
        onClick={saveNew}>Save current as profile</button>
      <div className="settings-control-row">
        <label htmlFor="intellisense-profile-select">Saved profile</label>
        <select id="intellisense-profile-select" value={selected ? selection : ''} disabled={blocked || !state.profiles.length}
          onChange={event => { setSelection(event.target.value); resetReview(); }}>
          <option value="">Select a saved profile</option>
          {state.profiles.map(profile => <option key={profileIdentity(profile.name)}
            value={profileIdentity(profile.name)}>{profile.name}</option>)}
        </select>
      </div>
      <div className="profile-controls">
        <button type="button" className="settings-reset" disabled={!selected || blocked} onClick={() => {
          if (!selected) return; resetReview();
          setPending({ kind: 'apply', review: reviewIntelliSenseProfile(preferences, selected.preferences), source: selected, origin: selected.name });
        }}>Review and apply</button>
        <button type="button" className="settings-reset" disabled={!selected || blocked} onClick={() => {
          if (!selected) return; resetReview();
          setPending({ kind: 'replace', expected: selected, review: reviewIntelliSenseProfile(selected.preferences, preferences) });
        }}>Review replace with current</button>
        <button type="button" className="settings-reset" disabled={!selected || blocked} onClick={() => {
          if (!selected) return; resetReview(); setPending({ kind: 'delete', expected: selected });
        }}>Review remove profile</button>
      </div>
      <div className="profile-transfer">
        <h3>Portable configuration</h3>
        <p>Transfer IntelliSense settings only. Source text, workspace paths, compiler approval and recovery data are excluded. No files are read or written.</p>
        <div className="profile-controls">
          <button className="settings-reset" type="button" aria-expanded={exportOpen}
            onClick={() => setExportOpen(value => !value)}>Export configuration</button>
          <button className="settings-reset" type="button" aria-expanded={importOpen}
            onClick={() => { setImportOpen(value => !value); resetReview(); }}>Import configuration</button>
        </div>
        {exportOpen && <div className="profile-transfer">
          <label htmlFor="intellisense-profile-export">Current configuration JSON (select and copy)</label>
          <textarea id="intellisense-profile-export" readOnly rows={6} value={exportIntelliSenseProfile(preferences)} />
        </div>}
        {importOpen && <div className="profile-transfer">
          <label htmlFor="intellisense-profile-import">Paste configuration JSON</label>
          <textarea id="intellisense-profile-import" rows={5} maxLength={MAX_PROFILE_TRANSFER_UNITS} value={raw}
            onChange={event => { setRaw(event.target.value.slice(0, MAX_PROFILE_TRANSFER_UNITS)); resetReview(); }} />
          <div className="profile-controls">
            <button className="settings-reset" type="button" onClick={previewImport} disabled={!raw.trim()}>Review import</button>
            <button className="settings-reset" type="button" onClick={() => { setRaw(''); resetReview(); }}>Clear import</button>
          </div>
        </div>}
      </div>
      {pending && <div className="profile-review" role="group" aria-label="Confirm IntelliSense profile action">
        <strong>{pending.kind === 'apply' ? 'Apply ' + pending.origin :
          pending.kind === 'replace' ? 'Replace ' + pending.expected.name :
          pending.kind === 'delete' ? 'Remove ' + pending.expected.name : 'Discard unreadable saved profiles?'}</strong>
        {review && <p>{review.changes.length} preference(s) would change.</p>}
        {review && review.changes.length > 0 && <ul className="profile-diff">
          {review.changes.map(change => <li key={change.key}>{change.label}: {change.before} → {change.after}</li>)}
        </ul>}
        {pending.kind === 'delete' && <p>Only this named profile is removed. Current preferences remain unchanged.</p>}
        {pending.kind === 'discard' && <p>This replaces only an unreadable saved profile record. Current preferences and source files remain unchanged.</p>}
        {(stale || replaceStale || profileStale) && <p role="alert">Configuration changed since review. Cancel and review again.</p>}
        <div className="profile-controls">
          <button className="settings-reset" type="button" disabled={stale || replaceStale || profileStale ||
            (pending.kind !== 'apply' && pending.kind !== 'discard' && blocked)} onClick={confirm}>Confirm {pending.kind}</button>
          <button className="settings-reset" type="button" onClick={resetReview}>Cancel</button>
        </div>
      </div>}
      {notice && <p className={notice.error ? 'profile-error' : 'profile-status'} role={notice.error ? 'alert' : 'status'}>{notice.message}</p>}
    </section>
  );
}
