import { describe, expect, it } from 'vitest';
import { createUntitled, type StudioDocument } from './documents';
import { EditorViewStateStore, MAX_EDITOR_VIEW_STATES } from './editorViewStateStore';

interface View {
  cursor: { line: number; column: number };
  scrollTop: number;
  folds: number[];
}
function view(line: number, column = 1): View {
  return { cursor: { line, column }, scrollTop: line * 20, folds: [line] };
}
function document(id: string, revision = 1, path: string | null = '/workspace/' + id + '.srp'): StudioDocument {
  return { id, revision, path, name: id + '.srp', content: 'private source text', savedContent: 'private saved text' };
}

describe('session-local editor view state store', () => {
  it('stores independent cursor, scroll and contribution state for exact tab identities', () => {
    const store = new EditorViewStateStore<View>();
    const a = document('a');
    const b = document('b');
    const first = view(2, 5);
    const second = view(10, 3);
    expect(store.capture(a, first)).toBe(true);
    expect(store.capture(b, second)).toBe(true);
    expect(store.size).toBe(2);
    expect(store.restore(a)).toBe(first);
    expect(store.restore(b)).toBe(second);
  });

  it('uses the latest capture when returning to the same unchanged tab', () => {
    const store = new EditorViewStateStore<View>();
    const source = document('a');
    store.capture(source, view(1));
    const later = view(8, 4);
    store.capture(source, later);
    expect(store.size).toBe(1);
    expect(store.restore(source)).toBe(later);
  });

  it('does not restore a closed and reopened file with an identical ID and path', () => {
    const store = new EditorViewStateStore<View>();
    const old = document('a', 4);
    store.capture(old, view(7));
    const reopened = document('a', 8);
    expect(store.restore(reopened)).toBeNull();
    expect(store.size).toBe(0);
    expect(store.restore(old)).toBeNull();
  });

  it('does not restore a pre-edit state after an edit/revert ABA', () => {
    const store = new EditorViewStateStore<View>();
    const original = document('a', 2);
    store.capture(original, view(4, 3));
    const reverted = { ...original, revision: 4 };
    store.reconcile([reverted]);
    expect(store.restore(reverted)).toBeNull();
    expect(store.size).toBe(0);
  });

  it('does not restore a saved or moved path even if its ID is unchanged', () => {
    const store = new EditorViewStateStore<View>();
    const original = document('a', 1);
    store.capture(original, view(4));
    expect(store.restore({ ...original, path: '/workspace/renamed.srp' })).toBeNull();
    expect(store.size).toBe(0);
  });

  it('supports unsaved and recovered tabs using their in-session identity', () => {
    const store = new EditorViewStateStore<View>();
    const untitled = createUntitled(4);
    const recovered = { ...createUntitled(5), recoveredDraft: 'draft.srp', revision: 4 };
    const first = view(1);
    const second = view(3, 2);
    store.capture(untitled, first);
    store.capture(recovered, second);
    expect(store.restore(untitled)).toBe(first);
    expect(store.restore(recovered)).toBe(second);
    expect(store.restore({ ...untitled, path: '/workspace/saved.srp', revision: 1 })).toBeNull();
  });

  it('prunes closed tabs and stale generations while preserving unrelated states', () => {
    const store = new EditorViewStateStore<View>();
    const a = document('a');
    const b = document('b');
    const c = document('c');
    const d = document('d');
    store.capture(a, view(1));
    store.capture(b, view(2));
    const third = view(3);
    store.capture(c, third);
    store.reconcile([c, { ...b, revision: 2 }, d]);
    expect(store.size).toBe(1);
    expect(store.restore(a)).toBeNull();
    expect(store.restore(b)).toBeNull();
    expect(store.restore(c)).toBe(third);
    expect(store.restore(d)).toBeNull();
  });

  it('preserves valid views when tabs are pinned or sorted without source changes', () => {
    const store = new EditorViewStateStore<View>();
    const a = document('a');
    const b = document('b');
    const first = view(2);
    const second = view(3);
    store.capture(a, first);
    store.capture(b, second);
    store.reconcile([b, a]);
    expect(store.restore(a)).toBe(first);
    expect(store.restore(b)).toBe(second);
  });

  it('fails closed for ambiguous duplicate live tab IDs', () => {
    const store = new EditorViewStateStore<View>();
    const a = document('a');
    const b = document('b');
    store.capture(a, view(1));
    store.capture(b, view(2));
    store.reconcile([a, { ...a, path: '/different.srp' }, b]);
    expect(store.restore(a)).toBeNull();
    expect(store.restore(b)).not.toBeNull();
  });

  it('evicts the least recently captured or restored state at capacity', () => {
    const store = new EditorViewStateStore<View>(2);
    const a = document('a');
    const b = document('b');
    const c = document('c');
    store.capture(a, view(1));
    store.capture(b, view(2));
    expect(store.restore(a)).not.toBeNull();
    store.capture(c, view(3));
    expect(store.size).toBe(2);
    expect(store.restore(b)).toBeNull();
    expect(store.restore(a)).not.toBeNull();
    expect(store.restore(c)).not.toBeNull();
  });

  it('bounds the default cache and retains the most recent tab states', () => {
    const store = new EditorViewStateStore<View>();
    const docs = Array.from({ length: MAX_EDITOR_VIEW_STATES + 3 }, (_, index) => document(String(index)));
    for (const [index, doc] of docs.entries()) store.capture(doc, view(index + 1));
    expect(store.size).toBe(MAX_EDITOR_VIEW_STATES);
    expect(store.restore(docs[0])).toBeNull();
    expect(store.restore(docs[2])).toBeNull();
    expect(store.restore(docs[3])).not.toBeNull();
    expect(store.restore(docs.at(-1)!)).not.toBeNull();
  });

  it('rejects invalid capacities and invalid identities or missing opaque state', () => {
    for (const capacity of [0, -1, NaN, 1.5, MAX_EDITOR_VIEW_STATES + 1]) {
      expect(() => new EditorViewStateStore(capacity)).toThrow();
    }
    const store = new EditorViewStateStore<View>();
    expect(store.capture(document(''), view(1))).toBe(false);
    expect(store.capture(document('a', -1), view(1))).toBe(false);
    expect(store.capture(document('a', Number.NaN), view(1))).toBe(false);
    expect(store.capture(document('a'), null)).toBe(false);
    expect(store.capture(document('a'), undefined)).toBe(false);
    expect(store.size).toBe(0);
  });

  it('allows targeted forgetting or full clearing without changing document objects', () => {
    const store = new EditorViewStateStore<View>();
    const a = document('a');
    const b = document('b');
    store.capture(a, view(1));
    store.capture(b, view(2));
    expect(store.forget('a')).toBe(true);
    expect(store.forget('a')).toBe(false);
    expect(store.restore(a)).toBeNull();
    expect(store.restore(b)).not.toBeNull();
    store.clear();
    expect(store.size).toBe(0);
    expect(a.content).toBe('private source text');
  });
});
