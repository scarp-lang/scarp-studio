import {describe,expect,it,vi} from 'vitest';
import {createUntitled,type StudioDocument} from './documents';
import {prepareProjectInspection,type InspectionSettings,type InspectionControl} from './projectInspection';
import {DEFAULT_PROJECT_SEARCH_SCOPE,MAX_SCOPE_REPORT_UNITS} from './projectSearchScope';
import {MAX_WORKSPACE_SYMBOLS,MAX_WORKSPACE_CALLS} from './workspaceSymbols';
import {executeListedSymbolIndex,filterListedSymbols,groupListedCalls,repeatedListedNames,pageListedSymbols,
  listedSymbolReportText,resolveListedSymbolPath,recheckListedSymbolSite,DEFAULT_LISTED_SYMBOL_FILTER,
  type ListedSymbolReport,type ListedSymbolSite} from './listedSymbolIndex';

const config:InspectionSettings={scope:DEFAULT_PROJECT_SEARCH_SCOPE,mode:'working',listingLimited:false};
const control:InspectionControl={isCurrent:()=>true,isCancelled:()=>false};
const entry=(name:string)=>({name,path:'C:/private-workspace/'+name});
const a='src/a.srp',b='src/b.srp',c='tests/check.srp';
const sourceA='pub pure funcra calculate(x: integer) -> integer { return x; }\nfuncra main() { calculate(1); other(); }\n';
const sourceB='funcra calculate(x: integer) -> integer { return x; }\nfuncra other() { calculate(2); unknown(); }\n';
function prepare(names=[a,b,c],settings=config){
  const result=prepareProjectInspection(names.map(entry),settings);
  if(!result.ok)throw Error(result.error);
  return result.value;
}
async function execute(contents:Record<string,string>={[a]:sourceA,[b]:sourceB,[c]:'// TODO comment\n'},
  settings=config,docs:readonly StudioDocument[]=[],cancellation=control){
  const plan=prepare(Object.keys(contents),settings);
  const read=vi.fn(async(path:string,_limit:number)=>{
    const name=path.replace('C:/private-workspace/','');
    if(!(name in contents))throw Error('private read failure');
    return contents[name];
  });
  const result=await executeListedSymbolIndex(plan,docs,read,cancellation);
  if(result.kind!=='report')throw Error('No report');
  return {report:result.report,read};
}
function site(report:ListedSymbolReport,name:string,kind:ListedSymbolSite['kind'],source=a){
  const found=[...report.declarations,...report.calls].find(item=>item.name===name&&item.kind===kind&&item.source===source);
  if(!found)throw Error('Missing site '+name);
  return found;
}
function doc(name:string,content:string,revision=0):StudioDocument{
  return {...createUntitled(1),name,path:entry(name).path,content,savedContent:content,revision};
}

