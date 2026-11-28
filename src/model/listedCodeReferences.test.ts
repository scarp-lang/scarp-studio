import {describe,expect,it,vi} from 'vitest';
import {createUntitled,type StudioDocument} from './documents';
import {DEFAULT_PROJECT_SEARCH_SCOPE,MAX_SCOPE_REPORT_UNITS} from './projectSearchScope';
import type {InspectionSettings,InspectionControl} from './projectInspection';
import {prepareListedReferences,confirmListedReferences,validateListedReferenceQuery,scanListedReferenceFile,
  executeListedReferences,filterListedReferences,groupReferenceSpellings,pageListedReferences,
  resolveListedReferencePath,recheckListedReference,listedReferenceReportText,DEFAULT_REFERENCE_FILTER,
  MAX_LISTED_REFERENCE_HITS,MAX_LISTED_REFERENCES_PER_FILE,LISTED_REFERENCE_PAGE,
  type ListedReferenceQuery} from './listedCodeReferences';

const settings:InspectionSettings={scope:DEFAULT_PROJECT_SEARCH_SCOPE,mode:'working',listingLimited:false};
const query:ListedReferenceQuery={identifier:'target',caseSensitive:true};
const control:InspectionControl={isCurrent:()=>true,isCancelled:()=>false};
const a='src/a.srp',b='src/b.srp',c='tests/c.srp';
const entry=(name:string)=>({name,path:'C:/private-native/'+name});
const source=[
  'funcra target() { }',
  'bind result = target();',
  'bind member = module.target;',
  'module.target();',
  'target += 1;',
  'bind typed: target = 0;',
  'print(target);',
  '// target()',
  'bind text = "target";',
  'bind longer = targetName;',
].join('\r\n');
function plan(names=[a,b,c],config=settings,identifier=query){
  const checked=prepareListedReferences(names.map(entry),config,identifier);
  if(!checked.ok)throw Error(checked.error);
  return checked.value;
}
function doc(name:string,content:string):StudioDocument{
  return {...createUntitled(1),name,path:entry(name).path,content,savedContent:content};
}
async function run(contents:Record<string,string>={[a]:source,[b]:'target();\nTARGET();\n',[c]:'// target'},
  config=settings,identifier=query,docs:readonly StudioDocument[]=[],cancellation=control){
  const read=vi.fn(async(path:string,_maxBytes:number)=>{
    const name=path.replace('C:/private-native/','');
    if(!Object.hasOwn(contents,name))throw Error('private error');
    return contents[name];
  });
  const response=await executeListedReferences(plan(Object.keys(contents),config,identifier),docs,read,cancellation);
  if(response.kind!=='report')throw Error('No report');
  return {report:response.report,read};
}
describe('reviewed listed reference query',()=>{
  it('accepts exactly one supported ASCII identifier and preserves case setting',()=>{
    expect(validateListedReferenceQuery(query)).toEqual({ok:true,value:query});
    expect(validateListedReferenceQuery({identifier:'_item42',caseSensitive:false}).ok).toBe(true);
    for(const identifier of ['',' target','target ','target-name','a.b','a::b','42value','नाम','a\nb','x'.repeat(129)])
      expect(validateListedReferenceQuery({identifier,caseSensitive:true}).ok).toBe(false);
    expect(validateListedReferenceQuery({identifier:'x',caseSensitive:'false' as unknown as boolean}).ok).toBe(false);
  });
  it('rechecks query identity and reviewed listing membership',()=>{
    const p=plan();
    expect(confirmListedReferences(p,[a,b,c].map(entry),settings,query).ok).toBe(true);
    expect(confirmListedReferences(p,[a,b,c].map(entry),settings,{...query,caseSensitive:false}).ok).toBe(false);
    expect(confirmListedReferences(p,[a,b,c].map(entry),settings,{...query,identifier:'other'}).ok).toBe(false);
    expect(confirmListedReferences(p,[a,b].map(entry),settings,query).ok).toBe(false);
    expect(confirmListedReferences(p,[a,b,c].map(entry),{...settings,mode:'saved'},query).ok).toBe(false);
    expect(confirmListedReferences(p,[a,b,c].map(entry),{...settings,listingLimited:true},query).ok).toBe(false);
  });
});
describe('lexical reference roles',()=>{
  it('classifies complete code-token matches with CRLF coordinates',()=>{
    const result=scanListedReferenceFile(a,source,query);
    expect(result.reasons).toEqual([]);
    expect(result.hits.map(hit=>hit.role)).toEqual([
      'declaration-like','call-like','qualified-member','qualified-call','assignment-like',
      'type-position','other-identifier',
    ]);
    expect(result.hits.map(hit=>hit.line)).toEqual([1,2,3,4,5,6,7]);
    expect(result.hits[0].column).toBe(8);
    expect(result.hits.every(hit=>source.slice(hit.offset,hit.end)===hit.token)).toBe(true);
  });
  it('keeps strings, comments and longer identifiers excluded',()=>{
    const text='// target\nbind a = r"target";\nbind b = """target\n target""";\nbind target_name = 1;\ntarget();\n';
    const result=scanListedReferenceFile(a,text,query);
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].role).toBe('call-like');
    expect(result.reasons).toEqual([]);
  });
  it('does not classify an identifier adjacent to non-ASCII units as exact',()=>{
    const result=scanListedReferenceFile(a,'étarget; targeté; target;',query);
    expect(result.hits).toHaveLength(1);
    expect(result.reasons).toContain('non-ascii-boundary');
  });
  it('records no trustworthy observations for malformed strings',()=>{
    const result=scanListedReferenceFile(a,'target();\nbind text = "broken\n',query);
    expect(result.hits).toEqual([]);
    expect(result.reasons).toEqual(['lexical-issue']);
  });
  it('preserves exact spelling under case-insensitive matching',()=>{
    const result=scanListedReferenceFile(a,'target(); Target(); TARGET(); target_more();',{...query,caseSensitive:false});
    expect(result.hits.map(hit=>hit.token)).toEqual(['target','Target','TARGET']);
    expect(result.reasons).toEqual([]);
  });
  it('separates per-file from remaining workspace result budgets',()=>{
    const dense='target;'.repeat(MAX_LISTED_REFERENCES_PER_FILE+1);
    const file=scanListedReferenceFile(a,dense,query);
    expect(file.hits).toHaveLength(MAX_LISTED_REFERENCES_PER_FILE);
    expect(file.reasons).toEqual(['file-hit-limit']);
    const workspace=scanListedReferenceFile(a,dense,query,3);
    expect(workspace.hits).toHaveLength(3);
    expect(workspace.reasons).toEqual(['workspace-hit-limit']);
    expect(scanListedReferenceFile(a,'other;',query,0).reasons).toEqual([]);
    expect(scanListedReferenceFile(a,'target;',query,0).reasons).toEqual(['workspace-hit-limit']);
  });
});
describe('listed reference execution',()=>{
  it('retains role counts and file evidence without exposing source or path',async()=>{
    const {report,read}=await run();
    expect(report.complete).toBe(true);
    expect(report.hits).toHaveLength(8);
    expect(report.counts['call-like']).toBe(2);
    expect(report.counts['qualified-call']).toBe(1);
    expect(report.counts['declaration-like']).toBe(1);
    expect(report.files.map(file=>file.hits).reduce((sum,n)=>sum+n,0)).toBe(report.hits.length);
    expect(read).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(report)).not.toContain('private-native');
    expect(JSON.stringify(report)).not.toContain('bind result');
    expect(Object.isFrozen(report.hits[0])).toBe(true);
  });
  it('uses one current working buffer and saved disk mode independently',async()=>{
    const working={...doc(a,'target(); target(); target();'),savedContent:'target();'};
    const result=await run({[a]:'target();',[b]:'other();'},settings,query,[working]);
    expect(result.read).toHaveBeenCalledTimes(1);
    expect(result.report.hits).toHaveLength(3);
    expect(result.report.files.find(file=>file.name===a)?.origin).toBe('open-buffer');
    const saved=await run({[a]:'target();',[b]:'other();'},{...settings,mode:'saved'},query,[working]);
    expect(saved.read).toHaveBeenCalledTimes(2);
    expect(saved.report.hits).toHaveLength(1);
  });
  it('keeps incomplete reads separate from exact zero observations',async()=>{
    const response=await executeListedReferences(plan(),[],async path=>{
      if(path.endsWith(b))throw Error('private native failure');
      return 'other();';
    },control);
    if(response.kind!=='report')throw Error('Missing report');
    expect(response.report.hits).toHaveLength(0);
    expect(response.report.complete).toBe(false);
    expect(response.report.files.filter(file=>file.state==='read-failed')).toHaveLength(1);
    expect(response.report.files.filter(file=>file.state==='scanned')).toHaveLength(2);
    expect(JSON.stringify(response.report)).not.toContain('private native failure');
  });
  it('enforces aggregate hit cap while retaining known zero-match files',async()=>{
    const dense='target;'.repeat(320);
    const {report}=await run({[a]:dense,[b]:dense,[c]:dense,'tests/d.srp':'other;'});
    expect(report.hits).toHaveLength(MAX_LISTED_REFERENCE_HITS);
    expect(report.complete).toBe(false);
    expect(report.files.some(file=>file.reasons.includes('workspace-hit-limit'))).toBe(true);
    expect(report.files.find(file=>file.name==='tests/d.srp')?.state).toBe('scanned');
  });
  it('does not choose between ambiguous open buffers',async()=>{
    const {report,read}=await run({[a]:source},settings,query,[doc(a,source),{...doc(a,'target;'),id:'other'}]);
    expect(report.files[0].state).toBe('ambiguous-buffer');
    expect(report.hits).toHaveLength(0);
    expect(read).not.toHaveBeenCalled();
  });
  it('returns completed file observations only after cancellation',async()=>{
    let cancelled=false;
    const {report,read}=await run({[a]:source,[b]:'target;',[c]:'target;'},settings,query,[],{
      ...control,isCancelled:()=>cancelled,onProgress:p=>{if(p.observed===1)cancelled=true;},
    });
    expect(report.status).toBe('cancelled');
    expect(report.files.filter(file=>file.state==='not-observed')).toHaveLength(2);
    expect(read).toHaveBeenCalledTimes(1);
  });
  it('discards observations after a stale workspace generation',async()=>{
    let current=true;
    const response=await executeListedReferences(plan(),[],async()=>{
      current=false;return source;
    },{...control,isCurrent:()=>current});
    expect(response).toEqual({kind:'invalidated'});
  });
});
describe('reference filtering, reports and current-source rechecks',()=>{
  it('filters roles, source labels and exact spelling without modifying evidence',async()=>{
    const {report}=await run(undefined,settings,{...query,caseSensitive:false});
    expect(groupReferenceSpellings(report)).toEqual([{token:'target',hits:8,files:2},{token:'TARGET',hits:1,files:1}]);
    expect(filterListedReferences(report,{...DEFAULT_REFERENCE_FILTER,role:'qualified-call'})).toHaveLength(1);
    expect(filterListedReferences(report,{...DEFAULT_REFERENCE_FILTER,source:b})).toHaveLength(2);
    expect(filterListedReferences(report,{...DEFAULT_REFERENCE_FILTER,spelling:'TARGET'})).toHaveLength(1);
    expect(filterListedReferences(report,{...DEFAULT_REFERENCE_FILTER,order:'spelling'})[0].token).toBe('TARGET');
    expect(report.hits).toHaveLength(9);
  });
  it('bounds pages independently of filters',async()=>{
    const {report}=await run({[a]:'target;'.repeat(100)});
    expect(pageListedReferences(report.hits,1).rows).toHaveLength(LISTED_REFERENCE_PAGE);
    expect(pageListedReferences(report.hits,999).page).toBe(5);
    expect(pageListedReferences([],999)).toEqual({page:1,pages:1,rows:[]});
  });
  it('resolves only exact retained evidence within unique current listing',async()=>{
    const {report}=await run();
    const hit=report.hits.find(item=>item.source===a)!;
    expect(resolveListedReferencePath(report,hit,[entry(a)])).toBe(entry(a).path);
    expect(resolveListedReferencePath(report,{...hit},[entry(a)])).toBeNull();
    expect(resolveListedReferencePath(report,hit,[entry(a),entry(a)])).toBeNull();
    expect(resolveListedReferencePath(report,hit,[entry(b)])).toBeNull();
  });
  it('rejects changed lexical role or source coordinates',async()=>{
    const {report}=await run({[a]:'target();'});
    const hit=report.hits[0],current=doc(a,'target();');
    expect(recheckListedReference(hit,current,current.path!)).toMatchObject({
      documentId:current.id,source:current.content,line:1,column:1,
    });
    expect(recheckListedReference(hit,doc(a,'target = 1;'),current.path!)).toBeNull();
    expect(recheckListedReference(hit,doc(a,'\ntarget();'),current.path!)).toBeNull();
    expect(recheckListedReference(hit,doc(a,'TARGET();'),current.path!)).toBeNull();
    expect(recheckListedReference(hit,doc(b,'target();'),current.path!)).toBeNull();
    expect(recheckListedReference(hit,doc(a,'target();\n'+ 'target;'.repeat(321)),current.path!)).toBeNull();
  });
  it('redacts query and names separately in reports',async()=>{
    const {report}=await run();
    expect(listedReferenceReportText(report)).not.toContain('target');
    expect(listedReferenceReportText(report)).not.toContain(a);
    expect(listedReferenceReportText(report,true,false)).toContain(a);
    expect(listedReferenceReportText(report,true,false)).not.toContain('target');
    expect(listedReferenceReportText(report,false,true)).toContain('target');
    expect(listedReferenceReportText(report,false,true)).not.toContain(a);
    const full=listedReferenceReportText(report,true,true);
    expect(full).not.toContain('private-native');
    expect(full).not.toContain('bind result');
    expect(full.length).toBeLessThanOrEqual(MAX_SCOPE_REPORT_UNITS);
  });
});
