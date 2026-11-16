import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { scarpProjectAction } from './project';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

describe('Scarp project command bridge', () => {
  beforeEach(() => vi.resetAllMocks());

  it('sends selected compiler, folder and read-only info action', async () => {
    vi.mocked(invoke).mockResolvedValue(['{"schema_version":1}', null]);
    await expect(scarpProjectAction('C:/scarp.exe', 'C:/Scarp workspace', 'info'))
      .resolves.toEqual({ output: '{"schema_version":1}', testReportJson: null });
    expect(invoke).toHaveBeenCalledWith('scarp_project_action', {
      binary: 'C:/scarp.exe', folder: 'C:/Scarp workspace', action: 'info',
    });
  });

  it('passes preloaded UTF-8 input only with explicit Run Project', async () => {
    vi.mocked(invoke).mockResolvedValue(['Hello Studio', null]);
    await expect(scarpProjectAction('C:/scarp.exe', 'C:/project', 'run',
      'नमस्ते\r\nStudio', true)).resolves.toEqual({ output: 'Hello Studio', testReportJson: null });
    expect(invoke).toHaveBeenCalledWith('scarp_project_action', {
      binary: 'C:/scarp.exe', folder: 'C:/project', action: 'run',
      stdinText: 'नमस्ते\r\nStudio', interactive: true,
    });
  });

  it('retains a separate machine-readable compiler test report when available', async () => {
    const report = '{"schema_version":2,"mode":"run","discovered":0,"passed":0,"failed":0,"tests":[]}';
    vi.mocked(invoke).mockResolvedValue(['Raw test output', report]);
    await expect(scarpProjectAction('C:/scarp.exe', 'C:/project', 'run-tests'))
      .resolves.toEqual({ output: 'Raw test output', testReportJson: report });
  });

  it('supports only named static verify and test actions', async () => {
    for (const action of ['verify', 'list-tests', 'run-tests'] as const) {
      vi.mocked(invoke).mockResolvedValue(['completed', null]);
      await scarpProjectAction('C:/scarp.exe', 'C:/project', action);
      expect(invoke).toHaveBeenCalledWith('scarp_project_action', {
        binary: 'C:/scarp.exe', folder: 'C:/project', action,
      });
    }
    expect(invoke).toHaveBeenCalledTimes(3);
  });
});
