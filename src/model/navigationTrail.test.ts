import { describe, expect, it } from 'vitest';
import { createUntitled, openedDocument } from './documents';
import { editorReducer, initialEditorState } from './editorState';
import { captureTrailLocation, createNavigationTrailStore, MAX_TRAIL_ENTRIES, MAX_TRAIL_SOURCE_UNITS,
  resolveTrailTarget, reviewTrailMove, reviewTrailSelection, trailEntryStatus, trailMoveTarget } from './navigationTrail';

const doc = (sequence = 1, content = 'first\nsecond\nthird', revision = 0) =>
  ({ ...createUntitled(sequence), content, revision });
const point = (document = doc(), line = 1, column = 1) => captureTrailLocation(document, line, column, 'insight')!;

describe('navigation trail coordinates', () => {
  it('accepts UTF-16 positions and CR/LF/CRLF with trailing empty line', () => {
    const source = doc(1, '😀\r\nx\ry\n');
    expect(captureTrailLocation(source, 1, 3, 'line')).toMatchObject({ line: 1, column: 3 });
    expect(captureTrailLocation(source, 2, 2, 'line')).not.toBeNull();
    expect(captureTrailLocation(source, 3, 2, 'line')).not.toBeNull();
    expect(captureTrailLocation(source, 4, 1, 'line')).not.toBeNull();
    expect(captureTrailLocation(source, 4, 2, 'line')).toBeNull();
  });
  it.each([[0, 1], [1, 0], [-1, 2], [1.5, 1], [1, Infinity], [4, 1], [1, 7]])('rejects invalid coordinate %j', (line, column) => {
    expect(captureTrailLocation(doc(), line, column, 'marked')).toBeNull();
  });
  it('rejects oversized sources without constructing a retained copy', () => {
    expect(captureTrailLocation(doc(1, 'a'.repeat(MAX_TRAIL_SOURCE_UNITS + 1)), 1, 1, 'marked')).toBeNull();
  });
  it('accepts empty buffers and end-of-line positions', () => {
    expect(captureTrailLocation(doc(1, ''), 1, 1, 'marked')).not.toBeNull();
    expect(captureTrailLocation(doc(), 1, 6, 'marked')).not.toBeNull();
  });
  it('does not resolve changed or closed sources', () => {
    const source = doc();
    const location = point(source, 2);
    expect(trailEntryStatus(location, [])).toBe('closed');
    expect(trailEntryStatus(location, [doc(1, source.content, 1)])).toBe('changed');
    expect(resolveTrailTarget(location, [doc(1, source.content, 1)])).toBeNull();
    expect(resolveTrailTarget(location, [source])).toMatchObject({ source: source.content, line: 2 });
  });
  it('revalidates the coordinate even when a malformed caller supplies the revision', () => {
    expect(resolveTrailTarget({ ...point(), line: 99 }, [doc()])).toBeNull();
    expect(resolveTrailTarget({ ...point(), column: -1 }, [doc()])).toBeNull();
  });
  it('does not store source text or arbitrary properties', () => {
    const source = doc(1, 'private source content');
    const store = createNavigationTrailStore();
    expect(store.record(null, { ...point(source), source: source.content } as ReturnType<typeof point>, [source])).toBe(true);
    expect(JSON.stringify(store.getSnapshot())).not.toContain(source.content);
    expect(Object.isFrozen(store.getSnapshot().entries[0])).toBe(true);
  });
});

