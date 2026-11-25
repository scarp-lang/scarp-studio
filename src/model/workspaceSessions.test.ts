import { describe, expect, it } from 'vitest';
import { createUntitled, type StudioDocument } from './documents';
import { editorReducer, initialEditorState } from './editorState';
import {
  captureWorkspaceSession, encodeWorkspaceSessions, parseWorkspaceSessions, planWorkspaceRestore,
  sameWorkspaceCapture, sameWorkspaceRestorePlan, validateWorkspaceSession, validWorkspaceRoot,
  MAX_REMEMBERED_WORKSPACES, MAX_WORKSPACE_SESSION_TABS, MAX_WORKSPACE_SESSION_JSON_UNITS,
  MAX_WORKSPACE_RESTORE_BYTES, type WorkspaceSession, type WorkspaceListedSource,
} from './workspaceSessions';

const root = 'C:/Scarp-Practice';
const files: WorkspaceListedSource[] = [
  { name: 'basic/main.srp', path: root + '/basic/main.srp' },
  { name: 'loops/main.srp', path: root + '/loops/main.srp' },
  { name: 'notes.srp', path: root + '/notes.srp' },
];
function doc(name: string, path: string | null, content = 'saved', savedContent = content): StudioDocument {
  return { id: path ?? name, name, path, content, savedContent, revision: 0 };
}
const session: WorkspaceSession = {
  root, savedAt: 10, names: ['basic/main.srp', 'loops/main.srp', 'notes.srp'], active: 'loops/main.srp',
};
function plan(s = session, listing = files, documents: StudioDocument[] = []) {
  const result = planWorkspaceRestore(s, root, listing, documents);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

describe('remembered workspace metadata validation', () => {
  it('accepts ordinary Windows, UNC, extended drive, extended UNC and POSIX roots', () => {
    for (const path of ['C:/work', 'C:\\work', '//server/share/work', '\\\\?\\C:\\work',
      '\\\\?\\UNC\\server\\share\\work', '/home/user/work', '/']) {
      expect(validWorkspaceRoot(path), path).toBe(true);
    }
  });
  it('rejects relative, drive-relative, control, device and malformed paths', () => {
    for (const path of ['', 'workspace', './workspace', '../workspace', 'C:work',
      '\\\\.\\PhysicalDrive0', '\\\\?\\GLOBALROOT\\Device', '//server',
      'C:/bad\u0000name', 'C:/bad\ud800name', 'x'.repeat(4097)]) {
      expect(validWorkspaceRoot(path), path).toBe(false);
    }
  });
  it('round-trips only versioned metadata', () => {
    const record = { version: 1 as const, sessions: [session] };
    const raw = encodeWorkspaceSessions(record);
    expect(raw.ok).toBe(true);
    if (raw.ok) expect(parseWorkspaceSessions(raw.value)).toEqual({ ok: true, value: record });
    expect(parseWorkspaceSessions(null)).toEqual({ ok: true, value: { version: 1, sessions: [] } });
  });
  it('rejects unknown version, extra data and malformed records', () => {
    for (const raw of ['', 'null', '{}', '[]', '{', JSON.stringify({ version: 2, sessions: [] }),
      JSON.stringify({ version: 1, sessions: [], content: 'private' })]) {
      expect(parseWorkspaceSessions(raw)).toMatchObject({ ok: false });
    }
  });
  it('rejects unsafe or non-source stored names and unexpected session fields', () => {
    for (const name of ['../outside.srp', '/outside.srp', 'folder/../outside.srp',
      'folder\\main.srp', 'folder//main.srp', 'node_modules/main.srp',
      '.git/main.srp', 'build/main.srp', 'main.txt', 'folder/a\u0000.srp',
      'a\ud800.srp', 'a/b/c/d/e/f/main.srp']) {
      expect(validateWorkspaceSession({ ...session, names: [name], active: null }), name)
        .toMatchObject({ ok: false });
    }
    expect(validateWorkspaceSession({ ...session, source: 'private' })).toMatchObject({ ok: false });
  });
  it('rejects missing, repeated or oversized tab inventories and invalid active names', () => {
    for (const value of [
      { ...session, names: [], active: null },
      { ...session, names: ['a.srp', 'a.srp'], active: null },
      { ...session, names: Array.from({ length: MAX_WORKSPACE_SESSION_TABS + 1 }, (_, i) => i + '.srp'), active: null },
      { ...session, active: 'other.srp' }, { ...session, savedAt: NaN }, { ...session, savedAt: -1 },
    ]) expect(validateWorkspaceSession(value)).toMatchObject({ ok: false });
  });
  it('rejects duplicate root aliases, too many workspaces and oversized raw records', () => {
    expect(parseWorkspaceSessions(JSON.stringify({ version: 1, sessions: [
      session, { ...session, root: 'c:\\SCARP-PRACTICE' },
    ] }))).toMatchObject({ ok: false });
    expect(parseWorkspaceSessions(JSON.stringify({ version: 1, sessions:
      Array.from({ length: MAX_REMEMBERED_WORKSPACES + 1 }, (_, i) => ({ ...session, root: '/work/' + i })) })))
      .toMatchObject({ ok: false });
    expect(parseWorkspaceSessions(' '.repeat(MAX_WORKSPACE_SESSION_JSON_UNITS + 1))).toMatchObject({ ok: false });
  });
});

describe('capture clean currently listed workspace tabs', () => {
  it('preserves tab order, the active relative name and duplicate basenames in separate folders', () => {
    const documents = [doc('main.srp', files[1].path), doc('main.srp', files[0].path)];
    const capture = captureWorkspaceSession(root, files, documents, documents[1].id, 42);
    expect(capture.session).toEqual({
      root, savedAt: 42, names: ['loops/main.srp', 'basic/main.srp'], active: 'basic/main.srp',
    });
    expect(capture.rememberedCount).toBe(2);
  });
  it('omits modified, untitled, unlisted and recovered blank drafts; never stores source text', () => {
    const documents = [
      doc('main.srp', files[0].path, 'PRIVATE SOURCE'),
      doc('main.srp', files[1].path, 'modified secret', 'saved'),
      createUntitled(1),
      { ...createUntitled(2), recoveredDraft: 'old.srp' },
      doc('outside.srp', 'C:/elsewhere/outside.srp'),
    ];
    const capture = captureWorkspaceSession(root, files, documents, documents[1].id, 42);
    expect(capture).toMatchObject({ rememberedCount: 1, omittedDirty: 1, omittedUntitled: 2, omittedUnlisted: 1 });
    expect(capture.session?.active).toBeNull();
    expect(JSON.stringify(capture)).not.toContain('PRIVATE SOURCE');
    expect(JSON.stringify(capture)).not.toContain('modified secret');
    expect(JSON.stringify(capture)).not.toContain('C:/elsewhere');
  });
  it('matches Windows path aliases but preserves exact native relative spelling', () => {
    const documents = [doc('MAIN.SRP', 'c:\\SCARP-PRACTICE\\BASIC\\MAIN.SRP')];
    expect(captureWorkspaceSession(root, files, documents, documents[0].id, 1).session?.names)
      .toEqual(['basic/main.srp']);
  });
  it('does not save ambiguous listing names or aliases of the same source', () => {
    const documents = [doc('main.srp', files[0].path)];
    const duplicateName = [...files, { name: files[0].name, path: root + '/different.srp' }];
    const duplicatePath = [...files, { name: 'alias.srp', path: 'c:/scarp-practice/BASIC/MAIN.SRP' }];
    for (const listing of [duplicateName, duplicatePath]) {
      expect(captureWorkspaceSession(root, listing, documents, documents[0].id, 1))
        .toMatchObject({ session: null, omittedAmbiguous: 1 });
    }
  });
  it('caps at the first 24 eligible tabs and reports omissions', () => {
    const listing = Array.from({ length: 30 }, (_, i) => ({ name: i + '.srp', path: root + '/' + i + '.srp' }));
    const documents = listing.map(file => doc(file.name, file.path));
    const result = captureWorkspaceSession(root, listing, documents, documents[29].id, 1);
    expect(result.session?.names).toHaveLength(MAX_WORKSPACE_SESSION_TABS);
    expect(result.omittedLimit).toBe(6);
    expect(result.session?.active).toBeNull();
  });
  it('only ignores capture timestamp when validating a reviewed list', () => {
    const documents = [doc('main.srp', files[0].path)];
    const a = captureWorkspaceSession(root, files, documents, documents[0].id, 0);
    const b = captureWorkspaceSession(root, files, documents, documents[0].id, 99);
    expect(sameWorkspaceCapture(a, b)).toBe(true);
    expect(sameWorkspaceCapture(a, { ...b, omittedDirty: 1 })).toBe(false);
    expect(sameWorkspaceCapture(a, { ...b, session: { ...b.session!, active: null } })).toBe(false);
    expect(sameWorkspaceCapture(a, { ...b, session: null })).toBe(false);
  });
});

describe('explicit workspace restore preview', () => {
  it('marks open dirty buffers, new sources and the remembered active file', () => {
    const open = doc('main.srp', files[1].path, 'dirty', 'saved');
    expect(plan(session, files, [open])).toMatchObject({
      activePath: files[1].path, newCount: 2, openCount: 1, missingCount: 0, ambiguousCount: 0,
      rows: [
        { name: files[0].name, kind: 'available', path: files[0].path },
        { name: files[1].name, kind: 'open', path: files[1].path, documentId: open.id, modified: true },
        { name: files[2].name, kind: 'available', path: files[2].path },
      ],
    });
  });
  it('never reconstructs a path from a missing stored name', () => {
    const result = plan(session, [files[0]]);
    expect(result.rows).toEqual([
      { name: files[0].name, kind: 'available', path: files[0].path },
      { name: files[1].name, kind: 'missing' },
      { name: files[2].name, kind: 'missing' },
    ]);
    expect(result.activePath).toBeNull();
    expect(result.missingCount).toBe(2);
  });
  it('marks duplicate path/name and open-document ambiguity rather than choosing arbitrarily', () => {
    expect(plan(session, [...files, { name: 'alias.srp', path: files[0].path }]).rows[0].kind).toBe('ambiguous');
    expect(plan(session, [...files, { name: files[0].name, path: root + '/other.srp' }]).rows[0].kind).toBe('ambiguous');
    const documents = [doc('main.srp', files[0].path), { ...doc('main.srp', files[0].path), id: 'another' }];
    expect(plan(session, files, documents).rows[0].kind).toBe('ambiguous');
  });
  it('requires the same selected workspace and rejects arbitrary stored path roots', () => {
    expect(planWorkspaceRestore(session, 'C:/other', files, [])).toMatchObject({ ok: false });
    expect(planWorkspaceRestore({ ...session, root: 'c:/SCARP-PRACTICE' }, root, files, [])).toMatchObject({ ok: true });
    expect(planWorkspaceRestore({ ...session, names: ['../outside.srp'], active: null }, root, files, []))
      .toMatchObject({ ok: false });
  });
  it('uses exact relative names instead of guessing after renames', () => {
    const renamed = [{ ...files[0], name: 'basic/MAIN.srp' }, ...files.slice(1)];
    expect(plan(session, renamed).rows[0].kind).toBe('missing');
  });
  it('invalidates a preview if availability, path, open identity, dirty state or active path changes', () => {
    const before = plan();
    expect(sameWorkspaceRestorePlan(before, plan())).toBe(true);
    expect(sameWorkspaceRestorePlan(before, plan(session, files.slice(1)))).toBe(false);
    expect(sameWorkspaceRestorePlan(before, plan(session, [{ ...files[0], path: root + '/new.srp' }, ...files.slice(1)]))).toBe(false);
    const open = doc('main.srp', files[0].path);
    const opened = plan(session, files, [open]);
    expect(sameWorkspaceRestorePlan(before, opened)).toBe(false);
    expect(sameWorkspaceRestorePlan(opened, plan(session, files, [{ ...open, content: 'dirty' }]))).toBe(false);
    expect(sameWorkspaceRestorePlan(opened, plan(session, files, [{ ...open, id: 'new-id' }]))).toBe(false);
    expect(sameWorkspaceRestorePlan(before, plan({ ...session, active: 'notes.srp' }))).toBe(false);
  });
});

describe('atomic workspace tab restoration', () => {
  it('appends new sources in order, keeps dirty existing tabs and activates the remembered source', () => {
    const opened = editorReducer(initialEditorState, { type: 'open', path: files[0].path, content: 'saved' });
    const dirty = editorReducer(opened, { type: 'edit', id: opened.activeId!, content: 'dirty' });
    const restored = editorReducer(dirty, { type: 'restore-workspace-tabs', files: [
      { path: files[0].path, content: 'older disk' }, { path: files[1].path, content: 'loops' },
      { path: files[2].path, content: 'notes' },
    ], activePath: files[1].path });
    expect(restored.documents).toHaveLength(dirty.documents.length + 2);
    expect(restored.documents[1]).toBe(dirty.documents[1]);
    expect(restored.documents[1].content).toBe('dirty');
    expect(restored.documents.at(-2)?.path).toBe(files[1].path);
    expect(restored.activeId).toBe(restored.documents.at(-2)?.id);
    expect(restored.sessionRevision).toBe(dirty.sessionRevision + 1);
  });
  it('does not alter existing focus when the remembered active source was unavailable', () => {
    const restored = editorReducer(initialEditorState, { type: 'restore-workspace-tabs',
      files: [{ path: files[0].path, content: 'source' }], activePath: null });
    expect(restored.activeId).toBe(initialEditorState.activeId);
  });
  it('can focus an existing tab without reading or adding new sources', () => {
    const opened = editorReducer(initialEditorState, { type: 'open', path: files[0].path, content: 'saved' });
    const other = editorReducer(opened, { type: 'activate', id: initialEditorState.activeId! });
    const restored = editorReducer(other, { type: 'restore-workspace-tabs', files: [], activePath: files[0].path });
    expect(restored.activeId).toBe(opened.activeId);
    expect(restored.documents).toBe(other.documents);
  });
  it('rejects duplicate aliases, invalid paths, invalid Unicode, unknown active paths and oversized batches', () => {
    for (const batch of [
      [{ path: files[0].path, content: 'a' }, { path: files[0].path.toUpperCase(), content: 'b' }],
      [{ path: 'relative.srp', content: 'a' }],
      [{ path: root + '/readme.txt', content: 'a' }],
      [{ path: files[0].path, content: '\ud800' }],
      [{ path: files[0].path, content: 'x'.repeat(MAX_WORKSPACE_RESTORE_BYTES / 2) },
        { path: files[1].path, content: 'x'.repeat(MAX_WORKSPACE_RESTORE_BYTES / 2 + 1) }],
      Array.from({ length: MAX_WORKSPACE_SESSION_TABS + 1 }, (_, i) => ({ path: root + '/' + i + '.srp', content: '' })),
    ]) {
      expect(editorReducer(initialEditorState, { type: 'restore-workspace-tabs', files: batch, activePath: null }))
        .toBe(initialEditorState);
    }
    expect(editorReducer(initialEditorState, { type: 'restore-workspace-tabs',
      files: [{ path: files[0].path, content: 'source' }], activePath: files[2].path })).toBe(initialEditorState);
  });
});
