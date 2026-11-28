import {useMemo,useState} from 'react';
import type {ListedSymbolReport,ListedSymbolSite} from '../model/listedSymbolIndex';
import {buildListedCallTopology,topologyNeighbors,walkTopology,shortestTopologyPath,filterTopologyNodes,
  pageTopology,topologyReportText,DEFAULT_TOPOLOGY_FILTER,TOPOLOGY_EDGE_LABELS,MAX_TOPOLOGY_DEPTH,
  type ListedCallTopology,type TopologyNode,type TopologyDirection,type TopologyEdge,type TopologyFilter} from '../model/listedCallTopology';

function NodeLabel({node}:{node:TopologyNode}){
  return <><strong><code dir="auto">{node.name}</code></strong> · <code dir="auto">{node.source}
    {node.declaration&&':'+node.declaration.line+':'+node.declaration.column}</code></>;
}
function EdgeList({edges,graph,busy,onNavigate,onSelect,heading}:{
  edges:readonly TopologyEdge[];graph:ListedCallTopology;busy:boolean;onNavigate:(site:ListedSymbolSite)=>void;
  onSelect:(id:string)=>void;heading:string;
}){
  const [page,setPage]=useState(1);
  const [detail,setDetail]=useState<string|null>(null);
  const [sitePage,setSitePage]=useState(1);
  const visible=pageTopology(edges,page);
  const selected=edges.find(edge=>edge.id===detail);
  const sites=pageTopology(selected?.sites??[],sitePage);
  const nodes=useMemo(()=>new Map(graph.nodes.map(node=>[node.id,node])),[graph]);
  return <section aria-label={heading}>
    <h4>{heading}</h4>
    <p>{edges.length} groups · Page {visible.page} of {visible.pages}</p>
    <ul>{visible.rows.map(edge=><li key={edge.id}>
      <strong><code>{edge.name}</code></strong> · {TOPOLOGY_EDGE_LABELS[edge.kind]} · {edge.sites.length} sites
      <p>Observed caller: {nodes.get(edge.callerId)?.name} · {nodes.get(edge.callerId)?.source}</p>
      {edge.targetId!==null&&<button type="button" onClick={()=>onSelect(edge.targetId!)}>Explore candidate node</button>}
      <button type="button" onClick={()=>{setDetail(detail===edge.id?null:edge.id);setSitePage(1);}}
        aria-expanded={detail===edge.id}>Review call sites</button>
    </li>)}</ul>
    {!edges.length&&<p>No retained groups in this direction.</p>}
    <button type="button" disabled={visible.page===1} onClick={()=>setPage(visible.page-1)}>Previous edge page</button>
    <button type="button" disabled={visible.page===visible.pages} onClick={()=>setPage(visible.page+1)}>Next edge page</button>
    {selected&&<div className="project-scope-inventory">
      <p>Sites for <code>{selected.name}</code> · Page {sites.page} of {sites.pages}</p>
      <ul>{sites.rows.map(site=><li key={site.id}><code>{site.source}:{site.line}:{site.column}</code>
        <button type="button" disabled={busy} onClick={()=>onNavigate(site)}>Recheck and open call site</button></li>)}</ul>
      <button type="button" disabled={sites.page===1} onClick={()=>setSitePage(sites.page-1)}>Previous call site page</button>
      <button type="button" disabled={sites.page===sites.pages} onClick={()=>setSitePage(sites.page+1)}>Next call site page</button>
      <button type="button" onClick={()=>setDetail(null)}>Close call sites</button>
    </div>}
  </section>;
}
export function ListedCallTopologyPanel({report,busy,onNavigate}:{
  report:ListedSymbolReport;busy:boolean;onNavigate:(site:ListedSymbolSite)=>void;
}){
  const [expanded,setExpanded]=useState(false);
  const [filter,setFilter]=useState(DEFAULT_TOPOLOGY_FILTER);
  const [page,setPage]=useState(1);
  const [selected,setSelected]=useState<string|null>(null);
  const [direction,setDirection]=useState<TopologyDirection>('outgoing');
  const [depth,setDepth]=useState(4);
  const [walkPage,setWalkPage]=useState(1);
  const [destination,setDestination]=useState('');
  const [showPath,setShowPath]=useState(false);
  const [showCycles,setShowCycles]=useState(false);
  const [cyclePage,setCyclePage]=useState(1);
  const [cycleId,setCycleId]=useState<string|null>(null);
  const [cycleNodePage,setCycleNodePage]=useState(1);
  const [showReport,setShowReport]=useState(false);
  const [labels,setLabels]=useState(false);
  const [names,setNames]=useState(false);
  const graph=useMemo(()=>expanded?buildListedCallTopology(report):null,[report,expanded]);
  const filtered=useMemo(()=>graph?filterTopologyNodes(graph,filter):[],[graph,filter]);
  const visible=pageTopology(filtered,page);
  const neighbors=useMemo(()=>graph&&selected?topologyNeighbors(graph,selected):null,[graph,selected]);
  const walk=useMemo(()=>graph&&selected?walkTopology(graph,selected,direction,depth):null,[graph,selected,direction,depth]);
  const walkVisible=pageTopology(walk?.rows??[],walkPage);
  const path=useMemo(()=>graph&&selected&&destination&&showPath?shortestTopologyPath(graph,selected,destination,depth):null,
    [graph,selected,destination,depth,showPath]);
  const cycles=pageTopology(graph?.cycles??[],cyclePage);
  const chosenCycle=graph?.cycles.find(cycle=>cycle.id===cycleId);
  const nodeMap=useMemo(()=>new Map(graph?.nodes.map(node=>[node.id,node])??[]),[graph]);
  const cycleNodes=pageTopology(chosenCycle?.nodes.map(id=>nodeMap.get(id)!).filter(Boolean)??[],cycleNodePage);
  const output=useMemo(()=>graph&&showReport?topologyReportText(graph,labels,names):'',[graph,showReport,labels,names]);
  function select(id:string){setSelected(id);setWalkPage(1);setDestination('');setShowPath(false);}
  function update(patch:Partial<TopologyFilter>){setFilter(old=>({...old,...patch}));setPage(1);}
  return <section className="project-scope-coverage" aria-label="Listed call candidate topology">
    <button type="button" aria-expanded={expanded} onClick={()=>{
      setExpanded(!expanded);if(expanded){setShowReport(false);setLabels(false);setNames(false);setShowPath(false);}
    }}>{expanded?'Hide call candidate topology':'Explore call candidate topology'}</button>
    {expanded&&graph&&<>
      <p>This is an observed spelling topology, not a compiler call graph. A unique spelling can still resolve differently.
        Ambiguous and missing candidates are excluded from traversal. File context means no retained enclosing declaration.</p>
      {!graph.complete&&<p role="status">The lexical inventory was incomplete. Missing links are not evidence of absence.</p>}
      <dl className="project-scope-stats">
        <div><dt>Function nodes</dt><dd>{graph.nodes.filter(node=>node.kind==='function').length}</dd></div>
        <div><dt>Call-like sites</dt><dd>{graph.callSites}</dd></div>
        <div><dt>Unique candidate groups</dt><dd>{graph.uniqueEdges}</dd></div>
        <div><dt>Ambiguous groups</dt><dd>{graph.ambiguousEdges}</dd></div>
        <div><dt>No observed candidate groups</dt><dd>{graph.unobservedEdges}</dd></div>
        <div><dt>Candidate-cycle components</dt><dd>{graph.cycles.length}</dd></div>
      </dl>
      <label>Find node<input type="search" aria-label="Filter call topology nodes" maxLength={120}
        value={filter.query} onChange={event=>update({query:event.target.value})}/></label>
      <label>Source<select aria-label="Call topology source" value={filter.source} onChange={event=>update({source:event.target.value})}>
        <option value="">All labels</option>{report.files.map(file=><option key={file.name} value={file.name}>{file.name}</option>)}
      </select></label>
      <label>Node kind<select aria-label="Call topology node kind" value={filter.kind} onChange={event=>{
        const value=event.target.value;if(value==='all'||value==='function'||value==='file-context')update({kind:value});
      }}><option value="all">All nodes</option><option value="function">Functions</option><option value="file-context">File contexts</option></select></label>
      <label><input type="checkbox" checked={filter.connectedOnly} onChange={event=>update({connectedOnly:event.target.checked})}/>Only nodes with observed links</label>
      <button type="button" onClick={()=>{setFilter(DEFAULT_TOPOLOGY_FILTER);setPage(1);}}>Reset topology filters</button>
      <p>{filtered.length} nodes · Page {visible.page} of {visible.pages}</p>
      <div className="project-scope-inventory"><ul>{visible.rows.map(node=><li key={node.id}>
        <NodeLabel node={node}/>
        <p>{node.outbound} outgoing groups · {node.inbound} incoming unique groups</p>
        <button type="button" aria-pressed={selected===node.id} onClick={()=>select(node.id)}>Explore node {node.name}</button>
      </li>)}</ul></div>
      {!filtered.length&&<p>No nodes match these filters.</p>}
      <button type="button" disabled={visible.page===1} onClick={()=>setPage(visible.page-1)}>Previous topology node page</button>
      <button type="button" disabled={visible.page===visible.pages} onClick={()=>setPage(visible.page+1)}>Next topology node page</button>
      {neighbors&&<section aria-label="Selected call topology node">
        <h4>Selected node</h4><NodeLabel node={neighbors.node}/>
        {neighbors.node.declaration&&<button type="button" disabled={busy} onClick={()=>onNavigate(neighbors.node.declaration!)}>
          Recheck and open function declaration
        </button>}
        <EdgeList key={'out'+neighbors.node.id} graph={graph} busy={busy} edges={neighbors.outgoing}
          heading="Outgoing candidate groups" onNavigate={onNavigate} onSelect={select}/>
        <EdgeList key={'in'+neighbors.node.id} graph={graph} busy={busy} edges={neighbors.incoming}
          heading="Incoming unique candidate groups" onNavigate={onNavigate} onSelect={select}/>
        <label>Traversal direction<select aria-label="Call topology direction" value={direction} onChange={event=>{
          const value=event.target.value;if(value==='outgoing'||value==='incoming'){setDirection(value);setWalkPage(1);}
        }}><option value="outgoing">Candidate callees</option><option value="incoming">Observed callers</option></select></label>
        <label>Maximum traversal depth<select aria-label="Call topology depth" value={depth} onChange={event=>{
          const value=Number(event.target.value);if(Number.isInteger(value)&&value>=1&&value<=MAX_TOPOLOGY_DEPTH){
            setDepth(value);setWalkPage(1);setShowPath(false);
          }
        }}>{Array.from({length:MAX_TOPOLOGY_DEPTH},(_,index)=><option key={index+1} value={index+1}>{index+1}</option>)}</select></label>
        {walk&&<section aria-label="Call topology traversal">
          <p>{walk.visited} observed nodes · {walk.limited?'Traversal limit reached':'Within traversal limits'}</p>
          <ul>{walkVisible.rows.map(row=><li key={row.node.id}><span>Depth {row.depth} · </span><NodeLabel node={row.node}/></li>)}</ul>
          <button type="button" disabled={walkVisible.page===1} onClick={()=>setWalkPage(walkVisible.page-1)}>Previous traversal page</button>
          <span>Page {walkVisible.page} of {walkVisible.pages}</span>
          <button type="button" disabled={walkVisible.page===walkVisible.pages} onClick={()=>setWalkPage(walkVisible.page+1)}>Next traversal page</button>
        </section>}
        <label>Path destination<select aria-label="Call topology path destination" value={destination} onChange={event=>{
          setDestination(event.target.value);setShowPath(false);
        }}><option value="">Choose a destination node</option>
          {graph.nodes.map(node=><option key={node.id} value={node.id}>{node.name} · {node.source}:{node.declaration?.line??0}</option>)}
        </select></label>
        <button type="button" disabled={!destination} onClick={()=>setShowPath(true)}>Find shortest observed candidate path</button>
        {path&&<section aria-label="Observed call candidate path">
          {path.status==='observed'?<><p>Observed candidate path only, {path.rows.length-1} edges.</p>
            <ol>{path.rows.map(row=><li key={row.node.id}><NodeLabel node={row.node}/></li>)}</ol></>:
            <p>{path.status==='limited'?'Traversal limit reached; path unknown.':'No path observed in these retained unique edges.'}</p>}
        </section>}
      </section>}
      <button type="button" aria-expanded={showCycles} onClick={()=>setShowCycles(!showCycles)}>
        {showCycles?'Hide candidate cycles':'Review candidate cycles'}
      </button>
      {showCycles&&<section aria-label="Call candidate cycles">
        <p>Strongly connected components of unique observed spelling edges; not proof of runtime recursion.</p>
        <ul>{cycles.rows.map(cycle=><li key={cycle.id}>
          <button type="button" aria-pressed={cycleId===cycle.id} onClick={()=>{setCycleId(cycle.id);setCycleNodePage(1);}}>
            {cycle.selfOnly?'Self candidate':'Candidate component'} · {cycle.nodes.length} nodes · {cycle.edgeIds.length} edges
          </button>
        </li>)}</ul>
        {!graph.cycles.length&&<p>No cycles observed in retained unique edges.</p>}
        <button type="button" disabled={cycles.page===1} onClick={()=>setCyclePage(cycles.page-1)}>Previous cycle page</button>
        <button type="button" disabled={cycles.page===cycles.pages} onClick={()=>setCyclePage(cycles.page+1)}>Next cycle page</button>
        {chosenCycle&&<><ul>{cycleNodes.rows.map(node=><li key={node.id}><NodeLabel node={node}/>
          <button type="button" onClick={()=>select(node.id)}>Explore cycle node</button></li>)}</ul>
          <button type="button" disabled={cycleNodes.page===1} onClick={()=>setCycleNodePage(cycleNodes.page-1)}>Previous cycle node page</button>
          <button type="button" disabled={cycleNodes.page===cycleNodes.pages} onClick={()=>setCycleNodePage(cycleNodes.page+1)}>Next cycle node page</button></>}
      </section>}
      <button type="button" aria-expanded={showReport} onClick={()=>{setShowReport(!showReport);if(showReport){setLabels(false);setNames(false);}}}>
        {showReport?'Hide topology report':'Review topology report'}
      </button>
      {showReport&&<>
        <label><input type="checkbox" checked={labels} onChange={event=>setLabels(event.target.checked)}/>Include topology source labels</label>
        <label><input type="checkbox" checked={names} onChange={event=>setNames(event.target.checked)}/>Include topology symbol names</label>
        <textarea aria-label="Call topology report" readOnly rows={10} value={output}/>
      </>}
    </>}
  </section>;
}
