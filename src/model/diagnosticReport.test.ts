import { describe,expect,it } from 'vitest';
import { parseDiagnosticReport,visibleDiagnosticText,diagnosticLocationLabel,summarizeDiagnostics,
  filterDiagnosticDetails,DEFAULT_DIAGNOSTIC_FILTER,buildDiagnosticReport,DEFAULT_DIAGNOSTIC_EXPORT,diagnosticPage,
  MAX_DIAGNOSTIC_REPORT_UNITS,MAX_DIAGNOSTIC_RELATED,MAX_DIAGNOSTIC_ROWS,MAX_DIAGNOSTIC_EXPORT,
  type DiagnosticReport,type DiagnosticAction } from './diagnosticReport';

const site=(path='C:/private/lib.srp',start=3,end=7)=>({
  path,span:[start,end],start:{line:2,column:4},end:{line:2,column:8},
});
const envelope=()=>({
  schema_version:1,severity:'error',code:'E0015',message:'expected integer, found string',
  span_encoding:'utf-8-bytes',column_encoding:'unicode-scalar',position_base:1,
  primary:site(),related:[{message:'type declared here',location:site('C:/private/main.srp')}],
  help:'Keep primitive types consistent',
});
function parse(value:unknown= envelope(),action:DiagnosticAction='verify'):DiagnosticReport{
  const result=parseDiagnosticReport(JSON.stringify(value),action);
  if(!result.ok)throw Error(result.reason);
  return result.report;
}
function invalid(patch:Record<string,unknown>){
  expect(parseDiagnosticReport(JSON.stringify({...envelope(),...patch}),'verify').ok).toBe(false);
}
describe('static compiler diagnostic report',()=>{
  it('preserves exact related source labels, half-open byte spans and scalar coordinates',()=>{
    const report=parse();
    expect(report).toMatchObject({action:'verify',diagnostics:[{
      id:0,code:'E0015',message:envelope().message,primary:{
        path:'C:/private/lib.srp',byteStart:3,byteEnd:7,start:{line:2,column:4},end:{line:2,column:8},
      },related:[{message:'type declared here',location:{path:'C:/private/main.srp'}}],help:envelope().help,
    }]});
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.diagnostics[0].primary!.start)).toBe(true);
    expect(Object.isFrozen(report.diagnostics[0].related)).toBe(true);
  });
  it('accepts non-source diagnostic messages and related notes without a location',()=>{
    const report=parse({...envelope(),code:null,primary:null,help:null,related:[{message:'note only',location:null}]});
    expect(report.diagnostics[0]).toMatchObject({code:null,primary:null,help:null,related:[{message:'note only',location:null}]});
    expect(diagnosticLocationLabel(null)).toBe('No source location reported');
  });
  it('accepts valid zero-width spans as insertion points',()=>{
    const point={...site(),span:[3,3],end:site().start};
    const row=parse({...envelope(),primary:point}).diagnostics[0];
    expect(diagnosticLocationLabel(row.primary)).toContain('(insertion point)');
  });
  it('accepts multiple complete JSON lines and preserves distinct records',()=>{
    const lines=[envelope(),{...envelope(),message:'another',primary:null}].map(row=>JSON.stringify(row)).join('\r\n');
    const result=parseDiagnosticReport('\n'+lines+'\r\n','inspect-references');
    expect(result).toMatchObject({ok:true,report:{action:'inspect-references',diagnostics:[{id:0},{id:1,message:'another'}]}});
    expect(parseDiagnosticReport(lines+'\nnot JSON','verify').ok).toBe(false);
    expect(parseDiagnosticReport(lines.replace('\r\n','\n\n'),'verify').ok).toBe(false);
  });
  it('never promotes arbitrary stdout or unsupported commands to structured reports',()=>{
    for(const action of ['exec','run','run-tests','info','unknown'])
      expect(parseDiagnosticReport(JSON.stringify(envelope()),action as DiagnosticAction).ok).toBe(false);
    for(const value of [null,'','{}','[]','plain text','x'.repeat(MAX_DIAGNOSTIC_REPORT_UNITS+1)])
      expect(parseDiagnosticReport(value,'verify').ok).toBe(false);
    expect(parseDiagnosticReport(Array.from({length:MAX_DIAGNOSTIC_ROWS+1},()=>JSON.stringify(envelope())).join('\n'),'verify').ok).toBe(false);
  });
  it('rejects invalid envelope fields and malformed UTF-16',()=>{
    for(const patch of [
      {schema_version:2},{severity:'warning'},{span_encoding:'utf-16'},{column_encoding:'bytes'},
      {position_base:0},{code:'E123'},{code:1},{message:''},{message:'\ud800'},{help:42},
      {related:null},{related:[{}]},{related:[{message:'note',location:undefined}]},
      {related:Array.from({length:MAX_DIAGNOSTIC_RELATED+1},()=>({message:'note',location:null}))},
    ])invalid(patch);
  });
  it('rejects malformed primary and related coordinates in the whole report',()=>{
    for(const bad of [
      {...site(),path:''},{...site(),path:42},{...site(),span:[-1,7]},{...site(),span:[7,3]},
      {...site(),span:[1.5,7]},{...site(),span:[3,3]},
      {...site(),start:{line:0,column:1}},{...site(),end:{line:1,column:1}},
      {...site(),end:{line:2,column:3}}, {...site(),end:{line:2,column:10000001}},
    ]){
      invalid({primary:bad});
      invalid({related:[{message:'note',location:bad}]});
    }
  });
});
describe('diagnostic projections and privacy',()=>{
  function report(){
    const rows=[envelope(),{...envelope(),code:'E0011',message:'duplicate binding',primary:site('src/other.srp'),related:[],help:null},
      {...envelope(),code:null,primary:null,related:[],help:null,message:'missing manifest'}];
    const result=parseDiagnosticReport(rows.map(row=>JSON.stringify(row)).join('\n'),'verify');
    if(!result.ok)throw Error(result.reason);
    return result.report;
  }
  it('summarizes all records without counting duplicate labels as distinct files',()=>{
    expect(summarizeDiagnostics(report())).toMatchObject({count:3,located:2,unlocated:1,related:1,distinctPaths:3,
      byCode:[{code:'E0015',count:1},{code:'E0011',count:1},{code:null,count:1}]});
  });
  it('filters by primary location, explicit code and related note text',()=>{
    const value=report();
    const ids=(patch:Partial<typeof DEFAULT_DIAGNOSTIC_FILTER>)=>filterDiagnosticDetails(value,{...DEFAULT_DIAGNOSTIC_FILTER,...patch}).map(row=>row.id);
    expect(ids({query:'DECLARED main.srp'})).toEqual([0]);
    expect(ids({query:'duplicate'})).toEqual([1]);
    expect(ids({location:'unlocated',code:null})).toEqual([2]);
    expect(ids({relatedOnly:true})).toEqual([0]);
    expect(ids({location:'located'})).toEqual([0,1]);
  });
  it('renders control characters visibly and preserves ordinary Unicode',()=>{
    expect(visibleDiagnosticText('हिंदी 🌍\u001b[31m\u202e')).toBe('हिंदी 🌍[U+001B][31m[U+202E]');
    expect(diagnosticLocationLabel(parse({...envelope(),primary:site('café.srp')}).diagnostics[0].primary)).toContain('café.srp:2:4');
  });
  it('does not leak optional private fields by default',()=>{
    const value=report(),rows=value.diagnostics;
    const hidden=buildDiagnosticReport(value,rows,DEFAULT_DIAGNOSTIC_EXPORT);
    for(const text of ['C:/private','expected integer','type declared here','Keep primitive'])expect(hidden.text).not.toContain(text);
    expect(hidden.text).toContain('E0015');
    const messages=buildDiagnosticReport(value,rows,{...DEFAULT_DIAGNOSTIC_EXPORT,messages:true});
    expect(messages.text).toContain('expected integer');
    expect(messages.text).not.toContain('type declared here');
    const notes=buildDiagnosticReport(value,rows,{...DEFAULT_DIAGNOSTIC_EXPORT,related:true,messages:true,locations:true,help:true});
    expect(notes.text).toContain('type declared here');
    expect(notes.text).toContain('C:/private/main.srp');
    expect(notes.text).toContain('Keep primitive');
  });
  it('omits whole rows and announces bounded export truncation',()=>{
    const row={...envelope(),message:'m'.repeat(12000),help:'h'.repeat(12000),related:[]};
    const value=parseDiagnosticReport(Array.from({length:10},()=>JSON.stringify(row)).join('\n'),'verify');
    if(!value.ok)throw Error(value.reason);
    const result=buildDiagnosticReport(value.report,value.report.diagnostics,{...DEFAULT_DIAGNOSTIC_EXPORT,messages:true,help:true});
    expect(result.text.length).toBeLessThanOrEqual(MAX_DIAGNOSTIC_EXPORT);
    expect(result.included+result.omitted).toBe(10);
    expect(result.omitted).toBeGreaterThan(0);
    expect(result.text).toContain('whole diagnostic row(s) omitted');
  });
  it('clamps page size and page number, retaining order',()=>{
    const items=[0,1,2,3,4];
    expect(diagnosticPage(items,2,2)).toEqual({page:2,pages:3,items:[2,3]});
    expect(diagnosticPage(items,Infinity,2).page).toBe(1);
    expect(diagnosticPage(items,99,2).items).toEqual([4]);
    expect(diagnosticPage([],1,0)).toEqual({page:1,pages:1,items:[]});
  });
});
