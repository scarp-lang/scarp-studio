import type { SourceImportGraph, SourceImportNode, ScarpSourceImport, ImportStatus } from './sourceImports';

export const MAX_DEPENDENCY_PATH_NODES = 200;
export const DEPENDENCY_PAGE = 12;
export const MAX_DEPENDENCY_REPORT = 48 * 1024;
export interface DependencyNode {
  readonly id: string;
  readonly name: string;
  readonly imports: number;
  readonly importedBy: number;
  readonly outgoing: readonly string[];
  readonly incoming: readonly string[];
  readonly uncertainEdges: number;
}
export interface DependencyComponent {
  readonly id: string;
  readonly members: readonly DependencyNode[];
  readonly cyclic: boolean;
}
export interface DependencyGraphReview {
  readonly nodes: readonly DependencyNode[];
  readonly components: readonly DependencyComponent[];
  readonly incomplete: boolean;
  readonly unknownTargetEdges: number;
  readonly duplicateAliases: readonly DuplicateImportAlias[];
}
export interface DuplicateImportAlias {
  readonly documentId: string;
  readonly sourceName: string;
  readonly alias: string;
  readonly edges: readonly ScarpSourceImport[];
}
const unknownStatuses: readonly ImportStatus[] = ['listed','missing','unsafe','unrecognized','ambiguous'];
const compare = (a: string,b: string) => a < b ? -1 : a > b ? 1 : 0;
function compareNode(a: DependencyNode,b: DependencyNode) {
  return compare(a.name,b.name) || compare(a.id,b.id);
}
function distinct(values: readonly string[]): string[] { return [...new Set(values)]; }

/** Build graph metadata solely from already-indexed open source nodes.
 * Unopened listed files are frontier edges, never guessed graph vertices.
 * All SCCs below describe the observed lexical graph, not compiler imports. */
export function reviewImportDependencies(graph: SourceImportGraph): DependencyGraphReview {
  const byId = new Map<string, SourceImportNode>();
  for (const node of graph.nodes.slice(0,MAX_DEPENDENCY_PATH_NODES)) {
    if (!byId.has(node.documentId)) byId.set(node.documentId,node);
  }
  const outgoing = new Map<string,string[]>(), incoming = new Map<string,string[]>();
  const uncertain = new Map<string,number>();
  for (const id of byId.keys()) { outgoing.set(id,[]); incoming.set(id,[]); uncertain.set(id,0); }
  let unknownTargetEdges = 0;
  const duplicates: DuplicateImportAlias[] = [];
  for (const node of byId.values()) {
    const aliases = new Map<string,ScarpSourceImport[]>();
    for (const edge of node.imports) {
      const target = edge.status === 'self' ? node.documentId : edge.status === 'open' ? edge.targetDocumentId : null;
      if (target && byId.has(target)) {
        outgoing.get(node.documentId)!.push(target);
        incoming.get(target)!.push(node.documentId);
      } else if (unknownStatuses.includes(edge.status) || edge.status === 'open') {
        unknownTargetEdges++;
        uncertain.set(node.documentId,uncertain.get(node.documentId)!+1);
      }
      if (edge.alias) {
        const existing = aliases.get(edge.alias);
        if (existing) existing.push(edge); else aliases.set(edge.alias,[edge]);
      }
    }
    for (const [alias,edges] of aliases) {
      if (edges.length > 1) duplicates.push(Object.freeze({
        documentId:node.documentId,sourceName:node.sourceName,alias,edges:Object.freeze([...edges]),
      }));
    }
  }
  const nodes = [...byId.values()].map(node => Object.freeze({
    id:node.documentId,name:node.sourceName,imports:node.imports.length,
    importedBy:incoming.get(node.documentId)!.length,
    outgoing:Object.freeze(distinct(outgoing.get(node.documentId)!)),
    incoming:Object.freeze(distinct(incoming.get(node.documentId)!)),
    uncertainEdges:uncertain.get(node.documentId)!,
  })).sort(compareNode);
  const index = new Map(nodes.map(node=>[node.id,node]));
  // Kosaraju with explicit stacks. Both passes traverse only observed
  // vertices and edges; components remain correct in dense cyclic graphs.
  const visited = new Set<string>(), finished: string[] = [];
  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    const stack: {id:string;next:number}[] = [{id:node.id,next:0}];
    visited.add(node.id);
    while(stack.length) {
      const frame=stack[stack.length-1], targets=index.get(frame.id)!.outgoing;
      if(frame.next>=targets.length) { finished.push(frame.id); stack.pop(); continue; }
      const target=targets[frame.next++];
      if(!visited.has(target)) { visited.add(target); stack.push({id:target,next:0}); }
    }
  }
  visited.clear();
  const components: DependencyComponent[]=[];
  for(const root of [...finished].reverse()) {
    if(visited.has(root)) continue;
    const members:DependencyNode[]=[];
    const stack=[root];visited.add(root);
    while(stack.length) {
      const id=stack.pop()!, node=index.get(id)!;
      members.push(node);
      for(const target of node.incoming) if(!visited.has(target)) {visited.add(target);stack.push(target);}
    }
    members.sort(compareNode);
    components.push(Object.freeze({
      id:JSON.stringify(members.map(node=>node.id)),members:Object.freeze(members),
      cyclic:members.length>1||members[0].outgoing.includes(members[0].id),
    }));
  }
  components.sort((a,b)=>compareNode(a.members[0],b.members[0]));
  return Object.freeze({
    nodes:Object.freeze(nodes),components:Object.freeze(components),
    incomplete:graph.limited||graph.nodes.length!==byId.size||graph.nodes.some(node=>node.incomplete)||unknownTargetEdges>0,
    unknownTargetEdges,duplicateAliases:Object.freeze(duplicates),
  });
}

