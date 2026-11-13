import { beforeEach, describe, expect, it, vi } from 'vitest';
import { save } from '@tauri-apps/plugin-dialog';
import { readTextFile, stat, writeTextFile } from '@tauri-apps/plugin-fs';
import { createUntitled } from '../model/documents';
import { writeSourceFile } from './files';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}));
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  stat: vi.fn(),
  writeTextFile: vi.fn(),
}));

describe('safe .srp file writes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(stat).mockResolvedValue({ isFile: true, size: 16 } as Awaited<ReturnType<typeof stat>>);
  });

  it('rejects oversized UTF-8 editor buffers before opening a save dialog', async () => {
    const document = { ...createUntitled(9), content: '🙂'.repeat(1_048_577) };
    await expect(writeSourceFile(document, true, [])).rejects.toThrow('4 MiB');
    expect(save).not.toHaveBeenCalled();
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it('refuses to overwrite an original source that grew beyond 4 MiB', async () => {
    const document = {
      ...createUntitled(9), path: 'C:/project/main.srp',
      savedContent: 'small', content: 'edited',
    };
    vi.mocked(stat).mockResolvedValue({ isFile: true, size: 4 * 1024 * 1024 + 1 } as Awaited<ReturnType<typeof stat>>);
    await expect(writeSourceFile(document, false, [])).rejects.toThrow('4 MiB');
    expect(readTextFile).not.toHaveBeenCalled();
    expect(writeTextFile).not.toHaveBeenCalled();
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

  it('rejects a file opened in another tab while Save As was waiting', async () => {
    const livePaths: string[] = [];
    vi.mocked(save).mockImplementation(async () => {
      livePaths.push(String.raw`C:\Project\new.srp`);
      return 'c:/project/NEW.SRP';
    });
    const getPaths = vi.fn(() => livePaths);
    await expect(writeSourceFile(createUntitled(2), true, getPaths))
      .rejects.toThrow('already open');
    expect(getPaths).toHaveBeenCalledTimes(1);
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it('does not inspect other tab paths when Save As is cancelled', async () => {
    vi.mocked(save).mockResolvedValue(null);
    const getPaths = vi.fn(() => ['C:/project/new.srp']);
    await expect(writeSourceFile(createUntitled(2), true, getPaths)).resolves.toBeNull();
    expect(getPaths).not.toHaveBeenCalled();
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
