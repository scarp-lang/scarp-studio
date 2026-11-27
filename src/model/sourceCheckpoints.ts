import type { StudioDocument } from './documents';
import { currentActiveDocument, isUnchangedSnapshot, type EditorState, type BufferReplacement } from './editorState';
import { compareScarpSnapshots, type SourceDiffReport } from './sourceDiff';
import { assertScarpSourceText } from './sourceLimits';
import { assertWellFormedUtf16, utf8ByteLength } from './utf8Text';

export const MAX_SOURCE_CHECKPOINTS = 24;
export const MAX_CHECKPOINTS_PER_TAB = 6;
export const MAX_CHECKPOINT_LABEL_UNITS = 60;
export const MAX_CHECKPOINT_SOURCE_UNITS = 256 * 1024;
export const MAX_CHECKPOINT_TOTAL_BYTES = 2 * 1024 * 1024;
export interface SourceCheckpoint {
  readonly id: number;
  readonly documentId: string;
  readonly documentName: string;
  readonly path: string | null;
  readonly capturedRevision: number;
  readonly label: string;
  readonly capturedAt: number;
  readonly content: string;
  readonly bytes: number;
}
export interface CheckpointState {
  readonly entries: readonly SourceCheckpoint[];
  readonly revision: number;
  readonly bytes: number;
}
export interface CheckpointCaptureReview {
  readonly storeRevision: number;
  readonly sessionRevision: number;
  readonly document: StudioDocument;
  readonly label: string;
  readonly bytes: number;
}
export interface CheckpointRestoreReview {
  readonly storeRevision: number;
  readonly sessionRevision: number;
  readonly checkpointId: number;
  readonly document: StudioDocument;
  readonly change: BufferReplacement;
  readonly report: SourceDiffReport;
}
export interface CheckpointRemovalReview {
  readonly storeRevision: number;
  readonly ids: readonly number[];
  readonly totalBytes: number;
}
type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const failure = (error: string): Result<never> => ({ ok: false, error });
const control = /[\x00-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/;
const belongsTo = (entry: SourceCheckpoint, document: StudioDocument) =>
  entry.documentId === document.id && entry.path === document.path;
const totalBytes = (entries: readonly SourceCheckpoint[]) => entries.reduce((sum, entry) => sum + entry.bytes, 0);

export function normalizedCheckpointLabel(value: string): string | null {
  const label = value.trim();
  if (!label || label.length > MAX_CHECKPOINT_LABEL_UNITS || control.test(value)) return null;
  try { assertWellFormedUtf16(label, 'Checkpoint label'); } catch { return null; }
  return label;
}
export function checkpointsForDocument(state: CheckpointState, document: StudioDocument | null): readonly SourceCheckpoint[] {
  return document ? state.entries.filter(entry => belongsTo(entry, document)) : [];
}
export function checkpointCaptureReview(store: CheckpointState, editor: EditorState, requestedLabel: string):
  Result<CheckpointCaptureReview> {
  const document = currentActiveDocument(editor);
  if (!document) return failure('Open a Scarp buffer before capturing a checkpoint.');
  const label = normalizedCheckpointLabel(requestedLabel);
  if (!label) return failure('Use a nonempty checkpoint label of up to 60 characters, without control codes.');
  if (document.content.length > MAX_CHECKPOINT_SOURCE_UNITS) return failure('Buffer exceeds the checkpoint source limit.');
  try { assertScarpSourceText(document.content); } catch { return failure('Buffer contains unsupported source text.'); }
  const bytes = utf8ByteLength(document.content);
  const existing = checkpointsForDocument(store, document);
  if (existing.some(entry => entry.label.toLowerCase() === label.toLowerCase())) return failure('This tab already has a checkpoint with that label.');
  if (existing.length >= MAX_CHECKPOINTS_PER_TAB) return failure('This tab reached its checkpoint capacity. Remove a checkpoint first.');
  if (store.entries.length >= MAX_SOURCE_CHECKPOINTS) return failure('Session checkpoint capacity reached. Remove a checkpoint first.');
  if (store.bytes + bytes > MAX_CHECKPOINT_TOTAL_BYTES) return failure('Session checkpoint byte limit reached. Remove checkpoints first.');
  return { ok: true, value: Object.freeze({ storeRevision: store.revision, sessionRevision: editor.sessionRevision,
    document: Object.freeze({ ...document }), label, bytes }) };
}
export function checkpointCaptureIsCurrent(review: CheckpointCaptureReview, store: CheckpointState, editor: EditorState): boolean {
  const active = currentActiveDocument(editor);
  if (!active || review.storeRevision !== store.revision || review.sessionRevision !== editor.sessionRevision ||
      !isUnchangedSnapshot(active, review.document)) return false;
  const fresh = checkpointCaptureReview(store, editor, review.label);
  return fresh.ok && fresh.value.label === review.label && fresh.value.bytes === review.bytes;
}
export function checkpointComparison(store: CheckpointState, editor: EditorState, checkpointId: number):
  Result<SourceDiffReport> {
  const entry = store.entries.find(item => item.id === checkpointId);
  const active = currentActiveDocument(editor);
  if (!entry || !active || !belongsTo(entry, active)) return failure('Checkpoint does not belong to the active open tab.');
  // Compare in the direction of the proposed restore: current -> checkpoint.
  return { ok: true, value: compareScarpSnapshots(active.content, entry.content) };
}
export function checkpointRestoreReview(store: CheckpointState, editor: EditorState, checkpointId: number):
  Result<CheckpointRestoreReview> {
  const entry = store.entries.find(item => item.id === checkpointId);
  const active = currentActiveDocument(editor);
  if (!entry || !active || !belongsTo(entry, active)) return failure('Checkpoint does not belong to the active open tab.');
  if (active.content === entry.content) return failure('The active buffer already matches this checkpoint.');
  // Refuse restoration when the UI cannot present the complete bounded diff.
  // The user may copy or inspect the checkpoint text separately instead.
  if (active.content.length > MAX_CHECKPOINT_SOURCE_UNITS) return failure('Current buffer exceeds the checkpoint review source limit.');
  const report = compareScarpSnapshots(active.content, entry.content);
  if (report.status !== 'ready' || report.truncated || report.hunks.some(hunk => hunk.lines.some(line => line.previewTruncated))) {
    return failure('Full restore diff exceeds the review budget. Inspect the checkpoint source and copy needed text manually.');
  }
  const snapshot = Object.freeze({ ...active });
  const change = Object.freeze({ id: active.id, snapshot, content: entry.content });
  return { ok: true, value: Object.freeze({ storeRevision: store.revision, sessionRevision: editor.sessionRevision,
    checkpointId, document: snapshot, change, report }) };
}
export function checkpointRestoreIsCurrent(review: CheckpointRestoreReview, store: CheckpointState, editor: EditorState): boolean {
  const active = currentActiveDocument(editor);
  if (!active || store.revision !== review.storeRevision || editor.sessionRevision !== review.sessionRevision ||
      !isUnchangedSnapshot(active, review.document) || !isUnchangedSnapshot(active, review.change.snapshot) ||
      review.change.id !== active.id) return false;
  const fresh = checkpointRestoreReview(store, editor, review.checkpointId);
  return fresh.ok && fresh.value.change.content === review.change.content;
}
export function reviewCheckpointRemoval(state: CheckpointState, ids: readonly number[]): Result<CheckpointRemovalReview> {
  if (!ids.length || ids.length > MAX_SOURCE_CHECKPOINTS || new Set(ids).size !== ids.length ||
      ids.some(id => !Number.isSafeInteger(id) || id <= 0)) return failure('Choose distinct existing checkpoints.');
  const selected = state.entries.filter(entry => ids.includes(entry.id));
  if (selected.length !== ids.length) return failure('Checkpoint selection changed.');
  return { ok: true, value: Object.freeze({ storeRevision: state.revision,
    ids: Object.freeze(selected.map(entry => entry.id)), totalBytes: totalBytes(selected) }) };
}
export function checkpointRemovalIsCurrent(review: CheckpointRemovalReview, state: CheckpointState): boolean {
  if (review.storeRevision !== state.revision) return false;
  const fresh = reviewCheckpointRemoval(state, review.ids);
  return fresh.ok && fresh.value.totalBytes === review.totalBytes;
}

/** Explicit in-memory snapshots. No storage, network, compiler execution,
 * filesystem calls, automatic capture, hidden eviction or path reopen.
 * Checkpoints survive edits and ordinary saves to the same path; they are
 * retired synchronously on tab closure or path change (including Save As).
 * IDs never repeat during a session.
 */
export function createSourceCheckpointStore() {
  let nextId = 1;
  let state: CheckpointState = Object.freeze({ entries: Object.freeze([]), revision: 0, bytes: 0 });
  const listeners = new Set<() => void>();
  const getSnapshot = () => state;
  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }
  function publish(entries: readonly SourceCheckpoint[]) {
    state = Object.freeze({ entries: Object.freeze([...entries]), revision: state.revision + 1, bytes: totalBytes(entries) });
    for (const listener of [...listeners]) listener();
  }
  function capture(review: CheckpointCaptureReview, editor: EditorState, timestamp: number): Result<SourceCheckpoint> {
    if (!checkpointCaptureIsCurrent(review, state, editor)) return failure('Buffer or checkpoint inventory changed. Review capture again.');
    const document = currentActiveDocument(editor)!;
    const entry = Object.freeze({ id: nextId++, documentId: document.id, documentName: document.name,
      path: document.path, capturedRevision: document.revision, label: review.label,
      capturedAt: Number.isSafeInteger(timestamp) && timestamp >= 0 ? timestamp : 0,
      content: document.content, bytes: review.bytes });
    publish([...state.entries, entry]);
    return { ok: true, value: entry };
  }
  function remove(review: CheckpointRemovalReview): boolean {
    if (!checkpointRemovalIsCurrent(review, state)) return false;
    const ids = new Set(review.ids);
    publish(state.entries.filter(entry => !ids.has(entry.id)));
    return true;
  }
  function reconcile(documents: readonly StudioDocument[]): void {
    const byId = new Map(documents.map(document => [document.id, document]));
    const kept = state.entries.filter(entry => {
      const current = byId.get(entry.documentId);
      return current !== undefined && belongsTo(entry, current);
    });
    if (kept.length !== state.entries.length) publish(kept);
  }
  return { getSnapshot, subscribe, capture, remove, reconcile };
}
