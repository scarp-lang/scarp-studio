import { describe,expect,it } from 'vitest';
import type { CompilerNavigationReport,CompilerSymbol,CompilerLocation,CompilerReference } from './compilerNavigation';
import {
  summarizeCompilerNavigation,querySymbolUsage,DEFAULT_USAGE_QUERY,buildOwnershipOverview,
  visibleOwnershipRows,buildNavigationOverviewReport,overviewPage,MAX_OVERVIEW_REPORT_UNITS,OVERVIEW_PAGE_SIZE,
} from './compilerNavigationOverview';
const site=(source:number):CompilerLocation=>({source,byteStart:0,byteEnd:1,line:1,column:1,endLine:1,endColumn:2});
function symbol(id:number,name:string,location:CompilerLocation|null,patch:Partial<CompilerSymbol>={}):CompilerSymbol{
  return {id,name,location,kind:'binding',owner:null,public:false,mutable:false,targetModule:null,...patch};
}
function fixture(kind:CompilerNavigationReport['kind']='references'):CompilerNavigationReport{
  const refs:CompilerReference[]=[
    {target:2,kind:'read',location:site(0)},
    {target:2,kind:'write',location:site(0)},
    {target:2,kind:'read_write',location:site(1)},
    {target:3,kind:'call',location:site(0)},
    {target:3,kind:'call',location:site(0)},
    {target:4,kind:'call',location:site(0)},
    {target:5,kind:'read',location:site(1)},
    {target:3,kind:'call',location:site(2)},
  ];
  return {kind,files:[{id:0,path:'C:/private/main.srp'},{id:1,path:'C:/private/lib.srp'},{id:2,path:'C:/private/third.srp'}],
    symbols:[
      symbol(0,'module_main',site(0),{kind:'module'}),
      symbol(1,'module_lib',site(1),{kind:'module'}),
      symbol(2,'shared',site(0),{owner:0,mutable:true}),
      symbol(3,'shared',site(1),{owner:1,kind:'function',public:true}),
      symbol(4,'print',null,{kind:'builtin'}),
      symbol(5,'result',null,{kind:'contract_result',owner:3}),
      symbol(6,'unused_hint',site(1),{owner:3,kind:'parameter'}),
    ],references:kind==='references'?refs:[]};
}
describe('compiler navigation overview',()=>{
  it('partitions each reference once and does not infer a location for an implicit target',()=>{
    const report=fixture(),o=summarizeCompilerNavigation(report);
    expect(o).toMatchObject({localReferences:2,crossFileReferences:4,implicitTargetReferences:2,implicitSymbols:2});
    expect(o.localReferences!+o.crossFileReferences!+o.implicitTargetReferences!).toBe(report.references.length);
    expect(o.files.reduce((sum,file)=>sum+file.symbols,0)+o.implicitSymbols).toBe(report.symbols.length);
    expect(o.files.reduce((sum,file)=>sum+file.referencesFrom!,0)).toBe(report.references.length);
    expect(o.files.reduce((sum,file)=>sum+file.referencesTo!,0)).toBe(6);
    expect(o.files[0]).toMatchObject({symbols:2,mutableSymbols:1,publicSymbols:0,referencesFrom:5,referencesTo:3,crossFileFrom:2,crossFileTo:1,implicitTargetReferences:1});
    expect(o.files[1]).toMatchObject({symbols:3,publicSymbols:1,referencesFrom:2,referencesTo:3,crossFileFrom:1,crossFileTo:3,implicitTargetReferences:1});
    expect(o.usage[5]).toMatchObject({references:1,local:0,external:0,unknownDefinition:1,sourceIds:[1]});
  });
  it('groups repeated references by actual source and target file identities',()=>{
    const o=summarizeCompilerNavigation(fixture());
    expect(o.links.map(link=>[link.from,link.to,link.references,link.distinctTargets])).toEqual([
      [0,1,2,[3]],[1,0,1,[2]],[2,1,1,[3]],
    ]);
    expect(o.links[0].byKind.call).toBe(2);
    expect(o.links[1].byKind.read_write).toBe(1);
    expect(o.usage[2]).toMatchObject({references:3,local:2,external:1,sourceIds:[0,1]});
    expect(o.usage[3]).toMatchObject({references:3,local:0,external:3,sourceIds:[0,2]});
    expect(Object.isFrozen(o.links[0].distinctTargets)).toBe(true);
    expect(Object.isFrozen(o.files[0].bySymbolKind)).toBe(true);
  });
  it('never treats definitions-only metadata as zero references',()=>{
    const report=fixture('symbols'),o=summarizeCompilerNavigation(report);
    expect(o).toMatchObject({includesReferences:false,localReferences:null,crossFileReferences:null,implicitTargetReferences:null,links:[]});
    expect(o.files.every(file=>file.referencesFrom===null&&file.referencesTo===null)).toBe(true);
    expect(o.usage.every(use=>use.references===null&&use.byKind===null)).toBe(true);
    expect(querySymbolUsage(report,o,{...DEFAULT_USAGE_QUERY,filter:'no-observed-references'})).toEqual([]);
    expect(querySymbolUsage(report,o,DEFAULT_USAGE_QUERY)).toHaveLength(report.symbols.length);
  });
  it('filters by reference kind, source identity and query without conflating same-name symbols',()=>{
    const report=fixture(),o=summarizeCompilerNavigation(report);
    const ids=(patch:Partial<typeof DEFAULT_USAGE_QUERY>)=>querySymbolUsage(report,o,{...DEFAULT_USAGE_QUERY,...patch}).map(row=>row.symbol.id);
    expect(ids({query:'SHARED'})).toEqual([2,3]);
    expect(ids({query:'shared',sourceId:1})).toEqual([3]);
    expect(ids({filter:'writes'})).toEqual([2]);
    expect(ids({filter:'cross-file',order:'cross-file'})).toEqual([3,2]);
    expect(ids({filter:'no-observed-references'})).toEqual([0,1,6]);
    expect(ids({sourceId:'implicit'})).toEqual([4,5]);
    expect(ids({filter:'has-references',order:'references'})).toEqual([2,3,4,5]);
  });
  it('produces an opt-in bounded label-bearing report and defaults to counts and IDs',()=>{
    const report=fixture(),o=summarizeCompilerNavigation(report);
    const hidden=buildNavigationOverviewReport(report,o);
    expect(hidden.text).not.toContain('C:/private');
    expect(hidden.text).not.toContain('unused_hint');
    expect(hidden.text).toContain('Cross-file #0 → #1');
    const shown=buildNavigationOverviewReport(report,o,true);
    expect(shown.text).toContain('C:/private/main.srp');
    expect(shown.text).toContain('"shared"');
    expect(shown.omitted).toBe(0);
    const huge:CompilerNavigationReport={kind:'symbols',files:[],references:[],
      symbols:Array.from({length:4096},(_,id)=>symbol(id,'a'.repeat(4096),null))};
    const bounded=buildNavigationOverviewReport(huge,summarizeCompilerNavigation(huge),true);
    expect(bounded.text.length).toBeLessThanOrEqual(MAX_OVERVIEW_REPORT_UNITS);
    expect(bounded.omitted).toBeGreaterThan(0);
    expect(bounded.text).toContain('omitted by report limit');
  });
});
describe('compiler owner projection',()=>{
  it('preserves explicit ownership of implicit and located symbols',()=>{
    const tree=buildOwnershipOverview(fixture());
    expect(tree.roots).toEqual([0,1,4]);
    expect(tree.nodes[1].childIds).toEqual([3]);
    expect(tree.nodes[1].descendantCount).toBe(3);
    expect(tree.nodes[3].childIds).toEqual([5,6]);
    expect(visibleOwnershipRows(tree,new Set())).toEqual([{id:0,depth:0},{id:1,depth:0},{id:4,depth:0}]);
    expect(visibleOwnershipRows(tree,new Set([1,3])).map(row=>[row.id,row.depth])).toEqual([[0,0],[1,0],[3,1],[5,2],[6,2],[4,0]]);
  });
  it('handles deep acyclic chains iteratively without recursion',()=>{
    const length=4096;
    const report:CompilerNavigationReport={kind:'symbols',files:[],references:[],
      symbols:Array.from({length},(_,id)=>symbol(id,'node'+id,null,{owner:id===0?null:id-1}))};
    const tree=buildOwnershipOverview(report);
    expect(tree.nodes[0].descendantCount).toBe(length-1);
    expect(tree.nodes[length-1].descendantCount).toBe(0);
    const rows=visibleOwnershipRows(tree,new Set(report.symbols.map(s=>s.id)));
    expect(rows).toHaveLength(length);
    expect(rows.at(-1)).toEqual({id:length-1,depth:length-1});
  });
  it('clamps page requests and never drops items when traversing pages',()=>{
    const rows=Array.from({length:OVERVIEW_PAGE_SIZE*2+1},(_,id)=>id);
    expect(overviewPage(rows,Infinity).page).toBe(1);
    expect(overviewPage(rows,999).items).toEqual([OVERVIEW_PAGE_SIZE*2]);
    expect([1,2,3].flatMap(page=>overviewPage(rows,page).items)).toEqual(rows);
  });
});
