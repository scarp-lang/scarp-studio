import { beforeEach, describe, expect, it, vi } from 'vitest';
import { open } from '@tauri-apps/plugin-dialog';
import { readScarpSource } from './sourceRead';
import { pickSourcePath } from './files';

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(), save: vi.fn() }));
vi.mock('@tauri-apps/plugin-fs', () => ({ writeTextFile: vi.fn() }));
vi.mock('./sourceRead', () => ({ readScarpSource: vi.fn() }));

describe('native Scarp picker selects paths without reading source data', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns a path with the Scarp filter, but does not read source', async () => {
    vi.mocked(open).mockResolvedValue(String.raw`C:\Project\Main.srp`);
    await expect(pickSourcePath()).resolves.toBe(String.raw`C:\Project\Main.srp`);
    expect(open).toHaveBeenCalledWith({
      title: 'Open Scarp source', multiple: false,
      filters: [{ name: 'Scarp source', extensions: ['srp'] }],
    });
    expect(readScarpSource).not.toHaveBeenCalled();
  });

  it('preserves existing dirty work when the selected on-disk source is unavailable', async () => {
    vi.mocked(open).mockResolvedValue('C:/project/missing.srp');
    vi.mocked(readScarpSource).mockRejectedValue(new Error('missing disk source'));
    await expect(pickSourcePath()).resolves.toBe('C:/project/missing.srp');
    expect(readScarpSource).not.toHaveBeenCalled();
  });

  it('handles native dialog cancellation without an accidental read', async () => {
    vi.mocked(open).mockResolvedValue(null);
    await expect(pickSourcePath()).resolves.toBeNull();
    expect(readScarpSource).not.toHaveBeenCalled();
  });

  it('rejects unexpected file extensions even if OS picker returned them', async () => {
    vi.mocked(open).mockResolvedValue('C:/project/unsafe.exe');
    await expect(pickSourcePath()).rejects.toThrow('.srp');
    expect(readScarpSource).not.toHaveBeenCalled();
    vi.mocked(open).mockResolvedValue('C:/project/PROGRAM.SRP');
    await expect(pickSourcePath()).resolves.toBe('C:/project/PROGRAM.SRP');
  });
});
