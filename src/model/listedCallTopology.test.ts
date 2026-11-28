import {describe,expect,it} from 'vitest';
import {prepareProjectInspection,type InspectionSettings} from './projectInspection';
import {DEFAULT_PROJECT_SEARCH_SCOPE,MAX_SCOPE_REPORT_UNITS} from './projectSearchScope';
import {executeListedSymbolIndex,type ListedSymbolReport} from './listedSymbolIndex';
import {buildListedCallTopology,topologyNeighbors,walkTopology,shortestTopologyPath,filterTopologyNodes,
  pageTopology,topologyReportText,DEFAULT_TOPOLOGY_FILTER,MAX_TOPOLOGY_DEPTH,MAX_TOPOLOGY_VISITS} from './listedCallTopology';

const settings:InspectionSettings={scope:DEFAULT_PROJECT_SEARCH_SCOPE,mode:'working',listingLimited:false};
const a='private/a.srp',b='private/b.srp';
const sourceA='funcra entry() { first(); first(); duplicate(); unknown(); }\nfuncra first() { second(); }\nfuncra duplicate() { }\n';
const sourceB='funcra second() { first(); }\nfuncra duplicate() { }\nfuncra self() { self(); }\nentry();\n';
async function report(contents:Record<string,string>={[a]:sourceA,[b]:sourceB},config=settings):Promise<ListedSymbolReport>{
  const plan=prepareProjectInspection(Object.keys(contents).map(name=>({name,path:'/private-native/'+name})),config);
  if(!plan.ok)throw Error(plan.error);
  const result=await executeListedSymbolIndex(plan.value,[],async path=>contents[path.replace('/private-native/','')],
    {isCurrent:()=>true,isCancelled:()=>false});
  if(result.kind!=='report')throw Error('Missing report');
  return result.report;
}
function node(graph:ReturnType<typeof buildListedCallTopology>,name:string,source?:string){
  const value=graph.nodes.find(node=>node.name===name&&(!source||node.source===source));
  if(!value)throw Error('Missing topology node '+name);
  return value;
}
describe('lexical call candidate graph',()=>{
  it('aggregates repeated observed call sites by exact caller and spelling',async()=>{
    const graph=buildListedCallTopology(await report());
    const entry=node(graph,'entry');
    const outgoing=topologyNeighbors(graph,entry.id)!.outgoing;
    const first=outgoing.find(edge=>edge.name==='first')!;
    expect(first.kind).toBe('unique-candidate');
    expect(first.sites).toHaveLength(2);
    expect(first.targetId).toBe(node(graph,'first').id);
    expect(outgoing.find(edge=>edge.name==='duplicate')).toMatchObject({
      kind:'ambiguous-candidates',candidateCount:2,targetId:null,
    });
    expect(outgoing.find(edge=>edge.name==='unknown')).toMatchObject({
      kind:'unobserved-candidate',candidateCount:0,targetId:null,
    });
    expect(entry.outbound).toBe(3);
    expect(graph.edges.reduce((total,edge)=>total+edge.sites.length,0)).toBe(graph.callSites);
  });
  it('preserves separate identities for duplicate function names',async()=>{
    const graph=buildListedCallTopology(await report({
      [a]:'funcra duplicate() { one(); }\nfuncra duplicate() { two(); }\nfuncra one() { }\nfuncra two() { }\n',
    }));
    const duplicates=graph.nodes.filter(item=>item.name==='duplicate');
    expect(duplicates).toHaveLength(2);
    expect(duplicates[0].id).not.toBe(duplicates[1].id);
    expect(topologyNeighbors(graph,duplicates[0].id)!.outgoing.map(edge=>edge.name)).toEqual(['one']);
    expect(topologyNeighbors(graph,duplicates[1].id)!.outgoing.map(edge=>edge.name)).toEqual(['two']);
  });
  it('represents file or unavailable function context without guessing an owner',async()=>{
    const graph=buildListedCallTopology(await report());
    const root=graph.nodes.find(item=>item.kind==='file-context')!;
    expect(root.source).toBe(b);
    expect(root.declaration).toBeNull();
    expect(topologyNeighbors(graph,root.id)!.outgoing[0].targetId).toBe(node(graph,'entry').id);
    expect(graph.fileContextEdges).toBe(1);
    expect(graph.complete).toBe(true);
  });
  it('keeps isolated declarations as nodes and distinguishes ambiguous edges',async()=>{
    const graph=buildListedCallTopology(await report({
      [a]:'funcra isolated() { }\nfuncra alpha() { beta(); }\nfuncra beta() { alpha(); }\nfuncra beta() { }\n',
    }));
    expect(node(graph,'isolated')).toMatchObject({inbound:0,outbound:0});
    expect(graph.ambiguousEdges).toBe(1);
    expect(graph.cycles).toHaveLength(0);
  });
});
describe('candidate topology cycles and traversal',()=>{
  it('finds two-node and self-only components without claiming runtime recursion',async()=>{
    const graph=buildListedCallTopology(await report());
    expect(graph.cycles).toHaveLength(2);
    expect(graph.cycles[0].nodes.map(id=>graph.nodes.find(node=>node.id===id)!.name).sort()).toEqual(['first','second']);
    expect(graph.cycles[0].edgeIds).toHaveLength(2);
    expect(graph.cycles[0].selfOnly).toBe(false);
    expect(graph.cycles[1]).toMatchObject({nodes:[node(graph,'self').id],selfOnly:true});
  });
  it('traverses unique candidate edges in either direction without revisiting cycles',async()=>{
    const graph=buildListedCallTopology(await report());
    const start=node(graph,'entry').id;
    const outward=walkTopology(graph,start,'outgoing',8);
    expect(outward.rows.map(row=>[row.node.name,row.depth])).toEqual([['entry',0],['first',1],['second',2]]);
    expect(outward.limited).toBe(false);
    expect(walkTopology(graph,node(graph,'second').id,'incoming',8).rows.map(row=>row.node.name))
      .toEqual(['second','first','entry','File / unknown function context']);
    expect(walkTopology(graph,'missing','outgoing').rows).toEqual([]);
  });
  it('finds a shortest observed candidate path and discloses depth limits',async()=>{
    const graph=buildListedCallTopology(await report());
    const entry=node(graph,'entry').id,second=node(graph,'second').id;
    const path=shortestTopologyPath(graph,entry,second,4);
    expect(path.status).toBe('observed');
    expect(path.rows.map(row=>row.node.name)).toEqual(['entry','first','second']);
    expect(shortestTopologyPath(graph,entry,second,1).status).toBe('limited');
    expect(shortestTopologyPath(graph,entry,node(graph,'self').id,4).status).toBe('not-observed');
    expect(shortestTopologyPath(graph,entry,entry).rows).toHaveLength(1);
    expect(shortestTopologyPath(graph,entry,'missing').status).toBe('invalid');
  });
  it('bounds requested traversal depth without recursive stack growth',async()=>{
    const contents:Record<string,string>={};
    for(let file=0;file<5;file++){
      contents['src/f'+file+'.srp']=Array.from({length:250},(_,i)=>{
        const n=file*250+i;return 'funcra n'+n+'() { n'+((n+1)%1250)+'(); }\n';
      }).join('');
    }
    const graph=buildListedCallTopology(await report(contents));
    expect(graph.nodes).toHaveLength(1250);
    expect(graph.cycles).toHaveLength(1);
    expect(graph.cycles[0].nodes).toHaveLength(1250);
    const walk=walkTopology(graph,node(graph,'n0').id,'outgoing',999);
    expect(walk.maxDepth).toBe(MAX_TOPOLOGY_DEPTH);
    expect(walk.visited).toBe(MAX_TOPOLOGY_DEPTH+1);
    expect(walk.visited).toBeLessThanOrEqual(MAX_TOPOLOGY_VISITS);
    expect(walk.limited).toBe(true);
  });
  it('retains incomplete coverage as a graph-wide qualification',async()=>{
    const graph=buildListedCallTopology(await report({[a]:sourceA},{...settings,listingLimited:true}));
    expect(graph.complete).toBe(false);
    expect(topologyReportText(graph)).toContain('Coverage: incomplete');
  });
});
describe('candidate graph presentation',()=>{
  it('filters node name, source, kind and connected state',async()=>{
    const graph=buildListedCallTopology(await report());
    expect(filterTopologyNodes(graph,{...DEFAULT_TOPOLOGY_FILTER,query:'DUPLICATE'})).toHaveLength(2);
    expect(filterTopologyNodes(graph,{...DEFAULT_TOPOLOGY_FILTER,kind:'file-context'})).toHaveLength(1);
    expect(filterTopologyNodes(graph,{...DEFAULT_TOPOLOGY_FILTER,source:a}).every(item=>item.source===a)).toBe(true);
    expect(filterTopologyNodes(graph,{...DEFAULT_TOPOLOGY_FILTER,connectedOnly:true}).some(item=>item.name==='duplicate')).toBe(false);
    expect(filterTopologyNodes(graph,{...DEFAULT_TOPOLOGY_FILTER,query:'x'.repeat(121)})).toEqual([]);
    expect(pageTopology(graph.nodes,999).page).toBe(1);
    expect(pageTopology([],NaN)).toEqual({page:1,pages:1,rows:[]});
  });
  it('redacts labels and names independently and never exports internal ids',async()=>{
    const graph=buildListedCallTopology(await report());
    const plain=topologyReportText(graph);
    expect(plain).not.toContain(a);
    expect(plain).not.toContain('duplicate');
    expect(plain).toContain('Candidate-cycle components: 2');
    const labels=topologyReportText(graph,true,false);
    expect(labels).toContain(a);
    expect(labels).not.toContain('duplicate');
    const names=topologyReportText(graph,false,true);
    expect(names).toContain('duplicate');
    expect(names).not.toContain(a);
    expect(names).not.toContain(node(graph,'entry').id);
    expect(topologyReportText(graph,true,true)).not.toContain('/private-native/');
  });
  it('bounds optional exports over large graph inventories',async()=>{
    const graph=buildListedCallTopology(await report({
      [a]:Array.from({length:350},(_,i)=>'funcra name_'+i+'_'+ 'a'.repeat(95)+'() { unknown_'+i+'(); }\n').join(''),
    }));
    const text=topologyReportText(graph,true,true);
    expect(text.length).toBeLessThanOrEqual(MAX_SCOPE_REPORT_UNITS);
    expect(text).toContain('Additional evidence omitted');
  });
});

