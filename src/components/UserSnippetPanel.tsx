import { useMemo, useState, useSyncExternalStore } from 'react';
import { compileSnippet, MAX_SNIPPET_BODY_UNITS } from '../model/snippetTemplate';
import { userSnippetStore, searchUserSnippets, validateUserSnippet, exportSnippets, reviewSnippetImport,
  snippetIdentity, MAX_USER_SNIPPETS, MAX_SNIPPET_PREFIX_UNITS, MAX_SNIPPET_NAME_UNITS,
  MAX_SNIPPET_DESCRIPTION_UNITS, MAX_SNIPPET_STORAGE_UNITS, type UserSnippet,
  type SnippetMutation, type SnippetImportReview } from '../model/userSnippets';

interface Props { available: boolean; store?: typeof userSnippetStore }
const blank = (): UserSnippet => ({ prefix: '', name: '', description: '', body: '', enabled: true });
type Review =
  | { kind: 'mutation'; revision: number; mutation: SnippetMutation }
  | { kind: 'import'; revision: number; review: SnippetImportReview }
  | { kind: 'discard'; revision: number };
export function UserSnippetPanel({ available, store = userSnippetStore }: Props) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [enabledOnly, setEnabledOnly] = useState(false);
  const [draft, setDraft] = useState<UserSnippet>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftRevision, setDraftRevision] = useState<number | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [raw, setRaw] = useState('');
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  const blocked = snapshot.persistence === 'blocked';
  const results = useMemo(() => searchUserSnippets(snapshot.items, query, enabledOnly), [snapshot.items, query, enabledOnly]);
  const compiled = useMemo(() => compileSnippet(draft.body), [draft.body]);
  const valid = useMemo(() => validateUserSnippet(draft), [draft]);
  const stale = !!review && review.revision !== snapshot.revision;
  const staleDraft = editing !== null && draftRevision !== snapshot.revision;
  function clearReview() { setReview(null); setNotice(null); }
  function update(patch: Partial<UserSnippet>) { setDraft(previous => ({ ...previous, ...patch })); clearReview(); }
  function resetDraft() { setDraft(blank()); setEditing(null); setDraftRevision(null); clearReview(); }
  function beginEdit(item: UserSnippet) {
    setDraft({ prefix: item.prefix, name: item.name, description: item.description, body: item.body, enabled: item.enabled });
    setEditing(item.prefix); setDraftRevision(snapshot.revision); clearReview();
  }
  function feedback(message: string, error = false) { setNotice({ message, error }); }
  function reviewSave() {
    clearReview();
    if (!valid.ok) { feedback(valid.error, true); return; }
    if (staleDraft) { feedback('Snippet changed while editing. Reopen the saved snippet.', true); return; }
    const item: UserSnippet = { ...draft, body: valid.value.body };
    const collision = snapshot.items.find(entry => snippetIdentity(entry.prefix) === snippetIdentity(item.prefix) &&
      (editing === null || snippetIdentity(entry.prefix) !== snippetIdentity(editing)));
    if (collision) { feedback('This prefix already belongs to a saved snippet.', true); return; }
    setReview({ kind: 'mutation', revision: snapshot.revision, mutation: editing === null ?
      { kind: 'create', item } : { kind: 'replace', prefix: editing, item } });
  }
  function reviewImport() {
    clearReview();
    const plan = reviewSnippetImport(snapshot.items, raw);
    if (!plan.ok) { feedback(plan.error, true); return; }
    setReview({ kind: 'import', revision: snapshot.revision, review: plan.value });
  }
  function confirm() {
    if (!review) return;
    const result = review.kind === 'mutation' ? store.mutate(review.mutation, review.revision) :
      review.kind === 'import' ? store.applyImport(review.review, review.revision) : store.discardUnreadable(review.revision);
    if (!result.ok) { setReview(null); feedback(result.error, true); return; }
    resetDraft();
    feedback(review.kind === 'import' ? 'Reviewed snippets added.' : review.kind === 'discard' ? 'Unreadable snippet data discarded.' : 'Snippet library updated.');
  }
  return <section className="intellisense-section user-snippet-panel" id="studio-user-snippets" tabIndex={-1} aria-label="User Scarp snippets">
    <h3>User Scarp snippets</h3>
    <p>Save reusable text templates for explicit insertion through completion. Snippets are local and separate from preference profiles; they never run or modify files on their own. The command palette can also insert their expanded default text at a single selection; use completion for interactive tab stops.</p>
    <p role="status">{snapshot.items.length} / {MAX_USER_SNIPPETS} snippets · {snapshot.items.filter(item => item.enabled).length} enabled</p>
    {!available && <p>Snippet suggestions are currently disabled by IntelliSense settings. The library remains editable.</p>}
    {snapshot.persistence === 'session-only' && <p>Changes apply in this session; persistent storage is unavailable.</p>}
    <button type="button" className="settings-reset" aria-expanded={open} aria-controls="user-snippet-content" onClick={() => {
      setOpen(value => !value); clearReview();
    }}>{open ? 'Hide snippet library' : 'Manage snippet library'}</button>
    <div id="user-snippet-content" hidden={!open}>
      {open && <>
        {blocked && <div className="transfer-review">
          <p role="alert">Saved snippet data could not be read. It is not overwritten automatically.</p>
          <button type="button" className="settings-reset" onClick={() => {
            const result = store.reload(); clearReview();
            feedback(result.ok ? 'Snippet storage reloaded.' : result.error, !result.ok);
          }}>Reload snippet storage</button>
          <button type="button" className="settings-reset" onClick={() => {
            clearReview(); setReview({ kind: 'discard', revision: snapshot.revision });
          }}>Review discard unreadable snippets</button>
        </div>}
        <div className="snippet-search-row">
          <label htmlFor="user-snippet-search">Find snippets</label>
          <input id="user-snippet-search" type="search" maxLength={120} value={query} onChange={event => setQuery(event.target.value)} />
          <label><input type="checkbox" checked={enabledOnly} onChange={event => setEnabledOnly(event.target.checked)} /> Enabled only</label>
          <button type="button" className="settings-reset" onClick={resetDraft} disabled={blocked}>New snippet</button>
        </div>
        {results.length ? <div className="snippet-list" aria-label="Saved snippets">
          {results.map(item => <article key={item.prefix} className="snippet-list-row">
            <div><strong>{item.name}</strong> · <code>{item.prefix}</code> · {item.enabled ? 'Enabled' : 'Disabled'}
              {item.description && <p>{item.description}</p>}</div>
            <div className="transfer-actions">
              <button type="button" className="settings-reset" disabled={blocked} onClick={() => beginEdit(item)}>Edit {item.prefix}</button>
              <button type="button" className="settings-reset" disabled={blocked} onClick={() => {
                clearReview(); setReview({ kind: 'mutation', revision: snapshot.revision, mutation: { kind: 'delete', prefix: item.prefix } });
              }}>Review remove {item.prefix}</button>
            </div>
          </article>)}
        </div> : <p>No saved snippets match the filters.</p>}
        <fieldset className="snippet-editor" disabled={blocked}>
          <legend>{editing ? 'Edit ' + editing : 'New snippet'}</legend>
          <label htmlFor="user-snippet-prefix">Completion prefix</label>
          <input id="user-snippet-prefix" value={draft.prefix} maxLength={MAX_SNIPPET_PREFIX_UNITS} onChange={event => update({ prefix: event.target.value })} />
          <label htmlFor="user-snippet-name">Name</label>
          <input id="user-snippet-name" value={draft.name} maxLength={MAX_SNIPPET_NAME_UNITS} onChange={event => update({ name: event.target.value })} />
          <label htmlFor="user-snippet-description">Description (optional)</label>
          <input id="user-snippet-description" value={draft.description} maxLength={MAX_SNIPPET_DESCRIPTION_UNITS} onChange={event => update({ description: event.target.value })} />
          <label htmlFor="user-snippet-body">Scarp template</label>
          <textarea id="user-snippet-body" rows={7} maxLength={MAX_SNIPPET_BODY_UNITS} spellCheck={false} value={draft.body} onChange={event => update({ body: event.target.value })} />
          <p>Use <code>{'{{1:name}}'}</code> to define an editable stop, <code>{'{{1}}'}</code> to repeat it and <code>{'{{0}}'}</code> for the final caret. Number stops from 1. Other text remains literal.</p>
          <label><input type="checkbox" checked={draft.enabled} onChange={event => update({ enabled: event.target.checked })} /> Enable in completion</label>
          {draft.body && (compiled.ok ? <div className="snippet-preview"><strong>Insertion preview</strong>
            <pre>{compiled.value.preview}</pre>
            <p>{compiled.value.stops.length} caret or placeholder occurrences. This is a preview, not compiler verification.</p>
          </div> : <p role="alert">{compiled.error}</p>)}
          {!valid.ok && (draft.prefix || draft.name || draft.body) && <p>{valid.error}</p>}
          {staleDraft && <p role="alert">The library changed after editing began. Reopen this snippet.</p>}
          <button type="button" className="settings-reset" disabled={!valid.ok || staleDraft || (!editing && snapshot.items.length >= MAX_USER_SNIPPETS)} onClick={reviewSave}>Review save snippet</button>
          <button type="button" className="settings-reset" onClick={resetDraft}>Clear snippet editor</button>
        </fieldset>
        <div className="transfer-actions">
          <button type="button" className="settings-reset" aria-expanded={exportOpen} onClick={() => setExportOpen(value => !value)}>Export snippet library</button>
          <button type="button" className="settings-reset" aria-expanded={importOpen} onClick={() => { setImportOpen(value => !value); clearReview(); }}>Import snippets</button>
        </div>
        {exportOpen && <div>
          <label htmlFor="user-snippet-export">Snippet JSON (includes template text)</label>
          <textarea id="user-snippet-export" rows={7} readOnly value={exportSnippets(snapshot.items)} />
          <p>Review the text before sharing. Do not include secrets in snippets.</p>
        </div>}
        {importOpen && <div>
          <label htmlFor="user-snippet-import">Paste snippet collection JSON</label>
          <textarea id="user-snippet-import" rows={7} maxLength={MAX_SNIPPET_STORAGE_UNITS} value={raw} onChange={event => { setRaw(event.target.value); clearReview(); }}
            onPaste={event => {
              const input = event.currentTarget;
              if (raw.length - (input.selectionEnd - input.selectionStart) + event.clipboardData.getData('text/plain').length > MAX_SNIPPET_STORAGE_UNITS) {
                event.preventDefault(); clearReview(); feedback('Snippet collection is too large.', true);
              }
            }} />
          <button type="button" className="settings-reset" disabled={blocked || !raw.trim()} onClick={reviewImport}>Review snippet import</button>
        </div>}
        {review && <div className="transfer-review" role="group" aria-label="Confirm snippet library changes">
          {review.kind === 'mutation' && <><strong>{review.mutation.kind === 'delete' ? 'Remove ' + review.mutation.prefix : 'Save ' + review.mutation.item.prefix}</strong>
            {review.mutation.kind !== 'delete' && <pre>{review.mutation.item.body}</pre>}</>}
          {review.kind === 'import' && <>
            <strong>{review.review.additions.length} additions · {review.review.conflicts.length} conflicts · {review.review.unchanged.length} unchanged</strong>
            <p>Only new prefixes are added. Existing snippets are kept.</p>
            {review.review.additions.length > 0 && <p>Add: {review.review.additions.join(', ')}</p>}
            {review.review.conflicts.length > 0 && <p>Keep existing: {review.review.conflicts.join(', ')}</p>}
          </>}
          {review.kind === 'discard' && <p>Discard only the unreadable local snippet collection? Source files and preferences remain unchanged.</p>}
          {stale && <p role="alert">Snippet library changed. Review again.</p>}
          <button type="button" className="settings-reset" disabled={stale || (review.kind === 'import' && !review.review.additions.length)} onClick={confirm}>Confirm snippet action</button>
          <button type="button" className="settings-reset" onClick={clearReview}>Cancel snippet review</button>
        </div>}
        {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.message}</p>}
      </>}
    </div>
  </section>;
}
