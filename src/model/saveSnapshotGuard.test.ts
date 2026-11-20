import { describe, expect, it } from 'vitest';
import { editorReducer, initialEditorState } from './editorState';
import { isCurrentSaveAllSource, isCurrentSingleSaveRequest } from './saveSnapshotGuard';

function opened() {
  return editorReducer(initialEditorState, {
    type: 'open', path: 'C:/work/main.srp', content: 'print(1);',
  });
}

describe('stale asynchronous Save/Save As guards', () => {
  it('accepts unchanged active source, including no-op editor updates', () => {
    const start = opened();
    const source = start.documents.at(-1)!;
    expect(isCurrentSingleSaveRequest(start, start, source)).toBe(true);
    const unchanged = editorReducer(start, {
      type: 'edit', id: source.id, content: source.content,
    });
    expect(isCurrentSingleSaveRequest(start, unchanged, source)).toBe(true);
  });

  it('rejects changed content including A→B→A before a delayed Save As resolves', () => {
    const start = opened();
    const source = start.documents.at(-1)!;
    const edited = editorReducer(start, {
      type: 'edit', id: source.id, content: 'print(2);',
    });
    const restored = editorReducer(edited, {
      type: 'edit', id: source.id, content: source.content,
    });
    expect(isCurrentSingleSaveRequest(start, edited, source)).toBe(false);
    expect(restored.documents.at(-1)?.content).toBe(source.content);
    expect(isCurrentSingleSaveRequest(start, restored, source)).toBe(false);
  });

  it('rejects focus A→B→A, background edits, new tabs, and close/reopen', () => {
    const start = opened();
    const source = start.documents.at(-1)!;
    const switchAway = editorReducer(start, { type: 'activate', id: 'untitled-1' });
    const focusAgain = editorReducer(switchAway, { type: 'activate', id: source.id });
    const backgroundEdit = editorReducer(start, {
      type: 'edit', id: 'untitled-1', content: 'background typing',
    });
    const created = editorReducer(start, { type: 'new' });
    const closed = editorReducer(start, { type: 'close', id: source.id, snapshot: source });
    const reopened = editorReducer(closed, {
      type: 'open', path: source.path!, content: source.content,
    });
    for (const current of [switchAway, focusAgain, backgroundEdit, created, closed, reopened]) {
      expect(isCurrentSingleSaveRequest(start, current, source)).toBe(false);
    }
  });

  it('allows a Save All item despite edits in another tab, not its own source', () => {
    const start = opened();
    const source = start.documents.at(-1)!;
    expect(isCurrentSaveAllSource(source, source)).toBe(true);
    const otherChanged = editorReducer(start, {
      type: 'edit', id: 'untitled-1', content: 'newer future batch item',
    });
    expect(isCurrentSaveAllSource(source, otherChanged.documents.at(-1))).toBe(true);
    const changed = editorReducer(start, {
      type: 'edit', id: source.id, content: 'changed during picker',
    });
    expect(isCurrentSaveAllSource(source, changed.documents.at(-1))).toBe(false);
    expect(isCurrentSaveAllSource(source, undefined)).toBe(false);
  });

  it('rejects same-content file closure/recreation for a pending Save All item', () => {
    const start = opened();
    const source = start.documents.at(-1)!;
    const closed = editorReducer(start, { type: 'close', id: source.id, snapshot: source });
    const reopened = editorReducer(closed, {
      type: 'open', path: source.path!, content: source.content,
    });
    expect(reopened.documents.at(-1)?.id).toBe(source.id);
    expect(isCurrentSaveAllSource(source, reopened.documents.at(-1))).toBe(false);
  });
});