/** A separate small-graph oracle uses repeated breadth-first searches rather
 * than the production iterative SCC implementation. Each generated program
 * has unique function spellings, so its intended lexical edges are known.
 */
function generatedAdjacency(seed:number,size:number):number[][]{
  let state=seed>>>0;
  const next=()=>{
    state=(Math.imul(state,1664525)+1013904223)>>>0;
    return state;
  };
  return Array.from({length:size},()=>Array.from({length:size},(_,index)=>index)
    .filter(()=>next()%7<2));
}

function oracleDistances(adjacency:readonly (readonly number[])[],start:number):Map<number,number>{
  const result=new Map<number,number>([[start,0]]);
  const queue=[start];
  for(let cursor=0;cursor<queue.length;cursor++){
    const from=queue[cursor];
    for(const to of adjacency[from]){
      if(result.has(to))continue;
      result.set(to,result.get(from)!+1);
      queue.push(to);
    }
  }
  return result;
}

function oracleCycles(adjacency:readonly (readonly number[])[]):string[]{
  const reachable=adjacency.map((_,index)=>oracleDistances(adjacency,index));
  const assigned=new Set<number>();
  const components:string[]=[];
  for(let start=0;start<adjacency.length;start++){
    if(assigned.has(start))continue;
    const members=adjacency.map((_,index)=>index).filter(index=>
      reachable[start].has(index)&&reachable[index].has(start));
    members.forEach(index=>assigned.add(index));
    if(members.length>1||adjacency[start].includes(start))
      components.push(members.map(index=>'oracle_'+index).sort().join(','));
  }
  return components.sort();
}

