import { describe,expect,it } from 'vitest';
import { testFilterError,testFilenameMatches,previewTestSelection,selectionCoverageLabel } from './projectTestSelection';
import { parseScarpTestReportForAction,type ScarpTestReport } from './projectTestReport';
import { reviewTestBaseline,compareProjectTestBaseline,reviewProjectTests,DEFAULT_TEST_FILTER,buildTestTextReport } from './projectTestWorkbench';
const passed={path:'tests/math-add.srp',status:'passed'};
const listed={path:'tests/math-add.srp',status:'discovered'};
const json=(mode:'run'|'list',tests:readonly unknown[])=>JSON.stringify({schema_version:2,mode,discovered:tests.length,passed:mode==='run'?tests.length:0,failed:0,tests});
describe('literal filename filter',()=>{
  it.each(['','-help','tests/foo','a\\b','C:foo','a\nb','x\u0000','x\u202e','\ud800','é'.repeat(65)])('rejects unsafe filter %j',filter=>{
    expect(testFilterError(filter)).not.toBeNull();
  });
  it.each(['math','Math','हिंदी','a b','a.*','[abc]','é'.repeat(64)])('accepts literal text %j',filter=>{
    expect(testFilterError(filter)).toBeNull();
  });
  it('matches case-sensitive filenames only, without glob expansion',()=>{
    expect(testFilenameMatches('tests/Math.srp','math')).toBe(false);
    expect(testFilenameMatches('tests/math.srp','math')).toBe(true);
    expect(testFilenameMatches('tests/math.srp','tests')).toBe(false);
    expect(testFilenameMatches('tests/math.srp','m.*')).toBe(false);
  });
});
describe('filtered result provenance',()=>{
  it('preserves explicit selection on a consistent run and discovery',()=>{
    const run=parseScarpTestReportForAction(json('run',[passed]),'run-tests',0,'math');
    expect(run?.filter).toBe('math');
    expect(run?.passed).toBe(1);
    expect(parseScarpTestReportForAction(json('list',[listed]),'list-tests',0,'math')?.filter).toBe('math');
    expect(parseScarpTestReportForAction(json('run',[passed]),'run-tests',0)?.filter).toBeUndefined();
  });
  it('rejects mismatched filters, command or exit code',()=>{
    expect(parseScarpTestReportForAction(json('run',[passed]),'run-tests',0,'Math')).toBeNull();
    expect(parseScarpTestReportForAction(json('run',[passed]),'run-tests',0,'other')).toBeNull();
    expect(parseScarpTestReportForAction(json('run',[passed]),'list-tests',0,'math')).toBeNull();
    expect(parseScarpTestReportForAction(json('run',[passed]),'run-tests',1,'math')).toBeNull();
    expect(parseScarpTestReportForAction(json('run',[passed]),'run-tests',0,'')).toBeNull();
    expect(parseScarpTestReportForAction(json('run',[passed]),'run-tests',2,'math')).toBeNull();
  });
  it('retains an empty strict filtered run without interpreting it as a pass',()=>{
    expect(parseScarpTestReportForAction(json('run',[]),'run-tests',1,'math')).toMatchObject({filter:'math',discovered:0,passed:0,failed:0});
    expect(parseScarpTestReportForAction(json('run',[]),'run-tests',0,'math')).toBeNull();
    expect(parseScarpTestReportForAction(json('list',[]),'list-tests',0,'math')).toMatchObject({filter:'math',discovered:0});
    expect(parseScarpTestReportForAction(json('list',[]),'list-tests',1,'math')).toBeNull();
  });
  it('does not treat a filtered suite as a full-suite baseline or regression comparison',()=>{
    const report=parseScarpTestReportForAction(json('run',[passed]),'run-tests',0,'math')!;
    const result={folder:'/project',report};
    expect(reviewTestBaseline(result,null,false)).toBeNull();
    expect(compareProjectTestBaseline({folder:'/project',capturedAt:1,cases:[]},result,false).ok).toBe(false);
    expect(selectionCoverageLabel(report)).toContain('Filtered selection only');
    const review=reviewProjectTests(result,null,false,DEFAULT_TEST_FILTER);
    expect(buildTestTextReport(result,review,false).text).toContain('Filtered selection only: "math"');
  });
  it('shows only reported matching filenames in a historical preview',()=>{
    const report:ScarpTestReport=parseScarpTestReportForAction(json('run',[passed,{...passed,path:'tests/other.srp'}]),'run-tests',0)!;
    expect(previewTestSelection(report,'math')).toEqual(['tests/math-add.srp']);
    expect(previewTestSelection(report,'Math')).toEqual([]);
    expect(previewTestSelection(report,'')).toEqual([]);
    expect(previewTestSelection(null,'math')).toEqual([]);
  });
});