describe('reviewed listed symbol inventory',()=>{
  it('indexes declarations and calls across unopened listed sources',async()=>{
    const {report,read}=await execute();
    expect(report.complete).toBe(true);
    expect(report.selected).toBe(3);
    expect(report.files.every(file=>file.state==='scanned')).toBe(true);
    expect(read).toHaveBeenCalledTimes(3);
    expect(site(report,'calculate','function')).toMatchObject({scope:'top-level',visibility:'public',pure:true});
    expect(site(report,'calculate','call')).toMatchObject({enclosing:'main'});
    expect(site(report,'other','call')).toMatchObject({enclosing:'main'});
    expect(site(report,'unknown','call',b)).toMatchObject({enclosing:'other'});
    expect(JSON.stringify(report)).not.toContain('C:/private-workspace');
    expect(JSON.stringify(report)).not.toContain('return x');
    expect(JSON.stringify(report)).not.toContain('listed-symbol');
  });
  it('does not treat comment or string contents as calls or declarations',async()=>{
    const {report}=await execute({[a]:'// funcra fake() { hidden(); }\nbind text = "funcra fake()";\nfuncra real() { print(text); }\n'});
    expect(report.declarations.map(item=>item.name)).toEqual(['text','real']);
    expect(report.calls.map(item=>item.name)).toEqual(['print']);
  });
  it('uses dirty buffers rather than disk in working mode',async()=>{
    const working=doc(a,'funcra working() { }\n');
    const {report,read}=await execute({[a]:sourceA,[b]:sourceB},config,[{...working,savedContent:sourceA}]);
    expect(read).toHaveBeenCalledTimes(1);
    expect(report.files.find(file=>file.name===a)?.origin).toBe('open-buffer');
    expect(report.declarations.some(item=>item.name==='working')).toBe(true);
    const saved=await execute({[a]:sourceA,[b]:sourceB},{...config,mode:'saved'},[working]);
    expect(saved.read).toHaveBeenCalledTimes(2);
    expect(saved.report.declarations.some(item=>item.name==='working')).toBe(false);
  });
  it('preserves read failures, malformed lexical evidence and limited listing',async()=>{
    const plan=prepare([a,b,c],{...config,listingLimited:true});
    const result=await executeListedSymbolIndex(plan,[],async path=>{
      if(path.endsWith(b))throw Error('private failure');
      return path.endsWith(c)?'bind x = "broken\n':sourceA;
    },control);
    if(result.kind!=='report')throw Error('Missing report');
    expect(result.report.complete).toBe(false);
    expect(result.report.files.find(file=>file.name===b)?.state).toBe('read-failed');
    expect(result.report.files.find(file=>file.name===c)?.reasons).toContain('lexical-issue');
    expect(JSON.stringify(result.report)).not.toContain('private failure');
  });
  it('marks ambiguity without choosing one of multiple matching working tabs',async()=>{
    const {report,read}=await execute({[a]:sourceA},config,[doc(a,sourceA),{...doc(a,sourceB),id:'duplicate'}]);
    expect(report.files[0].state).toBe('ambiguous-buffer');
    expect(report.declarations).toHaveLength(0);
    expect(read).not.toHaveBeenCalled();
  });
  it('enforces workspace-wide declaration and call caps',async()=>{
    const contents:Record<string,string>={};
    for(let i=0;i<8;i++){
      contents['src/file-'+i+'.srp']=Array.from({length:300},(_,j)=>
        'funcra f_'+i+'_'+j+'() { first(); second(); third(); }\n').join('');
    }
    const {report}=await execute(contents);
    expect(report.declarations).toHaveLength(MAX_WORKSPACE_SYMBOLS);
    expect(report.calls).toHaveLength(MAX_WORKSPACE_CALLS);
    expect(report.complete).toBe(false);
    expect(report.files.some(file=>file.reasons.includes('workspace-symbol-limit'))).toBe(true);
    expect(report.files.some(file=>file.reasons.includes('workspace-call-limit'))).toBe(true);
  });
  it('keeps only completed observations after cancellation',async()=>{
    let cancelled=false;
    const {report,read}=await execute({[a]:sourceA,[b]:sourceB,[c]:''},config,[],{
      ...control,isCancelled:()=>cancelled,onProgress:p=>{if(p.observed===1)cancelled=true;},
    });
    expect(report.status).toBe('cancelled');
    expect(report.files.filter(file=>file.state==='not-observed')).toHaveLength(2);
    expect(read).toHaveBeenCalledTimes(1);
    expect(report.complete).toBe(false);
  });
  it('invalidates all evidence when workspace changes during a read',async()=>{
    let current=true;
    const result=await executeListedSymbolIndex(prepare(),[],async()=>{
      current=false;return sourceA;
    },{...control,isCurrent:()=>current});
    expect(result).toEqual({kind:'invalidated'});
  });
  it('allows cancellation before any all-buffer scan after a cooperative yield',async()=>{
    let cancelled=false;
    const {report,read}=await execute({[a]:sourceA},config,[doc(a,sourceA)],{
      ...control,isCancelled:()=>cancelled,yieldBetweenFiles:async()=>{cancelled=true;},
    });
    expect(report.status).toBe('cancelled');
    expect(report.files[0].state).toBe('not-observed');
    expect(read).not.toHaveBeenCalled();
  });
});

