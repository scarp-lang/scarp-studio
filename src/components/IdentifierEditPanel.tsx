import { useState } from 'react';
import type { EditorState } from '../model/editorState';
import { identifierEditActiveName, identifierInventoryIsCurrent, planIdentifierEdit, scanIdentifierEdit,
  MAX_IDENTIFIER_EDIT_FILES, MAX_IDENTIFIER_EDIT_SITES, type IdentifierEditInventory, type IdentifierEditPlan,
  type IdentifierEditScope } from '../model/identifierEdit';

interface Props {
  editor: EditorState;
  busy: boolean;
  undoAvailable: boolean;
  onApply: (plan: IdentifierEditPlan) => boolean;
  onUndo: () => void;
  initiallyExpanded?: boolean;
}
const PAGE = 12;
export function IdentifierEditPanel({ editor, busy, undoAvailable, onApply, onUndo, initiallyExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [scope, setScope] = useState<IdentifierEditScope>('active');
  const [inventory, setInventory] = useState<IdentifierEditInventory | null>(null);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [page, setPage] = useState(1);
  const [plan, setPlan] = useState<IdentifierEditPlan | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [notice, setNotice] = useState('');
  const stale = inventory !== null && !identifierInventoryIsCurrent(inventory, editor);
  const pages = Math.max(1, Math.ceil((inventory?.sites.length ?? 0) / PAGE));
  const visiblePage = Math.min(page, pages);
  function reset() {
    setInventory(null); setSelected([]); setPlan(null); setAcknowledged(false); setPage(1); setNotice('');
  }
  function scan() {
    reset();
    const result = scanIdentifierEdit(editor, { from, to, scope });
    if (result.ok) setInventory(result.value); else setNotice(result.error);
  }
  function updateSelection(next: readonly string[]) {
    setSelected(next); setPlan(null); setAcknowledged(false); setNotice('');
  }
  return <section className="sidebar-section identifier-edit" aria-label="Reviewed literal identifier edit">
    <div className="sidebar-heading">IDENTIFIER EDIT</div>
    <button type="button" className="insights-toggle" aria-expanded={expanded} aria-controls="identifier-edit-body"
      onClick={() => { setExpanded(value => !value); reset(); }}>
      <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
      <span>{expanded ? 'Hide identifier edit' : 'Review identifier replacements'}</span>
    </button>
    <div id="identifier-edit-body" hidden={!expanded}>
      {expanded && <div className="insights-body">
        <p className="insights-disclaimer">Literal case-sensitive code token replacement, not semantic Rename Symbol.
          Scope, shadowing, imports, types and binding identity are not resolved. Strings and line comments are excluded.</p>
        <label>Existing identifier<input aria-label="Existing code identifier" value={from} maxLength={128}
          onChange={event => { setFrom(event.target.value); reset(); }}/></label>
        <label>Replacement identifier<input aria-label="Replacement code identifier" value={to} maxLength={128}
          onChange={event => { setTo(event.target.value); reset(); }}/></label>
        <select aria-label="Identifier replacement scope" value={scope} onChange={event => {
          const value = event.target.value;
          if (value === 'active' || value === 'open') { setScope(value); reset(); }
        }}><option value="active">Active buffer: {identifierEditActiveName(editor)}</option>
          <option value="open">All open buffers</option></select>
        <p>Maximum {MAX_IDENTIFIER_EDIT_FILES} buffers and {MAX_IDENTIFIER_EDIT_SITES} sites. Incomplete scans cannot be applied.</p>
        <button type="button" disabled={busy || !editor.activeId} onClick={scan}>Scan identifier sites</button>
        {inventory && <>
          <p role="status">{inventory.sites.length} literal site(s) in {inventory.scannedFiles} scanned buffer(s). {selected.length} selected.</p>
          {inventory.collisions.length > 0 && <div className="transfer-review">
            <strong>Replacement spelling already exists</strong>
            <p>This is a collision hint, not a binding check. Review existing names and possible shadowing.</p>
            <ul>{inventory.collisions.map(item => <li key={item.documentId}>{item.documentName}: {item.count} existing occurrence(s)</li>)}</ul>
          </div>}
          {stale && <p role="alert">Editor session changed. Scan again before selecting or applying.</p>}
          <div className="identifier-actions">
            <button type="button" disabled={busy || stale || !!plan} onClick={() => updateSelection(inventory.sites.map(site => site.id))}>Select all reviewed sites</button>
            <button type="button" disabled={busy || stale || !!plan} onClick={() => updateSelection([])}>Clear site selection</button>
          </div>
          <div className="identifier-site-list">{inventory.sites.slice((visiblePage - 1) * PAGE, visiblePage * PAGE).map(site =>
            <label key={site.id} className="identifier-site">
              <span><input type="checkbox" checked={selected.includes(site.id)} disabled={busy || stale || !!plan} onChange={event =>
                updateSelection(event.target.checked ? [...selected, site.id] : selected.filter(id => id !== site.id))}/>
                {site.documentName}:{site.line}:{site.column} · {site.role}</span>
              <code dir="auto"><span>Before: </span>{site.omittedPrefix ? '…' : ''}{JSON.stringify(site.before)}{site.omittedSuffix ? '…' : ''}</code>
              <code dir="auto"><span>After: </span>{site.omittedPrefix ? '…' : ''}{JSON.stringify(site.after)}{site.omittedSuffix ? '…' : ''}</code>
            </label>)}</div>
          {pages > 1 && <div className="insights-pages">
            <button type="button" disabled={visiblePage === 1} onClick={() => setPage(visiblePage - 1)}>Previous sites</button>
            <span>{visiblePage}/{pages}</span>
            <button type="button" disabled={visiblePage === pages} onClick={() => setPage(visiblePage + 1)}>Next sites</button>
          </div>}
          <button type="button" disabled={busy || stale || !selected.length || !!plan} onClick={() => {
            const result = planIdentifierEdit(inventory, selected, editor);
            if (result.ok) { setPlan(result.value); setAcknowledged(false); }
            else setNotice(result.error);
          }}>Review selected identifier edits</button>
        </>}
        {plan && <div className="transfer-review" role="group" aria-label="Confirm identifier edits">
          <p>Replace {plan.selectedIds.length} selected code tokens in {plan.changes.length} buffer(s).
            Unselected tokens, comments, strings and other source text remain unchanged.</p>
          <label><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)}/>
            I reviewed the selected literal sites and understand that binding identity and compiler validity are not checked.</label>
          <button type="button" disabled={busy || stale || !acknowledged} onClick={() => {
            const success = onApply(plan); reset();
            setNotice(success ? 'Identifier edits applied in memory. Review, Undo or Save manually.' : 'Identifier review rejected. Scan again.');
          }}>Confirm identifier edits</button>
          <button type="button" onClick={() => { setPlan(null); setAcknowledged(false); }}>Cancel identifier review</button>
        </div>}
        <button type="button" disabled={busy || !undoAvailable} onClick={onUndo}>Undo last identifier edits</button>
        {notice && <p role="status">{notice}</p>}
      </div>}
    </div>
  </section>;
}
