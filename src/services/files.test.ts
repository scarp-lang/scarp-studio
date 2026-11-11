import { beforeEach, describe, expect, it, vi } from 'vitest';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
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
});
