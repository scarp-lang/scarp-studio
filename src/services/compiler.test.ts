import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { executeScarp } from './compiler';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

describe('Scarp native invoke input contract', () => {
  beforeEach(() => { vi.resetAllMocks(); });

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
