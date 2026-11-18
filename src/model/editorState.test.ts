import { describe, expect, it } from 'vitest';
import { canApplyReplacementSnapshots, currentActiveDocument, editorReducer, hasUnchangedEditorSession, initialEditorState, isUnchangedSnapshot, sameDirtyDocuments, sameOpenDocumentSnapshots } from './editorState';
import { isCurrentSearchHit, searchOpenFiles } from './openFileSearch';

describe('atomic editor session transitions', () => {
  it('rejects a stale open-buffer search hit after an identical saved file is reopened', () => {
    const first = editorReducer(initialEditorState, {
      type: 'open', path: 'C:/project/main.srp', content: 'print("hello");',
    });
    const previous = first.documents.at(-1)!;
    const oldHit = searchOpenFiles(first.documents, 'hello', {
      caseSensitive: true, wholeWord: false,
    }).hits[0];
    const closed = editorReducer(first, { type: 'close', id: previous.id, snapshot: previous });
    const reopened = editorReducer(closed, {
      type: 'open', path: previous.path!, content: previous.content,
    });
    const current = reopened.documents.at(-1)!;
    expect(current.id).toBe(previous.id);
    expect(current.content).toBe(previous.content);
    expect(current.revision).toBeGreaterThan(previous.revision);
    expect(isCurrentSearchHit(current, oldHit)).toBe(false);
    expect(isUnchangedSnapshot(current, previous)).toBe(false);
    expect(sameOpenDocumentSnapshots(first.documents, reopened.documents)).toBe(false);
    expect(canApplyReplacementSnapshots(reopened, [{
      id: previous.id, snapshot: previous, content: 'replacement',
    }])).toBe(false);
  });

  it('invalidates deferred native actions after focus ABA, edits or file reopening', () => {
    const initial = editorReducer(initialEditorState, {
      type: 'open', path: '/project/current.srp', content: 'disk',
    });
    expect(hasUnchangedEditorSession(initial, initial)).toBe(true);
    expect(hasUnchangedEditorSession(initial, editorReducer(initial, {
      type: 'activate', id: initial.activeId!,
    }))).toBe(true);
    const switched = editorReducer(initial, { type: 'activate', id: 'untitled-1' });
    const restored = editorReducer(switched, { type: 'activate', id: initial.activeId! });
    expect(restored.activeId).toBe(initial.activeId);
    expect(hasUnchangedEditorSession(initial, restored)).toBe(false);
    const backgroundEdit = editorReducer(initial, {
      type: 'edit', id: 'untitled-1', content: 'new background typing',
    });
    expect(hasUnchangedEditorSession(initial, backgroundEdit)).toBe(false);
    const previous = initial.documents.at(-1)!;
    const closed = editorReducer(initial, { type: 'close', id: previous.id, snapshot: previous });
    const reopened = editorReducer(closed, {
      type: 'open', path: previous.path!, content: previous.content,
    });
    expect(hasUnchangedEditorSession(initial, reopened)).toBe(false);
  });


  it('advances the session revision for changes and ignores no-op editor requests', () => {
    const initial = initialEditorState;
    const opened = editorReducer(initial, {
      type: 'open', path: 'C:/workspace/main.srp', content: 'one',
    });
    expect(opened.sessionRevision).toBe(initial.sessionRevision + 1);
    expect(editorReducer(opened, {
      type: 'open', path: String.raw`c:\\WORKSPACE\\MAIN.srp`, content: 'stale disk',
    })).toBe(opened);
    expect(editorReducer(opened, { type: 'activate', id: opened.activeId! })).toBe(opened);
    const switched = editorReducer(opened, { type: 'activate', id: 'untitled-1' });
    expect(switched.sessionRevision).toBe(opened.sessionRevision + 1);
    const restored = editorReducer(switched, { type: 'activate', id: opened.activeId! });
    expect(restored.activeId).toBe(opened.activeId);
    expect(restored.sessionRevision).toBe(opened.sessionRevision + 2);
  });

  it('rejects a stale close or reload after source text changes A→B→A', () => {
    const original = editorReducer(initialEditorState, {
      type: 'open', path: '/project/main.srp', content: 'original source',
    });
    const snapshot = original.documents[1];
    const changed = editorReducer(original, {
      type: 'edit', id: snapshot.id, content: 'temporary different text',
    });
    const reverted = editorReducer(changed, {
      type: 'edit', id: snapshot.id, content: snapshot.content,
    });
    expect(reverted.documents[1].content).toBe(snapshot.content);
    expect(reverted.documents[1].savedContent).toBe(snapshot.savedContent);
    expect(reverted.documents[1].revision).toBe(snapshot.revision + 2);
    expect(isUnchangedSnapshot(reverted.documents[1], snapshot)).toBe(false);
    expect(editorReducer(reverted, {
      type: 'close', id: snapshot.id, snapshot,
    })).toBe(reverted);
    expect(editorReducer(reverted, {
      type: 'reload', id: snapshot.id, snapshot, content: 'disk',
    })).toBe(reverted);
  });

  it('does not create a new revision for identical no-op edit notifications', () => {
    const original = editorReducer(initialEditorState, {
      type: 'open', path: '/project/main.srp', content: 'source',
    });
    const snapshot = original.documents[1];
    expect(editorReducer(original, {
      type: 'edit', id: snapshot.id, content: snapshot.content,
    })).toBe(original);
    expect(editorReducer(original, {
      type: 'edit', id: 'nonexistent-tab', content: 'anything',
    })).toBe(original);
  });

  it('rejects stale Replace All after editing A→B→A even with matching source content', () => {
    const initial = editorReducer(initialEditorState, {
      type: 'open', path: '/project/main.srp', content: 'needle',
    });
    const snapshot = initial.documents[1];
    const changes = [{ id: snapshot.id, snapshot, content: 'replacement' }];
    const modified = editorReducer(initial, {
      type: 'edit', id: snapshot.id, content: 'other',
    });
    const reverted = editorReducer(modified, {
      type: 'edit', id: snapshot.id, content: 'needle',
    });
    expect(sameOpenDocumentSnapshots(initial.documents, reverted.documents)).toBe(false);
    expect(canApplyReplacementSnapshots(reverted, changes)).toBe(false);
    expect(editorReducer(reverted, {
      type: 'replace-open-files', changes, allSnapshots: initial.documents,
    })).toBe(reverted);
  });

  it('increments generations for saved snapshots, reloads and Replace All', () => {
    const original = editorReducer(initialEditorState, {
      type: 'open', path: '/project/main.srp', content: 'a',
    });
    const snapshot = original.documents[1];
    const saved = editorReducer(original, {
      type: 'saved', id: snapshot.id, path: snapshot.path!, savedContent: snapshot.content,
    });
    expect(saved.documents[1].revision).toBe(snapshot.revision + 1);
    expect(isUnchangedSnapshot(saved.documents[1], snapshot)).toBe(false);
    const reloaded = editorReducer(saved, {
      type: 'reload', id: snapshot.id, snapshot: saved.documents[1], content: 'b',
    });
    expect(reloaded.documents[1].revision).toBe(snapshot.revision + 2);
    const replaced = editorReducer(reloaded, {
      type: 'replace-open-files', changes: [{
        id: snapshot.id, snapshot: reloaded.documents[1], content: 'c',
      }], allSnapshots: reloaded.documents,
    });
    expect(replaced.documents[1].revision).toBe(snapshot.revision + 3);
  });

  it('selects Save and Close targets from the newest synchronous state', () => {
    const first = editorReducer(initialEditorState, {
      type: 'open', path: '/project/first.srp', content: 'first',
    });
    const staleRenderedId = first.activeId;
    const switched = editorReducer(first, { type: 'new' });
    const current = currentActiveDocument(switched);
    expect(current?.id).toBe('untitled-2');
    expect(staleRenderedId).toBe('file-/project/first.srp');
    expect(current?.id).not.toBe(staleRenderedId);
    expect(currentActiveDocument(editorReducer(switched, {
      type: 'close', id: switched.activeId!, snapshot: current!,
    }))?.id).toBe(staleRenderedId);
    expect(currentActiveDocument({ ...switched, activeId: 'closed' })).toBeNull();
  });

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
