import { useState, useSyncExternalStore } from 'react';
import { normalizeProfileName, profileIdentity, MAX_PROFILE_NAME_UNITS } from '../model/intelliSenseProfiles';
import { diffStudioPreferences, sameStudioPreferences, type StudioPortablePreferences } from '../model/studioPreferenceTransfer';
import { MAX_STUDIO_PROFILES, studioProfilesStore, type StudioProfileMutation } from '../model/studioSavedProfiles';

interface Props {
  current: StudioPortablePreferences;
  onReview: (snapshot: StudioPortablePreferences) => void;
  store?: typeof studioProfilesStore;
}
type Pending = { revision: number; action: Exclude<StudioProfileMutation, { kind: 'create' }> | { kind: 'discard' } };
export function StudioSavedProfilePanel({ current, onReview, store = studioProfilesStore }: Props) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [rename, setRename] = useState('');
  const [selection, setSelection] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const selected = state.entries.find(entry => profileIdentity(entry.name) === selection);
  const blocked = state.persistence === 'blocked';
  const stale = pending && (pending.revision !== state.revision ||
    (pending.action.kind === 'replace' && !sameStudioPreferences(pending.action.preferences, current)));
  const differences = selected ? diffStudioPreferences(current, selected.preferences).length : 0;
  function clear() { setPending(null); setNotice(null); }
  function feedback(text: string, error = false) { setNotice({ text, error }); }
  function create() {
    clear();
    const result = store.mutate({ kind: 'create', name, preferences: current }, state.revision);
    if (!result.ok) { feedback(result.error, true); return; }
    const normalized = normalizeProfileName(name);
    if (normalized) setSelection(profileIdentity(normalized));
    setName('');
    feedback('Saved current portable Studio configuration.');
  }
  function confirm() {
    if (!pending) return;
    if (stale) { clear(); feedback('Configuration changed. Review again.', true); return; }
    const result = pending.action.kind === 'discard' ? store.discardBlocked(pending.revision)
      : store.mutate(pending.action, pending.revision);
    setPending(null);
    if (!result.ok) { feedback(result.error, true); return; }
    if (pending.action.kind === 'rename') {
      setSelection(profileIdentity(pending.action.name)); setRename('');
    } else if (pending.action.kind === 'remove' || pending.action.kind === 'discard') setSelection('');
    feedback(store.getSnapshot().persistence === 'session-only' ? 'Saved configuration updated for this session.' : 'Saved configuration updated.');
  }
  return <section className="studio-saved-profiles" aria-label="Named Studio configurations">
    <h3>Named Studio configurations</h3>
    <p>Save complete portable configurations separately from IntelliSense-only profiles. Switching a configuration always opens a field-level review.</p>
    <p className="saved-profile-count" role="status">{state.entries.length} / {MAX_STUDIO_PROFILES} saved configurations
      {state.persistence === 'session-only' && ' · Session only'}
      {blocked && ' · Storage blocked'}</p>
    <button className="settings-reset" type="button" aria-expanded={open} aria-controls="studio-saved-configurations"
      onClick={() => { setOpen(value => !value); clear(); }}>{open ? 'Hide named configurations' : 'Manage named configurations'}</button>
    <div id="studio-saved-configurations" hidden={!open}>
      {open && <>
        {blocked && <div className="transfer-warning">
          <p>Storage is unreadable or changed externally. Reload first. Discard is only allowed for an unchanged unreadable record.</p>
          <div className="transfer-actions">
            <button type="button" className="settings-reset" onClick={() => {
              clear(); const result = store.reload(); feedback(result.ok ? 'Reloaded configurations.' : result.error, !result.ok);
            }}>Reload saved configurations</button>
            <button type="button" className="settings-reset" onClick={() => {
              clear(); setPending({ revision: state.revision, action: { kind: 'discard' } });
            }}>Review discard unreadable configurations</button>
          </div>
        </div>}
        <div className="settings-control-row">
          <label htmlFor="studio-profile-name">New configuration name</label>
          <input id="studio-profile-name" type="text" maxLength={MAX_PROFILE_NAME_UNITS}
            value={name} disabled={blocked} onChange={event => { setName(event.target.value); clear(); }} />
        </div>
        <button type="button" className="settings-reset" disabled={blocked || !name.trim() || state.entries.length >= MAX_STUDIO_PROFILES}
          onClick={create}>Save current configuration</button>
        <div className="settings-control-row">
          <label htmlFor="studio-profile-select">Saved configuration</label>
          <select id="studio-profile-select" value={selected ? selection : ''} disabled={blocked || !state.entries.length}
            onChange={event => { setSelection(event.target.value); setRename(''); clear(); }}>
            <option value="">Select a configuration</option>
            {state.entries.map(entry => <option key={profileIdentity(entry.name)} value={profileIdentity(entry.name)}>{entry.name}</option>)}
          </select>
        </div>
        {selected && <dl className="saved-profile-summary">
          <dt>Theme</dt><dd>{selected.preferences.appearance.theme}</dd>
          <dt>Editor font size</dt><dd>{selected.preferences.editor.fontSize} px</dd>
          <dt>Completion mode</dt><dd>{selected.preferences.intelliSense.completionMode}</dd>
          <dt>Differences from current settings</dt><dd>{differences}</dd>
        </dl>}
        <div className="transfer-actions">
          <button type="button" className="settings-reset" disabled={!selected || blocked} onClick={() => {
            if (!selected) return; clear(); onReview(selected.preferences);
          }}>Review configuration switch</button>
          <button type="button" className="settings-reset" disabled={!selected || blocked} onClick={() => {
            if (!selected) return; clear(); setPending({ revision: state.revision,
              action: { kind: 'replace', expected: selected, preferences: current } });
          }}>Review configuration replacement</button>
          <button type="button" className="settings-reset" disabled={!selected || blocked} onClick={() => {
            if (!selected) return; clear(); setPending({ revision: state.revision, action: { kind: 'remove', expected: selected } });
          }}>Review configuration removal</button>
        </div>
        <div className="settings-control-row">
          <label htmlFor="studio-profile-rename">New name for selected configuration</label>
          <input id="studio-profile-rename" type="text" maxLength={MAX_PROFILE_NAME_UNITS}
            value={rename} disabled={!selected || blocked} onChange={event => { setRename(event.target.value); clear(); }} />
        </div>
        <button type="button" className="settings-reset" disabled={!selected || blocked || !rename.trim()} onClick={() => {
          if (!selected) return; clear();
          const normalized = normalizeProfileName(rename);
          if (!normalized) { feedback('Enter a valid new name.', true); return; }
          setPending({ revision: state.revision, action: { kind: 'rename', expected: selected, name: normalized } });
        }}>Review configuration rename</button>
        {pending && <div className="transfer-review" role="group" aria-label="Confirm saved configuration mutation">
          <strong>{pending.action.kind === 'discard' ? 'Discard unreadable configuration record?' :
            pending.action.kind === 'replace' ? 'Replace ' + pending.action.expected.name + ' with current preferences?' :
            pending.action.kind === 'rename' ? 'Rename ' + pending.action.expected.name + ' to ' + pending.action.name + '?' :
            'Remove ' + pending.action.expected.name + '?'}</strong>
          {pending.action.kind === 'replace' && <p>{diffStudioPreferences(pending.action.expected.preferences, pending.action.preferences).length} saved preference(s) would change.</p>}
          <p>Only the named Studio configuration collection will change, not active preferences or source files.</p>
          {stale && <p role="alert">Configuration changed since review.</p>}
          <div className="transfer-actions">
            <button type="button" className="settings-reset" disabled={!!stale || (blocked && pending.action.kind !== 'discard')}
              onClick={confirm}>Confirm configuration action</button>
            <button type="button" className="settings-reset" onClick={clear}>Cancel configuration action</button>
          </div>
        </div>}
        {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
      </>}
    </div>
  </section>;
}
