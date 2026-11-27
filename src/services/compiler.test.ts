import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { detectScarp, executeScarp, openCompilerDownloads } from './compiler';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

describe('Scarp native invoke input contract', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('detects Scarp candidates through a bounded non-executing native command', async () => {
    const paths = ['C:\\Program Files\\Scarp\\scarp.exe', 'C:\\Users\\test\\Downloads\\Scarp\\scarp.exe'];
    vi.mocked(invoke).mockResolvedValue(paths);
    await expect(detectScarp()).resolves.toEqual(paths);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('scarp_detect');
    expect(invoke).not.toHaveBeenCalledWith('scarp_probe', expect.anything());
    expect(invoke).not.toHaveBeenCalledWith('scarp_execute', expect.anything());
  });

  it('opens the official download only in response to its distinct native command', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await expect(openCompilerDownloads()).resolves.toBeUndefined();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('scarp_download_page');
  });

  it('passes exact UTF-8 source and explicit stdin to Run without writing to disk', async () => {
    vi.mocked(invoke).mockResolvedValue(['Hello नमस्ते 👋', null]);
    const stdinText = 'नमस्ते 👋\r\nsecond line';
    await expect(executeScarp(
      'C:/trusted/scarp.exe', 'C:/project/main.srp', 'exec',
      'bind name = read_line();', stdinText,
    )).resolves.toEqual({ output: 'Hello नमस्ते 👋', diagnosticStderr: null });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('scarp_execute', {
      binary: 'C:/trusted/scarp.exe', source: 'C:/project/main.srp',
      mode: 'exec', expectedContent: 'bind name = read_line();', stdinText,
    });
  });

  it('supports static Verify with empty stdin payload', async () => {
    vi.mocked(invoke).mockResolvedValue(['verified', null]);
    await executeScarp('C:/trusted/scarp.exe', 'C:/project/main.srp',
      'verify', 'assert(true);', '');
    expect(invoke).toHaveBeenCalledWith('scarp_execute', expect.objectContaining({
      mode: 'verify', stdinText: '',
    }));
  });
  it('separates failed Verify JSON from untrusted raw output', async () => {
    const stderr = '{"schema_version":1,"severity":"error"}\n';
    vi.mocked(invoke).mockResolvedValue(['Scarp verify failed; raw output', stderr]);
    await expect(executeScarp('C:/trusted/scarp.exe', 'C:/main.srp', 'verify',
      'print(unknown_name);', '')).resolves.toEqual({
      output: 'Scarp verify failed; raw output', diagnosticStderr: stderr,
    });
    vi.mocked(invoke).mockResolvedValue(['{"schema_version":1}', null]);
    await expect(executeScarp('C:/trusted/scarp.exe', 'C:/main.srp', 'exec',
      'print("fake JSON");', '')).resolves.toEqual({
      output: '{"schema_version":1}', diagnosticStderr: null,
    });
  });
});

describe('native single-source outcome', () => {
  it('exposes exit code and flags separately from raw display output', async () => {
    vi.mocked(invoke).mockResolvedValue(['fake exit zero', null, [1, false, false, true]]);
    await expect(executeScarp('C:/scarp.exe', 'C:/main.srp', 'exec', '', ''))
      .resolves.toMatchObject({ nativeOutcome: { exitCode: 1, cancelled: false, outputTruncated: false, sourceStale: true } });
  });
  it.each([[1, true, false, false], [1, false, true, false], [1, false, false, true],
    [0, false, false, false], [null, false, false, false]])('suppresses non-authoritative Verify diagnostics: %j', async (...metadata) => {
    vi.mocked(invoke).mockResolvedValue(['output', 'diagnostic', metadata]);
    const result = await executeScarp('C:/scarp.exe', 'C:/main.srp', 'verify', '', '');
    expect(result.diagnosticStderr).toBeNull();
  });
});

it('rejects Verify diagnostics attached to malformed new-format outcome metadata', async () => {
  vi.mocked(invoke).mockResolvedValue(['output', 'diagnostic', [1, false]]);
  expect(await executeScarp('C:/scarp.exe', 'C:/main.srp', 'verify', '', ''))
    .toEqual({ output: 'output', diagnosticStderr: null });
});
