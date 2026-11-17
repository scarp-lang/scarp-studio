import { beforeEach, describe, expect, it, vi } from 'vitest';
import { open } from '@tauri-apps/plugin-fs';
import { MAX_SCARP_SOURCE_BYTES } from '../model/sourceLimits';
import { readScarpSource } from './sourceRead';

vi.mock('@tauri-apps/plugin-fs', () => ({ open: vi.fn() }));

const encoder = new TextEncoder();

function mockFile(
  data: Uint8Array,
  info: { size?: number; isFile?: boolean } = {},
) {
  let cursor = 0;
  const handle = {
    stat: vi.fn(async () => ({
      size: info.size ?? data.byteLength,
      isFile: info.isFile ?? true,
    })),
    read: vi.fn(async (buffer: Uint8Array): Promise<number | null> => {
      if (cursor >= data.byteLength) return null;
      const count = Math.min(buffer.byteLength, data.byteLength - cursor);
      buffer.set(data.subarray(cursor, cursor + count));
      cursor += count;
      return count;
    }),
    close: vi.fn(async () => {}),
  };
  vi.mocked(open).mockResolvedValue(handle as unknown as Awaited<ReturnType<typeof open>>);
  return handle;
}

describe('bounded Scarp source reading through one scoped handle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('refuses non-Scarp extensions without opening any native file handle', async () => {
    await expect(readScarpSource('C:/project/notes.txt')).rejects.toThrow('.srp');
    expect(open).not.toHaveBeenCalled();
    const handle = mockFile(encoder.encode('print(1);'));
    await expect(readScarpSource('C:/project/script.SRP')).resolves.toBe('print(1);');
    expect(open).toHaveBeenCalledWith('C:/project/script.SRP', { read: true });
    expect(handle.close).toHaveBeenCalledTimes(1);
  });

  it('opens only in read mode, reads, and always closes the handle', async () => {
    const handle = mockFile(encoder.encode('print("hello");'));
    await expect(readScarpSource('C:/project/main.srp')).resolves.toBe('print("hello");');
    expect(open).toHaveBeenCalledWith('C:/project/main.srp', { read: true });
    expect(handle.stat).toHaveBeenCalledTimes(1);
    expect(handle.read).toHaveBeenCalled();
    expect(handle.close).toHaveBeenCalledTimes(1);
  });

  it('rejects oversized metadata before reading any file bytes', async () => {
    const handle = mockFile(encoder.encode('short'), { size: MAX_SCARP_SOURCE_BYTES + 1 });
    await expect(readScarpSource('C:/project/large.srp')).rejects.toThrow('4 MiB');
    expect(handle.read).not.toHaveBeenCalled();
    expect(handle.close).toHaveBeenCalledTimes(1);
  });

  it('allows a file exactly at the 4 MiB byte boundary', async () => {
    const contents = 'a'.repeat(MAX_SCARP_SOURCE_BYTES);
    const handle = mockFile(encoder.encode(contents));
    await expect(readScarpSource('C:/project/limit.srp')).resolves.toBe(contents);
    expect(handle.close).toHaveBeenCalledTimes(1);
  });

  it('refuses growth beyond 4 MiB even when handle metadata is stale', async () => {
    const handle = mockFile(new Uint8Array(MAX_SCARP_SOURCE_BYTES + 100_000), { size: 3 });
    await expect(readScarpSource('C:/project/growing.srp')).rejects.toThrow('4 MiB');
    expect(handle.read).toHaveBeenCalled();
    expect(handle.read.mock.calls.every(([buffer]) => buffer.byteLength <= 16 * 1024)).toBe(true);
    expect(handle.close).toHaveBeenCalledTimes(1);
  });

  it('preserves UTF-8 characters split across two native read chunks', async () => {
    const content = 'a'.repeat(16 * 1024 - 1) + '🙂 हिन्दी';
    const handle = mockFile(encoder.encode(content));
    await expect(readScarpSource('C:/project/unicode.srp')).resolves.toBe(content);
    expect(handle.read.mock.calls.length).toBeGreaterThan(1);
    expect(handle.close).toHaveBeenCalledTimes(1);
  });

  it('preserves an existing UTF-8 BOM and both Windows and Unix line endings', async () => {
    const content = '\ufeffprint("one");\r\nprint("two");\n';
    const handle = mockFile(encoder.encode(content));
    await expect(readScarpSource('C:/project/bom.srp')).resolves.toBe(content);
    expect(handle.close).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid and incomplete UTF-8 with handle cleanup', async () => {
    const malformed = mockFile(new Uint8Array([0xc3, 0x28]));
    await expect(readScarpSource('C:/project/invalid.srp')).rejects.toThrow();
    expect(malformed.close).toHaveBeenCalledTimes(1);
    const incomplete = mockFile(new Uint8Array([0xe2, 0x82]));
    await expect(readScarpSource('C:/project/incomplete.srp')).rejects.toThrow();
    expect(incomplete.close).toHaveBeenCalledTimes(1);
  });

  it('rejects directories and non-finite metadata with guaranteed close', async () => {
    const directory = mockFile(new Uint8Array(0), { isFile: false });
    await expect(readScarpSource('C:/project/folder.srp')).rejects.toThrow('regular file');
    expect(directory.read).not.toHaveBeenCalled();
    expect(directory.close).toHaveBeenCalledTimes(1);
    const invalid = mockFile(new Uint8Array(0), { size: Number.NaN });
    await expect(readScarpSource('C:/project/bad.srp')).rejects.toThrow('4 MiB');
    expect(invalid.close).toHaveBeenCalledTimes(1);
  });

  it('always closes the handle after a native read or metadata failure', async () => {
    const readFailure = mockFile(encoder.encode('text'));
    readFailure.read.mockRejectedValueOnce(new Error('permission revoked'));
    await expect(readScarpSource('C:/project/revoked.srp')).rejects.toThrow('permission revoked');
    expect(readFailure.close).toHaveBeenCalledTimes(1);
    const statFailure = mockFile(encoder.encode('text'));
    statFailure.stat.mockRejectedValueOnce(new Error('metadata denied'));
    await expect(readScarpSource('C:/project/denied.srp')).rejects.toThrow('metadata denied');
    expect(statFailure.close).toHaveBeenCalledTimes(1);
  });

  it('rejects a zero-progress or invalid native read count', async () => {
    const stalled = mockFile(encoder.encode('abc'));
    stalled.read.mockResolvedValueOnce(0);
    await expect(readScarpSource('C:/project/stalled.srp')).rejects.toThrow('invalid byte count');
    expect(stalled.close).toHaveBeenCalledTimes(1);
    const impossible = mockFile(encoder.encode('abc'));
    impossible.read.mockResolvedValueOnce(999_999);
    await expect(readScarpSource('C:/project/impossible.srp')).rejects.toThrow('invalid byte count');
    expect(impossible.close).toHaveBeenCalledTimes(1);
  });

  it('fails closed when opening a path is forbidden', async () => {
    vi.mocked(open).mockRejectedValue(new Error('path outside selected scope'));
    await expect(readScarpSource('C:/secret.srp')).rejects.toThrow('outside selected scope');
  });
});
