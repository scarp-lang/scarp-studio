import { useState } from 'react';
import { exportShortcutBindings, parseShortcutTransfer, reviewShortcutTransfer, serializeShortcuts, shortcutLabel,
  SHORTCUT_GROUPS, MAX_SHORTCUT_STORAGE_UNITS, type ShortcutBindings, type ShortcutGroup, type ShortcutTransferReview } from '../model/studioShortcuts';
import type { ProfileResult } from '../model/intelliSenseProfileTransfer';

interface Props {
  bindings: ShortcutBindings;
  revision: number;
  onApply: (review: ShortcutTransferReview) => ProfileResult<true>;
}
interface Undo { readonly before: ShortcutBindings; readonly after: string; readonly expectedRevision: number }
export function ShortcutTransferPanel({ bindings, revision, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [raw, setRaw] = useState('');
  const [groups, setGroups] = useState<ShortcutGroup[]>([...SHORTCUT_GROUPS]);
  const [review, setReview] = useState<ShortcutTransferReview | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  const stale = !!review && (review.revision !== revision || review.baseline !== serializeShortcuts(bindings));
  const canUndo = !!undo && revision === undo.expectedRevision && serializeShortcuts(bindings) === undo.after;
  function clearReview() { setReview(null); setUndoing(false); setNotice(null); }
  function feedback(message: string, error = false) { setNotice({ message, error }); }
  function reviewImport() {
    clearReview();
    const parsed = parseShortcutTransfer(raw);
    if (!parsed.ok) { feedback(parsed.error, true); return; }
    const next = reviewShortcutTransfer(bindings, parsed.value, groups, revision);
    if (!next.ok) { feedback(next.error, true); return; }
    setReview(next.value);
  }
  function reviewUndo() {
    clearReview();
    if (!undo || !canUndo) { feedback('Shortcuts changed after the import. Undo is no longer available.', true); return; }
    const next = reviewShortcutTransfer(bindings, undo.before, SHORTCUT_GROUPS, revision);
    if (!next.ok) { feedback(next.error, true); return; }
    setUndoing(true); setReview(next.value);
  }
  function apply() {
    if (!review || stale) return;
    const before = bindings;
    const result = onApply(review);
    if (!result.ok) { clearReview(); feedback(result.error, true); return; }
    if (undoing) setUndo(null);
    else setUndo({ before, after: serializeShortcuts(review.target), expectedRevision: revision + 1 });
    feedback(undoing ? 'Previous shortcut bindings restored.' : 'Reviewed shortcut backup applied.');
    setUndoing(false); setReview(null);
  }
  return <section className="shortcut-transfer-panel" id="studio-shortcut-transfer" tabIndex={-1} aria-label="Keyboard shortcut backup and restore">
    <h3>Keyboard shortcut backup and restore</h3>
    <p>Transfer only Studio command bindings. This separate backup never changes source files, compiler permissions or other preferences.</p>
    <button type="button" className="settings-reset" aria-expanded={open} aria-controls="shortcut-transfer-content" onClick={() => {
      setOpen(value => !value); clearReview();
    }}>{open ? 'Hide shortcut transfer' : 'Manage shortcut backup'}</button>
    <div id="shortcut-transfer-content" hidden={!open}>
      {open && <>
        <div className="transfer-actions">
          <button type="button" className="settings-reset" aria-expanded={exportOpen} onClick={() => setExportOpen(value => !value)}>Export shortcuts</button>
          {undo && <button type="button" className="settings-reset" disabled={!canUndo} onClick={reviewUndo}>Review undo shortcut import</button>}
        </div>
        {undo && !canUndo && <p>Undo is unavailable after another shortcut change.</p>}
        {exportOpen && <div>
          <label htmlFor="studio-shortcut-export">Shortcut backup JSON</label>
          <textarea id="studio-shortcut-export" readOnly rows={8} value={exportShortcutBindings(bindings)} />
        </div>}
        <label htmlFor="studio-shortcut-import">Paste shortcut backup</label>
        <textarea id="studio-shortcut-import" rows={8} maxLength={MAX_SHORTCUT_STORAGE_UNITS} value={raw}
          onChange={event => { setRaw(event.target.value); clearReview(); }}
          onPaste={event => {
            const input = event.currentTarget;
            if (raw.length - (input.selectionEnd - input.selectionStart) + event.clipboardData.getData('text/plain').length > MAX_SHORTCUT_STORAGE_UNITS) {
              event.preventDefault(); clearReview(); feedback('Shortcut backup is too large.', true);
            }
          }} />
        <fieldset>
          <legend>Command groups to restore</legend>
          <div className="shortcut-transfer-groups">{SHORTCUT_GROUPS.map(group => <label key={group}>
            <input type="checkbox" checked={groups.includes(group)} onChange={event => {
              setGroups(previous => event.target.checked ? [...previous, group] : previous.filter(item => item !== group));
              clearReview();
            }} /> {group}
          </label>)}</div>
          <div className="transfer-actions">
            <button type="button" className="settings-reset" onClick={() => { setGroups([...SHORTCUT_GROUPS]); clearReview(); }}>All groups</button>
            <button type="button" className="settings-reset" onClick={() => { setGroups([]); clearReview(); }}>No groups</button>
          </div>
        </fieldset>
        <button type="button" className="settings-reset" disabled={!raw.trim() || !groups.length} onClick={reviewImport}>Review shortcut import</button>
        {review && <div className="transfer-review" role="group" aria-label="Confirm shortcut transfer">
          <strong>{review.changes.length} binding changes · {review.groups.join(', ')}</strong>
          <p>Fixed Settings and Stop bindings remain unchanged. Conflicting assignments are rejected before confirmation.</p>
          {review.changes.length > 0 && <ul className="shortcut-transfer-changes">{review.changes.map(change =>
            <li key={change.id}>{change.label}: <code>{shortcutLabel(change.before)}</code> → <code>{shortcutLabel(change.after)}</code></li>)}</ul>}
          {stale && <p role="alert">Shortcuts changed since the review. Review again.</p>}
          <button type="button" className="settings-reset" disabled={stale || !review.changes.length} onClick={apply}>
            {undoing ? 'Confirm shortcut undo' : 'Confirm shortcut import'}
          </button>
          <button type="button" className="settings-reset" onClick={clearReview}>Cancel shortcut transfer review</button>
        </div>}
        {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.message}</p>}
      </>}
    </div>
  </section>;
}
