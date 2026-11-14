import { describe, expect, it } from 'vitest';
import { parseScarpTestReport } from './projectTestReport';

function report(mode: 'list' | 'run', tests: unknown[], passed: number, failed: number) {
  return JSON.stringify({ schema_version: 2, mode, discovered: tests.length, passed, failed, tests });
}
const pass = { path: 'tests/green.srp', status: 'passed' };
const fail = { path: 'tests/लाल.srp', status: 'failed', phase: 'runtime',
  diagnostic: { schema_version: 1, severity: 'error', code: 'E0065',
    message: 'Test assertion failed', help: 'Inspect the assertion' } };

describe('Scarp alpha.10 project test report parser', () => {
  it('reads published v2 reports with Unicode paths and structured errors', () => {
    expect(parseScarpTestReport(report('run', [pass, fail], 1, 1))).toEqual({
      mode: 'run', discovered: 2, passed: 1, failed: 1,
      tests: [
        { path: 'tests/green.srp', status: 'passed', phase: null, code: null, message: null, help: null },
        { path: 'tests/लाल.srp', status: 'failed', phase: 'runtime', code: 'E0065',
          message: 'Test assertion failed', help: 'Inspect the assertion' },
      ],
    });
  });

  it('supports discovery only and valid empty reports', () => {
    const listed = report('list', [{ path: 'tests/अंक.srp', status: 'discovered' }], 0, 0);
    expect(parseScarpTestReport(listed)?.tests[0].path).toBe('tests/अंक.srp');
    expect(parseScarpTestReport(report('run', [], 0, 0))?.discovered).toBe(0);
  });

  it('rejects malformed JSON, unsupported schemas and inconsistent counts', () => {
    expect(parseScarpTestReport(null)).toBeNull();
    expect(parseScarpTestReport('{malformed')).toBeNull();
    expect(parseScarpTestReport('{"schema_version":3}')).toBeNull();
    expect(parseScarpTestReport(report('run', [pass], 0, 0))).toBeNull();
    expect(parseScarpTestReport(report('list', [pass], 1, 0))).toBeNull();
    expect(parseScarpTestReport(' '.repeat(256 * 1024 + 1))).toBeNull();
  });

  it('rejects unsafe paths, duplicate tests and unexpected status', () => {
    for (const path of ['../outside.srp', 'tests/../outside.srp',
      'tests\\other.srp', 'tests/a/b.srp', 'tests/C:evil.srp']) {
      expect(parseScarpTestReport(report('run', [{ path, status: 'passed' }], 1, 0))).toBeNull();
    }
    expect(parseScarpTestReport(report('run', [pass, pass], 2, 0))).toBeNull();
    expect(parseScarpTestReport(report('run', [{ path: 'tests/unknown.srp', status: 'unknown' }], 0, 0))).toBeNull();
  });

  it('bounds error strings and rejects unknown failure phases', () => {
    const unknown = { ...fail, phase: 'unknown' };
    expect(parseScarpTestReport(report('run', [unknown], 0, 1))).toBeNull();
    expect(parseScarpTestReport(report('run', [{ ...fail,
      diagnostic: { ...fail.diagnostic, message: 'x'.repeat(1601) } }], 0, 1))).toBeNull();
  });
});
