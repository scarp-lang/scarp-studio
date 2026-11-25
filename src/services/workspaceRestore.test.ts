import { describe, expect, it, vi } from 'vitest';
import { prepareWorkspaceRestore, type WorkspaceRestoreRequest } from './workspaceRestore';
import { MAX_WORKSPACE_RESTORE_BYTES, planWorkspaceRestore, type WorkspaceSession } from '../model/workspaceSessions';
import type { StudioDocument } from '../model/documents';

const root = 'C:/practice';
const listedFiles = [
  { name: 'one.srp', path: root + '/one.srp' },
  { name: 'two.srp', path: root + '/two.srp' },
  { name: 'three.srp', path: root + '/three.srp' },
];
const session: WorkspaceSession = {
  root, savedAt: 1, names: ['one.srp', 'two.srp', 'three.srp'], active: 'two.srp',
};
function openDoc(path: string, content: string): StudioDocument {
  return { id: path, path, name: path.split('/').at(-1)!, content, savedContent: 'saved', revision: 1 };
}
function request(overrides: Partial<WorkspaceRestoreRequest> = {}): WorkspaceRestoreRequest {
  const params = { session, selectedRoot: root, listedFiles, documents: [],
    isCurrent: () => true, read: async () => 'source', ...overrides };
  const preview = planWorkspaceRestore(params.session, params.selectedRoot, params.listedFiles, params.documents);
  if (!preview.ok) throw new Error(preview.error);
  return { ...params, expectedPlan: preview.value, ...overrides };
}

describe('bounded workspace restore reads', () => {
  it('reads only exact listed paths sequentially and accounts for UTF-8 bytes', async () => {
    const read = vi.fn(async (path: string, _budget: number) => path === listedFiles[0].path ? '🌍' : 'abc');
    const result = await prepareWorkspaceRestore(request({ read }));
    expect(read.mock.calls).toEqual([
      [listedFiles[0].path, MAX_WORKSPACE_RESTORE_BYTES],
      [listedFiles[1].path, MAX_WORKSPACE_RESTORE_BYTES - 4],
      [listedFiles[2].path, MAX_WORKSPACE_RESTORE_BYTES - 7],
    ]);
    expect(result.files).toEqual([
      { path: listedFiles[0].path, content: '🌍' },
      { path: listedFiles[1].path, content: 'abc' },
      { path: listedFiles[2].path, content: 'abc' },
    ]);
    expect(result.activePath).toBe(listedFiles[1].path);
    expect(result.alreadyOpen).toBe(0);
  });

  it('does not reread existing dirty tabs or construct paths for unlisted files', async () => {
    const read = vi.fn(async () => 'disk');
    const existing = openDoc(listedFiles[1].path, 'unsaved editor content');
    const result = await prepareWorkspaceRestore(request({
      listedFiles: listedFiles.slice(0, 2), documents: [existing], read,
    }));
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith(listedFiles[0].path, MAX_WORKSPACE_RESTORE_BYTES);
    expect(result).toEqual({
      files: [{ path: listedFiles[0].path, content: 'disk' }],
      activePath: existing.path, alreadyOpen: 1, skipped: 1,
    });
    expect(existing.content).toBe('unsaved editor content');
  });

  it('skips reviewed ambiguous entries without touching native reads', async () => {
    const read = vi.fn(async () => 'disk');
    const result = await prepareWorkspaceRestore(request({
      listedFiles: [...listedFiles, { name: 'alias.srp', path: listedFiles[0].path }], read,
    }));
    expect(read).toHaveBeenCalledTimes(2);
    expect(result.skipped).toBe(1);
    expect(result.files.map(file => file.path)).toEqual([listedFiles[1].path, listedFiles[2].path]);
  });

  it('rejects a stale operation before the first read', async () => {
    const read = vi.fn(async () => 'source');
    await expect(prepareWorkspaceRestore(request({ isCurrent: () => false, read }))).rejects.toThrow('changed');
    expect(read).not.toHaveBeenCalled();
  });

  it('rejects all staged results if the live editor changes during a read', async () => {
    let current = true;
    const read = vi.fn(async () => { current = false; return 'disk'; });
    await expect(prepareWorkspaceRestore(request({ isCurrent: () => current, read }))).rejects.toThrow('changed');
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('rejects changed availability and stale previews before any read', async () => {
    const read = vi.fn(async () => 'disk');
    const previous = request();
    await expect(prepareWorkspaceRestore({
      ...previous, listedFiles: listedFiles.slice(1), read,
    })).rejects.toThrow('preview changed');
    expect(read).not.toHaveBeenCalled();
  });

  it('discards the staged batch on a later native failure', async () => {
    const read = vi.fn(async (path: string) => {
      if (path === listedFiles[1].path) throw new Error('access denied');
      return 'disk';
    });
    await expect(prepareWorkspaceRestore(request({ read }))).rejects.toThrow('Cannot restore two.srp: access denied');
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('enforces the aggregate read budget even if the reader returns too much', async () => {
    const read = vi.fn(async (path: string) => path === listedFiles[0].path
      ? 'x'.repeat(MAX_WORKSPACE_RESTORE_BYTES - 1) : '🌍');
    await expect(prepareWorkspaceRestore(request({ read }))).rejects.toThrow('4 MiB read budget');
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('never invokes the reader with a zero byte limit', async () => {
    const read = vi.fn(async () => 'x'.repeat(MAX_WORKSPACE_RESTORE_BYTES));
    await expect(prepareWorkspaceRestore(request({ read }))).rejects.toThrow('4 MiB read budget');
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed Unicode before any editor state can be applied', async () => {
    await expect(prepareWorkspaceRestore(request({ read: async () => '\ud800' }))).rejects.toThrow('unpaired');
  });

  it('handles an already-open remembered active tab without any native reads', async () => {
    const read = vi.fn(async () => 'disk');
    const result = await prepareWorkspaceRestore(request({
      documents: listedFiles.map(file => openDoc(file.path, 'existing')), read,
    }));
    expect(read).not.toHaveBeenCalled();
    expect(result).toEqual({ files: [], activePath: listedFiles[1].path, alreadyOpen: 3, skipped: 0 });
  });
});
