import type {ListedSymbolReport,ListedSymbolSite} from './listedSymbolIndex';
import {MAX_SCOPE_REPORT_UNITS} from './projectSearchScope';

export const MAX_TOPOLOGY_VISITS=1500;
export const MAX_TOPOLOGY_DEPTH=24;
export const TOPOLOGY_PAGE_SIZE=16;
export type TopologyNodeKind='function'|'file-context';
export interface TopologyNode{
  readonly id:string;
  readonly name:string;
  readonly source:string;
  readonly kind:TopologyNodeKind;
  readonly declaration:ListedSymbolSite|null;
  readonly outbound:number;
  readonly inbound:number;
}
export type TopologyEdgeKind='unique-candidate'|'ambiguous-candidates'|'unobserved-candidate';
export const TOPOLOGY_EDGE_LABELS:Readonly<Record<TopologyEdgeKind,string>>=Object.freeze({
  'unique-candidate':'One observed candidate',
  'ambiguous-candidates':'Multiple observed candidates',
  'unobserved-candidate':'No observed candidate',
});
export interface TopologyEdge{
  readonly id:string;
  readonly callerId:string;
  readonly name:string;
  readonly kind:TopologyEdgeKind;
  readonly candidateCount:number;
  /** Only a unique observed spelling is represented as a traversable edge. */
  readonly targetId:string|null;
  readonly sites:readonly ListedSymbolSite[];
}
export interface TopologyCycle{
  readonly id:string;
  readonly nodes:readonly string[];
  readonly edgeIds:readonly string[];
  readonly selfOnly:boolean;
}
export interface ListedCallTopology{
  readonly complete:boolean;
  readonly nodes:readonly TopologyNode[];
  readonly edges:readonly TopologyEdge[];
  readonly cycles:readonly TopologyCycle[];
  readonly uniqueEdges:number;
  readonly ambiguousEdges:number;
  readonly unobservedEdges:number;
  readonly fileContextEdges:number;
  readonly callSites:number;
}
const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;
const fileId=(source:string)=>JSON.stringify(['file-context',source]);
type MutableNode=Omit<TopologyNode,'outbound'|'inbound'>&{outbound:number;inbound:number};

/** Iterative Kosaraju traversal avoids JS recursion limits even in long
 * candidate chains. Each unique spelling edge is traversed at most once
 * in each direction. Ambiguous candidates do not become graph edges.
 */
function stronglyConnected(nodes:readonly TopologyNode[],edges:readonly TopologyEdge[]):readonly TopologyCycle[]{
  const forward=new Map<string,string[]>(),reverse=new Map<string,string[]>();
  for(const node of nodes){
    forward.set(node.id,[]);reverse.set(node.id,[]);
  }
  for(const edge of edges){
    if(edge.targetId===null)continue;
    forward.get(edge.callerId)?.push(edge.targetId);
    reverse.get(edge.targetId)?.push(edge.callerId);
  }
  for(const list of forward.values())list.sort(compare);
  for(const list of reverse.values())list.sort(compare);
  const seen=new Set<string>(),finished:string[]=[];
  for(const node of nodes){
    if(seen.has(node.id))continue;
    seen.add(node.id);
    const stack=[{id:node.id,next:0}];
    while(stack.length){
      const frame=stack[stack.length-1];
      const children=forward.get(frame.id)??[];
      if(frame.next>=children.length){
        finished.push(frame.id);stack.pop();continue;
      }
      const child=children[frame.next++];
      if(!seen.has(child)){seen.add(child);stack.push({id:child,next:0});}
    }
  }
  const assigned=new Set<string>(),groups:string[][]=[];
  for(let index=finished.length-1;index>=0;index--){
    const id=finished[index];
    if(assigned.has(id))continue;
    const component:string[]=[],stack=[id];
    assigned.add(id);
    while(stack.length){
      const current=stack.pop()!;
      component.push(current);
      for(const neighbor of reverse.get(current)??[]){
        if(!assigned.has(neighbor)){assigned.add(neighbor);stack.push(neighbor);}
      }
    }
    component.sort(compare);
    groups.push(component);
  }
  const componentByNode=new Map<string,number>();
  groups.forEach((group,index)=>group.forEach(id=>componentByNode.set(id,index)));
  const internal=groups.map(()=>[] as string[]);
  for(const edge of edges){
    if(edge.targetId===null)continue;
    const from=componentByNode.get(edge.callerId);
    if(from!==undefined&&from===componentByNode.get(edge.targetId))internal[from].push(edge.id);
  }
  return groups.flatMap((group,index)=>{
    const ids=internal[index];
    if(!ids.length)return [];
    return [Object.freeze({id:JSON.stringify(group),nodes:Object.freeze(group),
      edgeIds:Object.freeze(ids.sort(compare)),selfOnly:group.length===1})];
  }).sort((a,b)=>b.nodes.length-a.nodes.length||compare(a.id,b.id));
}

