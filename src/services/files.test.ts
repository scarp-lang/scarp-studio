import { beforeEach, describe, expect, it, vi } from 'vitest';
import { save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { createUntitled } from '../model/documents';
import { writeSourceFile } from './files';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}));
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}));

describe('safe .srp file writes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('does not write when Save As is cancelled', async () => {
    vi.mocked(save).mockResolvedValue(null);
    expect(await writeSourceFile(createUntitled(1), false, [])).toBeNull();
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it('rejects a conflicting Windows path already open in another tab', async () => {
    vi.mocked(save).mockResolvedValue('c:/project/main.SRP');
    await expect(writeSourceFile(createUntitled(1), true, ['C:\\Project\\main.srp']))
      .rejects.toThrow('already open');
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it('rejects a file opened in another tab while Save As is waiting', async () => {
    const livePaths: string[] = [];
    vi.mocked(save).mockImplementation(async () => {
      // A different tab opens this path while the native picker is active.
      livePaths.push(String.raw`C:\Project\new.srp`);
      return 'c:/project/NEW.SRP';
    });
    const currentPaths = vi.fn(() => livePaths);
    await expect(writeSourceFile(createUntitled(2), true, currentPaths))
      .rejects.toThrow('already open');
    expect(currentPaths).toHaveBeenCalledTimes(1);
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it('does not evaluate live tab paths when the Save As chooser is cancelled', async () => {
    vi.mocked(save).mockResolvedValue(null);
    const currentPaths = vi.fn(() => ['C:/project/example.srp']);
    await expect(writeSourceFile(createUntitled(2), true, currentPaths)).resolves.toBeNull();
    expect(currentPaths).not.toHaveBeenCalled();
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it('uses the latest live tabs when saving an existing file', async () => {
    const document = {
      ...createUntitled(7),
      path: 'C:/project/existing.srp',
      savedContent: 'old',
      content: 'edited',
    };
    const currentPaths = vi.fn(() => [String.raw`c:\PROJECT\EXISTING.srp`]);
    await expect(writeSourceFile(document, false, currentPaths)).rejects.toThrow('already open');
    expect(currentPaths).toHaveBeenCalledTimes(1);
    expect(readTextFile).not.toHaveBeenCalled();
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it('rejects destinations without the Scarp extension', async () => {
    vi.mocked(save).mockResolvedValue('/tmp/other.rs');
    await expect(writeSourceFile(createUntitled(1), true, []))
      .rejects.toThrow('.srp');
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it('writes the exact document snapshot to the selected path', async () => {
    vi.mocked(save).mockResolvedValue('C:\\Project\\example.srp');
    const document = { ...createUntitled(2), content: 'bind value = 123' };
    const selected = await writeSourceFile(document, false, []);
    expect(selected).toBe('C:\\Project\\example.srp');
    expect(writeTextFile).toHaveBeenCalledTimes(1);
    expect(writeTextFile).toHaveBeenCalledWith(selected, document.content);
  });
  it('checks an unchanged on-disk snapshot before overwriting an open file', async () => {
    const document = {
      ...createUntitled(3),
      path: 'C:/project/main.srp',
      savedContent: 'original',
      content: 'edited',
    };
    vi.mocked(readTextFile).mockResolvedValue('original');
    await expect(writeSourceFile(document, false, [])).resolves.toBe(document.path);
    expect(readTextFile).toHaveBeenCalledWith(document.path);
    expect(writeTextFile).toHaveBeenCalledWith(document.path, 'edited');
  });

  it('preserves an externally modified source file instead of overwriting it', async () => {
    const document = {
      ...createUntitled(4),
      path: 'C:/project/main.srp',
      savedContent: 'last saved version',
      content: 'new local edit',
    };
    vi.mocked(readTextFile).mockResolvedValue('external editor changes');
    await expect(writeSourceFile(document, false, [])).rejects.toThrow('changed on disk');
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it('fails safely when an original file disappeared before saving', async () => {
    const document = {
      ...createUntitled(5),
      path: 'C:/project/main.srp',
      savedContent: 'original',
      content: 'local text',
    };
    vi.mocked(readTextFile).mockRejectedValue(new Error('file not found'));
    await expect(writeSourceFile(document, false, [])).rejects.toThrow('file not found');
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it('uses the user-selected Save As destination without reading the old path', async () => {
    const document = {
      ...createUntitled(6),
      path: 'C:/project/main.srp',
      savedContent: 'old',
      content: 'new',
    };
    vi.mocked(save).mockResolvedValue('C:/project/backup.srp');
    await expect(writeSourceFile(document, true, [])).resolves.toBe('C:/project/backup.srp');
    expect(readTextFile).not.toHaveBeenCalled();
    expect(writeTextFile).toHaveBeenCalledWith('C:/project/backup.srp', 'new');
  });

});
