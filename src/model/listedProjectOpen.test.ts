import { describe, expect, it } from 'vitest';
import { openedDocument, updateContent } from './documents';
import { resolveListedProjectOpen } from './listedProjectOpen';

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
    const path = String.raw`C:\\Project\\Main.srp`;
    const decision = resolveListedProjectOpen(
      'c:/project/main.SRP', [{ path }], [],
    );
    expect(decision).toEqual({ kind: 'load', path });
  });

  it('matches canonical Windows drive and UNC aliases conservatively', () => {
    expect(resolveListedProjectOpen(
      String.raw`\\\\?\\C:\\Project\\Main.srp`,
      [{ path: 'c:/project/main.srp' }],
      [],
    )).toEqual({ kind: 'load', path: 'c:/project/main.srp' });
    expect(resolveListedProjectOpen(
      String.raw`\\\\?\\UNC\\server\\share\\Main.srp`,
      [{ path: String.raw`\\\\server\\share\\main.srp` }],
      [],
    )).toEqual({ kind: 'load', path: String.raw`\\\\server\\share\\main.srp` });
  });

  it('preserves distinct case-sensitive POSIX source names', () => {
    const files = [{ path: '/project/Main.srp' }];
    expect(resolveListedProjectOpen('/project/main.srp', files, []))
      .toEqual({ kind: 'not-listed' });
  });
});
