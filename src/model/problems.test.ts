import { describe, expect, it } from 'vitest';
import { createUntitled, markSaved, updateContent } from './documents';
import { captureVerifiedSource } from './verifiedSource';
import { collectProblems, currentDiagnosticTarget, filterProblems, type ProblemInputs } from './problems';
import type { ScarpDiagnostic } from './diagnostics';

const initial = createUntitled(1);
const saved = markSaved([initial], initial.id, 'C:/project/main.srp', 'A😀B')[0];
const snapshot = captureVerifiedSource(saved)!;
const diagnostic: ScarpDiagnostic = { code: 'E0015', message: 'Wrong type', help: 'Use integer', path: 'main.srp', line: 1, column: 3, endLine: null, endColumn: null };
const base: ProblemInputs = { diagnostic, snapshot, documents: [saved], testResult: null, selection: null, stale: false };

describe('current structured problems', () => {
  it('resolves a background saved source and converts scalar columns', () => {
    expect(collectProblems(base)[0].target).toMatchObject({ kind: 'source', lineNumber: 1, column: 4, snapshot });
  });
  it('does not navigate a foreign module but retains its message', () => {
    const d = { ...diagnostic, path: 'foreign/main.srp' };
    expect(collectProblems({ ...base, diagnostic: d })[0].target).toBeNull();
    expect(currentDiagnosticTarget(d, snapshot, [saved])).toBeNull();
  });
  it('retire problems after edits, ABA, closed tabs or stale input', () => {
    const edited = updateContent([saved], saved.id, 'new')[0];
    const aba = updateContent([edited], edited.id, saved.content)[0];
    for (const documents of [[edited], [aba], []]) expect(collectProblems({ ...base, documents })).toEqual([]);
    expect(collectProblems({ ...base, stale: true })).toEqual([]);
  });
  it('reports only failed tests and opens only exact listed sources', () => {
    const failed = { path: 'tests/fail.srp', status: 'failed' as const, phase: 'compile' as const, code: 'E0015', message: 'Wrong type', help: null };
    const passed = { ...failed, path: 'tests/pass.srp', status: 'passed' as const };
    const unlisted = { ...failed, path: 'tests/other.srp' };
    const testResult = { folder: 'C:/project', report: { mode: 'run' as const, discovered: 3, passed: 1, failed: 2, tests: [failed, passed, unlisted] } };
    const selection = { path: 'C:/project', files: [{ name: failed.path, path: 'C:/project/tests/fail.srp' }] };
    const problems = collectProblems({ ...base, diagnostic: null, testResult, selection });
    expect(problems).toHaveLength(2);
    expect(problems[0].target).toEqual({ kind: 'test', folder: testResult.folder, path: failed.path });
    expect(problems[1].target).toBeNull();
    expect(collectProblems({ ...base, diagnostic: null, testResult, selection: null })).toEqual([]);
  });
  it('filters by kind, code, path, message and help', () => {
    const problems = collectProblems(base);
    expect(filterProblems(problems, 'all', 'e0015')).toHaveLength(1);
    expect(filterProblems(problems, 'compiler', 'INTEGER')).toHaveLength(1);
    expect(filterProblems(problems, 'test', '')).toEqual([]);
    expect(filterProblems(problems, 'all', 'foreign')).toEqual([]);
  });
});