/** The topology is a projection of retained lexical observations only.
 * The same spelling may resolve to a different symbol in actual Scarp code.
 * Missing enclosing metadata is represented as file context, never guessed
 * from a function name; duplicate declaration spellings stay ambiguous.
 */
export function buildListedCallTopology(report:ListedSymbolReport):ListedCallTopology{
  const nodes=new Map<string,MutableNode>();
  const byName=new Map<string,ListedSymbolSite[]>();
  for(const declaration of report.declarations){
    if(declaration.kind!=='function')continue;
    nodes.set(declaration.id,{
      id:declaration.id,name:declaration.name,source:declaration.source,kind:'function',
      declaration,outbound:0,inbound:0,
    });
    const bucket=byName.get(declaration.name)??[];
    bucket.push(declaration);byName.set(declaration.name,bucket);
  }
  const grouped=new Map<string,{callerId:string;name:string;sites:ListedSymbolSite[]}>();
  for(const site of report.calls){
    const owner=site.enclosingId?nodes.get(site.enclosingId):undefined;
    const callerId=owner&&owner.source===site.source?owner.id:fileId(site.source);
    if(!nodes.has(callerId))nodes.set(callerId,{
      id:callerId,name:'File / unknown function context',source:site.source,kind:'file-context',
      declaration:null,outbound:0,inbound:0,
    });
    const id=JSON.stringify([callerId,site.name]);
    const bucket=grouped.get(id)??{callerId,name:site.name,sites:[]};
    bucket.sites.push(site);grouped.set(id,bucket);
  }
  const edges:TopologyEdge[]=[];
  for(const [id,group] of grouped){
    const candidates=byName.get(group.name)??[];
    const targetId=candidates.length===1?candidates[0].id:null;
    const kind:TopologyEdgeKind=targetId!==null?'unique-candidate':
      candidates.length?'ambiguous-candidates':'unobserved-candidate';
    const caller=nodes.get(group.callerId)!;
    caller.outbound++;
    if(targetId!==null)nodes.get(targetId)!.inbound++;
    edges.push(Object.freeze({id,callerId:group.callerId,name:group.name,kind,targetId,
      candidateCount:candidates.length,sites:Object.freeze(group.sites)}));
  }
  const orderedNodes=[...nodes.values()].sort((a,b)=>compare(a.source,b.source)||
    (a.declaration?.offset??-1)-(b.declaration?.offset??-1)||compare(a.id,b.id)).map(node=>Object.freeze(node));
  const rank=new Map(orderedNodes.map((node,index)=>[node.id,index]));
  edges.sort((a,b)=>rank.get(a.callerId)!-rank.get(b.callerId)!||compare(a.name,b.name));
  return Object.freeze({
    complete:report.complete,nodes:Object.freeze(orderedNodes),edges:Object.freeze(edges),
    cycles:Object.freeze(stronglyConnected(orderedNodes,edges)),
    uniqueEdges:edges.filter(edge=>edge.kind==='unique-candidate').length,
    ambiguousEdges:edges.filter(edge=>edge.kind==='ambiguous-candidates').length,
    unobservedEdges:edges.filter(edge=>edge.kind==='unobserved-candidate').length,
    fileContextEdges:edges.filter(edge=>nodes.get(edge.callerId)?.kind==='file-context').length,
    callSites:report.calls.length,
  });
}

