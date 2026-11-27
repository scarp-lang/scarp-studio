import { describe, expect, it } from 'vitest';
import { createUntitled, type StudioDocument } from './documents';
import { editorReducer, initialEditorState, type EditorState } from './editorState';
import { AutoSaveReviewGate } from './autoSaveReviewGate';
import { createOpenFileReplaceUndo, canUndoOpenFileReplace } from './openFileReplaceUndo';
import { createSourceCheckpointStore, checkpointCaptureReview, checkpointCaptureIsCurrent, checkpointComparison,
  checkpointRestoreReview, checkpointRestoreIsCurrent, checkpointsForDocument, normalizedCheckpointLabel,
  reviewCheckpointRemoval, checkpointRemovalIsCurrent, MAX_CHECKPOINTS_PER_TAB, MAX_SOURCE_CHECKPOINTS,
  MAX_CHECKPOINT_SOURCE_UNITS, MAX_CHECKPOINT_TOTAL_BYTES, type CheckpointState } from './sourceCheckpoints';

const doc = (content: string, id = 'a', path: string | null = null): StudioDocument => ({
  ...createUntitled(1), id, name: id + '.srp', path, content, savedContent: content, revision: 1,
});
const state = (documents: StudioDocument[], activeId = documents[0]?.id ?? null): EditorState =>
  ({ ...initialEditorState, documents, activeId, sessionRevision: 1 });
