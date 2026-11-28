import {describe,expect,it} from 'vitest';
import {prepareProjectInspection,type InspectionSettings} from './projectInspection';
import {DEFAULT_PROJECT_SEARCH_SCOPE,MAX_SCOPE_REPORT_UNITS} from './projectSearchScope';
import {executeListedSymbolIndex,type ListedSymbolReport} from './listedSymbolIndex';
import {captureInterfaceBaseline,compareInterfaceBaselines,filterInterfaces,filterInterfaceComparison,pageInterfaces,
  interfaceInventoryReport,interfaceComparisonReport,DEFAULT_INTERFACE_FILTER,type InterfaceBaseline} from './listedFunctionInterfaces';
import type {StudioDocument} from './documents';

const settings:InspectionSettings={scope:DEFAULT_PROJECT_SEARCH_SCOPE,mode:'working',listingLimited:false};
const a='private/a.srp',b='private/b.srp';
const entry=(name:string)=>({name,path:'/private-native/'+name});
function value<T>(result:{ok:true;value:T}|{ok:false;error:string}):T{
  if(!result.ok)throw Error(result.error);return result.value;
}
async function index(contents:Record<string,string>,config=settings,docs:readonly StudioDocument[]=[],capture=true,
  unavailable:readonly string[]=[]):Promise<ListedSymbolReport>{
  const plan=value(prepareProjectInspection(Object.keys(contents).map(entry),config));
  const result=await executeListedSymbolIndex(plan,docs,async path=>{
    const label=path.replace('/private-native/','');
    if(unavailable.includes(label))throw Error('private native failure');
    return contents[label];
  },{isCurrent:()=>true,isCancelled:()=>false},capture);
  if(result.kind!=='report')throw Error('Missing report');
  return result.report;
}
async function baseline(contents:Record<string,string>,config=settings,docs:readonly StudioDocument[]=[],
  unavailable:readonly string[]=[]):Promise<InterfaceBaseline>{
  return value(captureInterfaceBaseline(await index(contents,config,docs,true,unavailable)));
}
describe('explicit listed interface capture',()=>{
  it('does not capture header shapes by default',async()=>{
    const report=await index({[a]:'pub funcra privateName(secret: privateType) { }'},settings,[],false);
    expect(report.interfaces).toBeNull();
    expect(JSON.stringify(report)).not.toContain('privateType');
    expect(JSON.stringify(report)).not.toContain('secret');
    expect(captureInterfaceBaseline(report).ok).toBe(false);
  });
  it('captures only retained top-level function interfaces, not their bodies',async()=>{
    const report=await index({[a]:'pub funcra privateName(secret: privateType) { print("private body"); }\nfuncra local() { funcra nested() {} }'});
    expect(report.interfaces?.map(item=>item.site.name)).toEqual(['privateName','local']);
    expect(report.interfaces?.[0].evidence).toMatchObject({ok:true,shape:{parameters:[['secret',':','privateType']]}});
    expect(JSON.stringify(report)).not.toContain('private body');
    expect(JSON.stringify(report)).not.toContain('/private-native/');
    const captured=value(captureInterfaceBaseline(report));
    expect(captured.complete).toBe(true);
    expect(captured.files[0].records).toHaveLength(2);
    expect(Object.isFrozen(captured.files[0].records[0].shape?.parameters)).toBe(true);
  });
  it('rejects observations with mismatched or duplicated retained declaration identities',async()=>{
    const report=await index({[a]:'pub funcra a() {} pub funcra b() {}'});
    const first=report.interfaces![0],second=report.interfaces![1];
    expect(captureInterfaceBaseline({...report,interfaces:[first]}).ok).toBe(false);
    expect(captureInterfaceBaseline({...report,interfaces:[first,first]}).ok).toBe(false);
    expect(captureInterfaceBaseline({...report,interfaces:[{...first,site:{...first.site}},second]}).ok).toBe(false);
    if(!first.evidence.ok)throw Error('Missing expected shape');
    expect(captureInterfaceBaseline({...report,interfaces:[
      {...first,evidence:{ok:true,shape:{...first.evidence.shape,name:'changed'}}},second,
    ]}).ok).toBe(false);
  });
  it('retains unavailable shapes as incomplete file evidence',async()=>{
    const report=await index({[a]:'pub funcra unsupported(x) {}\npub funcra supported() {}'});
    const captured=value(captureInterfaceBaseline(report));
    expect(captured.complete).toBe(false);
    expect(captured.files[0].complete).toBe(false);
    expect(captured.files[0].records.find(item=>item.name==='unsupported')?.shape).toBeNull();
    expect(captured.files[0].records.find(item=>item.name==='supported')?.shape).not.toBeNull();
  });
});
describe('function interface observations over time',()=>{
  it('distinguishes unchanged body edits, shape changes, visibility changes and observed names',async()=>{
    const earlier=await baseline({[a]:[
      'pub funcra unchanged(x: integer) -> integer { return x; }',
      'pub funcra changed(x: integer) -> integer { return x; }',
      'pub funcra visibility() {}',
      'pub funcra removed() {}',
    ].join('\n')});
    const current=await baseline({[a]:[
      '// moved coordinates',
      'pub funcra unchanged(x: integer) -> integer { return 42; }',
      'pub pure funcra changed(x: float) -> integer {}',
      'funcra visibility() {}',
      'pub funcra added() {}',
    ].join('\n')});
    const data=value(compareInterfaceBaselines(earlier,current));
    const changes=Object.fromEntries(data.rows.map(row=>[row.name,row.change]));
    expect(changes).toEqual({added:'observed-added',changed:'shape-changed',removed:'observed-removed',
      unchanged:'unchanged',visibility:'visibility-changed'});
    expect(data.earlierComplete).toBe(true);
    expect(data.currentComplete).toBe(true);
    expect(data.counts['shape-changed']).toBe(1);
    expect(data.counts['visibility-changed']).toBe(1);
  });
  it('never pairs repeated function spellings by order or coordinates',async()=>{
    const before=await baseline({[a]:'pub funcra duplicate(a: integer) {} pub funcra duplicate(b: float) {}'});
    const after=await baseline({[a]:'pub funcra duplicate(b: float) {} pub funcra duplicate(a: integer) {}'});
    const data=value(compareInterfaceBaselines(before,after));
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0].change).toBe('ambiguous');
    expect(data.rows[0].before).toHaveLength(2);
    expect(data.rows[0].after).toHaveLength(2);
  });
  it('does not infer removals in unread or partial file observations',async()=>{
    const before=await baseline({[a]:'pub funcra retained() {}',[b]:'pub funcra other() {}'});
    const after=await baseline({[a]:'',[b]:'pub funcra other() {}'},settings,[],[a]);
    const data=value(compareInterfaceBaselines(before,after));
    expect(data.rows.find(row=>row.name==='retained')?.change).toBe('incomplete');
    expect(data.counts['observed-removed']).toBe(0);
    expect(data.currentComplete).toBe(false);
    const partial=await baseline({[a]:'pub funcra unsupported(x) {}',[b]:'pub funcra other() {}'});
    expect(value(compareInterfaceBaselines(before,partial)).rows.find(row=>row.name==='retained')?.change).toBe('incomplete');
  });
  it('separates file selection membership from declaration absence',async()=>{
    const before=await baseline({[a]:'pub funcra first() {}',[b]:'pub funcra shared() {}'});
    const after=await baseline({[b]:'pub funcra shared() {}','private/c.srp':'pub funcra first() {}'});
    const data=value(compareInterfaceBaselines(before,after));
    expect(data.counts['earlier-only-file']).toBe(1);
    expect(data.counts['current-only-file']).toBe(1);
    expect(data.counts['observed-removed']).toBe(0);
    expect(data.counts['observed-added']).toBe(0);
  });
  it('declines comparison across different source origins',async()=>{
    const content='pub funcra current() {}';
    const before=await baseline({[a]:content});
    const after=await baseline({[a]:content},settings,[{
      id:'working',name:a,path:entry(a).path,content,savedContent:content,revision:0,
    }]);
    const data=value(compareInterfaceBaselines(before,after));
    expect(data.rows[0].change).toBe('origin-changed');
  });
  it('rejects changes to mode and reviewed scope',async()=>{
    const contents={[a]:'pub funcra a() {}'};
    const before=await baseline(contents);
    const saved=await baseline(contents,{...settings,mode:'saved'});
    const scoped=await baseline(contents,{...settings,scope:{...settings.scope,directory:'private'}});
    expect(compareInterfaceBaselines(before,saved).ok).toBe(false);
    expect(compareInterfaceBaselines(before,scoped).ok).toBe(false);
  });
});
describe('interface inventory and comparison display',()=>{
  it('filters public modifiers, exact source labels, names and change states',async()=>{
    const report=await index({[a]:'pub funcra shown() {} funcra hidden() {}',[b]:'pub funcra second() {}'});
    expect(filterInterfaces(report,DEFAULT_INTERFACE_FILTER).map(item=>item.site.name)).toEqual(['shown','second']);
    expect(filterInterfaces(report,{...DEFAULT_INTERFACE_FILTER,publicOnly:false})).toHaveLength(3);
    expect(filterInterfaces(report,{...DEFAULT_INTERFACE_FILTER,source:b})).toHaveLength(1);
    expect(filterInterfaces(report,{...DEFAULT_INTERFACE_FILTER,query:'SHOWN'})).toHaveLength(1);
    const before=value(captureInterfaceBaseline(report));
    const after=await baseline({[a]:'pub funcra shown() {} pub funcra hidden() {}',[b]:'pub funcra second() {}'});
    const compared=value(compareInterfaceBaselines(before,after));
    expect(filterInterfaceComparison(compared,{...DEFAULT_INTERFACE_FILTER,changedOnly:true}).map(row=>row.name)).toEqual(['hidden']);
    expect(filterInterfaceComparison(compared,{...DEFAULT_INTERFACE_FILTER,change:'unchanged'})).toHaveLength(2);
    expect(pageInterfaces([],99)).toEqual({page:1,pages:1,rows:[]});
  });
  it('redacts function, type and parameter names unless explicitly requested',async()=>{
    const report=await index({[a]:'pub funcra privateFunction(privateParam: privateType) needs privateCondition { print("private body"); }'});
    const plain=interfaceInventoryReport(report);
    for(const secret of [a,'privateFunction','privateParam','privateType','privateCondition','private body']){
      expect(plain).not.toContain(secret);
    }
    const names=interfaceInventoryReport(report,{includeLabels:false,includeNames:true,includeShapes:false});
    expect(names).toContain('privateFunction');
    expect(names).not.toContain('privateType');
    expect(names).not.toContain(a);
    const shapes=interfaceInventoryReport(report,{includeLabels:false,includeNames:false,includeShapes:true});
    expect(shapes).toContain('privateParam');
    expect(shapes).toContain('privateType');
    expect(shapes).not.toContain('privateCondition');
    expect(shapes).not.toContain('private body');
    expect(shapes).not.toContain(a);
  });
  it('limits optional shape reports and preserves explicit privacy controls',async()=>{
    const functions=Array.from({length:300},(_,i)=>
      'pub funcra f'+i+'(parameter_'+ 'x'.repeat(80)+': type_'+ 'y'.repeat(80)+') {}').join('\n');
    const report=await index({[a]:functions});
    const output=interfaceInventoryReport(report,{includeLabels:true,includeNames:true,includeShapes:true});
    expect(output.length).toBeLessThanOrEqual(MAX_SCOPE_REPORT_UNITS);
    expect(output).toContain('Additional interface evidence omitted');
    const captured=value(captureInterfaceBaseline(report));
    const data=value(compareInterfaceBaselines(captured,captured));
    const plain=interfaceComparisonReport(data);
    expect(plain).not.toContain(a);
    expect(plain).not.toContain('parameter_');
    const detailed=interfaceComparisonReport(data,{includeLabels:true,includeNames:true,includeShapes:true});
    expect(detailed.length).toBeLessThanOrEqual(MAX_SCOPE_REPORT_UNITS);
    expect(detailed).toContain('Additional interface evidence omitted');
  });
});
