import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readTextFile, stat } from '@tauri-apps/plugin-fs';
import { MAX_SCARP_SOURCE_BYTES } from '../model/sourceLimits';
import { readScarpSource } from './sourceRead';

vi.mock('@tauri-apps/plugin-fs', () => ({
  stat: vi.fn(),
  readTextFile: vi.fn(),
}));

const metadata = (size: number, isFile = true) =>
  ({ size, isFile }) as Awaited<ReturnType<typeof stat>>;

describe('bounded Scarp file loading', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(stat).mockResolvedValue(metadata(10));
    vi.mocked(readTextFile).mockResolvedValue('print(1);');
  });

  it('reads a normal source after checking file metadata', async () => {
    await expect(readScarpSource('C:/project/main.srp')).resolves.toBe('print(1);');
    expect(stat).toHaveBeenCalledWith('C:/project/main.srp');
    expect(readTextFile).toHaveBeenCalledWith('C:/project/main.srp');
  });

  it('rejects oversized files before invoking the native text reader', async () => {
    vi.mocked(stat).mockResolvedValue(metadata(MAX_SCARP_SOURCE_BYTES + 1));
    await expect(readScarpSource('C:/project/huge.srp')).rejects.toThrow('4 MiB');
    expect(readTextFile).not.toHaveBeenCalled();
  });

  it('accepts a file of exactly the permitted UTF-8 byte size', async () => {
    const content = 'a'.repeat(MAX_SCARP_SOURCE_BYTES);
    vi.mocked(stat).mockResolvedValue(metadata(MAX_SCARP_SOURCE_BYTES));
    vi.mocked(readTextFile).mockResolvedValue(content);
    await expect(readScarpSource('C:/project/limit.srp')).resolves.toBe(content);
  });

  it('rechecks actual UTF-8 size after metadata can become stale', async () => {
    vi.mocked(stat).mockResolvedValue(metadata(1));
    vi.mocked(readTextFile).mockResolvedValue('🙂'.repeat(1_048_577));
    await expect(readScarpSource('C:/project/growing.srp')).rejects.toThrow('4 MiB');
  });

  it('rejects directories and invalid metadata before reading', async () => {
    vi.mocked(stat).mockResolvedValue(metadata(2, false));
    await expect(readScarpSource('C:/project/folder.srp')).rejects.toThrow('regular file');
    vi.mocked(stat).mockResolvedValue(metadata(Number.NaN));
    await expect(readScarpSource('C:/project/bad.srp')).rejects.toThrow('4 MiB');
    expect(readTextFile).not.toHaveBeenCalled();
  });

  it('fails closed when filesystem metadata inspection is denied', async () => {
    vi.mocked(stat).mockRejectedValue(new Error('forbidden path'));
    await expect(readScarpSource('C:/secret.srp')).rejects.toThrow('forbidden path');
    expect(readTextFile).not.toHaveBeenCalled();
  });
});
