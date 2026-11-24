import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readDir, writeTextFile } from '@tauri-apps/plugin-fs';
import { readScarpSource } from './sourceRead';
import { scanSourceFolder, readFolderSource } from './folders';
import { writeSourceFile } from './files';
import { openedDocument, updateContent, markSaved, isDirty } from '../model/documents';

vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn(async (parent: string, name: string) => parent + '/' + name),
}));
vi.mock('@tauri-apps/plugin-fs', () => ({ readDir: vi.fn(), writeTextFile: vi.fn() }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(), save: vi.fn() }));
vi.mock('./sourceRead', () => ({ readScarpSource: vi.fn() }));

describe('nested workspace source edit/save lifecycle', () => {
  const sourcePath = 'C:/Scarp-Practice/basic_tuple/main.srp';
  let disk: string;

  beforeEach(() => {
    vi.resetAllMocks();
    disk = 'print("original");';
    vi.mocked(readDir).mockImplementation(async path => {
      if (path === 'C:/Scarp-Practice') return [
        { name: 'basic_tuple', isFile: false, isDirectory: true, isSymlink: false },
      ];
      if (path === 'C:/Scarp-Practice/basic_tuple') return [
        { name: 'main.srp', isFile: true, isDirectory: false, isSymlink: false },
      ];
      throw new Error('unexpected folder');
    });
    vi.mocked(readScarpSource).mockImplementation(async path => {
      if (path !== sourcePath) throw new Error('unexpected source');
      return disk;
    });
    vi.mocked(writeTextFile).mockImplementation(async (path, value) => {
      if (path !== sourcePath) throw new Error('unexpected destination');
      disk = value;
    });
  });

  it('opens, edits, saves to the original nested path, and marks the tab clean', async () => {
    const listing = await scanSourceFolder('C:/Scarp-Practice');
    const original = await readFolderSource(sourcePath, listing.files);
    const opened = openedDocument([], sourcePath, original);
    const edited = updateContent(opened.documents, opened.id, 'print("changed");')[0];
    expect(isDirty(edited)).toBe(true);
    expect(await writeSourceFile(edited, false, [])).toBe(sourcePath);
    const saved = markSaved([edited], edited.id, sourcePath, edited.content)[0];
    expect(saved.path).toBe(sourcePath);
    expect(isDirty(saved)).toBe(false);
    expect(disk).toBe('print("changed");');
    expect(readScarpSource).toHaveBeenCalledTimes(3);
    expect(writeTextFile).toHaveBeenCalledTimes(1);
  });

  it('preserves unsaved work when another editor has changed the nested source', async () => {
    const listing = await scanSourceFolder('C:/Scarp-Practice');
    const original = await readFolderSource(sourcePath, listing.files);
    const opened = openedDocument([], sourcePath, original);
    const edited = updateContent(opened.documents, opened.id, 'print("my edit");')[0];
    disk = 'print("external edit");';
    await expect(writeSourceFile(edited, false, [])).rejects.toThrow('changed on disk');
    expect(writeTextFile).not.toHaveBeenCalled();
    expect(isDirty(edited)).toBe(true);
  });
});
