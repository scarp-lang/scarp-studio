import { describe,expect,it } from 'vitest';
import { parseCompilerNavigation,type CompilerNavigationReport,type CompilerSymbol,type CompilerReference,type CompilerLocation } from './compilerNavigation';
import { compareNavigationSnapshots,captureNavigationBaseline,filterComparison,comparisonPage,comparisonExport,
  comparisonOwnerLabel,DEFAULT_COMPARISON_FILTER,MAX_COMPARISON_EXPORT,type NavigationSnapshot,type NavigationBaseline } from './compilerNavigationComparison';
const site=(source:number,start:number):CompilerLocation=>({source,byteStart:start,byteEnd:start+1,line:1,column:start+1,endLine:1,endColumn:start+2});
const symbol=(id:number,name:string,kind:CompilerSymbol['kind'],owner:number|null,source:number|null,start=0,
  extra:Partial<CompilerSymbol>={}):CompilerSymbol=>({id,name,kind,owner,public:false,mutable:false,targetModule:null,
    location:source===null?null:site(source,start),...extra});
const reference=(target:number,source:number,kind:CompilerReference['kind'],start:number):CompilerReference=>({target,kind,location:site(source,start)});
function report(files:string[],symbols:CompilerSymbol[],references:CompilerReference[]=[],kind:CompilerNavigationReport['kind']='references'):CompilerNavigationReport{
  return {kind,files:files.map((path,id)=>({id,path})),symbols,references};
}
function snapshot(report:CompilerNavigationReport,folder='C:/work/project'):NavigationSnapshot{return {folder,report};}
function baseline(report:CompilerNavigationReport,folder='C:/work/project'):NavigationBaseline{return {...snapshot(report,folder),capturedAt:1};}
function compare(before:CompilerNavigationReport,after:CompilerNavigationReport){
  const result=compareNavigationSnapshots(baseline(before),snapshot(after));
  if(!result.ok)throw Error(result.error);
  return result.value;
}
describe('structural label comparison',()=>{
  it('does not use report-local IDs or file numbers across snapshots',()=>{
    const old=report(['main.srp','lib.srp'],[
      symbol(0,'f','function',null,1,1),symbol(1,'x','parameter',0,1,2),symbol(2,'sum','builtin',null,null),
    ],[reference(0,0,'call',20),reference(1,1,'read',5),reference(2,0,'call',40)]);
    const next=report(['lib.srp','main.srp'],[
      symbol(0,'sum','builtin',null,null),symbol(1,'x','parameter',2,0,2),symbol(2,'f','function',null,0,1),
    ],[reference(2,1,'call',20),reference(1,0,'read',5),reference(0,1,'call',40)]);
    const result=compare(old,next);
    expect(result.counts.unchanged).toBe(3);
    const fn=result.rows.find(row=>row.group.name==='f')!;
    expect([fn.before[0].id,fn.after[0].id]).toEqual([0,2]);
    expect(result.files).toEqual([
      {label:'lib.srp',before:2,after:2,referencesBefore:1,referencesAfter:1},
      {label:'main.srp',before:0,after:0,referencesBefore:2,referencesAfter:2},
    ]);
  });
  it('separates changed flags, target module labels, reference counts and coordinates',()=>{
    const old=report(['a.srp','b.srp'],[
      symbol(0,'f','function',null,0,0),symbol(1,'x','binding',null,0,2),symbol(2,'g','function',null,1,3),
      symbol(3,'m','import_alias',null,0,8,{targetModule:1}),
    ],[reference(0,1,'call',8),reference(1,0,'read',10)]);
    const next=report(['a.srp','b.srp','c.srp'],[
      symbol(0,'f','function',null,0,1,{public:true}),symbol(1,'x','binding',null,0,2),symbol(2,'g','function',null,1,4),
      symbol(3,'m','import_alias',null,0,8,{targetModule:2}),
    ],[reference(0,1,'call',8),reference(0,1,'call',10),reference(1,1,'read',10)]);
    const result=compare(old,next),byName=(name:string)=>result.rows.find(row=>row.group.name===name)!;
    expect(byName('f')).toMatchObject({change:'metadata',metadataChanged:true,referencesChanged:true,positionChanged:true});
    expect(byName('x')).toMatchObject({change:'references',metadataChanged:false,referencesChanged:true,positionChanged:false});
    expect(byName('g')).toMatchObject({change:'positions',metadataChanged:false,referencesChanged:false,positionChanged:true});
    expect(byName('m')).toMatchObject({change:'metadata',metadataChanged:true});
    expect(result.files.find(file=>file.label==='c.srp')).toMatchObject({before:null,after:0});
  });
  it('never pairs repeated structural labels or their descendants',()=>{
    const old=report(['a.srp'],[
      symbol(0,'f','function',null,0),symbol(1,'f','function',null,0,8),
      symbol(2,'x','parameter',0,0,2),symbol(3,'y','parameter',1,0,10),
    ]);
    const next=report(['a.srp'],[symbol(0,'f','function',null,0,8),symbol(1,'x','parameter',0,0,2)]);
    const result=compare(old,next);
    expect(result.counts.ambiguous).toBe(3);
    expect(result.rows.find(row=>row.group.name==='f')).toMatchObject({change:'ambiguous',ambiguousAncestor:false});
    expect(result.rows.find(row=>row.group.name==='x')).toMatchObject({change:'ambiguous',ambiguousAncestor:true});
    expect(result.rows.find(row=>row.group.name==='y')).toMatchObject({change:'ambiguous',ambiguousAncestor:true});
  });
  it('treats label additions and removals independently, never guessing a rename',()=>{
    const old=report(['a.srp'],[symbol(0,'old','binding',null,0)]);
    const next=report(['a.srp'],[symbol(0,'new','binding',null,0)]);
    expect(compare(old,next).rows.map(row=>[row.group.name,row.change])).toEqual([['old','only-baseline'],['new','only-current']]);
  });
  it('does not infer reference absence from a symbols-only snapshot',()=>{
    const old=report(['a.srp'],[symbol(0,'x','binding',null,0)],[],'symbols');
    const result=compare(old,old);
    expect(result.includesReferences).toBe(false);
    expect(result.rows[0].before[0].references).toBeNull();
    expect(result.files[0].referencesBefore).toBeNull();
    expect(compareNavigationSnapshots(baseline(old),snapshot({...old,kind:'references'})).ok).toBe(false);
  });
  it('handles deeply nested owner chains iteratively and fails closed for cycles',()=>{
    const symbols=Array.from({length:2000},(_,id)=>symbol(id,'node'+id,'binding',id===1999?null:id+1,0,id));
    const value=report(['a.srp'],symbols);
    const result=compare(value,value);
    expect(result.counts.unchanged).toBe(2000);
    expect(comparisonOwnerLabel(result,result.rows.find(row=>row.group.name==='node0')!.group)).toContain('…');
    const cyclic=report(['a.srp'],[symbol(0,'a','binding',1,0),symbol(1,'b','binding',0,0)]);
    expect(compareNavigationSnapshots(baseline(cyclic),snapshot(cyclic)).ok).toBe(false);
  });
});
describe('baseline confirmation and bounded comparison projections',()=>{
  const sample=report(['/private/source.srp'],[symbol(0,'Secret','binding',null,0)]);
  it('requires exact reviewed report and prior baseline identity',()=>{
    const current=snapshot(sample),review={snapshot:current,previous:null};
    const captured=captureNavigationBaseline(review,current,null,42);
    expect(captured).toMatchObject({capturedAt:42,folder:current.folder,report:sample});
    expect(captureNavigationBaseline(review,{...current},null,42)).toBeNull();
    expect(captureNavigationBaseline(review,current,captured,42)).toBeNull();
    expect(captureNavigationBaseline(review,current,null,NaN)).toBeNull();
    expect(compareNavigationSnapshots(captured,snapshot(sample,'C:/other')).ok).toBe(false);
    expect(compareNavigationSnapshots(captured,snapshot(sample,'C:/WORK/PROJECT')).ok).toBe(true);
  });
  it('filters and paginates groups and omits private labels by default',()=>{
    const result=compare(sample,report(['/private/source.srp'],[
      symbol(0,'Secret','binding',null,0),symbol(1,'Other','function',null,0,2),
    ]));
    expect(filterComparison(result,DEFAULT_COMPARISON_FILTER).map(row=>row.group.name)).toEqual(['Other']);
    expect(filterComparison(result,{query:'secret private',change:'all',kind:'binding'})).toHaveLength(1);
    const text=comparisonExport(result,result.rows).text;
    expect(text).not.toContain('Secret');expect(text).not.toContain('/private');
    expect(comparisonExport(result,result.rows,true).text).toContain('/private/source.srp');
    expect(comparisonPage(Array.from({length:41},(_,i)=>i),99)).toMatchObject({page:3,pages:3,items:[40]});
  });
  it('bounds export size and announces omitted whole groups',()=>{
    const many=report(['p.srp'],Array.from({length:1000},(_,id)=>symbol(id,'x'.repeat(200)+id,'binding',null,0,id)));
    const result=compare(many,many),text=comparisonExport(result,result.rows,true);
    expect(text.text.length).toBeLessThanOrEqual(MAX_COMPARISON_EXPORT);
    expect(text.included+text.omitted).toBe(1000);
    expect(text.omitted).toBeGreaterThan(0);
  });
  it('operates on genuinely validated wire reports',()=>{
    const raw={schema_version:1,kind:'scarp.symbols',span_encoding:'utf-8-bytes',column_encoding:'unicode-scalar',position_base:1,
      files:[{id:0,path:'main.srp'}],symbols:[{id:0,name:'x',kind:'binding',owner:null,public:false,mutable:false,target_module:null,
        location:{source:0,span:[0,1],start:{line:1,column:1},end:{line:1,column:2}}}]};
    const parsed=parseCompilerNavigation(JSON.stringify(raw),'inspect-symbols');
    if(!parsed.ok)throw Error(parsed.reason);
    expect(compare(parsed.report,parsed.report).counts.unchanged).toBe(1);
  });
});