describe('navigation trail transitions', () => {
  it('starts empty, then records the origin and requested destination', () => {
    const store = createNavigationTrailStore();
    const source = doc();
    expect(store.getSnapshot()).toEqual({ entries: [], index: -1, revision: 0 });
    expect(store.record(point(source), point(source, 2), [source])).toBe(true);
    expect(store.getSnapshot().entries.map(item => item.line)).toEqual([1, 2]);
    expect(store.getSnapshot().index).toBe(1);
  });
  it('deduplicates adjacent locations and does not grow when marking the same cursor', () => {
    const store = createNavigationTrailStore(), source = doc();
    store.record(null, point(source), [source]);
    const before = store.getSnapshot();
    expect(store.record(point(source), point(source), [source])).toBe(false);
    expect(store.getSnapshot()).toBe(before);
    store.record(point(source), point(source, 2), [source]);
    expect(store.getSnapshot().entries.map(item => item.line)).toEqual([1, 2]);
  });
  it('navigates back and forward across two open documents without recording replay', () => {
    const a = doc(), b = doc(2), documents = [a, b];
    const store = createNavigationTrailStore();
    store.record(point(a, 2), point(b, 3), documents);
    const back = reviewTrailMove(store.getSnapshot(), 'back', documents)!;
    expect(store.move(back, documents)).toMatchObject({ documentId: a.id, line: 2 });
    expect(reviewTrailMove(store.getSnapshot(), 'back', documents)).toBeNull();
    const forward = reviewTrailMove(store.getSnapshot(), 'forward', documents)!;
    expect(store.move(forward, documents)).toMatchObject({ documentId: b.id, line: 3 });
    expect(reviewTrailMove(store.getSnapshot(), 'forward', documents)).toBeNull();
    expect(store.getSnapshot().entries).toHaveLength(2);
  });
  it('skips stale and closed entries, preserving them for inspection', () => {
    const a = doc(), b = doc(2), c = doc(3), d = doc(4);
    const store = createNavigationTrailStore();
    const documents = [a, b, c, d];
    store.record(null, point(a), documents);
    store.record(null, point(b), documents);
    store.record(null, point(c), documents);
    store.record(null, point(d), documents);
    const live = [a, doc(2, b.content, 1), d];
    const move = reviewTrailMove(store.getSnapshot(), 'back', live)!;
    expect(store.move(move, live)?.documentId).toBe(a.id);
    expect(store.getSnapshot().entries).toHaveLength(4);
    expect(store.move(reviewTrailMove(store.getSnapshot(), 'forward', live)!, live)?.documentId).toBe(d.id);
  });
  it('discards the forward branch on a new explicit jump after going back', () => {
    const source = doc(), store = createNavigationTrailStore(), documents = [source];
    store.record(point(source), point(source, 2), documents);
    store.record(point(source, 2), point(source, 3), documents);
    store.move(reviewTrailMove(store.getSnapshot(), 'back', documents)!, documents);
    store.record(point(source, 2), point(source, 1, 2), documents);
    expect(store.getSnapshot().entries.map(item => [item.line, item.column])).toEqual([[1, 1], [2, 1], [1, 2]]);
    expect(reviewTrailMove(store.getSnapshot(), 'forward', documents)).toBeNull();
  });
  it('keeps forward history when marking the same selected location', () => {
    const source = doc(), store = createNavigationTrailStore(), documents = [source];
    store.record(point(source), point(source, 2), documents);
    store.move(reviewTrailMove(store.getSnapshot(), 'back', documents)!, documents);
    expect(store.record(null, point(source), documents)).toBe(false);
    expect(reviewTrailMove(store.getSnapshot(), 'forward', documents)).not.toBeNull();
  });
  it('bounds retained entries and never reuses IDs after clearing', () => {
    const source = doc(1, 'x'.repeat(MAX_TRAIL_ENTRIES + 5));
    const store = createNavigationTrailStore();
    for (let column = 1; column <= MAX_TRAIL_ENTRIES + 5; column++) {
      store.record(null, point(source, 1, column), [source]);
    }
    const state = store.getSnapshot();
    expect(state.entries).toHaveLength(MAX_TRAIL_ENTRIES);
    expect(state.entries[0].column).toBe(6);
    const last = state.entries.at(-1)!.id;
    expect(store.clear(state.revision)).toBe(true);
    store.record(null, point(source), [source]);
    expect(store.getSnapshot().entries[0].id).toBeGreaterThan(last);
  });
  it('rejects stale move and clear reviews after any recorded change', () => {
    const source = doc(), store = createNavigationTrailStore(), documents = [source];
    store.record(point(source), point(source, 2), documents);
    const before = store.getSnapshot();
    const review = reviewTrailMove(before, 'back', documents)!;
    store.record(point(source, 2), point(source, 3), documents);
    expect(store.move(review, documents)).toBeNull();
    expect(store.clear(before.revision)).toBe(false);
  });
  it('rejects forged or out-of-range move indexes and mismatched IDs', () => {
    const source = doc(), store = createNavigationTrailStore();
    store.record(point(source), point(source, 2), [source]);
    const state = store.getSnapshot();
    const move = reviewTrailMove(state, 'back', [source])!;
    expect(trailMoveTarget(state, { ...move, id: 999 }, [source])).toBeNull();
    expect(trailMoveTarget(state, { ...move, index: -1 }, [source])).toBeNull();
    expect(trailMoveTarget(state, { ...move, index: 0.5 }, [source])).toBeNull();
    expect(reviewTrailSelection(state, 999, [source])).toBeNull();
  });
  it('rejects a reviewed location if its source changes before replay', () => {
    const source = doc(), store = createNavigationTrailStore();
    store.record(point(source), point(source, 2), [source]);
    const review = reviewTrailMove(store.getSnapshot(), 'back', [source])!;
    expect(store.move(review, [doc(1, source.content, 2)])).toBeNull();
    expect(store.getSnapshot().index).toBe(1);
  });
  it('ignores a stale origin and does not append an invalid destination', () => {
    const source = doc(), store = createNavigationTrailStore();
    const changed = doc(1, source.content, 1);
    expect(store.record(point(source), point(changed, 2), [changed])).toBe(true);
    expect(store.getSnapshot().entries.map(item => item.line)).toEqual([2]);
    expect(store.record(null, point(source), [changed])).toBe(false);
  });
  it('publishes transitions to subscribers and supports unsubscribe', () => {
    const source = doc(), store = createNavigationTrailStore();
    let calls = 0;
    const unsubscribe = store.subscribe(() => calls++);
    store.record(null, point(source), [source]);
    store.record(null, point(source), [source]);
    expect(calls).toBe(1);
    unsubscribe();
    store.clear(store.getSnapshot().revision);
    expect(calls).toBe(1);
  });
  it('does not confuse independent saved sources', () => {
    const a = openedDocument([], 'C:\\one\\main.srp', 'one', 1);
    const b = openedDocument(a.documents, 'C:\\two\\main.srp', 'two', 2);
    const store = createNavigationTrailStore();
    store.record(point(b.documents[0]), point(b.documents[1]), b.documents);
    expect(store.move(reviewTrailMove(store.getSnapshot(), 'back', b.documents)!, b.documents)?.source).toBe('one');
  });
});


