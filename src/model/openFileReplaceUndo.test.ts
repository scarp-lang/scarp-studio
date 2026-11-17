import { describe, expect, it } from 'vitest';
import { editorReducer, initialEditorState } from './editorState';
import { createOpenFileReplaceUndo, canUndoOpenFileReplace } from './openFileReplaceUndo';

function twoFiles() {
  const first = editorReducer(initialEditorState, {
    type: 'open', path: '/project/main.srp', content: 'print("a")',
  });
  return editorReducer(first, {
    type: 'open', path: '/project/util.srp', content: 'bind a = 1',
  });
}

function replaceAndRemember() {
  const before = twoFiles();
  const originals = before.documents;
  const targets = originals.slice(1).map((snapshot) => ({
    id: snapshot.id, snapshot, content: snapshot.content.replace('a', 'b'),
  }));
  const after = editorReducer(before, {
    type: 'replace-open-files', changes: targets, allSnapshots: originals,
  });
  const undo = createOpenFileReplaceUndo(originals, after.documents)!;
  return { before, after, undo };
}

describe('atomic one-step undo of confirmed open-buffer Replace All', () => {
  it('restores all changed buffers without changing saved disk snapshots', () => {
    const { before, after, undo } = replaceAndRemember();
    expect(canUndoOpenFileReplace(undo, after)).toBe(true);
    const restored = editorReducer(after, {
      type: 'replace-open-files', changes: undo.changes, allSnapshots: undo.after,
    });
    expect(restored.documents.map((document) => [document.content, document.savedContent, document.path]))
      .toEqual(before.documents.map((document) => [document.content, document.savedContent, document.path]));
    expect(restored.documents[1].revision).toBe(after.documents[1].revision + 1);
    expect(restored.documents[1].savedContent).toBe('print("a")');
    expect(restored.documents[2].savedContent).toBe('bind a = 1');
    expect(restored.activeId).toBe(after.activeId);
  });

  it('refuses Undo after editing A→B→A returns to identical post-replacement text', () => {
    const { after, undo } = replaceAndRemember();
    const snapshot = after.documents[1];
    const modified = editorReducer(after, {
      type: 'edit', id: snapshot.id, content: 'new work',
    });
    const reverted = editorReducer(modified, {
      type: 'edit', id: snapshot.id, content: snapshot.content,
    });
    expect(reverted.documents[1].content).toBe(snapshot.content);
    expect(canUndoOpenFileReplace(undo, reverted)).toBe(false);
    expect(editorReducer(reverted, {
      type: 'replace-open-files', changes: undo.changes, allSnapshots: undo.after,
    })).toBe(reverted);
  });

  it('refuses to erase an edit made after Replace All in a changed tab', () => {
    const { after, undo } = replaceAndRemember();
    const newer = editorReducer(after, {
      type: 'edit', id: after.documents[1].id, content: 'new typing',
    });
    expect(canUndoOpenFileReplace(undo, newer)).toBe(false);
    expect(editorReducer(newer, {
      type: 'replace-open-files', changes: undo.changes, allSnapshots: undo.after,
    })).toBe(newer);
    expect(newer.documents[1].content).toBe('new typing');
  });

  it('refuses to erase an edit in a tab with no replacement matches', () => {
    const { after, undo } = replaceAndRemember();
    const newer = editorReducer(after, {
      type: 'edit', id: 'untitled-1', content: 'unsaved new work',
    });
    expect(canUndoOpenFileReplace(undo, newer)).toBe(false);
  });

  it('refuses undo after saving a previously replaced source to disk', () => {
    const { after, undo } = replaceAndRemember();
    const target = after.documents[1];
    const saved = editorReducer(after, {
      type: 'saved', id: target.id, path: target.path!, savedContent: target.content,
    });
    expect(canUndoOpenFileReplace(undo, saved)).toBe(false);
  });

  it('refuses undo after creating or closing a tab', () => {
    const { after, undo } = replaceAndRemember();
    expect(canUndoOpenFileReplace(undo, editorReducer(after, { type: 'new' }))).toBe(false);
    const closed = editorReducer(after, {
      type: 'close', id: 'untitled-1', snapshot: after.documents[0],
    });
    expect(canUndoOpenFileReplace(undo, closed)).toBe(false);
  });

  it('permits switching tabs without changing their text', () => {
    const { after, undo } = replaceAndRemember();
    const switched = editorReducer(after, { type: 'activate', id: 'untitled-1' });
    expect(canUndoOpenFileReplace(undo, switched)).toBe(true);
    const restored = editorReducer(switched, {
      type: 'replace-open-files', changes: undo.changes, allSnapshots: undo.after,
    });
    expect(restored.activeId).toBe('untitled-1');
  });

  it('restores exactly the previous dirty content, not the saved content', () => {
    const clean = twoFiles();
    const dirty = editorReducer(clean, {
      type: 'edit', id: clean.documents[1].id, content: 'my unsaved edit',
    });
    const snapshot = dirty.documents[1];
    const replaced = editorReducer(dirty, {
      type: 'replace-open-files', changes: [{
        id: snapshot.id, snapshot, content: 'updated edit',
      }], allSnapshots: dirty.documents,
    });
    const undo = createOpenFileReplaceUndo(dirty.documents, replaced.documents)!;
    expect(canUndoOpenFileReplace(undo, replaced)).toBe(true);
    const restored = editorReducer(replaced, {
      type: 'replace-open-files', changes: undo.changes, allSnapshots: undo.after,
    });
    expect(restored.documents[1].content).toBe('my unsaved edit');
    expect(restored.documents[1].savedContent).toBe('print("a")');
  });

  it('never fabricates an undo for unchanged or incompatible tab snapshots', () => {
    const before = twoFiles();
    expect(createOpenFileReplaceUndo(before.documents, before.documents)).toBeNull();
    expect(createOpenFileReplaceUndo(before.documents, before.documents.slice(1))).toBeNull();
    const saved = editorReducer(before, {
      type: 'saved', id: before.documents[1].id,
      path: '/project/renamed.srp', savedContent: 'other disk',
    });
    expect(createOpenFileReplaceUndo(before.documents, saved.documents)).toBeNull();
  });
});