function programForGraph(adjacency:readonly (readonly number[])[]):Record<string,string>{
  const result:Record<string,string>={};
  for(let index=0;index<adjacency.length;index++){
    const source='src/oracle-'+(index%3)+'.srp';
    const body=adjacency[index].map(target=>'oracle_'+target+'();').join(' ');
    result[source]=(result[source]??'')+'funcra oracle_'+index+'() { '+body+' }\n';
  }
  return result;
}

describe('candidate topology independent graph oracle',()=>{
  it('matches mutual reachability, shortest distances and edge accounting over reproducible graph cases',async()=>{
    for(const seed of [1,2,3,7,17,99,1001,2147483647,4294967295]){
      const adjacency=generatedAdjacency(seed,9);
      const graph=buildListedCallTopology(await report(programForGraph(adjacency)));
      expect(graph.complete).toBe(true);
      expect(graph.nodes).toHaveLength(adjacency.length);
      const edgeCount=adjacency.reduce((sum,list)=>sum+list.length,0);
      expect(graph.uniqueEdges).toBe(edgeCount);
      expect(graph.callSites).toBe(edgeCount);
      expect(graph.ambiguousEdges).toBe(0);
      expect(graph.unobservedEdges).toBe(0);
      const ids=new Map(graph.nodes.map(item=>[item.id,item.name]));
      expect(graph.cycles.map(component=>component.nodes.map(id=>ids.get(id)!).sort().join(',')).sort())
        .toEqual(oracleCycles(adjacency));
      for(const component of graph.cycles){
        const members=new Set(component.nodes);
        const internal=graph.edges.filter(edge=>members.has(edge.callerId)&&edge.targetId!==null&&members.has(edge.targetId));
        expect(component.edgeIds.slice().sort()).toEqual(internal.map(edge=>edge.id).sort());
        expect(component.selfOnly).toBe(component.nodes.length===1);
      }
      for(let start=0;start<adjacency.length;start++){
        const origin=node(graph,'oracle_'+start);
        const distances=oracleDistances(adjacency,start);
        const walk=walkTopology(graph,origin.id,'outgoing',9);
        expect(walk.limited).toBe(false);
        expect(walk.visited).toBe(distances.size);
        expect(new Set(walk.rows.map(row=>row.node.id)).size).toBe(walk.rows.length);
        for(const row of walk.rows){
          const target=Number(row.node.name.slice('oracle_'.length));
          expect(row.depth).toBe(distances.get(target));
          if(row.depth===0){
            expect(row.via).toBeNull();
            expect(row.edgeId).toBeNull();
          }else{
            const edge=graph.edges.find(item=>item.id===row.edgeId);
            expect(edge?.callerId).toBe(row.via);
            expect(edge?.targetId).toBe(row.node.id);
          }
        }
        for(let end=0;end<adjacency.length;end++){
          const target=node(graph,'oracle_'+end);
          const path=shortestTopologyPath(graph,origin.id,target.id,9);
          if(!distances.has(end)){
            expect(path.status).toBe('not-observed');
            expect(path.rows).toEqual([]);
            continue;
          }
          expect(path.status).toBe('observed');
          expect(path.rows).toHaveLength(distances.get(end)!+1);
          expect(path.rows[0].node.id).toBe(origin.id);
          expect(path.rows.at(-1)?.node.id).toBe(target.id);
          for(let index=1;index<path.rows.length;index++){
            const previous=Number(path.rows[index-1].node.name.slice('oracle_'.length));
            const current=Number(path.rows[index].node.name.slice('oracle_'.length));
            expect(adjacency[previous]).toContain(current);
          }
        }
      }
    }
  });

  it('matches reverse reachability without confusing outgoing and incoming links',async()=>{
    const adjacency=generatedAdjacency(805,11);
    const reverse=adjacency.map((_,target)=>adjacency.map((_,source)=>source)
      .filter(source=>adjacency[source].includes(target)));
    const graph=buildListedCallTopology(await report(programForGraph(adjacency)));
    for(let start=0;start<adjacency.length;start++){
      const target=node(graph,'oracle_'+start);
      const expected=oracleDistances(reverse,start);
      const walk=walkTopology(graph,target.id,'incoming',11);
      expect(walk.visited).toBe(expected.size);
      expect(walk.limited).toBe(false);
      for(const row of walk.rows){
        const index=Number(row.node.name.slice('oracle_'.length));
        expect(row.depth).toBe(expected.get(index));
        if(row.edgeId){
          const edge=graph.edges.find(item=>item.id===row.edgeId);
          expect(edge?.callerId).toBe(row.node.id);
          expect(edge?.targetId).toBe(row.via);
        }
      }
    }
  });

  it('retains all isolated nodes and no cycles for an empty-edge graph',async()=>{
    const adjacency=Array.from({length:12},()=>[] as number[]);
    const graph=buildListedCallTopology(await report(programForGraph(adjacency)));
    expect(graph.nodes).toHaveLength(12);
    expect(graph.edges).toEqual([]);
    expect(graph.cycles).toEqual([]);
    expect(graph.callSites).toBe(0);
    for(const current of graph.nodes){
      expect(topologyNeighbors(graph,current.id)).toMatchObject({outgoing:[],incoming:[]});
      expect(walkTopology(graph,current.id,'outgoing',12).visited).toBe(1);
      expect(walkTopology(graph,current.id,'incoming',12).visited).toBe(1);
    }
  });
});
