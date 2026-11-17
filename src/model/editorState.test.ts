import { describe, expect, it } from 'vitest';
import { canApplyReplacementSnapshots, editorReducer, initialEditorState, sameDirtyDocuments, sameOpenDocumentSnapshots } from './editorState';

describe('atomic editor session transitions', () => {
  it('preserves all tabs when two opens complete asynchronously', () => {
    const a = editorReducer(initialEditorState, {
      type: 'open', path: 'C:/project/one.srp', content: 'first',
    });
    const b = editorReducer(a, {
      type: 'open', path: 'C:/project/two.srp', content: 'second',
    });
    expect(b.documents.map((document) => document.name)).toEqual([
      'Untitled-1.srp', 'one.srp', 'two.srp',
    ]);
    expect(b.activeId).toBe('file-C:/project/two.srp');
  });

  it('reuses an existing Windows file tab without overwriting unsaved edits', () => {
    const first = editorReducer(initialEditorState, {
      type: 'open', path: 'C:/Project/Main.srp', content: 'disk',
    });
    const changed = editorReducer(first, {
      type: 'edit', id: first.activeId!, content: 'local edits',
    });
    const reopened = editorReducer(changed, {
      type: 'open', path: String.raw`c:\project\main.SRP`, content: 'new disk',
    });
    expect(reopened.documents).toEqual(changed.documents);
    expect(reopened.activeId).toBe(first.activeId);
  });

  it('never closes a document when it changed while the discard dialog was open', () => {
    const opened = editorReducer(initialEditorState, {
      type: 'open', path: '/project/main.srp', content: 'disk',
    });
    const snapshot = opened.documents[1];
    const edited = editorReducer(opened, {
      type: 'edit', id: snapshot.id, content: 'new unsaved work',
    });
    const staleClose = editorReducer(edited, {
      type: 'close', id: snapshot.id, snapshot,
    });
    expect(staleClose).toBe(edited);
  });

  it('preserves edits made during an asynchronous save', () => {
    const opened = editorReducer(initialEditorState, {
      type: 'open', path: '/project/main.srp', content: 'disk',
    });
    const editing = editorReducer(opened, {
      type: 'edit', id: opened.activeId!, content: 'newer edits',
    });
    const afterSave = editorReducer(editing, {
      type: 'saved', id: opened.activeId!, path: '/project/main.srp', savedContent: 'disk',
    });
    expect(afterSave.documents[1].content).toBe('newer edits');
    expect(afterSave.documents[1].savedContent).toBe('disk');
  });

  it('moves focus only if the closed tab was active', () => {
    const two = editorReducer(initialEditorState, { type: 'new' });
    const closeFirst = editorReducer(two, {
      type: 'close', id: 'untitled-1', snapshot: two.documents[0],
    });
    expect(closeFirst.activeId).toBe('untitled-2');
    const closeSecond = editorReducer(closeFirst, {
      type: 'close', id: 'untitled-2', snapshot: closeFirst.documents[0],
    });
    expect(closeSecond.activeId).toBeNull();
    expect(closeSecond.documents).toHaveLength(0);
  });

  it('detects new edits while an application close confirmation is open', () => {
    const original = editorReducer(initialEditorState, { type: 'new' });
    const dirty = editorReducer(original, {
      type: 'edit', id: 'untitled-2', content: 'first edit',
    });
    const snapshot = dirty.documents.filter((document) => document.content !== document.savedContent);
    expect(sameDirtyDocuments(snapshot, dirty.documents)).toBe(true);
    const moreEdits = editorReducer(dirty, {
      type: 'edit', id: 'untitled-2', content: 'new changes after prompt',
    });
    expect(sameDirtyDocuments(snapshot, moreEdits.documents)).toBe(false);
    const newTab = editorReducer(dirty, { type: 'new' });
    const changedTab = editorReducer(newTab, {
      type: 'edit', id: 'untitled-3', content: 'another unsaved file',
    });
    expect(sameDirtyDocuments(snapshot, changedTab.documents)).toBe(false);
  });

  it('reloads a saved source and updates the exact clean snapshot', () => {
    const opened = editorReducer(initialEditorState, {
      type: 'open', path: 'C:/project/main.srp', content: 'original',
    });
    const snapshot = opened.documents[1];
    const result = editorReducer(opened, {
      type: 'reload', id: snapshot.id, snapshot, content: 'external change',
    });
    expect(result.documents[1].content).toBe('external change');
    expect(result.documents[1].savedContent).toBe('external change');
    expect(result.documents[1].path).toBe(snapshot.path);
    expect(result.activeId).toBe(snapshot.id);
  });

  it('makes a confirmed dirty reload clean without affecting other tabs', () => {
    const opened = editorReducer(initialEditorState, {
      type: 'open', path: '/project/main.srp', content: 'disk',
    });
    const edited = editorReducer(opened, {
      type: 'edit', id: opened.activeId!, content: 'local edits',
    });
    const snapshot = edited.documents[1];
    const result = editorReducer(edited, {
      type: 'reload', id: snapshot.id, snapshot, content: 'new external disk',
    });
    expect(result.documents[1].content).toBe('new external disk');
    expect(result.documents[1].savedContent).toBe('new external disk');
    expect(result.documents[0]).toBe(edited.documents[0]);
  });

  it('refuses a stale disk reload after edits, saves or tab changes', () => {
    const opened = editorReducer(initialEditorState, {
      type: 'open', path: '/project/main.srp', content: 'old',
    });
    const snapshot = opened.documents[1];
    const edited = editorReducer(opened, {
      type: 'edit', id: snapshot.id, content: 'new unsaved work',
    });
    expect(editorReducer(edited, { type: 'reload', id: snapshot.id, snapshot, content: 'disk' }))
      .toBe(edited);
    const saved = editorReducer(opened, {
      type: 'saved', id: snapshot.id, path: snapshot.path!, savedContent: 'different',
    });
    expect(editorReducer(saved, { type: 'reload', id: snapshot.id, snapshot, content: 'disk' }))
      .toBe(saved);
    const switched = editorReducer(opened, { type: 'activate', id: 'untitled-1' });
    expect(editorReducer(switched, { type: 'reload', id: snapshot.id, snapshot, content: 'disk' }))
      .toBe(switched);
  });

  it('does not revive a closed tab or reload an unsaved source', () => {
    const opened = editorReducer(initialEditorState, {
      type: 'open', path: '/project/main.srp', content: 'disk',
    });
    const snapshot = opened.documents[1];
    const closed = editorReducer(opened, { type: 'close', id: snapshot.id, snapshot });
    expect(editorReducer(closed, { type: 'reload', id: snapshot.id, snapshot, content: 'external' }))
      .toBe(closed);
    const untitled = initialEditorState.documents[0];
    expect(editorReducer(initialEditorState, {
      type: 'reload', id: untitled.id, snapshot: untitled, content: 'external',
    })).toBe(initialEditorState);
  });

  it('keeps unchanged disk snapshots as an identity-preserving no-op', () => {
    const opened = editorReducer(initialEditorState, {
      type: 'open', path: '/project/main.srp', content: 'unchanged',
    });
    const snapshot = opened.documents[1];
    expect(editorReducer(opened, {
      type: 'reload', id: snapshot.id, snapshot, content: 'unchanged',
    })).toBe(opened);
  });

  it('atomically replaces several open buffers without writing saved snapshots', () => {
    const first = editorReducer(initialEditorState, { type: 'open', path: '/project/a.srp', content: 'foo' });
    const both = editorReducer(first, { type: 'open', path: '/project/b.srp', content: 'foo and foo' });
    const a = both.documents[1];
    const b = both.documents[2];
    const changes = [
      { id: a.id, snapshot: a, content: 'bar' },
      { id: b.id, snapshot: b, content: 'bar and bar' },
    ];
    expect(canApplyReplacementSnapshots(both, changes)).toBe(true);
    const result = editorReducer(both, { type: 'replace-open-files', changes, allSnapshots: both.documents });
    expect(result.documents.map((document) => document.content)).toEqual(['', 'bar', 'bar and bar']);
    expect(result.documents[1].savedContent).toBe('foo');
    expect(result.documents[2].savedContent).toBe('foo and foo');
    expect(result.documents[0]).toBe(both.documents[0]);
  });

  it('rejects the entire replacement when even one tab changed during confirmation', () => {
    const first = editorReducer(initialEditorState, { type: 'open', path: '/a.srp', content: 'a' });
    const both = editorReducer(first, { type: 'open', path: '/b.srp', content: 'a' });
    const snapshots = both.documents.slice(1);
    const changes = snapshots.map((snapshot) => ({
      id: snapshot.id, snapshot, content: 'b',
    }));
    const newer = editorReducer(both, { type: 'edit', id: snapshots[1].id, content: 'newer' });
    expect(canApplyReplacementSnapshots(newer, changes)).toBe(false);
    expect(editorReducer(newer, { type: 'replace-open-files', changes, allSnapshots: both.documents })).toBe(newer);
  });

  it('rejects duplicate, removed, identical and stale saved snapshots', () => {
    const opened = editorReducer(initialEditorState, { type: 'open', path: '/file.srp', content: 'one' });
    const snapshot = opened.documents[1];
    const replacement = { id: snapshot.id, snapshot, content: 'two' };
    expect(canApplyReplacementSnapshots(opened, [])).toBe(false);
    expect(canApplyReplacementSnapshots(opened, [replacement, replacement])).toBe(false);
    expect(canApplyReplacementSnapshots(opened, [{ ...replacement, content: 'one' }])).toBe(false);
    const closed = editorReducer(opened, { type: 'close', id: snapshot.id, snapshot });
    expect(editorReducer(closed, { type: 'replace-open-files', changes: [replacement], allSnapshots: opened.documents })).toBe(closed);
    const saved = editorReducer(opened, {
      type: 'saved', id: snapshot.id, path: snapshot.path!, savedContent: 'new saved content',
    });
    expect(editorReducer(saved, { type: 'replace-open-files', changes: [replacement], allSnapshots: opened.documents })).toBe(saved);
  });

  it('rejects the entire preview if new or originally unmatched tabs changed', () => {
    const first = editorReducer(initialEditorState, {
      type: 'open', path: '/project/search.srp', content: 'needle',
    });
    const snapshot = first.documents[1];
    const changes = [{ id: snapshot.id, snapshot, content: 'replacement' }];
    const added = editorReducer(first, { type: 'new' });
    expect(sameOpenDocumentSnapshots(first.documents, added.documents)).toBe(false);
    expect(editorReducer(added, {
      type: 'replace-open-files', changes, allSnapshots: first.documents,
    })).toBe(added);
    const editedOther = editorReducer(first, {
      type: 'edit', id: 'untitled-1', content: 'new match in unrelated tab',
    });
    expect(sameOpenDocumentSnapshots(first.documents, editedOther.documents)).toBe(false);
    expect(editorReducer(editedOther, {
      type: 'replace-open-files', changes, allSnapshots: first.documents,
    })).toBe(editedOther);
    expect(sameOpenDocumentSnapshots(first.documents, first.documents)).toBe(true);
  });

  it('ignores stale edits and save results for a removed tab', () => {
    const doc = initialEditorState.documents[0];
    const closed = editorReducer(initialEditorState, {
      type: 'close', id: doc.id, snapshot: doc,
    });
    expect(editorReducer(closed, { type: 'edit', id: doc.id, content: 'late' })).toBe(closed);
    expect(editorReducer(closed, {
      type: 'saved', id: doc.id, path: '/project/x.srp', savedContent: '',
    })).toBe(closed);
  });
});
