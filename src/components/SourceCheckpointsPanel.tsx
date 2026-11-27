import { useMemo, useState, useSyncExternalStore } from 'react';
import { currentActiveDocument, type EditorState } from '../model/editorState';
import {
  checkpointCaptureReview, checkpointCaptureIsCurrent, checkpointComparison, checkpointRestoreReview,
  checkpointRestoreIsCurrent, checkpointsForDocument, reviewCheckpointRemoval, checkpointRemovalIsCurrent,
  MAX_CHECKPOINT_LABEL_UNITS, MAX_CHECKPOINTS_PER_TAB, MAX_SOURCE_CHECKPOINTS, MAX_CHECKPOINT_TOTAL_BYTES,
  type createSourceCheckpointStore, type CheckpointCaptureReview, type CheckpointRestoreReview, type CheckpointRemovalReview,
} from '../model/sourceCheckpoints';
import { splitSnapshotLines, type SourceDiffReport } from '../model/sourceDiff';

interface Props {
  editor: EditorState;
  store: ReturnType<typeof createSourceCheckpointStore>;
  busy: boolean;
  undoAvailable: boolean;
  onCapture: (review: CheckpointCaptureReview) => boolean;
  onRestore: (review: CheckpointRestoreReview) => boolean;
  onRemove: (review: CheckpointRemovalReview) => boolean;
  onUndo: () => void;
  initiallyExpanded?: boolean;
}
function CheckpointDiff({ report, showContext, before, after }: { report: SourceDiffReport; showContext: boolean; before: string; after: string }) {
  if (report.status === 'clean') return <p role="status">The current buffer matches the checkpoint exactly.</p>;
  if (report.status === 'limited') return <p role="status">{report.message}</p>;
  const beforeLines = splitSnapshotLines(before), afterLines = splitSnapshotLines(after);
  const endingLabel = (ending: string | undefined) => ending === '\r\n' ? 'CRLF' : ending === '\r' ? 'CR' : ending === '\n' ? 'LF' : 'EOF';
  return <div className="checkpoint-diff">
    <p role="status">+{report.addedLines} / −{report.removedLines} lines on restore · {report.hunkCount} change group(s)</p>
    {report.message && <p role="status">{report.message}</p>}
    {report.hunks.map(hunk => <section key={hunk.id} className="changes-hunk" aria-label={'Restore change group ' + hunk.id}>
      <div className="changes-hunk-header">−{hunk.beforeStart},{hunk.beforeCount} +{hunk.afterStart},{hunk.afterCount}</div>
      <div className="changes-hunk-lines">
        {hunk.lines.filter(line => showContext || line.kind !== 'context').map((line, index) =>
          <div className={'changes-line changes-line-' + line.kind} key={index}>
            <span className="changes-line-marker" aria-hidden="true">{line.kind === 'added' ? '+' : line.kind === 'removed' ? '−' : '·'}</span>
            <span className="changes-line-number">{line.kind === 'removed' ? line.beforeLine : line.afterLine}</span>
            <code>{line.preview}{line.previewTruncated ? '…' : ''} <small className="checkpoint-eol">[{endingLabel(line.kind === 'removed' ? beforeLines[(line.beforeLine ?? 1) - 1]?.ending : afterLines[(line.afterLine ?? 1) - 1]?.ending)}]</small></code>
          </div>)}
      </div>
    </section>)}
  </div>;
}
export function SourceCheckpointsPanel({ editor, store, busy, undoAvailable, onCapture, onRestore, onRemove, onUndo,
  initiallyExpanded = false }: Props) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [label, setLabel] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [capture, setCapture] = useState<CheckpointCaptureReview | null>(null);
  const [restore, setRestore] = useState<CheckpointRestoreReview | null>(null);
  const [removal, setRemoval] = useState<CheckpointRemovalReview | null>(null);
  const [notice, setNotice] = useState('');
  const [showSource, setShowSource] = useState(false);
  const [showContext, setShowContext] = useState(true);
  const active = currentActiveDocument(editor);
  const entries = checkpointsForDocument(state, active);
  const selected = entries.find(entry => entry.id === selectedId) ?? null;
  const report = useMemo(() => expanded && selected ? checkpointComparison(state, editor, selected.id) : null,
    [expanded, selected, editor, state]);
  const captureStale = capture !== null && !checkpointCaptureIsCurrent(capture, state, editor);
  const restoreStale = restore !== null && !checkpointRestoreIsCurrent(restore, state, editor);
  const removalStale = removal !== null && !checkpointRemovalIsCurrent(removal, state);
  function clearReviews() { setCapture(null); setRestore(null); setRemoval(null); setNotice(''); }
  function prepareCapture() {
    clearReviews();
    const result = checkpointCaptureReview(state, editor, label);
    if (result.ok) setCapture(result.value); else setNotice(result.error);
  }
  function prepareRestore() {
    clearReviews();
    if (!selected) return;
    const result = checkpointRestoreReview(state, editor, selected.id);
    if (result.ok) setRestore(result.value); else setNotice(result.error);
  }
  function prepareRemoval(ids: readonly number[]) {
    clearReviews();
    const result = reviewCheckpointRemoval(state, ids);
    if (result.ok) setRemoval(result.value); else setNotice(result.error);
  }
  return <section className="sidebar-section source-checkpoints" aria-label="Session source checkpoints">
    <div className="sidebar-heading">SOURCE CHECKPOINTS</div>
    <button type="button" className="insights-toggle" aria-expanded={expanded} aria-controls="source-checkpoint-body"
      onClick={() => { setExpanded(value => !value); clearReviews(); setShowSource(false); }}>
      <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
      <span>{expanded ? 'Hide source checkpoints' : 'Manage source checkpoints'}</span>
    </button>
    <div id="source-checkpoint-body" hidden={!expanded}>
      {expanded && <div className="insights-body">
        <p className="insights-disclaimer">Explicit, session-only copies of editor text. Not saved files, Git history or restart recovery. Closing a tab, changing its path or exiting Studio discards its checkpoints.</p>
        <p role="status">{entries.length}/{MAX_CHECKPOINTS_PER_TAB} for this tab · {state.entries.length}/{MAX_SOURCE_CHECKPOINTS} in session · {state.bytes}/{MAX_CHECKPOINT_TOTAL_BYTES} UTF-8 bytes</p>
        {!active ? <p className="sidebar-note">Open a Scarp buffer to capture or inspect checkpoints.</p> : <>
          <label>Checkpoint label
            <input aria-label="Checkpoint label" value={label} maxLength={MAX_CHECKPOINT_LABEL_UNITS}
              placeholder="Before refactoring" onChange={event => { setLabel(event.target.value); clearReviews(); }} />
          </label>
          <button type="button" disabled={busy || !label.trim()} onClick={prepareCapture}>Review checkpoint capture</button>
          {entries.length > 0 && <div className="checkpoint-list" aria-label="Active tab checkpoints">
            {[...entries].reverse().map(entry => <button type="button" key={entry.id} className="insights-task"
              aria-pressed={selected?.id === entry.id} onClick={() => {
                setSelectedId(entry.id); setShowSource(false); clearReviews();
              }}>
              <strong>{entry.label}</strong>
              <span>{entry.bytes} bytes · {new Date(entry.capturedAt).toLocaleTimeString()}</span>
            </button>)}
          </div>}
          {selected && <div className="checkpoint-detail">
            <strong>{selected.label}</strong>
            <p>Compare current text with this checkpoint. Added and removed lines describe the proposed restoration.</p>
            <label><input type="checkbox" checked={showContext} onChange={event => setShowContext(event.target.checked)}/> Show unchanged context</label>
            {report?.ok && <CheckpointDiff report={report.value} showContext={showContext} before={active.content} after={selected.content} />}
            {report && !report.ok && <p role="status">{report.error}</p>}
            <button type="button" aria-expanded={showSource} onClick={() => setShowSource(value => !value)}>
              {showSource ? 'Hide checkpoint source' : 'Inspect checkpoint source'}
            </button>
            {showSource && <label>Read-only checkpoint source (may contain private text)
              <textarea aria-label="Checkpoint source text" rows={8} readOnly value={selected.content} />
            </label>}
            <button type="button" disabled={busy || active.content === selected.content} onClick={prepareRestore}>Review checkpoint restore</button>
            <button type="button" disabled={busy} onClick={() => prepareRemoval([selected.id])}>Review checkpoint removal</button>
          </div>}
        </>}
        {capture && <div className="transfer-review" role="group" aria-label="Confirm checkpoint capture">
          <strong>{capture.label}</strong>
          <p>Copy {capture.bytes} UTF-8 bytes from {capture.document.name} into session memory only.</p>
          {captureStale && <p role="alert">Editor or checkpoint inventory changed. Review capture again.</p>}
          <button type="button" disabled={busy || captureStale} onClick={() => {
            const success = onCapture(capture);
            clearReviews();
            if (success) setLabel('');
            setNotice(success ? 'Checkpoint captured for this session.' : 'Checkpoint capture rejected; review again.');
          }}>Confirm checkpoint capture</button>
          <button type="button" onClick={clearReviews}>Cancel checkpoint capture</button>
        </div>}
        {restore && <div className="transfer-review" role="group" aria-label="Confirm checkpoint restore">
          <strong>Restore exact checkpoint text to {restore.document.name}?</strong>
          <p>{restore.report.hunkCount} reviewed change group(s). No disk write; the restored buffer is held from Auto Save until manual save or further editing.</p>
          {restoreStale && <p role="alert">Editor or checkpoint inventory changed. Review restore again.</p>}
          <button type="button" disabled={busy || restoreStale} onClick={() => {
            const success = onRestore(restore); clearReviews();
            setNotice(success ? 'Checkpoint restored to the editor buffer. Undo or save manually.' : 'Restore rejected; review again.');
          }}>Confirm checkpoint restore</button>
          <button type="button" onClick={clearReviews}>Cancel checkpoint restore</button>
        </div>}
        {state.entries.length > 0 && <button type="button" disabled={busy}
          onClick={() => prepareRemoval(state.entries.map(entry => entry.id))}>Review removal of all session checkpoints</button>}
        {removal && <div className="transfer-review" role="group" aria-label="Confirm checkpoint removal">
          <p>Remove {removal.ids.length} checkpoint(s), freeing {removal.totalBytes} bytes? Open source buffers and saved files remain unchanged.</p>
          {removalStale && <p role="alert">Checkpoint inventory changed. Review removal again.</p>}
          <button type="button" disabled={busy || removalStale} onClick={() => {
            const success = onRemove(removal); clearReviews(); setSelectedId(null); setShowSource(false);
            setNotice(success ? 'Reviewed checkpoint(s) removed.' : 'Checkpoint inventory changed; review again.');
          }}>Confirm checkpoint removal</button>
          <button type="button" onClick={clearReviews}>Cancel checkpoint removal</button>
        </div>}
        <button type="button" disabled={busy || !undoAvailable} onClick={onUndo}>Undo last checkpoint restore</button>
        {notice && <p role="status">{notice}</p>}
      </div>}
    </div>
  </section>;
}
