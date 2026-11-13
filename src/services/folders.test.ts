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
