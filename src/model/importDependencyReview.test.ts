import { describe,expect,it } from 'vitest';
import { buildScarpImportGraph, collectScarpRawImports,currentImportNavigationTarget,
  MAX_IMPORT_GRAPH_SOURCE_UNITS, type ListedImportSource } from './sourceImports';
import { dependencyLayers, dependencyReport, reachableImportNodes, reviewImportDependencies } from './importDependencyReview';
import type { StudioDocument } from './documents';

function doc(name:string,content:string,revision=1):StudioDocument{
  return {id:name,name,path:'C:/workspace/'+name,content,savedContent:content,revision};
}
function listed(...names:string[]):ListedImportSource[]{
  return names.map(name=>({name,path:'C:/workspace/'+name}));
}
const imp=(name:string,alias=name)=>'import "'+name+'.srp" as '+alias+';';
function review(docs:StudioDocument[],additional:string[]=[]){
  return reviewImportDependencies(buildScarpImportGraph(docs,listed(...docs.map(d=>d.name),...additional)));
}
describe('observed dependency graph',()=>{
  it('preserves direct edge multiplicity separately from distinct neighbors',()=>{
    const a=doc('a.srp',imp('b','one')+imp('b','two')), b=doc('b.srp','');
    const result=review([a,b]);
    expect(result.nodes[0]).toMatchObject({imports:2,outgoing:['b.srp'],incoming:[],importedBy:0,uncertainEdges:0});
    expect(result.nodes[1]).toMatchObject({incoming:['a.srp'],importedBy:2,outgoing:[]});
    expect(result.incomplete).toBe(false);
  });
  it('retains frontier and unresolved edges without guessing unopened nodes',()=>{
    const a=doc('a.srp',imp('b')+imp('missing')+imp('../escape','bad'));
    const result=review([a],['b.srp']);
    expect(result).toMatchObject({incomplete:true,unknownTargetEdges:3});
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]).toMatchObject({outgoing:[],uncertainEdges:3});
    expect(reachableImportNodes(result,a.id,'dependencies')).toEqual([]);
  });
  it('detects a single strongly connected component in overlapping cycles',()=>{
    const a=doc('a.srp',imp('b')),b=doc('b.srp',imp('a')+imp('c')),c=doc('c.srp',imp('b'));
    const d=doc('d.srp',imp('a'));
    const result=review([d,c,b,a]);
    expect(result.components.map(c=>[c.members.map(n=>n.id),c.cyclic])).toEqual([
      [['a.srp','b.srp','c.srp'],true],[['d.srp'],false],
    ]);
  });
  it('recognizes self loops as cyclic single-node components',()=>{
    const result=review([doc('a.srp',imp('a')),doc('b.srp','')]);
    expect(result.components.map(c=>[c.members[0].id,c.cyclic])).toEqual([['a.srp',true],['b.srp',false]]);
  });
  it('groups repeated exact aliases within one source only',()=>{
    const a=doc('a.srp',imp('b','shared')+imp('c','shared')+imp('b','SHARED'));
    const b=doc('b.srp',imp('c','shared')),c=doc('c.srp','');
    const result=review([a,b,c]);
    expect(result.duplicateAliases).toHaveLength(1);
    expect(result.duplicateAliases[0]).toMatchObject({documentId:a.id,alias:'shared'});
    expect(result.duplicateAliases[0].edges.map(e=>e.specifier)).toEqual(['b.srp','c.srp']);
  });
  it('keeps exact nested source identities distinct',()=>{
    const a=doc('first/main.srp',imp('helper')),b=doc('first/helper.srp','');
    const c=doc('second/main.srp',imp('helper')),d=doc('second/helper.srp','');
    const result=review([a,b,c,d]);
    expect(reachableImportNodes(result,a.id,'dependencies').map(x=>x.node.id)).toEqual([b.id]);
    expect(reachableImportNodes(result,c.id,'dependencies').map(x=>x.node.id)).toEqual([d.id]);
  });
});
describe('observed breadth-first routes and layers',()=>{
  const a=doc('a.srp',imp('c')+imp('b')), b=doc('b.srp',imp('d')),c=doc('c.srp',imp('d')),d=doc('d.srp','');
  it('uses deterministic shortest observed routes through a diamond',()=>{
    const result=review([d,c,b,a]);
    expect(reachableImportNodes(result,a.id,'dependencies').map(r=>[r.node.id,r.distance,r.route.map(n=>n.id)])).toEqual([
      [b.id,1,[a.id,b.id]],[c.id,1,[a.id,c.id]],[d.id,2,[a.id,b.id,d.id]],
    ]);
  });
  it('walks reverse edges for dependents without duplicating vertices',()=>{
    const result=review([a,b,c,d]);
    expect(reachableImportNodes(result,d.id,'dependents').map(r=>[r.node.id,r.distance])).toEqual([[b.id,1],[c.id,1],[a.id,2]]);
  });
  it('does not return the root again in a cyclic route',()=>{
    const result=review([doc('a.srp',imp('b')),doc('b.srp',imp('a'))]);
    expect(reachableImportNodes(result,'a.srp','dependencies').map(r=>r.node.id)).toEqual(['b.srp']);
    expect(reachableImportNodes(result,'missing.srp','dependents')).toEqual([]);
  });
  it('layers the condensation graph from observed leaves to dependents',()=>{
    const result=review([a,b,c,d]);
    expect(dependencyLayers(result).map(layer=>layer.components.map(c=>c.members.map(n=>n.id)))).toEqual([
      [['d.srp']],[['b.srp'],['c.srp']],[['a.srp']],
    ]);
  });
  it('keeps a cyclic component intact in one layer',()=>{
    const result=review([doc('a.srp',imp('b')),doc('b.srp',imp('a')+imp('leaf')),doc('leaf.srp','')]);
    expect(dependencyLayers(result).map(layer=>layer.components.map(c=>c.members.map(n=>n.id)))).toEqual([
      [['leaf.srp']],[['a.srp','b.srp']],
    ]);
  });
  it('returns no synthetic layers for an empty graph',()=>{
    expect(dependencyLayers(review([]))).toEqual([]);
  });
  it('reports only relative names and labels unknown coverage',()=>{
    const result=review([doc('a.srp',imp('missing'))]);
    const report=dependencyReport(result);
    expect(report.text).toContain('incomplete or unresolved frontier');
    expect(report.text).toContain('"a.srp"');
    expect(report.text).not.toContain('C:/workspace');
    expect(report.omitted).toBe(0);
  });
});
describe('import navigation provenance and coverage',()=>{
  it('requires a complete recognizable header with a semicolon',()=>{
    expect(collectScarpRawImports('import "b.srp" as b').references[0].recognized).toBe(false);
    expect(collectScarpRawImports('import "b.srp" as b; "unfinished')).toEqual({references:[],incomplete:true});
  });
  it('revalidates exact source generation, original header and listing ambiguity',()=>{
    const a=doc('a.srp',imp('b')),b=doc('b.srp',''),list=listed('a.srp','b.srp');
    const edge=buildScarpImportGraph([a,b],list).edges[0];
    expect(currentImportNavigationTarget(edge,[a,b],list)).toBe(b.path);
    expect(currentImportNavigationTarget(edge,[doc(a.name,a.content,2),b],list)).toBeNull();
    expect(currentImportNavigationTarget(edge,[doc(a.name,imp('c')),b],list)).toBeNull();
    expect(currentImportNavigationTarget(edge,[a,b],list.slice(0,1))).toBeNull();
    expect(currentImportNavigationTarget(edge,[a,b],[...list,{name:'b.srp',path:'C:/other/b.srp'}])).toBeNull();
  });
  it('bounds aggregate scans and marks open targets whose bodies were not scanned as unresolved',()=>{
    const source=' '.repeat(512*1024-100);
    const docs=Array.from({length:5},(_,i)=>doc('m'+i+'.srp',source+(i===0?imp('m4'):'')));
    const graph=buildScarpImportGraph(docs,listed(...docs.map(d=>d.name)));
    expect(docs.reduce((sum,d)=>sum+d.content.length,0)).toBeGreaterThan(MAX_IMPORT_GRAPH_SOURCE_UNITS);
    expect(graph.limited).toBe(true);
    const result=reviewImportDependencies(graph);
    expect(result.incomplete).toBe(true);
    expect(result.unknownTargetEdges).toBe(1);
  });
});
