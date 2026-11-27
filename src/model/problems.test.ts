import { describe, expect, it } from 'vitest';
import { openedDocument, updateContent } from './documents';
import { captureVerifiedSource } from './verifiedSource';
import { collectProblems, currentDiagnosticTarget, filterProblems, sameDiagnosticTarget, type ProblemInputs } from './problems';
import type { ScarpDiagnostic } from './diagnostics';

const saved = openedDocument([], 'C:/project/main.srp', 'A😀B').documents[0];
const snapshot = captureVerifiedSource(saved)!;
const diagnostic: ScarpDiagnostic = { code: 'E0015', message: 'Wrong type', help: 'Use integer', path: 'main.srp', line: 1, column: 3, endLine: null, endColumn: null };
const base: ProblemInputs = { diagnostic, snapshot, documents: [saved], testResult: null, selection: null, stale: false };

describe('current structured problems', () => {
  it('uses a genuinely clean, saved fixture rather than a pending save snapshot', () => {
    expect(saved.content).toBe(saved.savedContent);
    expect(snapshot).not.toBeNull();
  });
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

describe('pending diagnostic navigation', () => {
  it('rejects a changed position or source snapshot even with equal source text', () => {
    const target = currentDiagnosticTarget(diagnostic, snapshot, [saved])!;
    expect(sameDiagnosticTarget({ ...target }, target)).toBe(true);
    expect(sameDiagnosticTarget({ ...target, column: target.column + 1 }, target)).toBe(false);
    expect(sameDiagnosticTarget({ ...target, snapshot: { ...snapshot } }, target)).toBe(false);
  });
});


describe('selected project structured problems',()=>{
  it('uses the actual nested manifest root rather than the Explorer parent',()=>{
    const testResult={folder:'C:/workspace/nested',report:{mode:'run' as const,discovered:1,passed:0,failed:1,
      tests:[{path:'tests/fail.srp',status:'failed' as const,phase:'compile' as const,code:'E0015',message:'Wrong type',help:null}]}};
    const selection={path:'C:/workspace',projectRoots:[{directory:'nested',path:'C:/workspace/nested'}],
      files:[{name:'nested/tests/fail.srp',path:'C:/workspace/nested/tests/fail.srp'}]};
    const input={...base,diagnostic:null,testResult,selection,selectedProjectPath:'C:/WORKSPACE/nested'};
    expect(collectProblems(input)).toHaveLength(1);
    expect(collectProblems(input)[0].target).toEqual({kind:'test',folder:testResult.folder,path:'tests/fail.srp'});
    expect(collectProblems({...input,selectedProjectPath:'C:/workspace/another'})).toEqual([]);
    expect(collectProblems({...input,selectedProjectPath:null})).toEqual([]);
  });
  it('lists project static errors without interpreting foreign source labels as editor targets',()=>{
    const report={action:'verify' as const,diagnostics:[{id:0,code:'E0015',message:'project error',help:null,
      primary:{path:'C:/project/main.srp',byteStart:0,byteEnd:1,start:{line:1,column:1},end:{line:1,column:2}},related:[]}]};
    const input={...base,diagnostic:null,projectDiagnosticReport:report};
    expect(collectProblems(input)).toEqual([{id:'project-diagnostic:0',kind:'compiler',code:'E0015',message:'project error',
      help:null,location:'C:/project/main.srp:1:1',target:null}]);
    expect(collectProblems({...input,stale:true})).toEqual([]);
  });
});
