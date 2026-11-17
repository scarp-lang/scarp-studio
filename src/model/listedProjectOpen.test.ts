import { describe, expect, it } from 'vitest';
import { openedDocument, updateContent } from './documents';
import { editorReducer, initialEditorState } from './editorState';
import { isCurrentListedSourceRead, resolveListedProjectOpen } from './listedProjectOpen';

describe('bounded Explorer source selection', () => {
  it('rejects a file absent from the currently selected project listing', () => {
    const files = [{ path: 'C:/project/main.srp' }];
    expect(resolveListedProjectOpen('C:/outside/secret.srp', files, []))
      .toEqual({ kind: 'not-listed' });
    expect(resolveListedProjectOpen('C:/project/unlisted.srp', files, []))
      .toEqual({ kind: 'not-listed' });
  });

  it('reuses a live dirty tab instead of reading a renamed or removed disk file', () => {
    const opened = openedDocument([], 'C:/Project/Main.srp', 'first');
    const dirty = updateContent(opened.documents, opened.id, 'unsaved Scarp work');
    const decision = resolveListedProjectOpen(
      'c:/project/main.SRP', [{ path: 'C:/Project/Main.srp' }], dirty,
    );
    expect(decision).toEqual({ kind: 'activate', documentId: opened.id });
    expect(dirty[0].content).toBe('unsaved Scarp work');
  });

  it('does not activate an already-open tab through a no-longer-listed path', () => {
    const opened = openedDocument([], 'C:/project/removed.srp', 'buffer');
    expect(resolveListedProjectOpen('C:/project/removed.srp', [], opened.documents))
      .toEqual({ kind: 'not-listed' });
  });

  it('reads new project files using exactly the current selected listing path', () => {
    const path = String.raw`C:\Project\Main.srp`;
    const decision = resolveListedProjectOpen(
      'c:/project/main.SRP', [{ path }], [],
    );
    expect(decision).toEqual({ kind: 'load', path });
  });

  it('matches canonical Windows drive and UNC aliases conservatively', () => {
    expect(resolveListedProjectOpen(
      String.raw`\\?\C:\Project\Main.srp`,
      [{ path: 'c:/project/main.srp' }],
      [],
    )).toEqual({ kind: 'load', path: 'c:/project/main.srp' });
    expect(resolveListedProjectOpen(
      String.raw`\\?\UNC\server\share\Main.srp`,
      [{ path: String.raw`\\server\share\main.srp` }],
      [],
    )).toEqual({ kind: 'load', path: String.raw`\\server\share\main.srp` });
  });

  it('accepts a delayed Explorer source read only while the current tab stays untouched', () => {
    const folder = { path: 'C:/Project', files: [{ path: 'C:/Project/a.srp' }] };
    const editor = editorReducer(initialEditorState, {
      type: 'open', path: 'C:/Project/current.srp', content: 'original',
    });
    const active = editor.documents[1];
    expect(isCurrentListedSourceRead(folder, folder, active.id, active, editor)).toBe(true);
    const stillActive = editorReducer(editor, { type: 'activate', id: active.id });
    expect(isCurrentListedSourceRead(folder, folder, active.id, active, stillActive)).toBe(true);
  });

  it('rejects a delayed Explorer read after editing the same active tab', () => {
    const folder = { path: '/project', files: [] };
    const editor = editorReducer(initialEditorState, {
      type: 'open', path: '/project/current.srp', content: 'initial',
    });
    const active = editor.documents[1];
    const edited = editorReducer(editor, {
      type: 'edit', id: active.id, content: 'new unsaved source',
    });
    expect(isCurrentListedSourceRead(folder, folder, active.id, active, edited)).toBe(false);
    expect(edited.documents[1].content).toBe('new unsaved source');
  });

  it('rejects a delayed Explorer read after tab switch, Save, or folder refresh', () => {
    const folder = { path: '/project', files: [{ path: '/project/target.srp' }] };
    const editor = editorReducer(initialEditorState, {
      type: 'open', path: '/project/current.srp', content: 'original',
    });
    const active = editor.documents[1];
    const switched = editorReducer(editor, { type: 'activate', id: 'untitled-1' });
    expect(isCurrentListedSourceRead(folder, folder, active.id, active, switched)).toBe(false);
    const saved = editorReducer(editor, {
      type: 'saved', id: active.id, path: active.path!, savedContent: 'new disk',
    });
    expect(isCurrentListedSourceRead(folder, folder, active.id, active, saved)).toBe(false);
    const refreshed = { path: folder.path, files: folder.files };
    expect(isCurrentListedSourceRead(folder, refreshed, active.id, active, editor)).toBe(false);
    expect(isCurrentListedSourceRead(folder, null, active.id, active, editor)).toBe(false);
  });

  it('rejects a new-tab insertion while the initially selected tab was absent', () => {
    const folder = { path: '/project', files: [] };
    const noTabs = { ...initialEditorState, documents: [], activeId: null };
    expect(isCurrentListedSourceRead(folder, folder, null, null, noTabs)).toBe(true);
    const added = editorReducer(noTabs, { type: 'new' });
    expect(isCurrentListedSourceRead(folder, folder, null, null, added)).toBe(false);
  });

  it('preserves distinct case-sensitive POSIX source names', () => {
    const files = [{ path: '/project/Main.srp' }];
    expect(resolveListedProjectOpen('/project/main.srp', files, []))
      .toEqual({ kind: 'not-listed' });
  });
});
