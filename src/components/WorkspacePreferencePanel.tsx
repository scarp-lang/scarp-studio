import { useState, useSyncExternalStore } from 'react';
import { sameFilePath } from '../model/documents';
import { PORTABLE_GROUPS, PORTABLE_GROUP_LABELS, diffStudioPreferences, sameStudioPreferences,
  type StudioPortablePreferences, type PortableGroup } from '../model/studioPreferenceTransfer';
import { workspacePreferenceStore, captureWorkspacePreference, findWorkspacePreference, reviewWorkspacePreference,
  workspacePreferenceReviewIsCurrent, MAX_WORKSPACE_PREFERENCES, type WorkspacePreferenceReview,
  type WorkspacePreferenceEntry } from '../model/workspacePreferences';

interface Props {
  root: string | null;
  current: StudioPortablePreferences;
  onApply: (expected: StudioPortablePreferences, target: StudioPortablePreferences) => boolean;
  store?: typeof workspacePreferenceStore;
}
type Pending =
  | { kind: 'save'; root: string; revision: number; entry: WorkspacePreferenceEntry; expected: WorkspacePreferenceEntry | null; baseline: StudioPortablePreferences }
  | { kind: 'forget'; revision: number; expected: WorkspacePreferenceEntry }
  | { kind: 'discard'; revision: number }
  | { kind: 'apply'; plan: WorkspacePreferenceReview };
