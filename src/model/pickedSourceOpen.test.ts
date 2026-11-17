import { describe, expect, it } from 'vitest';
import { createUntitled, openedDocument, updateContent } from './documents';
import { decidePickedSourceOpen } from './pickedSourceOpen';

describe('safe native source selection after a file picker', () => {
  it('selects a previously opened dirty tab without another disk read', () => {
    const opened = openedDocument([createUntitled(1)], 'C:/Project/Main.srp', 'disk');
    const dirty = updateContent(opened.documents, opened.id, 'unsaved source');
    expect(decidePickedSourceOpen('c:/project/main.SRP', dirty, opened.id, opened.id))
      .toEqual({ kind: 'activate', documentId: opened.id });
    expect(dirty[1].content).toBe('unsaved source');
  });

  it('safely selects UNC and extended-length Windows aliases', () => {
    const opened = openedDocument([], String.raw`\\server\share\main.srp`, 'disk');
    expect(decidePickedSourceOpen(
      String.raw`\\?\UNC\SERVER\SHARE\MAIN.SRP`,
      opened.documents, opened.id, opened.id,
    )).toEqual({ kind: 'activate', documentId: opened.id });
  });

  it('loads a new path only if the picker-start tab stayed active', () => {
    const docs = [createUntitled(1)];
    expect(decidePickedSourceOpen('C:/project/new.srp', docs, docs[0].id, docs[0].id))
      .toEqual({ kind: 'read', path: 'C:/project/new.srp' });
    expect(decidePickedSourceOpen('C:/project/new.srp', docs, docs[0].id, 'untitled-2'))
      .toEqual({ kind: 'stale' });
  });

  it('does not change the active tab when the original file was selected again', () => {
    const opened = openedDocument([], '/project/file.srp', 'disk');
    const different = [opened.documents[0], createUntitled(2)];
    expect(decidePickedSourceOpen('/project/file.srp', different, opened.id, 'untitled-2'))
      .toEqual({ kind: 'stale' });
  });

  it('keeps distinct POSIX file cases and rejects non-Scarp paths', () => {
    const opened = openedDocument([], '/project/Main.srp', 'disk');
    expect(decidePickedSourceOpen('/project/main.srp', opened.documents, opened.id, opened.id))
      .toEqual({ kind: 'read', path: '/project/main.srp' });
    expect(decidePickedSourceOpen('/project/main.rs', opened.documents, opened.id, opened.id))
      .toEqual({ kind: 'invalid' });
  });

  it('treats null-to-non-null activation as a stale result', () => {
    expect(decidePickedSourceOpen('/project/main.srp', [], null, 'untitled-1'))
      .toEqual({ kind: 'stale' });
    expect(decidePickedSourceOpen('/project/main.srp', [], null, null))
      .toEqual({ kind: 'read', path: '/project/main.srp' });
  });
});
