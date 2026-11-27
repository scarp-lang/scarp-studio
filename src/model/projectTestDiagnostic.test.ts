import { describe,expect,it } from 'vitest';
import { parseScarpTestReportForAction } from './projectTestReport';
import { inspectProjectTestDiagnostic,isProjectDiagnosticLabel,testFailureDetailRows,filterTestFailureDetails,
  summarizeTestFailureDetails,buildTestFailureDetailExport,DEFAULT_TEST_DETAIL_EXPORT,MAX_PROJECT_TEST_DETAIL_UNITS } from './projectTestDiagnostic';
const site=(path='src/declaration.srp')=>({path,span:[0,4],start:{line:1,column:1},end:{line:1,column:2}});
const diagnostic={schema_version:1,severity:'error',code:'E0065',message:'private message',help:'private help',
  span_encoding:'utf-8-bytes',column_encoding:'unicode-scalar',position_base:1,primary:site(),
  related:[{message:'private related note',location:site('tests/example.srp')}]};
function report(raw:Record<string,unknown>=diagnostic){
  return JSON.stringify({schema_version:2,mode:'run',discovered:1,passed:0,failed:1,
    tests:[{path:'tests/example.srp',status:'failed',phase:'runtime',diagnostic:raw}]});
}
function parsed(raw:Record<string,unknown>=diagnostic){
  const result=parseScarpTestReportForAction(report(raw),'run-tests',1);
  if(!result)throw Error('expected validated failure summary');
  return result;
}
describe('nested published diagnostic envelope',()=>{
  it('preserves exact compiler coordinates in validated project failures',()=>{
    const result=parsed(),row=testFailureDetailRows(result)[0];
    expect(row.coverage).toBe('validated');
    expect(row.detail?.primary).toEqual({path:'src/declaration.srp',byteStart:0,byteEnd:4,start:{line:1,column:1},end:{line:1,column:2}});
    expect(row.detail?.related[0].location?.path).toBe('tests/example.srp');
    expect(Object.isFrozen(row.detail?.related)).toBe(true);
    expect(parseScarpTestReportForAction(report(),'run',1)).toBeNull();
    expect(parseScarpTestReportForAction(report(),'run-tests',0)).toBeNull();
  });
  it('preserves a validated location-free fixture failure',()=>{
    const detail=inspectProjectTestDiagnostic({...diagnostic,code:null,primary:null,related:[],help:null});
    expect(detail.coverage).toBe('validated');
    expect(detail.detail?.primary).toBeNull();
  });
  it('does not invent detail for old summary-only fixtures',()=>{
    const summary={message:'failure',code:'E0065',help:null};
    expect(inspectProjectTestDiagnostic(summary)).toEqual({coverage:'summary-only',detail:null});
    expect(parsed(summary).tests[0].inspection).toBeUndefined();
  });
  it('retains failure summary while rejecting unsupported full envelopes',()=>{
    for(const raw of [
      {...diagnostic,schema_version:2},{...diagnostic,severity:'warning'},
      {...diagnostic,span_encoding:'utf-16'},{...diagnostic,column_encoding:'bytes'},
      {...diagnostic,position_base:0},{...diagnostic,primary:site('/absolute.srp')},
      {...diagnostic,primary:{...site(),span:[4,0]}},
      {...diagnostic,primary:{...site(),start:{line:0,column:1}}},
      {...diagnostic,related:[{message:'note',location:site('../private.srp')}]},
      {...diagnostic,related:Array.from({length:9},()=>({message:'note',location:null}))},
      {...diagnostic,related:[{message:'🙂'.repeat(513),location:null}]},
      {...diagnostic,related:[{message:'\ud800',location:null}]},
      {...diagnostic,primary:site('x'.repeat(4097))},
      {...diagnostic,primary:site('é'.repeat(2049))},
    ]){
      const row=parsed(raw).tests[0];
      expect(row.status).toBe('failed');
      expect(row.inspection).toEqual({coverage:'unsupported',detail:null});
    }
  });
  it('validates project-relative labels without converting them to native paths',()=>{
    for(const path of ['src/हिंदी.srp','main.srp','tests/🙂.srp'])expect(isProjectDiagnosticLabel(path)).toBe(true);
    for(const path of ['','/a.srp','C:a.srp','a\\b.srp','../a.srp','./a.srp','a//b.srp','a/\u007f.srp','é'.repeat(2049)])
      expect(isProjectDiagnosticLabel(path)).toBe(false);
  });
});
describe('failure detail review and export',()=>{
  it('distinguishes missing locations from unavailable full envelopes',()=>{
    const report=parsed();
    const rows=testFailureDetailRows({...report,tests:[report.tests[0],
      {...report.tests[0],path:'tests/no-site.srp',inspection:inspectProjectTestDiagnostic({...diagnostic,primary:null,related:[]})},
      {...report.tests[0],path:'tests/unsupported.srp',inspection:{coverage:'unsupported',detail:null}},
      {...report.tests[0],path:'tests/pass.srp',status:'passed'}]});
    expect(summarizeTestFailureDetails(rows)).toEqual({total:3,validated:2,located:1,related:1,unavailable:1,locations:2});
    expect(filterTestFailureDetails(rows,'located','declaration')).toHaveLength(1);
    expect(filterTestFailureDetails(rows,'related','private related')).toHaveLength(1);
    expect(filterTestFailureDetails(rows,'unlocated','').map(row=>row.path)).toEqual(['tests/no-site.srp']);
    expect(filterTestFailureDetails(rows,'unavailable','').map(row=>row.path)).toEqual(['tests/unsupported.srp']);
    expect(testFailureDetailRows({...report,mode:'list'})).toEqual([]);
  });
  it('excludes private labels, messages and locations by default',()=>{
    const rows=testFailureDetailRows(parsed());
    const safe=buildTestFailureDetailExport(rows,DEFAULT_TEST_DETAIL_EXPORT,true);
    expect(safe.text).toContain('Historical report');
    expect(safe.text).toContain('E0065');
    expect(safe.text).not.toContain('private message');
    expect(safe.text).not.toContain('tests/example.srp');
    expect(safe.text).not.toContain('src/declaration.srp');
    const full=buildTestFailureDetailExport(rows,{testLabels:true,messages:true,locations:true,related:true},false);
    for(const term of ['private message','private help','private related note','tests/example.srp','src/declaration.srp','UTF-8 bytes 0–4'])
      expect(full.text).toContain(term);
  });
  it('keeps bounded whole-row exports with an explicit omission count',()=>{
    const item=testFailureDetailRows(parsed({...diagnostic,message:'x'.repeat(1600),
      related:Array.from({length:8},()=>({message:'y'.repeat(512),location:null}))}))[0];
    const rows=Array.from({length:64},()=>item);
    const result=buildTestFailureDetailExport(rows,{testLabels:true,messages:true,locations:true,related:true},false);
    expect(result.text.length).toBeLessThanOrEqual(MAX_PROJECT_TEST_DETAIL_UNITS);
    expect(result.included+result.omitted).toBe(64);
    expect(result.omitted).toBeGreaterThan(0);
    expect(result.text).toContain('whole failure row(s) omitted');
  });
});