export function WorkspacePreferencePanel({ root, current, onApply, store = workspacePreferenceStore }: Props) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<readonly PortableGroup[]>(PORTABLE_GROUPS);
  const [forgetRoot, setForgetRoot] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const existing = findWorkspacePreference(state.entries, root);
  const forgetEntry = findWorkspacePreference(state.entries, forgetRoot);
  const blocked = state.status === 'blocked';
  const stale = !!pending && (pending.kind === 'apply'
    ? !workspacePreferenceReviewIsCurrent(pending.plan, state, root, current)
    : pending.revision !== state.revision || (pending.kind === 'save' &&
      (!root || !sameFilePath(root, pending.root) || !sameStudioPreferences(current, pending.baseline))));
  function feedback(text: string, error = false) { setNotice({ text, error }); }
  function clear() { setPending(null); setNotice(null); }
  function saveReview() {
    clear();
    const result = captureWorkspacePreference(root, current, groups);
    if (!result.ok) { feedback(result.error, true); return; }
    setPending({ kind: 'save', root: result.value.root, revision: state.revision, entry: result.value, expected: existing, baseline: current });
  }
  function applyReview() {
    clear();
    const result = reviewWorkspacePreference(state, root, current);
    if (!result.ok) { feedback(result.error, true); return; }
    setPending({ kind: 'apply', plan: result.value });
  }
  function confirm() {
    if (!pending) return;
    if (stale) { clear(); feedback('Workspace or preferences changed. Review again.', true); return; }
    if (pending.kind === 'apply') {
      if (!store.canApply(pending.plan, root, current) || !onApply(pending.plan.review.baseline, pending.plan.review.target)) {
        clear(); feedback('Workspace or preferences changed. Review again.', true); return;
      }
      clear(); feedback('Applied saved workspace preferences to the active Studio configuration.'); return;
    }
    const result = pending.kind === 'discard' ? store.discardUnreadable(pending.revision) :
      pending.kind === 'forget' ? store.mutate({ kind: 'forget', expected: pending.expected }, pending.revision) :
      store.mutate({ kind: 'remember', entry: pending.entry, expected: pending.expected }, pending.revision);
    setPending(null);
    if (!result.ok) { feedback(result.error, true); return; }
    if (pending.kind !== 'save') setForgetRoot('');
    feedback(store.getSnapshot().status === 'session-only' ? 'Workspace preference metadata updated for this session only.' : 'Workspace preference metadata updated.');
  }
  const changes = pending?.kind === 'apply' ? pending.plan.review.changes : [];
  return <section className="workspace-preferences" aria-label="Workspace preference associations">
    <h3>Workspace preference associations</h3>
    <p>Optionally remember selected preference categories for a native workspace. The local folder path is stored only after explicit save and is not exported. Opening a workspace never automatically changes active settings or reads configuration files.</p>
    <p role="status">{state.entries.length} / {MAX_WORKSPACE_PREFERENCES} saved workspaces
      {state.status === 'session-only' && ' · Session only'}{blocked && ' · Storage blocked'}</p>
    <button type="button" className="settings-reset" aria-expanded={open} aria-controls="workspace-preference-content"
      onClick={() => { setOpen(value => !value); clear(); }}>{open ? 'Hide workspace preferences' : 'Manage workspace preferences'}</button>
    <div id="workspace-preference-content" hidden={!open}>
      {open && <>
        {blocked && <div className="transfer-warning">
          <p>Reload changed or unreadable records first. Explicit discard works only for the reviewed unreadable record.</p>
          <button type="button" className="settings-reset" onClick={() => {
            clear(); const result = store.reload(); feedback(result.ok ? 'Reloaded workspace preferences.' : result.error, !result.ok);
          }}>Reload workspace preferences</button>
          <button type="button" className="settings-reset" onClick={() => {
            clear(); setPending({ kind: 'discard', revision: state.revision });
          }}>Review discard unreadable workspace preferences</button>
        </div>}
        <p>Selected workspace: <span className="workspace-preference-root">{root ?? 'No workspace selected'}</span></p>
        {existing && <p>Saved categories: {existing.groups.map(group => PORTABLE_GROUP_LABELS[group]).join(', ')}.</p>}
        <fieldset className="transfer-groups"><legend>Categories to remember</legend>
          {PORTABLE_GROUPS.map(group => <label key={group}><input type="checkbox" checked={groups.includes(group)}
            disabled={!root || blocked} onChange={event => {
              const checked = event.target.checked;
              setGroups(previous => checked ? [...previous, group] : previous.filter(item => item !== group)); clear();
            }} />{PORTABLE_GROUP_LABELS[group]}</label>)}
        </fieldset>
        <div className="transfer-actions">
          <button type="button" className="settings-reset" disabled={!root || blocked || !groups.length || !existing && state.entries.length >= MAX_WORKSPACE_PREFERENCES}
            onClick={saveReview}>{existing ? 'Review update workspace preferences' : 'Review save workspace preferences'}</button>
          <button type="button" className="settings-reset" disabled={!existing || blocked} onClick={applyReview}>Review apply workspace preferences</button>
        </div>
        <fieldset><legend>Forget a saved association</legend>
          <div className="workspace-preference-records">
            {state.entries.map(entry => <label key={entry.root}><input type="radio" name="workspace-preference-forget"
              checked={forgetRoot === entry.root} disabled={blocked} onChange={() => { setForgetRoot(entry.root); clear(); }} />
              <span>{entry.root} · {entry.groups.length} categories</span></label>)}
          </div>
          <button type="button" className="settings-reset" disabled={!forgetEntry || blocked} onClick={() => {
            if (!forgetEntry) return; clear(); setPending({ kind: 'forget', revision: state.revision, expected: forgetEntry });
          }}>Review forget workspace association</button>
        </fieldset>
        {pending && <div className="transfer-review" role="group" aria-label="Confirm workspace preference action">
          <strong>{pending.kind === 'save' ? (pending.expected ? 'Update' : 'Save') + ' workspace preference association' :
            pending.kind === 'apply' ? 'Apply saved workspace preferences' :
            pending.kind === 'forget' ? 'Forget ' + pending.expected.root : 'Discard unreadable preference record?'}</strong>
          {pending.kind === 'save' && <p>{pending.entry.groups.map(group => PORTABLE_GROUP_LABELS[group]).join(', ')} · {
            pending.expected ? diffStudioPreferences(pending.expected.preferences, pending.entry.preferences).length + ' stored preference difference(s)' : 'New local association'
          }. Only local metadata changes.</p>}
          {pending.kind === 'apply' && <>
            <p>{changes.length} portable preference(s) would change. Settings apply globally for the current Studio session, not as automatic per-project overrides.</p>
            <ul className="transfer-changes">{changes.map(change => <li key={change.group + ':' + change.key}>
              {change.label}: {change.before} → {change.after}</li>)}</ul>
          </>}
          {(pending.kind === 'forget' || pending.kind === 'discard') && <p>This removes only local preference metadata, never files or permissions.</p>}
          {stale && <p role="alert">Workspace, stored association or active preferences changed. Review again.</p>}
          <div className="transfer-actions">
            <button type="button" className="settings-reset" disabled={stale || (pending.kind === 'apply' && !changes.length) ||
              (blocked && pending.kind !== 'discard')} onClick={confirm}>Confirm workspace preference action</button>
            <button type="button" className="settings-reset" onClick={clear}>Cancel workspace review</button>
          </div>
        </div>}
        {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
      </>}
    </div>
  </section>;
}
