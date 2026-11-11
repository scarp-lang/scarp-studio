import { describe, expect, it } from 'vitest';
import { editorReducer, initialEditorState, sameDirtyDocuments } from './editorState';

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
