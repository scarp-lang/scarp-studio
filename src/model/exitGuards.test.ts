import { describe, expect, it } from 'vitest';
import { exitBlockReason, sameExitEditorState } from './exitGuards';
import { editorReducer, initialEditorState } from './editorState';

describe('safe native window close guards', () => {
  it('permits exit when no file or compiler operation is active', () => {
    expect(exitBlockReason(false, false, false)).toBeNull();
  });
  it('blocks closing while an executable is running', () => {
    expect(exitBlockReason(false, true, false)).toMatch(/Stop it/);
  });
  it('blocks closing during an in-flight file save', () => {
    expect(exitBlockReason(true, false, false)).toMatch(/being saved/);
  });
  it('blocks closing while the selected compiler is being probed', () => {
    expect(exitBlockReason(false, false, true)).toMatch(/selecting/);
  });
  it('blocks exit during a native source or project-folder picker', () => {
    expect(exitBlockReason(false, false, false, true)).toMatch(/source or folder/);
    expect(exitBlockReason(false, false, false, false)).toBeNull();
  });
  it('gives executing and save operations priority over source picker state', () => {
    expect(exitBlockReason(true, false, false, true)).toMatch(/being saved/);
    expect(exitBlockReason(false, true, false, true)).toMatch(/Stop it/);
  });
  it('prioritizes save safety over other simultaneous operations', () => {
    expect(exitBlockReason(true, true, true)).toMatch(/being saved/);
  });
});


describe('native exit confirmation snapshots', () => {
  it('accepts the exact unchanged session and no-op editor notifications', () => {
    const opened = editorReducer(initialEditorState, {
      type: 'open', path: 'C:/workspace/main.srp', content: 'unchanged',
    });
    expect(sameExitEditorState(opened, opened)).toBe(true);
    const noOp = editorReducer(opened, {
      type: 'edit', id: opened.activeId!, content: 'unchanged',
    });
    expect(noOp).toBe(opened);
    expect(sameExitEditorState(opened, noOp)).toBe(true);
  });

  it('rejects edits to originally clean tabs even if text returns to its original value', () => {
    const initial = editorReducer(initialEditorState, {
      type: 'open', path: 'C:/workspace/main.srp', content: 'original',
    });
    const changed = editorReducer(initial, {
      type: 'edit', id: initial.activeId!, content: 'new text',
    });
    expect(sameExitEditorState(initial, changed)).toBe(false);
    const reverted = editorReducer(changed, {
      type: 'edit', id: initial.activeId!, content: 'original',
    });
    expect(reverted.documents.at(-1)?.content).toBe('original');
    expect(sameExitEditorState(initial, reverted)).toBe(false);
  });

  it('rejects saving an already clean tab while confirmation is pending', () => {
    const initial = editorReducer(initialEditorState, {
      type: 'open', path: 'C:/workspace/main.srp', content: 'original',
    });
    const saved = editorReducer(initial, {
      type: 'saved', id: initial.activeId!, path: 'C:/workspace/main.srp', savedContent: 'original',
    });
    expect(sameExitEditorState(initial, saved)).toBe(false);
  });

  it('rejects active-tab switches and new tabs, including create-then-close ABA', () => {
    const initial = editorReducer(initialEditorState, {
      type: 'open', path: 'C:/workspace/main.srp', content: 'original',
    });
    const switched = editorReducer(initial, { type: 'activate', id: 'untitled-1' });
    expect(sameExitEditorState(initial, switched)).toBe(false);
    const added = editorReducer(initial, { type: 'new' });
    expect(sameExitEditorState(initial, added)).toBe(false);
    const created = added.documents.at(-1)!;
    const closed = editorReducer(added, { type: 'close', id: created.id, snapshot: created });
    expect(closed.documents).toEqual(initial.documents);
    expect(sameExitEditorState(initial, closed)).toBe(false);
  });

  it('rejects closing and reopening an identical saved file during a pending exit', () => {
    const initial = editorReducer(initialEditorState, {
      type: 'open', path: 'C:/workspace/main.srp', content: 'original',
    });
    const file = initial.documents.at(-1)!;
    const closed = editorReducer(initial, {
      type: 'close', id: file.id, snapshot: file,
    });
    const reopened = editorReducer(closed, {
      type: 'open', path: 'C:/workspace/main.srp', content: 'original',
    });
    // Visible saved content and path still match, but the reopened file is a
    // new document generation: stale source or exit approval must not survive.
    expect(reopened.documents[0]).toEqual(initial.documents[0]);
    expect(reopened.documents.at(-1)).toMatchObject({
      id: file.id, name: file.name, path: file.path,
      content: file.content, savedContent: file.savedContent,
    });
    expect(reopened.documents.at(-1)?.revision).toBeGreaterThan(file.revision);
    expect(reopened.activeId).toBe(initial.activeId);
    expect(reopened.nextUntitled).toBe(initial.nextUntitled);
    expect(reopened.sessionRevision).toBeGreaterThan(initial.sessionRevision);
    expect(sameExitEditorState(initial, reopened)).toBe(false);
  });

  it('rejects switching away then returning to the same active tab', () => {
    const initial = editorReducer(initialEditorState, {
      type: 'open', path: 'C:/workspace/main.srp', content: 'original',
    });
    const switched = editorReducer(initial, { type: 'activate', id: 'untitled-1' });
    const restored = editorReducer(switched, { type: 'activate', id: initial.activeId! });
    expect(restored.documents).toEqual(initial.documents);
    expect(restored.activeId).toBe(initial.activeId);
    expect(sameExitEditorState(initial, restored)).toBe(false);
  });
});