export interface DependencyReach {
  readonly node:DependencyNode;
  readonly distance:number;
  readonly route:readonly DependencyNode[];
}
export type DependencyDirection='dependencies'|'dependents';
/** Breadth-first paths, each reachable open node once. The starting node
 * is excluded even when a cycle returns to it. Paths are shortest in
 * observed edge count, not execution order or full project resolution. */
export function reachableImportNodes(review:DependencyGraphReview,rootId:string,
  direction:DependencyDirection):readonly DependencyReach[] {
  const byId=new Map(review.nodes.map(node=>[node.id,node]));
  const root=byId.get(rootId);
  if(!root)return [];
  const parent=new Map<string,string|null>([[rootId,null]]);
  const distance=new Map<string,number>([[rootId,0]]);
  const queue=[rootId];
  for(let i=0;i<queue.length;i++){
    const id=queue[i], node=byId.get(id)!;
    const neighbors=direction==='dependencies'?node.outgoing:node.incoming;
    const ordered=neighbors.map(value=>byId.get(value)).filter((value):value is DependencyNode=>!!value).sort(compareNode);
    for(const next of ordered){
      if(parent.has(next.id))continue;
      parent.set(next.id,id);distance.set(next.id,distance.get(id)!+1);queue.push(next.id);
    }
  }
  return Object.freeze(queue.slice(1).map(id=>{
    const route:DependencyNode[]=[];
    let cursor:string|null=id;
    while(cursor!==null){route.push(byId.get(cursor)!);cursor=parent.get(cursor)??null;}
    return Object.freeze({node:byId.get(id)!,distance:distance.get(id)!,route:Object.freeze(route.reverse())});
  }));
}
export interface DependencyLayer {
  readonly number:number;
  readonly components:readonly DependencyComponent[];
}
/** Collapse strongly connected components to a DAG. Layers begin with
 * components having no observed outgoing edges to other components.
 * This is an inspection aid, never a safe build or initialization order. */
export function dependencyLayers(review:DependencyGraphReview):readonly DependencyLayer[]{
  const ownership=new Map<string,number>();
  review.components.forEach((component,i)=>component.members.forEach(node=>ownership.set(node.id,i)));
  const children=review.components.map(()=>new Set<number>());
  const parents=review.components.map(()=>new Set<number>());
  review.components.forEach((component,i)=>{
    for(const node of component.members)for(const target of node.outgoing){
      const j=ownership.get(target);
      if(j!==undefined&&j!==i){children[i].add(j);parents[j].add(i);}
    }
  });
  const pending=children.map(set=>set.size);
  let layer=pending.map((count,i)=>count===0?i:-1).filter(i=>i>=0);
  const result:DependencyLayer[]=[];
  while(layer.length){
    const next:number[]=[];
    result.push(Object.freeze({number:result.length,components:Object.freeze(layer.map(i=>review.components[i]))}));
    for(const i of layer)for(const parent of parents[i])if(--pending[parent]===0)next.push(parent);
    layer=next.sort((a,b)=>a-b);
  }
  return Object.freeze(result);
}
export function dependencyReport(review:DependencyGraphReview):{text:string;omitted:number}{
  const lines=[
    'Scarp Studio — observed open-buffer import graph',
    'Editor-only lexical hints; not compiler module resolution or build order.',
    'Coverage: '+(review.incomplete?'incomplete or unresolved frontier':'all observed indexed edges resolved'),
    'Open nodes: '+review.nodes.length+'; unresolved/frontier edges: '+review.unknownTargetEdges,
    'Cyclic components: '+review.components.filter(c=>c.cyclic).length+'; repeated aliases: '+review.duplicateAliases.length,
  ];
  let units=lines.join('\n').length,omitted=0;
  for(const node of review.nodes){
    const line=JSON.stringify(node.name)+' | imports '+node.imports+' | imported by '+node.importedBy+
      ' | distinct open dependencies '+node.outgoing.length+' | uncertain '+node.uncertainEdges;
    if(units+line.length+1>MAX_DEPENDENCY_REPORT-100){omitted++;continue;}
    lines.push(line);units+=line.length+1;
  }
  if(omitted)lines.push(omitted+' node row(s) omitted by report limit.');
  return {text:lines.join('\n'),omitted};
}
