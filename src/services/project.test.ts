import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { scarpProjectAction } from './project';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

describe('Scarp project command bridge', () => {
  beforeEach(() => vi.resetAllMocks());

  it('sends selected compiler, folder and read-only info action', async () => {
    vi.mocked(invoke).mockResolvedValue(['{"schema_version":1}', null, 0]);
    await expect(scarpProjectAction('C:/scarp.exe', 'C:/Scarp workspace', 'info'))
      .resolves.toEqual({ output: '{"schema_version":1}', testReportJson: null, exitCode: 0 });
    expect(invoke).toHaveBeenCalledWith('scarp_project_action', {
      binary: 'C:/scarp.exe', folder: 'C:/Scarp workspace', action: 'info',
    });
  });

  it('passes preloaded UTF-8 input only with explicit Run Project', async () => {
    vi.mocked(invoke).mockResolvedValue(['Hello Studio', null, 0]);
    await expect(scarpProjectAction('C:/scarp.exe', 'C:/project', 'run',
      'नमस्ते\r\nStudio', true)).resolves.toEqual({ output: 'Hello Studio', testReportJson: null, exitCode: 0 });
    expect(invoke).toHaveBeenCalledWith('scarp_project_action', {
      binary: 'C:/scarp.exe', folder: 'C:/project', action: 'run',
      stdinText: 'नमस्ते\r\nStudio', interactive: true,
    });
  });

  it('retains a separate machine-readable compiler test report when available', async () => {
    const report = '{"schema_version":2,"mode":"run","discovered":0,"passed":0,"failed":0,"tests":[]}';
    vi.mocked(invoke).mockResolvedValue(['Raw test output', report, 1]);
    await expect(scarpProjectAction('C:/scarp.exe', 'C:/project', 'run-tests'))
      .resolves.toEqual({ output: 'Raw test output', testReportJson: report, exitCode: 1 });
  });

  it('supports only named static verify and test actions', async () => {
    for (const action of ['verify', 'list-tests', 'run-tests'] as const) {
      vi.mocked(invoke).mockResolvedValue(['completed', null, 0]);
      await scarpProjectAction('C:/scarp.exe', 'C:/project', action);
      expect(invoke).toHaveBeenCalledWith('scarp_project_action', {
        binary: 'C:/scarp.exe', folder: 'C:/project', action,
      });
    }
    expect(invoke).toHaveBeenCalledTimes(3);
  });
  it('preserves abnormal or missing exit status as data without forging a success', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(['status unavailable', null, null])
      .mockResolvedValueOnce(['CLI error', null, 2]);
    await expect(scarpProjectAction('C:/scarp.exe', 'C:/project', 'run-tests'))
      .resolves.toEqual({ output: 'status unavailable', testReportJson: null, exitCode: null });
    await expect(scarpProjectAction('C:/scarp.exe', 'C:/project', 'run-tests'))
      .resolves.toEqual({ output: 'CLI error', testReportJson: null, exitCode: 2 });
  });

});

describe('native project outcome', () => {
  it('rejects structured test reports on cancelled or truncated results', async () => {
    for (const flags of [[0, true, false, false], [0, false, true, false]]) {
      vi.mocked(invoke).mockResolvedValue(['output', '{}', 0, flags]);
      expect((await scarpProjectAction('C:/scarp.exe', 'C:/project', 'run-tests')).testReportJson).toBeNull();
    }
  });
  it('rejects conflicting exit codes and malformed new-format metadata', async () => {
    for (const flags of [[1, false, false, false], [0, false]]) {
      vi.mocked(invoke).mockResolvedValue(['output', '{}', 0, flags]);
      expect(await scarpProjectAction('C:/scarp.exe', 'C:/project', 'run-tests'))
        .toEqual({ output: 'output', testReportJson: null, exitCode: null });
    }
  });
});

describe('native inspection provenance', () => {
  it('accepts separate inspection JSON only from the fixed static command', async () => {
    vi.mocked(invoke).mockResolvedValue(['display', null, 0, [0, false, false, false], '{}']);
    expect((await scarpProjectAction('C:/scarp.exe', 'C:/project', 'inspect-references')).inspectionJson).toBe('{}');
    expect((await scarpProjectAction('C:/scarp.exe', 'C:/project', 'run')).inspectionJson).toBeUndefined();
  });
  it('rejects cancelled, truncated and conflicting native results', async () => {
    for (const metadata of [[0, true, false, false], [0, false, true, false], [1, false, false, false], null]) {
      vi.mocked(invoke).mockResolvedValue(['display', null, 0, metadata, '{}']);
      expect((await scarpProjectAction('C:/scarp.exe', 'C:/project', 'inspect-symbols')).inspectionJson).toBeUndefined();
    }
  });
});

describe('saved metadata native channel',()=>{
  it('accepts an Info report separately from inspection and test JSON',async()=>{
    vi.mocked(invoke).mockResolvedValue(['display',null,0,[0,false,false,false],'{"schema_version":1}']);
    const result=await scarpProjectAction('C:/scarp.exe','C:/project','info');
    expect(result.projectInfoJson).toBe('{"schema_version":1}');
    expect(result.inspectionJson).toBeUndefined();
    expect(result.testReportJson).toBeNull();
    expect((await scarpProjectAction('C:/scarp.exe','C:/project','run')).projectInfoJson).toBeUndefined();
  });
  it('does not accept a failed or truncated native metadata response',async()=>{
    for(const meta of [[0,true,false,false],[0,false,true,false],[0,false,false,true],[1,false,false,false],null]){
      vi.mocked(invoke).mockResolvedValue(['display',null,0,meta,'{}']);
      expect((await scarpProjectAction('C:/scarp.exe','C:/project','info')).projectInfoJson).toBeUndefined();
    }
  });
});
