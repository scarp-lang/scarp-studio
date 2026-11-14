import { beforeEach, describe, expect, it, vi } from 'vitest';
import { join } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import { readDir, readTextFile, stat } from '@tauri-apps/plugin-fs';
import { chooseSourceFolder, readFolderSource } from './folders';

vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn(async (parent: string, name: string) => parent + '/' + name),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));
vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: vi.fn(),
  readTextFile: vi.fn(),
  stat: vi.fn(),
}));

describe('selected-folder Scarp source reads', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(stat).mockResolvedValue({ isFile: true, size: 64 } as Awaited<ReturnType<typeof stat>>);
  });

  it('does not request directory entries if the chooser was cancelled', async () => {
    vi.mocked(open).mockResolvedValue(null);
    expect(await chooseSourceFolder()).toBeNull();
    expect(readDir).not.toHaveBeenCalled();
  });

  it('reads only top-level regular Scarp file names', async () => {
    vi.mocked(open).mockResolvedValue('C:/project');
    vi.mocked(readDir).mockResolvedValue([
      { name: 'z.srp', isFile: true, isSymlink: false, isDirectory: false },
      { name: 'other.rs', isFile: true, isSymlink: false, isDirectory: false },
      { name: 'a.SRP', isFile: true, isSymlink: false, isDirectory: false },
      { name: 'unsafe.srp', isFile: false, isSymlink: true, isDirectory: false },
    ]);
    const listing = await chooseSourceFolder();
    expect(listing?.files).toEqual([
      { name: 'a.SRP', path: 'C:/project/a.SRP' },
      { name: 'z.srp', path: 'C:/project/z.srp' },
    ]);
    expect(listing?.truncated).toBe(false);
    expect(join).toHaveBeenCalledTimes(2);
  });

  it('shows standard src, tests and examples Scarp sources without recursion', async () => {
    vi.mocked(open).mockResolvedValue('C:/project');
    vi.mocked(readDir).mockImplementation(async (path) => {
      if (path === 'C:/project') return [
        { name: 'src', isFile: false, isDirectory: true, isSymlink: false },
        { name: 'tests', isFile: false, isDirectory: true, isSymlink: false },
        { name: 'examples', isFile: false, isDirectory: true, isSymlink: false },
        { name: 'vendor', isFile: false, isDirectory: true, isSymlink: false },
        { name: 'linked-src', isFile: false, isDirectory: true, isSymlink: true },
      ];
      if (path === 'C:/project/src') return [
        { name: 'main.srp', isFile: true, isDirectory: false, isSymlink: false },
        { name: 'child', isFile: false, isDirectory: true, isSymlink: false },
      ];
      if (path === 'C:/project/tests') return [
        { name: 'hello.srp', isFile: true, isDirectory: false, isSymlink: false },
      ];
      if (path === 'C:/project/examples') return [
        { name: 'demo.srp', isFile: true, isDirectory: false, isSymlink: false },
        { name: 'external.srp', isFile: true, isDirectory: false, isSymlink: true },
      ];
      throw new Error('unexpected recursive scan ' + path);
    });
    const listing = await chooseSourceFolder();
    expect(listing?.files).toEqual([
      { name: 'examples/demo.srp', path: 'C:/project/examples/demo.srp' },
      { name: 'src/main.srp', path: 'C:/project/src/main.srp' },
      { name: 'tests/hello.srp', path: 'C:/project/tests/hello.srp' },
    ]);
    expect(listing?.truncated).toBe(false);
    expect(listing?.unavailableFolders).toEqual([]);
    expect(readDir).toHaveBeenCalledTimes(4);
  });

  it('reports unreadable project subdirectories while retaining root files', async () => {
    vi.mocked(open).mockResolvedValue('C:/project');
    vi.mocked(readDir).mockImplementation(async (path) => {
      if (path === 'C:/project') return [
        { name: 'root.srp', isFile: true, isDirectory: false, isSymlink: false },
        { name: 'src', isFile: false, isDirectory: true, isSymlink: false },
      ];
      throw new Error('Access denied to project sources');
    });
    const listing = await chooseSourceFolder();
    expect(listing?.files).toEqual([{ name: 'root.srp', path: 'C:/project/root.srp' }]);
    expect(listing?.unavailableFolders).toEqual(['src']);
  });

  it('never traverses symlinked project subdirectories', async () => {
    vi.mocked(open).mockResolvedValue('C:/project');
    vi.mocked(readDir).mockResolvedValue([
      { name: 'src', isFile: false, isDirectory: true, isSymlink: true },
      { name: 'tests', isFile: false, isDirectory: true, isSymlink: true },
    ]);
    expect((await chooseSourceFolder())?.files).toEqual([]);
    expect(readDir).toHaveBeenCalledTimes(1);
  });

  it('enforces a combined 200-file limit across root and project subfolders', async () => {
    vi.mocked(open).mockResolvedValue('C:/project');
    const asFile = (name: string) => ({ name, isFile: true, isDirectory: false, isSymlink: false });
    vi.mocked(readDir).mockImplementation(async (path) =>
      path === 'C:/project'
        ? [
          ...Array.from({ length: 195 }, (_, i) => asFile('root' + i + '.srp')),
          { name: 'src', isFile: false, isDirectory: true, isSymlink: false },
        ]
        : Array.from({ length: 40 }, (_, i) => asFile('nested' + i + '.srp')));
    const listing = await chooseSourceFolder();
    expect(listing?.files).toHaveLength(200);
    expect(listing?.truncated).toBe(true);
  });

  it('opens a nested source only when it was explicitly listed', async () => {
    vi.mocked(readTextFile).mockResolvedValue('print("nested");');
    const selected = [{ name: 'src/main.srp', path: 'C:/project/src/main.srp' }];
    await expect(readFolderSource('C:/project/src/main.srp', selected))
      .resolves.toBe('print("nested");');
    await expect(readFolderSource('C:/project/src/hidden.srp', selected))
      .rejects.toThrow('current folder listing');
    expect(readTextFile).toHaveBeenCalledTimes(1);
  });

  it('refuses paths not present in the current selected listing', async () => {
    await expect(readFolderSource('C:/another/outside.srp', [
      { name: 'file.srp', path: 'C:/project/file.srp' },
    ])).rejects.toThrow('current folder listing');
    expect(readTextFile).not.toHaveBeenCalled();
  });

  it('allows Windows path aliases for an explicitly listed file', async () => {
    vi.mocked(readTextFile).mockResolvedValue('print("hello");');
    const listing = [{ name: 'Main.srp', path: 'C:/Project/Main.srp' }];
    const result = await readFolderSource('c:\\project\\main.SRP', listing);
    expect(result).toBe('print("hello");');
    expect(readTextFile).toHaveBeenCalledWith('C:/Project/Main.srp');
  });

  it('rejects non-Scarp paths even if a caller injects them into the list', async () => {
    await expect(readFolderSource('C:/project/main.rs', [
      { name: 'main.rs', path: 'C:/project/main.rs' },
    ])).rejects.toThrow('.srp');
    expect(readTextFile).not.toHaveBeenCalled();
  });
});