const newStore = createSourceCheckpointStore;
function capture(store: ReturnType<typeof newStore>, editor: EditorState, label = 'First', time = 100) {
  const review = checkpointCaptureReview(store.getSnapshot(), editor, label);
  if (!review.ok) throw Error(review.error);
  const captured = store.capture(review.value, editor, time);
  if (!captured.ok) throw Error(captured.error);
  return captured.value;
}
function restore(store: ReturnType<typeof newStore>, editor: EditorState, id: number) {
  const review = checkpointRestoreReview(store.getSnapshot(), editor, id);
  if (!review.ok) throw Error(review.error);
  return review.value;
}
describe('explicit source checkpoint capture', () => {
  it('stores exact source text, label, UTF-8 byte size and tab identity in an immutable record', () => {
    const editor = state([doc('print("नमस्ते 😀");\r\n', 'a', 'C:\\practice\\a.srp')]);
    const store = newStore();
    const item = capture(store, editor, ' Before changes ');
    expect(item).toMatchObject({ id: 1, documentId: 'a', path: editor.documents[0].path,
      label: 'Before changes', content: editor.documents[0].content, capturedAt: 100, capturedRevision: 1 });
    expect(item.bytes).toBe(new TextEncoder().encode(item.content).length);
    expect(store.getSnapshot().bytes).toBe(item.bytes);
    expect(Object.isFrozen(item)).toBe(true);
    expect(Object.isFrozen(store.getSnapshot().entries)).toBe(true);
  });
  it('accepts explicit empty snapshots, including untitled sources', () => {
    const editor = state([doc('')]);
    const store = newStore();
    expect(capture(store, editor).content).toBe('');
    expect(store.getSnapshot().bytes).toBe(0);
    expect(checkpointsForDocument(store.getSnapshot(), editor.documents[0])).toHaveLength(1);
  });
  it.each(['', '   ', 'a'.repeat(61), 'line\nbreak', '\tlabel', 'a\u202eb', '\ud800'])(
    'rejects unsafe or empty checkpoint labels (%j)', value => {
      expect(normalizedCheckpointLabel(value)).toBeNull();
      expect(checkpointCaptureReview(newStore().getSnapshot(), state([doc('a')]), value).ok).toBe(false);
    });
  it('accepts bounded Unicode labels and trims ordinary spaces', () => {
    expect(normalizedCheckpointLabel('  पहला मसौदा 😀  ')).toBe('पहला मसौदा 😀');
  });
  it('does not capture when there is no active open tab', () => {
    expect(checkpointCaptureReview(newStore().getSnapshot(), state([], null), 'first').ok).toBe(false);
  });
  it('rejects source beyond the unit budget or with malformed UTF-16', () => {
    for (const source of ['x'.repeat(MAX_CHECKPOINT_SOURCE_UNITS + 1), '\ud800']) {
      expect(checkpointCaptureReview(newStore().getSnapshot(), state([doc(source)]), 'first').ok).toBe(false);
    }
  });
  it('allows equal labels in different tabs but rejects a case-folded duplicate within the same tab', () => {
    const store = newStore();
    const editor = state([doc('a', 'a'), doc('b', 'b')]);
    capture(store, editor, 'First');
    expect(checkpointCaptureReview(store.getSnapshot(), editor, ' first ').ok).toBe(false);
    const other = editorReducer(editor, { type: 'activate', id: 'b' });
    expect(capture(store, other, 'FIRST').documentId).toBe('b');
  });
  it('enforces per-tab capacity without silent eviction', () => {
    const store = newStore();
    const editor = state([doc('a')]);
    for (let i = 0; i < MAX_CHECKPOINTS_PER_TAB; i++) capture(store, editor, 'copy ' + i);
    expect(checkpointCaptureReview(store.getSnapshot(), editor, 'overflow').ok).toBe(false);
    expect(store.getSnapshot().entries).toHaveLength(MAX_CHECKPOINTS_PER_TAB);
    expect(store.getSnapshot().entries[0].label).toBe('copy 0');
  });
  it('enforces session count across multiple open tabs', () => {
    const store = newStore();
    const documents = Array.from({ length: MAX_SOURCE_CHECKPOINTS + 1 }, (_, i) => doc('', String(i)));
    for (let i = 0; i < MAX_SOURCE_CHECKPOINTS; i++) capture(store, state(documents, String(i)));
    expect(checkpointCaptureReview(store.getSnapshot(), state(documents, String(MAX_SOURCE_CHECKPOINTS)), 'overflow').ok).toBe(false);
    expect(store.getSnapshot().entries).toHaveLength(MAX_SOURCE_CHECKPOINTS);
  });
  it('enforces aggregate UTF-8 byte capacity independently from the count limit', () => {
    const store = newStore();
    const source = 'क'.repeat(MAX_CHECKPOINT_SOURCE_UNITS);
    const editor = state([doc(source, 'a'), doc(source, 'b'), doc(source, 'c')]);
    capture(store, editor);
    capture(store, state(editor.documents, 'b'));
    expect(store.getSnapshot().bytes).toBe(2 * MAX_CHECKPOINT_SOURCE_UNITS * 3);
    expect(store.getSnapshot().bytes).toBeLessThan(MAX_CHECKPOINT_TOTAL_BYTES);
    expect(checkpointCaptureReview(store.getSnapshot(), state(editor.documents, 'c'), 'third').ok).toBe(false);
  });
  it('rejects stale capture after editing, focus ABA, other tab changes or store changes', () => {
    const store = newStore();
    const editor = state([doc('a', 'a'), doc('b', 'b')]);
    const result = checkpointCaptureReview(store.getSnapshot(), editor, 'first');
    if (!result.ok) throw Error(result.error);
    expect(checkpointCaptureIsCurrent(result.value, store.getSnapshot(), editor)).toBe(true);
    const focused = editorReducer(editor, { type: 'activate', id: 'b' });
    const back = editorReducer(focused, { type: 'activate', id: 'a' });
    const edited = editorReducer(editor, { type: 'edit', id: 'b', content: 'changed' });
    for (const changed of [focused, back, edited]) expect(store.capture(result.value, changed, 0).ok).toBe(false);
    capture(store, editor, 'different');
    expect(store.capture(result.value, editor, 0).ok).toBe(false);
    expect(store.getSnapshot().entries).toHaveLength(1);
  });
  it('rejects fabricated byte counts and noncanonical labels', () => {
    const store = newStore();
    const editor = state([doc('a')]);
    const result = checkpointCaptureReview(store.getSnapshot(), editor, 'label');
    if (!result.ok) throw Error(result.error);
    expect(store.capture({ ...result.value, bytes: 0 }, editor, 0).ok).toBe(false);
    expect(store.capture({ ...result.value, label: ' label ' }, editor, 0).ok).toBe(false);
  });
});
describe('checkpoint lifecycle', () => {
  it('survives editing and ordinary saving to the exact same path', () => {
    const store = newStore();
    const editor = state([doc('original', 'a', 'C:\\practice\\a.srp')]);
    const item = capture(store, editor);
    const edited = editorReducer(editor, { type: 'edit', id: 'a', content: 'new text' });
    store.reconcile(edited.documents);
    const saved = editorReducer(edited, { type: 'saved', id: 'a', path: editor.documents[0].path!, savedContent: 'new text' });
    store.reconcile(saved.documents);
    expect(store.getSnapshot().entries).toEqual([item]);
    expect(checkpointsForDocument(store.getSnapshot(), saved.documents[0])[0].content).toBe('original');
  });
  it('retires checkpoint copies on Save As or tab closure without retaining a hidden backup', () => {
    const store = newStore();
    const editor = state([doc('a', 'a'), doc('b', 'b')]);
    capture(store, editor);
    capture(store, state(editor.documents, 'b'));
    const saved = editorReducer(editor, { type: 'saved', id: 'a', path: 'C:\\temp\\a.srp', savedContent: 'a' });
    store.reconcile(saved.documents);
    expect(store.getSnapshot().entries.map(item => item.documentId)).toEqual(['b']);
    const closed = editorReducer(saved, { type: 'close', id: 'b', snapshot: saved.documents[1] });
    store.reconcile(closed.documents);
    expect(store.getSnapshot().entries).toEqual([]);
    expect(store.getSnapshot().bytes).toBe(0);
  });
  it('does not reuse a closed tab checkpoint when an identical path is reopened', () => {
    const store = newStore();
    const editor = editorReducer(state([], null), { type: 'open', path: 'C:\\temp\\a.srp', content: 'same' });
    const item = capture(store, editor);
    const closed = editorReducer(editor, { type: 'close', id: editor.activeId!, snapshot: editor.documents[0] });
    store.reconcile(closed.documents);
    const reopened = editorReducer(closed, { type: 'open', path: 'C:\\temp\\a.srp', content: 'same' });
    store.reconcile(reopened.documents);
    expect(checkpointComparison(store.getSnapshot(), reopened, item.id).ok).toBe(false);
    expect(capture(store, reopened).id).toBeGreaterThan(item.id);
  });
  it('publishes only genuine mutations and unsubscribes cleanly', () => {
    const store = newStore();
    const editor = state([doc('a')]);
    let calls = 0;
    const off = store.subscribe(() => calls++);
    capture(store, editor);
    store.reconcile(editor.documents);
    expect(calls).toBe(1);
    store.reconcile([]);
    expect(calls).toBe(2);
    off();
    capture(store, editor);
    expect(calls).toBe(2);
  });
});
describe('reviewed checkpoint restoration', () => {
  it('compares in restore direction and changes only the current source buffer', () => {
    const store = newStore();
    const editor = state([doc('first\n', 'a'), doc('untouched\n', 'b')]);
    const item = capture(store, editor);
    const edited = editorReducer(editor, { type: 'edit', id: 'a', content: 'second\nthird\n' });
    const review = restore(store, edited, item.id);
    expect(review.report).toMatchObject({ status: 'ready', addedLines: 1, removedLines: 2 });
    expect(review.change.content).toBe('first\n');
    expect(checkpointRestoreIsCurrent(review, store.getSnapshot(), edited)).toBe(true);
    const applied = editorReducer(edited, { type: 'replace-open-files', allSnapshots: edited.documents, changes: [review.change] });
    expect(applied.documents[0].content).toBe('first\n');
    expect(applied.documents[1]).toBe(edited.documents[1]);
    expect(applied.documents[0].savedContent).toBe(edited.documents[0].savedContent);
  });
  it('refuses restoring an identical buffer and a different tab checkpoint', () => {
    const store = newStore();
    const editor = state([doc('a','a'), doc('b','b')]);
    const item = capture(store, editor);
    expect(checkpointRestoreReview(store.getSnapshot(), editor, item.id).ok).toBe(false);
    expect(checkpointRestoreReview(store.getSnapshot(), state(editor.documents, 'b'), item.id).ok).toBe(false);
    expect(checkpointComparison(store.getSnapshot(), editor, item.id)).toMatchObject({ ok: true, value: { status: 'clean' } });
  });
  it('refuses limited and truncated diff previews rather than overwriting unseen text', () => {
    const store = newStore();
    const editor = state([doc('a'.repeat(300))]);
    const item = capture(store, editor);
    const edited = editorReducer(editor, { type: 'edit', id: 'a', content: 'b'.repeat(300) });
    expect(checkpointRestoreReview(store.getSnapshot(), edited, item.id).ok).toBe(false);
    const store2 = newStore();
    const many = state([doc('a\n'.repeat(1000))]);
    const manyItem = capture(store2, many);
    const changed = editorReducer(many, { type: 'edit', id: 'a', content: 'b\n'.repeat(1000) });
    expect(checkpointRestoreReview(store2.getSnapshot(), changed, manyItem.id).ok).toBe(false);
  });
  it('rejects a modified restore target, stale session and removed checkpoint', () => {
    const store = newStore();
    const editor = state([doc('before')]);
    const item = capture(store, editor);
    const edited = editorReducer(editor, { type: 'edit', id: 'a', content: 'after' });
    const review = restore(store, edited, item.id);
    expect(checkpointRestoreIsCurrent({ ...review, change: { ...review.change, content: 'fabricated' } }, store.getSnapshot(), edited)).toBe(false);
    const aba = editorReducer(editorReducer(edited, { type: 'edit', id: 'a', content: 'other' }),
      { type: 'edit', id: 'a', content: 'after' });
    expect(checkpointRestoreIsCurrent(review, store.getSnapshot(), aba)).toBe(false);
    const remove = reviewCheckpointRemoval(store.getSnapshot(), [item.id]);
    if (!remove.ok) throw Error(remove.error);
    store.remove(remove.value);
    expect(checkpointRestoreIsCurrent(review, store.getSnapshot(), edited)).toBe(false);
  });
  it('keeps restored dirty snapshots out of Auto Save and supports exact undo', () => {
    const store = newStore();
    const editor = state([doc('original', 'a', 'C:\\temp\\a.srp')]);
    const modified = editorReducer(editor, { type: 'edit', id: 'a', content: 'checkpoint text' });
    const item = capture(store, modified);
    const edited = editorReducer(modified, { type: 'edit', id: 'a', content: 'latest text' });
    const review = restore(store, edited, item.id);
    const applied = editorReducer(edited, { type: 'replace-open-files', changes: [review.change], allSnapshots: edited.documents });
    const gate = new AutoSaveReviewGate();
    gate.holdReplacements(applied.documents, ['a']);
    expect(gate.canWrite(applied.documents[0], applied.documents[0], true)).toBe(false);
    const undo = createOpenFileReplaceUndo(edited.documents, applied.documents)!;
    expect(canUndoOpenFileReplace(undo, applied)).toBe(true);
    const undone = editorReducer(applied, { type: 'replace-open-files', changes: undo.changes, allSnapshots: undo.after });
    gate.holdReplacements(undone.documents, ['a']);
    expect(undone.documents[0].content).toBe('latest text');
    expect(gate.canWrite(undone.documents[0], undone.documents[0], true)).toBe(false);
    expect(canUndoOpenFileReplace(undo, undone)).toBe(false);
  });
});
describe('explicit checkpoint removal', () => {
  it('rejects missing and repeated checkpoint IDs and forged byte totals', () => {
    const store = newStore();
    const item = capture(store, state([doc('a')]));
    for (const ids of [[], [0], [999], [item.id,item.id]]) expect(reviewCheckpointRemoval(store.getSnapshot(), ids).ok).toBe(false);
    const result = reviewCheckpointRemoval(store.getSnapshot(), [item.id]);
    if (!result.ok) throw Error(result.error);
    expect(checkpointRemovalIsCurrent({ ...result.value, totalBytes: 0 }, store.getSnapshot())).toBe(false);
  });
  it('removes only reviewed checkpoint IDs and recalculates aggregate bytes', () => {
    const store = newStore();
    const editor = state([doc('abc')]);
    const first = capture(store, editor);
    const second = capture(store, editor, 'second');
    const review = reviewCheckpointRemoval(store.getSnapshot(), [first.id]);
    if (!review.ok) throw Error(review.error);
    expect(store.remove(review.value)).toBe(true);
    expect(store.getSnapshot().entries).toEqual([second]);
    expect(store.getSnapshot().bytes).toBe(3);
    expect(store.remove(review.value)).toBe(false);
    expect(editor.documents[0].content).toBe('abc');
  });
  it('invalidates clear-all confirmation when the inventory changes', () => {
    const store = newStore();
    const editor = state([doc('abc')]);
    const first = capture(store, editor);
    const review = reviewCheckpointRemoval(store.getSnapshot(), [first.id]);
    if (!review.ok) throw Error(review.error);
    capture(store, editor, 'new copy');
    expect(store.remove(review.value)).toBe(false);
    expect(store.getSnapshot().entries).toHaveLength(2);
  });
});
