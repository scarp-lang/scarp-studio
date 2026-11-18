import { describe, expect, it } from 'vitest';
import { createUntitled, type StudioDocument } from './documents';
import { editorReducer, initialEditorState } from './editorState';
import { captureVerifiedSource, isCurrentVerifiedSource } from './verifiedSource';

function saved(path = 'C:/project/main.srp', text = 'print(1);'): StudioDocument {
  return { id: 'file-C:/project/main.srp', name: 'main.srp', path,
    content: text, savedContent: text, revision: 7 };
}

describe('exact in-session identity of compiler-verified source', () => {
  it('captures only clean named sources and allows equivalent Windows paths', () => {
    const document = saved();
    const snapshot = captureVerifiedSource(document);
    expect(snapshot).toEqual({
      documentId: document.id, path: document.path,
      content: document.content, revision: document.revision,
    });
    expect(isCurrentVerifiedSource(snapshot, document)).toBe(true);
    expect(isCurrentVerifiedSource(snapshot, {
      ...document, path: String.raw`c:\PROJECT\MAIN.srp`,
    })).toBe(true);
    expect(captureVerifiedSource(createUntitled(1))).toBeNull();
    expect(captureVerifiedSource({ ...document, content: 'unsaved' })).toBeNull();
    expect(captureVerifiedSource(null)).toBeNull();
    expect(isCurrentVerifiedSource(null, document)).toBe(false);
    expect(isCurrentVerifiedSource(snapshot, null)).toBe(false);
  });

  it('rejects a second tab, changed disk snapshots and unrelated paths', () => {
    const document = saved();
    const verified = captureVerifiedSource(document);
    expect(isCurrentVerifiedSource(verified, { ...document, id: 'other-tab' })).toBe(false);
    expect(isCurrentVerifiedSource(verified, { ...document, path: 'D:/main.srp' })).toBe(false);
    expect(isCurrentVerifiedSource(verified, {
      ...document, savedContent: 'new disk data',
    })).toBe(false);
    expect(isCurrentVerifiedSource(verified, {
      ...document, path: null,
    })).toBe(false);
  });

  it('does not revive stale diagnostics after A-to-B-to-A edits', () => {
    const opened = editorReducer(initialEditorState, {
      type: 'open', path: 'C:/project/main.srp', content: 'original',
    });
    const first = opened.documents.at(-1)!;
    const verified = captureVerifiedSource(first);
    const edited = editorReducer(opened, { type: 'edit', id: first.id, content: 'new work' });
    const restored = editorReducer(edited, {
      type: 'edit', id: first.id, content: 'original',
    });
    expect(restored.documents.at(-1)?.content).toBe(first.content);
    expect(isCurrentVerifiedSource(verified, edited.documents.at(-1)!)).toBe(false);
    expect(isCurrentVerifiedSource(verified, restored.documents.at(-1)!)).toBe(false);
  });

  it('invalidates Verify results even after an unchanged Save or identical reopen', () => {
    const opened = editorReducer(initialEditorState, {
      type: 'open', path: 'C:/project/main.srp', content: 'original',
    });
    const document = opened.documents.at(-1)!;
    const verified = captureVerifiedSource(document);
    const savedAgain = editorReducer(opened, {
      type: 'saved', id: document.id, path: document.path!, savedContent: document.content,
    });
    expect(isCurrentVerifiedSource(verified, savedAgain.documents.at(-1)!)).toBe(false);
    const closed = editorReducer(opened, { type: 'close', id: document.id, snapshot: document });
    const reopened = editorReducer(closed, {
      type: 'open', path: document.path!, content: document.content,
    });
    expect(reopened.documents.at(-1)?.id).toBe(document.id);
    expect(reopened.documents.at(-1)?.content).toBe(document.content);
    expect(isCurrentVerifiedSource(verified, reopened.documents.at(-1)!)).toBe(false);
    const switched = editorReducer(opened, { type: 'activate', id: 'untitled-1' });
    const switchedBack = editorReducer(switched, { type: 'activate', id: document.id });
    expect(isCurrentVerifiedSource(verified, switchedBack.documents.at(-1)!)).toBe(true);
  });
});
