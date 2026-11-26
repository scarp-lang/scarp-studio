import { useState, useSyncExternalStore } from 'react';
import { MAX_PREFERENCE_HISTORY_ENTRIES, type createPreferenceHistory, type HistoryRestorePlan } from '../model/preferenceHistory';
import { PORTABLE_GROUPS, PORTABLE_GROUP_LABELS, diffStudioPreferences,
  type StudioPortablePreferences, type PortableGroup } from '../model/studioPreferenceTransfer';
interface Props {
  current: StudioPortablePreferences;
  history: ReturnType<typeof createPreferenceHistory>;
  onApply: (expected: StudioPortablePreferences, target: StudioPortablePreferences) => boolean;
}
export function PreferenceHistoryPanel({ current, history, onApply }: Props) {
  const state = useSyncExternalStore(history.subscribe, history.getSnapshot, history.getSnapshot);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [endpoint, setEndpoint] = useState<'before' | 'after'>('before');
  const [groups, setGroups] = useState<readonly PortableGroup[]>(PORTABLE_GROUPS);
  const [plan, setPlan] = useState<HistoryRestorePlan | null>(null);
  const [clearRevision, setClearRevision] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const selected = state.entries.find(entry => entry.id === selectedId) ?? state.entries.at(-1);
  const stale = !!plan && !history.canRestore(plan, current);
  const comparison = selected ? diffStudioPreferences(current, selected[endpoint]) : [];
  function clearReview() { setPlan(null); setClearRevision(null); setNotice(''); }
  function review() {
    clearReview();
    if (!selected) return;
    const result = history.review(selected.id, endpoint, current, groups);
    if (result.ok) setPlan(result.value);
    else setNotice(result.error);
  }
  function apply() {
    if (!plan || !history.canRestore(plan, current) || !onApply(plan.review.baseline, plan.review.target)) {
      setPlan(null); setNotice('History or preferences changed. Review again.'); return;
    }
    setPlan(null); setNotice('Reviewed historical preferences restored. This change will appear in session history.');
  }
  return <section className="preference-history" aria-label="Preference change history">
    <h3>Preference change history</h3>
    <p>Session-only history of portable preferences, not source edits. Continuous changes to the same field may be combined. It excludes paths, compiler trust, automatic-write enablement and keyboard bindings.</p>
    <p role="status">{state.entries.length} / {MAX_PREFERENCE_HISTORY_ENTRIES} recent changes</p>
    <button type="button" className="settings-reset" aria-expanded={open} aria-controls="preference-history-content"
      onClick={() => { setOpen(value => !value); clearReview(); }}>{open ? 'Hide preference history' : 'Browse preference history'}</button>
    <div id="preference-history-content" hidden={!open}>
      {open && <>
        {!state.entries.length ? <p>No portable preferences changed in this Studio session.</p> : <>
          <div className="history-entries" aria-label="Recent preference changes">
            {[...state.entries].reverse().map(entry => <button type="button" className="settings-reset" key={entry.id}
              aria-pressed={selected?.id === entry.id} onClick={() => { setSelectedId(entry.id); clearReview(); }}>
              <strong>{entry.changes.length === 1 ? entry.changes[0].label : entry.changes.length + ' preference changes'}</strong>
              <small>{entry.changes.map(change => change.label).slice(0, 3).join(', ')} · {new Date(entry.recordedAt).toLocaleTimeString()}</small>
            </button>)}
          </div>
          {selected && <div className="history-detail">
            <strong>Recorded change</strong>
            <ul className="transfer-changes">{selected.changes.map(change => <li key={change.group + ':' + change.key}>
              {change.label}: {change.before} → {change.after}
            </li>)}</ul>
            <label htmlFor="history-endpoint">Compare with current settings</label>
            <select id="history-endpoint" value={endpoint} onChange={event => {
              if (event.target.value === 'before' || event.target.value === 'after') { setEndpoint(event.target.value); clearReview(); }
            }}><option value="before">Before this change</option><option value="after">After this change</option></select>
            <p>{comparison.length} portable preference difference(s) from current settings.</p>
            <fieldset className="transfer-groups"><legend>Categories to restore</legend>
              {PORTABLE_GROUPS.map(group => <label key={group}><input type="checkbox" checked={groups.includes(group)}
                onChange={event => {
                  const checked = event.target.checked;
                  setGroups(previous => checked ? [...previous, group] : previous.filter(item => item !== group)); clearReview();
                }} />{PORTABLE_GROUP_LABELS[group]}</label>)}
            </fieldset>
            <button type="button" className="settings-reset" disabled={!groups.length} onClick={review}>Review historical restore</button>
          </div>}
          <button type="button" className="settings-reset" onClick={() => { clearReview(); setClearRevision(state.revision); }}>Review clear session history</button>
        </>}
        {plan && <div className="transfer-review" role="group" aria-label="Confirm historical preference restore">
          <strong>{plan.review.changes.length} preference(s) would change</strong>
          <ul className="transfer-changes">{plan.review.changes.map(change => <li key={change.group + ':' + change.key}>
            {PORTABLE_GROUP_LABELS[change.group]} · {change.label}: {change.before} → {change.after}</li>)}</ul>
          {stale && <p role="alert">History or active preferences changed. Review again.</p>}
          <button type="button" className="settings-reset" disabled={stale || !plan.review.changes.length} onClick={apply}>Confirm historical restore</button>
          <button type="button" className="settings-reset" onClick={clearReview}>Cancel historical review</button>
        </div>}
        {clearRevision !== null && <div className="transfer-review" role="group" aria-label="Confirm clear preference history">
          <p>Clear only the session history? Active preferences and saved configurations stay unchanged.</p>
          <button type="button" className="settings-reset" disabled={clearRevision !== state.revision} onClick={() => {
            const success = history.clear(clearRevision, current); clearReview(); setSelectedId(null);
            setNotice(success ? 'Session history cleared.' : 'History changed. Review again.');
          }}>Confirm clear history</button>
          <button type="button" className="settings-reset" onClick={clearReview}>Cancel clear history</button>
        </div>}
        {notice && <p role="status">{notice}</p>}
      </>}
    </div>
  </section>;
}
