import { beforeEach, describe, expect, it, vi } from 'vitest';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { readScarpSource } from './sourceRead';
import { createUntitled } from '../model/documents';
import { writeSourceFile } from './files';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}));
vi.mock('@tauri-apps/plugin-fs', () => ({ writeTextFile: vi.fn() }));
vi.mock('./sourceRead', () => ({ readScarpSource: vi.fn() }));

describe('safe .srp file writes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(readScarpSource).mockResolvedValue('original');
    // Model the filesystem's successful write and subsequent bounded
    // read-back, rather than returning the pre-save disk snapshot forever.
    vi.mocked(writeTextFile).mockImplementation(async (_path, content) => {
      vi.mocked(readScarpSource).mockResolvedValue(content);
    });
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
    vi.mocked(readScarpSource).mockRejectedValue(new Error('Scarp source exceeds the 4 MiB editor file limit.'));
    await expect(writeSourceFile(document, false, [])).rejects.toThrow('4 MiB');
    // Source size validation is now inside the bounded handle reader.
    // The caller must invoke that reader and must not invoke the writer.
    expect(readScarpSource).toHaveBeenCalledWith(document.path);
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

  it('rejects Save As via forward-slash UNC spelling of a dirty network tab', async () => {
    vi.mocked(save).mockResolvedValue('//SERVER/SHARE/src/main.srp');
    await expect(writeSourceFile(createUntitled(18), true, [
      String.raw`\\server\share\src\MAIN.SRP`,
    ])).rejects.toThrow('already open');
    expect(readScarpSource).not.toHaveBeenCalled();
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it('refuses Save As through a Windows parent-directory alias of an already-open tab', async () => {
    vi.mocked(save).mockResolvedValue(String.raw`C:\Project\src\..\main.srp`);
    await expect(writeSourceFile(createUntitled(1), true, ['c:/project/MAIN.SRP']))
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
    expect(readScarpSource).not.toHaveBeenCalled();
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
    vi.mocked(readScarpSource).mockResolvedValue('original');
    await expect(writeSourceFile(document, false, [])).resolves.toBe(document.path);
    expect(readScarpSource).toHaveBeenCalledWith(document.path);
    expect(writeTextFile).toHaveBeenCalledWith(document.path, 'edited');
  });

  it('preserves an externally modified source file instead of overwriting it', async () => {
    const document = {
      ...createUntitled(4),
      path: 'C:/project/main.srp',
      savedContent: 'last saved version',
      content: 'new local edit',
    };
    vi.mocked(readScarpSource).mockResolvedValue('external editor changes');
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
    vi.mocked(readScarpSource).mockRejectedValue(new Error('file not found'));
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
    // Save As must not read the old file to validate its snapshot. The only
    // read is the NEW destination after writing, for exact byte verification.
    expect(readScarpSource).toHaveBeenCalledTimes(1);
    expect(readScarpSource).toHaveBeenCalledWith('C:/project/backup.srp');
    expect(writeTextFile).toHaveBeenCalledWith('C:/project/backup.srp', 'new');
  });

  it('never opens a dialog or writes if the buffer has an unpaired Unicode surrogate', async () => {
    const document = { ...createUntitled(8), content: 'print("\uD800");' };
    await expect(writeSourceFile(document, true, [])).rejects.toThrow(/unpaired UTF-16 surrogate/);
    expect(save).not.toHaveBeenCalled();
    expect(readScarpSource).not.toHaveBeenCalled();
    expect(writeTextFile).not.toHaveBeenCalled();
  });
  it('verifies a successful Save As by reading back the exact saved UTF-8 source', async () => {
    vi.mocked(save).mockResolvedValue('C:/project/unicode.srp');
    const source = { ...createUntitled(10), content: 'print("नमस्ते 👋");' };
    await expect(writeSourceFile(source, false, [])).resolves.toBe('C:/project/unicode.srp');
    expect(writeTextFile).toHaveBeenCalledWith('C:/project/unicode.srp', source.content);
    expect(readScarpSource).toHaveBeenCalledWith('C:/project/unicode.srp');
  });

  it('refuses to report Save success after an external same-length rewrite', async () => {
    const source = { ...createUntitled(11), path: 'C:/project/main.srp',
      savedContent: 'original', content: 'print("aaa");' };
    // Simulate a sync client / second editor replacing the bytes after the
    // successful native write but before the editor records savedContent.
    vi.mocked(writeTextFile).mockResolvedValue(undefined);
    vi.mocked(readScarpSource).mockResolvedValueOnce('original')
      .mockResolvedValueOnce('print("bbb");');
    await expect(writeSourceFile(source, false, []))
      .rejects.toThrow('NOT marked saved');
    expect(writeTextFile).toHaveBeenCalledWith(source.path, source.content);
    expect(readScarpSource).toHaveBeenCalledTimes(2);
  });

  it('does not trust a successful write when read-back fails or source disappears', async () => {
    vi.mocked(save).mockResolvedValue('C:/project/vanished.srp');
    vi.mocked(writeTextFile).mockResolvedValue(undefined);
    vi.mocked(readScarpSource).mockRejectedValue(new Error('file not found'));
    await expect(writeSourceFile(
      { ...createUntitled(12), content: 'print(12);' }, false, [],
    )).rejects.toThrow('could not be verified on disk');
    expect(writeTextFile).toHaveBeenCalledTimes(1);
  });

  it('does not trust a successful write if the destination grows beyond the reader limit', async () => {
    vi.mocked(save).mockResolvedValue('C:/project/grown.srp');
    vi.mocked(writeTextFile).mockResolvedValue(undefined);
    vi.mocked(readScarpSource).mockRejectedValue(new Error('4 MiB editor file limit'));
    await expect(writeSourceFile(
      { ...createUntitled(13), content: 'print(13);' }, true, [],
    )).rejects.toThrow('could not be verified on disk');
  });

  it('does not write the older snapshot when its tab changes during Save As', async () => {
    const original = { ...createUntitled(31), content: 'original snapshot' };
    let current = true;
    vi.mocked(save).mockImplementation(async () => {
      // A user keystroke lands while the OS chooser is still outstanding.
      current = false;
      return 'C:/project/from-dialog.srp';
    });
    const isCurrent = vi.fn(() => current);
    await expect(writeSourceFile(original, true, [], isCurrent))
      .rejects.toThrow('No file was written');
    expect(isCurrent).toHaveBeenCalledTimes(1);
    expect(readScarpSource).not.toHaveBeenCalled();
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it('rechecks the source after asynchronous pre-save disk validation', async () => {
    const original = { ...createUntitled(32), path: 'C:/project/live.srp',
      content: 'my new edit', savedContent: 'prior saved bytes' };
    let current = true;
    vi.mocked(readScarpSource).mockImplementation(async () => {
      // A competing user edit occurs after the original disk bytes matched.
      current = false;
      return 'prior saved bytes';
    });
    const isCurrent = vi.fn(() => current);
    await expect(writeSourceFile(original, false, [], isCurrent))
      .rejects.toThrow('No file was written');
    expect(isCurrent).toHaveBeenCalledTimes(2);
    expect(readScarpSource).toHaveBeenCalledTimes(1);
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it('does not query session freshness after cancelling the Save As chooser', async () => {
    vi.mocked(save).mockResolvedValue(null);
    const isCurrent = vi.fn(() => false);
    await expect(writeSourceFile(
      { ...createUntitled(33), content: 'edited' }, true, [], isCurrent,
    )).resolves.toBeNull();
    expect(isCurrent).not.toHaveBeenCalled();
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it('continues to save an unchanged request with an active snapshot guard', async () => {
    const original = { ...createUntitled(34), content: 'print("आनंद");' };
    vi.mocked(save).mockResolvedValue('C:/project/stable.srp');
    const isCurrent = vi.fn(() => true);
    await expect(writeSourceFile(original, true, [], isCurrent))
      .resolves.toBe('C:/project/stable.srp');
    expect(writeTextFile).toHaveBeenCalledWith('C:/project/stable.srp', original.content);
    expect(isCurrent).toHaveBeenCalledTimes(2);
  });

});