describe('symbol evidence filtering and groups',()=>{
  it('groups identical call spellings without implying semantic resolution',async()=>{
    const {report}=await execute();
    const groups=groupListedCalls(report);
    const calculate=groups.find(group=>group.name==='calculate')!;
    expect(calculate.status).toBe('multiple-observed');
    expect(calculate.calls).toHaveLength(2);
    expect(calculate.candidates).toHaveLength(2);
    expect(calculate.sameFileCalls).toBe(2);
    const other=groups.find(group=>group.name==='other')!;
    expect(other.status).toBe('one-observed');
    expect(other.crossFileOnlyCalls).toBe(1);
    const missing=groups.find(group=>group.name==='unknown')!;
    expect(missing.status).toBe('none-observed');
    expect(missing.coverageComplete).toBe(true);
    expect(repeatedListedNames(report).map(group=>[group.name,group.sources])).toEqual([['calculate',2]]);
  });
  it('marks every candidate group as limited when the listing is incomplete',async()=>{
    const {report}=await execute({[a]:sourceA}, {...config,listingLimited:true});
    expect(groupListedCalls(report).every(group=>!group.coverageComplete)).toBe(true);
  });
  it('filters name, source, kind, modifiers and nesting independently',async()=>{
    const {report}=await execute();
    const f=DEFAULT_LISTED_SYMBOL_FILTER;
    expect(filterListedSymbols(report,{...f,query:'CALCULATE'})).toHaveLength(4);
    expect(filterListedSymbols(report,{...f,kind:'function',publicOnly:true})).toHaveLength(1);
    expect(filterListedSymbols(report,{...f,pureOnly:true})).toHaveLength(1);
    expect(filterListedSymbols(report,{...f,source:b,kind:'call'})).toHaveLength(2);
    expect(filterListedSymbols(report,{...f,scope:'nested'})).toHaveLength(0);
    expect(filterListedSymbols(report,{...f,query:'x'.repeat(121)})).toHaveLength(0);
    expect(filterListedSymbols(report,{...f,query:'\n'})).toHaveLength(0);
    expect(filterListedSymbols(report,{...f,order:'name'})[0].name).toBe('calculate');
  });
  it('clamps pagination and returns bounded pages',async()=>{
    const {report}=await execute({[a]:Array.from({length:60},(_,i)=>'bind value_'+i+' = 1;\n').join('')});
    expect(pageListedSymbols(report.declarations,1).rows).toHaveLength(20);
    expect(pageListedSymbols(report.declarations,999).page).toBe(3);
    expect(pageListedSymbols([],999)).toEqual({page:1,pages:1,rows:[]});
    expect(pageListedSymbols(report.declarations,NaN).page).toBe(1);
  });
});

describe('current lexical navigation',()=>{
  it('resolves only report-owned sites and unique current listed labels',async()=>{
    const {report}=await execute();
    const target=site(report,'calculate','function');
    expect(resolveListedSymbolPath(report,target,[entry(a),entry(b)])).toBe(entry(a).path);
    expect(resolveListedSymbolPath(report,target,[entry(a),entry(a)])).toBeNull();
    expect(resolveListedSymbolPath(report,target,[entry(b)])).toBeNull();
    expect(resolveListedSymbolPath(report,{...target},[entry(a)])).toBeNull();
  });
  it('revalidates current location, declaration shape and modifier metadata',async()=>{
    const {report}=await execute();
    const target=site(report,'calculate','function');
    const current=doc(a,sourceA,9);
    expect(recheckListedSymbolSite(target,current,current.path!)).toMatchObject({
      documentId:current.id,revision:9,source:sourceA,line:target.line,column:target.column,
    });
    for(const changed of ['\n'+sourceA,sourceA.replace('calculate','different'),sourceA.replace('pub ','    '),
      sourceA.replace('pure ','     '),'// '+sourceA,sourceA+'bind bad = "broken\n']){
      expect(recheckListedSymbolSite(target,doc(a,changed),current.path!)).toBeNull();
    }
    expect(recheckListedSymbolSite(target,doc(b,sourceA),current.path!)).toBeNull();
  });
  it('allows matching current lexical coordinates but does not assert identical semantics',async()=>{
    const {report}=await execute();
    const target=site(report,'calculate','function');
    const changed=sourceA.replace('return x;','return 1;');
    expect(recheckListedSymbolSite(target,doc(a,changed),entry(a).path)?.source).toBe(changed);
  });
  it('rejects a call whose enclosing observed function changed',async()=>{
    const {report}=await execute();
    const target=site(report,'calculate','call');
    expect(recheckListedSymbolSite(target,doc(a,sourceA.replace('main()','test()')),entry(a).path)).toBeNull();
  });
});

describe('symbol report privacy',()=>{
  it('exports relative labels and lexical names only on separate opt-ins',async()=>{
    const {report}=await execute();
    const plain=listedSymbolReportText(report);
    expect(plain).not.toContain(a);
    expect(plain).not.toContain('calculate');
    const labels=listedSymbolReportText(report,true,false);
    expect(labels).toContain(a);
    expect(labels).not.toContain('calculate');
    const names=listedSymbolReportText(report,false,true);
    expect(names).toContain('calculate');
    expect(names).not.toContain(a);
    const full=listedSymbolReportText(report,true,true);
    expect(full).toContain(a);
    expect(full).toContain('calculate');
    expect(full).not.toContain('return x');
    expect(full).not.toContain('C:/private-workspace');
  });
  it('bounds long report exports and declares truncation',async()=>{
    const {report}=await execute({[a]:Array.from({length:350},(_,i)=>
      'funcra name_'+i+'_'+ 'a'.repeat(95)+'() { another_'+i+'_'+ 'b'.repeat(95)+'(); }\n').join('')});
    const result=listedSymbolReportText(report,true,true);
    expect(result.length).toBeLessThanOrEqual(MAX_SCOPE_REPORT_UNITS);
    expect(result).toContain('Additional evidence omitted');
  });
});
