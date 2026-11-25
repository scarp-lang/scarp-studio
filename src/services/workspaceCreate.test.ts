import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkspaceItem, type WorkspaceCreateOptions } from './workspaceCreate';

const native = vi.hoisted(() => ({
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  readDir: vi.fn(),
  mkdir: vi.fn(),
  open: vi.fn(),
  close: vi.fn(),
}));
vi.mock('@tauri-apps/api/path', () => ({ join: native.join }));
vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: native.readDir, mkdir: native.mkdir, open: native.open,
}));

const root = 'C:/workspace';
const folder = (name: string, isSymlink = false) => ({
  name, isDirectory: true, isFile: false, isSymlink,
});
const file = (name: string) => ({
  name, isDirectory: false, isFile: true, isSymlink: false,
});
const options = (extra: Partial<WorkspaceCreateOptions> = {}): WorkspaceCreateOptions => ({
  root, targets: ['', 'src', 'src/lib'],
  request: { kind: 'source', directory: 'src/lib', name: 'math' },
  isCurrent: () => true, openPaths: () => [], ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  native.readDir.mockReset();
  native.readDir.mockImplementation(async (path: string) => {
    if (path === root) return [folder('src')];
    if (path === root + '/src') return [folder('lib')];
    if (path === root + '/src/lib') return [];
    throw new Error('unlisted path');
  });
  native.mkdir.mockReset().mockResolvedValue(undefined);
  native.close.mockReset().mockResolvedValue(undefined);
  native.open.mockReset().mockResolvedValue({ close: native.close });
});

describe('native workspace creation', () => {
  it('walks every parent and creates an empty source exclusively', async () => {
    const result = await createWorkspaceItem(options());
    expect(native.readDir.mock.calls).toEqual([[root], [root + '/src'], [root + '/src/lib']]);
    expect(native.open).toHaveBeenCalledExactlyOnceWith(root + '/src/lib/math.srp', {
      write: true, createNew: true,
    });
    expect(native.close).toHaveBeenCalledOnce();
    expect(native.mkdir).not.toHaveBeenCalled();
    expect(result).toEqual({
      path: root + '/src/lib/math.srp', relativePath: 'src/lib/math.srp', kind: 'source',
    });
  });

  it('creates a single empty directory without recursive creation', async () => {
    await createWorkspaceItem(options({
      request: { kind: 'directory', directory: '', name: 'practice' },
    }));
    expect(native.mkdir).toHaveBeenCalledExactlyOnceWith(root + '/practice', { recursive: false });
    expect(native.open).not.toHaveBeenCalled();
  });

  it('rejects invalid input without touching the filesystem', async () => {
    await expect(createWorkspaceItem(options({
      request: { kind: 'source', directory: '../outside', name: 'math' },
    }))).rejects.toThrow('currently available');
    expect(native.readDir).not.toHaveBeenCalled();
    expect(native.open).not.toHaveBeenCalled();
  });

  it('rejects a parent replaced by a link', async () => {
    native.readDir.mockResolvedValueOnce([folder('src', true)]);
    await expect(createWorkspaceItem(options())).rejects.toThrow('linked');
    expect(native.join).not.toHaveBeenCalled();
    expect(native.open).not.toHaveBeenCalled();
  });

  it('rejects a missing or non-directory parent', async () => {
    native.readDir.mockResolvedValueOnce([file('src')]);
    await expect(createWorkspaceItem(options())).rejects.toThrow('parent');
    expect(native.open).not.toHaveBeenCalled();
  });

  it('rejects a portable case-insensitive name collision', async () => {
    native.readDir.mockResolvedValueOnce([folder('src')])
      .mockResolvedValueOnce([folder('lib')]).mockResolvedValueOnce([file('MATH.SRP')]);
    await expect(createWorkspaceItem(options())).rejects.toThrow('already exists');
    expect(native.open).not.toHaveBeenCalled();
  });

  it('protects an existing open editor even when its file is missing on disk', async () => {
    await expect(createWorkspaceItem(options({
      openPaths: () => ['c:\\WORKSPACE\\src\\lib\\MATH.SRP'],
    }))).rejects.toThrow('open editor');
    expect(native.open).not.toHaveBeenCalled();
  });

  it('checks the workspace generation after asynchronous native reads', async () => {
    let current = true;
    native.readDir.mockImplementationOnce(async () => {
      current = false;
      return [folder('src')];
    });
    await expect(createWorkspaceItem(options({ isCurrent: () => current })))
      .rejects.toThrow('workspace changed');
    expect(native.join).not.toHaveBeenCalled();
    expect(native.open).not.toHaveBeenCalled();
  });

  it('does not retry a race-lost exclusive creation with an overwrite', async () => {
    native.open.mockRejectedValueOnce(new Error('already exists'));
    await expect(createWorkspaceItem(options())).rejects.toThrow('already exists');
    expect(native.open).toHaveBeenCalledOnce();
    expect(native.close).not.toHaveBeenCalled();
  });

  it('reports an uncertain result if closing the created file fails', async () => {
    native.close.mockRejectedValueOnce(new Error('close failed'));
    await expect(createWorkspaceItem(options())).rejects.toThrow('may have been created');
    expect(native.open).toHaveBeenCalledOnce();
    expect(native.close).toHaveBeenCalledOnce();
  });

  it('propagates native access denial without fallback', async () => {
    native.readDir.mockRejectedValueOnce(new Error('denied'));
    await expect(createWorkspaceItem(options())).rejects.toThrow('denied');
    expect(native.open).not.toHaveBeenCalled();
    expect(native.mkdir).not.toHaveBeenCalled();
  });
});
