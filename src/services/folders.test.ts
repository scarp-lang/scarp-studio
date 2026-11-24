import { beforeEach, describe, expect, it, vi } from 'vitest';
import { join } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import { readDir } from '@tauri-apps/plugin-fs';
import { readScarpSource } from './sourceRead';
import { chooseSourceFolder, readFolderSource, scanSourceFolder } from './folders';

vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn(async (parent: string, name: string) => parent + '/' + name),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));
vi.mock('@tauri-apps/plugin-fs', () => ({ readDir: vi.fn() }));
vi.mock('./sourceRead', () => ({ readScarpSource: vi.fn() }));

describe('selected-folder Scarp source reads', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(readScarpSource).mockResolvedValue('');
  });

  it('does not request directory entries if the chooser was cancelled', async () => {
    vi.mocked(open).mockResolvedValue(null);
    expect(await chooseSourceFolder()).toBeNull();
    expect(readDir).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ directory: true, recursive: true, multiple: false }));
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

  it('shows standard Scarp sources and scans safe nested folders', async () => {
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
      if (path === 'C:/project/src/child') return [];
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
    expect(listing?.directories).toEqual(['src', 'tests', 'examples', 'src/child']);
    expect(readDir).toHaveBeenCalledTimes(5);
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

  it('refreshes directory listing on demand without another native folder picker', async () => {
    vi.mocked(readDir)
      .mockResolvedValueOnce([
        { name: 'original.srp', isFile: true, isDirectory: false, isSymlink: false },
      ])
      .mockResolvedValueOnce([
        { name: 'added.srp', isFile: true, isDirectory: false, isSymlink: false },
        { name: 'renamed.srp', isFile: true, isDirectory: false, isSymlink: false },
      ]);
    const original = await scanSourceFolder('C:/project');
    const latest = await scanSourceFolder('C:/project');
    expect(original.files.map((file) => file.name)).toEqual(['original.srp']);
    expect(latest.files.map((file) => file.name)).toEqual(['added.srp', 'renamed.srp']);
    expect(latest.truncated).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it('reports root read failures on refresh without inventing an empty listing', async () => {
    vi.mocked(readDir).mockRejectedValue(new Error('Access denied'));
    await expect(scanSourceFolder('C:/project')).rejects.toThrow('Access denied');
    expect(open).not.toHaveBeenCalled();
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

  it('preserves standard nested sources under a saturated 200-file root', async () => {
    vi.mocked(open).mockResolvedValue('C:/project');
    const asFile = (name: string) => ({
      name, isFile: true, isDirectory: false, isSymlink: false,
    });
    const asDirectory = (name: string) => ({
      name, isFile: false, isDirectory: true, isSymlink: false,
    });
    vi.mocked(readDir).mockImplementation(async (path) => {
      if (path === 'C:/project') return [
        ...Array.from({ length: 200 }, (_, i) =>
          asFile('root-' + String(i).padStart(3, '0') + '.srp')),
        asDirectory('src'), asDirectory('tests'), asDirectory('examples'),
      ];
      if (path === 'C:/project/src') return [
        ...Array.from({ length: 225 }, (_, i) =>
          asFile('a-' + String(i).padStart(3, '0') + '.srp')),
        asFile('main.srp'),
      ];
      if (path === 'C:/project/tests') return [asFile('smoke.srp')];
      if (path === 'C:/project/examples') return [asFile('demo.srp')];
      throw new Error('unexpected directory scan');
    });
    const listing = await chooseSourceFolder();
    expect(listing?.truncated).toBe(true);
    expect(listing?.files).toHaveLength(200);
    expect(listing?.files).toContainEqual({
      name: 'src/main.srp', path: 'C:/project/src/main.srp',
    });
    expect(listing?.files).toContainEqual({
      name: 'tests/smoke.srp', path: 'C:/project/tests/smoke.srp',
    });
    expect(listing?.files).toContainEqual({
      name: 'examples/demo.srp', path: 'C:/project/examples/demo.srp',
    });
    // Three directory joins plus only the 200 selected file paths.
    expect(join).toHaveBeenCalledTimes(203);
    expect(readDir).toHaveBeenCalledTimes(4);
  });

  it('finds standard project folders after the 4096-entry generic budget', async () => {
    const other = Array.from({ length: 4096 }, (_, index) => ({
      name: 'noise-' + index + '.rs', isFile: true, isDirectory: false, isSymlink: false,
    }));
    const file = (name: string) => ({
      name, isFile: true, isDirectory: false, isSymlink: false,
    });
    const directory = (name: string, isSymlink = false) => ({
      name, isFile: false, isDirectory: true, isSymlink,
    });
    vi.mocked(readDir).mockImplementation(async (path) => {
      if (path === 'C:/project') return [
        ...other, file('main.srp'),
        directory('src'), directory('tests'), directory('examples', true),
      ];
      if (path === 'C:/project/src') return [file('main.srp')];
      if (path === 'C:/project/tests') return [file('smoke.srp')];
      throw new Error('unexpected directory traversal: ' + path);
    });
    const result = await scanSourceFolder('C:/project');
    expect(result.truncated).toBe(true);
    expect(result.files).toEqual([
      { name: 'main.srp', path: 'C:/project/main.srp' },
      { name: 'src/main.srp', path: 'C:/project/src/main.srp' },
      { name: 'tests/smoke.srp', path: 'C:/project/tests/smoke.srp' },
    ]);
    expect(readDir).toHaveBeenCalledTimes(3);
    expect(readDir).not.toHaveBeenCalledWith('C:/project/examples');
    expect(result.unavailableFolders).toEqual([]);
  });

  it('opens a nested source only when it was explicitly listed', async () => {
    vi.mocked(readScarpSource).mockResolvedValue('print("nested");');
    const selected = [{ name: 'src/main.srp', path: 'C:/project/src/main.srp' }];
    await expect(readFolderSource('C:/project/src/main.srp', selected))
      .resolves.toBe('print("nested");');
    await expect(readFolderSource('C:/project/src/hidden.srp', selected))
      .rejects.toThrow('current folder listing');
    expect(readScarpSource).toHaveBeenCalledTimes(1);
  });

  it('refuses paths not present in the current selected listing', async () => {
    await expect(readFolderSource('C:/another/outside.srp', [
      { name: 'file.srp', path: 'C:/project/file.srp' },
    ])).rejects.toThrow('current folder listing');
    expect(readScarpSource).not.toHaveBeenCalled();
  });

  it('allows Windows path aliases for an explicitly listed file', async () => {
    vi.mocked(readScarpSource).mockResolvedValue('print("hello");');
    const listing = [{ name: 'Main.srp', path: 'C:/Project/Main.srp' }];
    const result = await readFolderSource('c:\\project\\main.SRP', listing);
    expect(result).toBe('print("hello");');
    expect(readScarpSource).toHaveBeenCalledWith('C:/Project/Main.srp');
  });

  it('rejects non-Scarp paths even if a caller injects them into the list', async () => {
    await expect(readFolderSource('C:/project/main.rs', [
      { name: 'main.rs', path: 'C:/project/main.rs' },
    ])).rejects.toThrow('.srp');
    expect(readScarpSource).not.toHaveBeenCalled();
  });
});
