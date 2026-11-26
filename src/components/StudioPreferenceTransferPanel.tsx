import { useState } from 'react';
import { WorkspacePreferencePanel } from './WorkspacePreferencePanel';
import { StudioSavedProfilePanel } from './StudioSavedProfilePanel';
import {
  MAX_STUDIO_TRANSFER_UNITS, PORTABLE_GROUPS, PORTABLE_GROUP_LABELS, exportStudioPreferences,
  importStudioPreferences, reviewStudioPreferences, studioReviewIsCurrent, reviewStudioUndo,
  sameStudioPreferences, type StudioPortablePreferences, type PortableGroup, type StudioTransferReview,
} from '../model/studioPreferenceTransfer';

interface Props {
  current: StudioPortablePreferences;
  workspaceRoot?: string | null;
  onApply: (expected: StudioPortablePreferences, target: StudioPortablePreferences) => boolean;
}
interface Pending { kind: 'import' | 'undo'; review: StudioTransferReview }
export function StudioPreferenceTransferPanel({ current, onApply, workspaceRoot = null }: Props) {
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [raw, setRaw] = useState('');
  const [groups, setGroups] = useState<readonly PortableGroup[]>(PORTABLE_GROUPS);
  const [pending, setPending] = useState<Pending | null>(null);
  const [lastApplied, setLastApplied] = useState<StudioTransferReview | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const stale = !!pending && !studioReviewIsCurrent(pending.review, current);
  const undoAvailable = !!lastApplied && sameStudioPreferences(lastApplied.target, current);
  function clearReview() { setPending(null); setMessage(null); }
  function feedback(text: string, error = false) { setMessage({ text, error }); }
  function reviewImport() {
    clearReview();
    const imported = importStudioPreferences(raw);
    if (!imported.ok) { feedback(imported.error, true); return; }
    setPending({ kind: 'import', review: reviewStudioPreferences(current, imported.value, groups) });
  }
  function undo() {
    clearReview();
    if (!lastApplied) return;
    const result = reviewStudioUndo(lastApplied, current);
    if (!result.ok) { feedback(result.error, true); return; }
    setPending({ kind: 'undo', review: result.value });
  }
  function confirm() {
    if (!pending || !pending.review.changes.length) return;
    if (!studioReviewIsCurrent(pending.review, current) ||
        !onApply(pending.review.baseline, pending.review.target)) {
      setPending(null); feedback('Preferences changed since review. Review again.', true); return;
    }
    setLastApplied(pending.kind === 'import' ? pending.review : null);
    feedback(pending.kind === 'import' ? 'Reviewed portable preferences applied.' : 'Previous portable preferences restored.');
    setPending(null);
  }
  return <section className="studio-transfer" aria-label="Studio preference transfer">
    <p>Export and restore display, editor, IntelliSense, workspace dimensions and Auto Save timing. This excludes automatic-write enablement, startup discovery, compiler trust, source files, workspace paths, recovery copies and named profiles.</p>
    <WorkspacePreferencePanel root={workspaceRoot} current={current} onApply={onApply} />
    <StudioSavedProfilePanel current={current} onReview={snapshot => {
      setImportOpen(false); clearReview();
      setPending({ kind: 'import', review: reviewStudioPreferences(current, snapshot, PORTABLE_GROUPS) });
    }} />
    <div className="transfer-actions">
      <button type="button" className="settings-reset" aria-expanded={exportOpen} aria-controls="studio-transfer-export-content"
        onClick={() => setExportOpen(value => !value)}>Export Studio preferences</button>
      <button type="button" className="settings-reset" aria-expanded={importOpen} aria-controls="studio-transfer-import-content"
        onClick={() => { setImportOpen(value => !value); clearReview(); }}>Import Studio preferences</button>
      {lastApplied && <button type="button" className="settings-reset" disabled={!undoAvailable} onClick={undo}>Review undo last import</button>}
    </div>
    {lastApplied && !undoAvailable && <p>Undo is unavailable because portable preferences changed after the last import.</p>}
    <div id="studio-transfer-export-content" hidden={!exportOpen}>
      {exportOpen && <>
        <label htmlFor="studio-transfer-export">Portable configuration JSON (select and copy)</label>
        <textarea id="studio-transfer-export" readOnly rows={8} value={exportStudioPreferences(current)} />
      </>}
    </div>
    <div id="studio-transfer-import-content" hidden={!importOpen}>
      {importOpen && <>
        <label htmlFor="studio-transfer-import">Paste Studio configuration JSON</label>
        <textarea id="studio-transfer-import" rows={7} maxLength={MAX_STUDIO_TRANSFER_UNITS} value={raw}
          onPaste={event => {
            const element = event.currentTarget;
            const length = raw.length - (element.selectionEnd - element.selectionStart) + event.clipboardData.getData('text/plain').length;
            if (length > MAX_STUDIO_TRANSFER_UNITS) {
              event.preventDefault(); clearReview(); feedback('Configuration is too large; paste rejected.', true);
            }
          }} onChange={event => {
            clearReview();
            if (event.target.value.length > MAX_STUDIO_TRANSFER_UNITS) { feedback('Configuration is too large.', true); return; }
            setRaw(event.target.value);
          }} />
        <fieldset className="transfer-groups">
          <legend>Categories to restore</legend>
          {PORTABLE_GROUPS.map(group => <label key={group}>
            <input type="checkbox" checked={groups.includes(group)} onChange={event => {
              setGroups(previous => event.target.checked ? [...previous, group] : previous.filter(item => item !== group));
              clearReview();
            }} />{PORTABLE_GROUP_LABELS[group]}
          </label>)}
        </fieldset>
        <div className="transfer-actions">
          <button type="button" className="settings-reset" onClick={() => { setGroups(PORTABLE_GROUPS); clearReview(); }}>Select all categories</button>
          <button type="button" className="settings-reset" onClick={() => { setGroups([]); clearReview(); }}>Select none</button>
          <button type="button" className="settings-reset" disabled={!raw.trim() || !groups.length} onClick={reviewImport}>Review Studio import</button>
          <button type="button" className="settings-reset" onClick={() => { setRaw(''); clearReview(); }}>Clear Studio import</button>
        </div>
      </>}
    </div>
    {pending && <div className="transfer-review" role="group" aria-label="Confirm Studio preference changes">
      <strong>{pending.kind === 'import' ? 'Review import' : 'Review undo'} · {pending.review.changes.length} change(s)</strong>
      {pending.review.changes.length > 0 ? <ul className="transfer-changes">
        {pending.review.changes.map(change => <li key={change.group + ':' + change.key}>
          <strong>{PORTABLE_GROUP_LABELS[change.group]} · {change.label}</strong>
          <div className="transfer-value">{change.before} → {change.after}</div>
        </li>)}
      </ul> : <p>No selected preference would change.</p>}
      <p>Only these portable settings will change. Existing Auto Save enablement, compiler approval and source data remain unchanged. Settings storage follows the existing local persistence behavior.</p>
      {stale && <p className="transfer-warning" role="alert">Current preferences changed since review. Cancel and review again.</p>}
      <div className="transfer-actions">
        <button type="button" className="settings-reset" disabled={stale || !pending.review.changes.length}
          onClick={confirm}>{pending.kind === 'import' ? 'Confirm Studio import' : 'Confirm Studio undo'}</button>
        <button type="button" className="settings-reset" onClick={clearReview}>Cancel Studio review</button>
      </div>
    </div>}
    {message && <p className={message.error ? 'transfer-warning' : undefined} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
  </section>;
}