export interface TopologyNeighbors{
  readonly node:TopologyNode;
  readonly outgoing:readonly TopologyEdge[];
  readonly incoming:readonly TopologyEdge[];
}
export function topologyNeighbors(graph:ListedCallTopology,id:string):TopologyNeighbors|null{
  const node=graph.nodes.find(item=>item.id===id);
  if(!node)return null;
  return {node,outgoing:graph.edges.filter(edge=>edge.callerId===id),
    incoming:graph.edges.filter(edge=>edge.targetId===id)};
}
export type TopologyDirection='outgoing'|'incoming';
export interface TopologyWalkRow{
  readonly node:TopologyNode;
  readonly depth:number;
  readonly via:string|null;
  readonly edgeId:string|null;
}
export interface TopologyWalk{
  readonly rows:readonly TopologyWalkRow[];
  readonly limited:boolean;
  readonly maxDepth:number;
  readonly visited:number;
}
function safeDepth(depth:number){
  return Math.min(MAX_TOPOLOGY_DEPTH,Math.max(1,Number.isSafeInteger(depth)?depth:1));
}
/** Traverse only one-observed-candidate edges. An incomplete inventory,
 * ambiguous name or depth limit means that non-reachability is unknown.
 */
export function walkTopology(graph:ListedCallTopology,start:string,direction:TopologyDirection,
  requestedDepth=4):TopologyWalk{
  const depthLimit=safeDepth(requestedDepth);
  const nodes=new Map(graph.nodes.map(node=>[node.id,node]));
  const first=nodes.get(start);
  if(!first)return {rows:[],limited:false,maxDepth:depthLimit,visited:0};
  const adjacency=new Map<string,{target:string;edgeId:string}[]>();
  for(const edge of graph.edges){
    if(edge.targetId===null)continue;
    const from=direction==='outgoing'?edge.callerId:edge.targetId;
    const to=direction==='outgoing'?edge.targetId:edge.callerId;
    const bucket=adjacency.get(from)??[];
    bucket.push({target:to,edgeId:edge.id});adjacency.set(from,bucket);
  }
  for(const edges of adjacency.values())edges.sort((a,b)=>compare(a.target,b.target)||compare(a.edgeId,b.edgeId));
  const rows:TopologyWalkRow[]=[{node:first,depth:0,via:null,edgeId:null}];
  const seen=new Set([start]);
  let limited=false;
  for(let i=0;i<rows.length;i++){
    const row=rows[i];
    for(const edge of adjacency.get(row.node.id)??[]){
      if(seen.has(edge.target)||!nodes.has(edge.target))continue;
      if(row.depth>=depthLimit||rows.length>=MAX_TOPOLOGY_VISITS){limited=true;continue;}
      seen.add(edge.target);
      rows.push({node:nodes.get(edge.target)!,depth:row.depth+1,via:row.node.id,edgeId:edge.edgeId});
    }
  }
  return {rows:Object.freeze(rows.map(row=>Object.freeze(row))),limited,maxDepth:depthLimit,visited:rows.length};
}
export interface TopologyPath{
  readonly status:'observed'|'not-observed'|'limited'|'invalid';
  readonly rows:readonly TopologyWalkRow[];
}
export function shortestTopologyPath(graph:ListedCallTopology,from:string,to:string,depth=MAX_TOPOLOGY_DEPTH):TopologyPath{
  if(!graph.nodes.some(node=>node.id===from)||!graph.nodes.some(node=>node.id===to))
    return {status:'invalid',rows:[]};
  const walk=walkTopology(graph,from,'outgoing',depth);
  const byId=new Map(walk.rows.map(row=>[row.node.id,row]));
  const endpoint=byId.get(to);
  if(!endpoint)return {status:walk.limited?'limited':'not-observed',rows:[]};
  const path:TopologyWalkRow[]=[];
  let cursor:TopologyWalkRow|undefined=endpoint;
  while(cursor){path.push(cursor);cursor=cursor.via===null?undefined:byId.get(cursor.via);}
  return {status:'observed',rows:Object.freeze(path.reverse())};
}
export interface TopologyFilter{
  readonly query:string;
  readonly source:string;
  readonly kind:TopologyNodeKind|'all';
  readonly connectedOnly:boolean;
}
export const DEFAULT_TOPOLOGY_FILTER:TopologyFilter=Object.freeze({query:'',source:'',kind:'all',connectedOnly:false});
export function filterTopologyNodes(graph:ListedCallTopology,filter:TopologyFilter){
  if(filter.query.length>120||/[\x00-\x1f\x7f]/.test(filter.query))return [];
  const query=filter.query.toLowerCase().trim();
  return graph.nodes.filter(node=>(filter.kind==='all'||node.kind===filter.kind)&&
    (!filter.source||node.source===filter.source)&&(!filter.connectedOnly||node.inbound>0||node.outbound>0)&&
    (!query||[node.name,node.source].join(' ').toLowerCase().includes(query)));
}
export function pageTopology<T>(rows:readonly T[],requested:number){
  const pages=Math.max(1,Math.ceil(rows.length/TOPOLOGY_PAGE_SIZE));
  const page=Math.min(pages,Math.max(1,Number.isSafeInteger(requested)?requested:1));
  return {page,pages,rows:rows.slice((page-1)*TOPOLOGY_PAGE_SIZE,page*TOPOLOGY_PAGE_SIZE)};
}
export function topologyReportText(graph:ListedCallTopology,includeLabels=false,includeNames=false):string{
  const lines=[
    'Scarp Studio — lexical call candidate topology',
    'One observed spelling is not a resolved compiler call target.',
    'Coverage: '+(graph.complete?'complete for chosen listed lexical scope':'incomplete'),
    'Observed function nodes: '+graph.nodes.filter(node=>node.kind==='function').length,
    'File / unknown function contexts: '+graph.nodes.filter(node=>node.kind==='file-context').length,
    'Call-like sites: '+graph.callSites,
    'Unique candidate groups: '+graph.uniqueEdges,
    'Ambiguous candidate groups: '+graph.ambiguousEdges,
    'No observed candidate groups: '+graph.unobservedEdges,
    'Candidate-cycle components: '+graph.cycles.length,
    'Self-only components: '+graph.cycles.filter(cycle=>cycle.selfOnly).length,
    'Ambiguous edges are excluded from traversal; missing paths are not proof of non-reachability.',
    'No source text, native paths or semantic call edges are included.',
  ];
  let units=lines.join('\n').length;
  const append=(line:string)=>{
    if(units+line.length+1>MAX_SCOPE_REPORT_UNITS-100)return false;
    lines.push(line);units+=line.length+1;return true;
  };
  if(includeNames||includeLabels){
    const ids=new Map(graph.nodes.map((node,index)=>[node.id,index+1]));
    for(const [index,node] of graph.nodes.entries()){
      if(!append('Node '+(index+1)+
        (includeNames?' '+JSON.stringify(node.name):'')+
        (includeLabels?' in '+JSON.stringify(node.source):'')+
        '; outgoing groups: '+node.outbound+'; incoming unique groups: '+node.inbound)){
        lines.push('Additional evidence omitted due to report size limit.');return lines.join('\n');
      }
    }
    for(const edge of graph.edges){
      if(!append('Node '+ids.get(edge.callerId)+' → '+
        (edge.targetId===null?'unresolved candidate group':'node '+ids.get(edge.targetId))+
        (includeNames?' '+JSON.stringify(edge.name):'')+
        '; '+TOPOLOGY_EDGE_LABELS[edge.kind]+'; sites: '+edge.sites.length)){
        lines.push('Additional evidence omitted due to report size limit.');return lines.join('\n');
      }
    }
    for(const cycle of graph.cycles){
      if(!append('Candidate-cycle nodes: '+cycle.nodes.map(id=>ids.get(id)).join(', '))){
        lines.push('Additional evidence omitted due to report size limit.');break;
      }
    }
  }
  return lines.join('\n');
}