describe('navigation trail against real editor generations', () => {
  it('does not revive a marked location after edit and exact textual reversion', () => {
    const source = initialEditorState.documents[0];
    const marked = point(source);
    const edited = editorReducer(initialEditorState, { type: 'edit', id: source.id, content: 'changed' });
    const restored = editorReducer(edited, { type: 'edit', id: source.id, content: source.content });
    expect(restored.documents[0].content).toBe(source.content);
    expect(resolveTrailTarget(marked, restored.documents)).toBeNull();
  });
  it('does not revive a saved file location after close and reopen of the same path', () => {
    const opened = editorReducer(initialEditorState, { type: 'open', path: 'C:/demo/main.srp', content: 'one\n' });
    const source = opened.documents.find(item => item.id === opened.activeId)!;
    const location = point(source);
    const closed = editorReducer(opened, { type: 'close', id: source.id, snapshot: source });
    expect(trailEntryStatus(location, closed.documents)).toBe('closed');
    const reopened = editorReducer(closed, { type: 'open', path: source.path!, content: source.content });
    expect(reopened.activeId).toBe(source.id);
    expect(resolveTrailTarget(location, reopened.documents)).toBeNull();
  });
  it('invalidates coordinates after a save-as changes source identity', () => {
    const source = initialEditorState.documents[0];
    const location = point(source);
    const saved = editorReducer(initialEditorState, { type: 'saved', id: source.id, path: 'C:/demo/first.srp', savedContent: source.content });
    expect(trailEntryStatus(location, saved.documents)).toBe('changed');
  });
});
