import { useMemo,useState } from 'react';
import type { SourceImportGraph } from '../model/sourceImports';
import { dependencyLayers,dependencyReport,reachableImportNodes,reviewImportDependencies,
  DEPENDENCY_PAGE,type DependencyDirection } from '../model/importDependencyReview';
interface Props {graph:SourceImportGraph;activeId:string|null}
export function ImportDependencyPanel({graph,activeId}:Props){
  const [expanded,setExpanded]=useState(false);
  const [direction,setDirection]=useState<DependencyDirection>('dependencies');
  const [page,setPage]=useState(1);
  const [query,setQuery]=useState('');
  const [showLayers,setShowLayers]=useState(false);
  const [showReport,setShowReport]=useState(false);
  const review=useMemo(()=>expanded?reviewImportDependencies(graph):null,[expanded,graph]);
  const root=review?.nodes.find(node=>node.id===activeId);
  const reachable=useMemo(()=>review&&activeId?reachableImportNodes(review,activeId,direction):[],[review,activeId,direction]);
  const visible=reachable.filter(item=>item.node.name.toLowerCase().includes(query.trim().toLowerCase()));
  const pages=Math.max(1,Math.ceil(visible.length/DEPENDENCY_PAGE)),currentPage=Math.min(page,pages);
  const layers=useMemo(()=>showLayers&&review?dependencyLayers(review):[],[review,showLayers]);
  return <section className="import-dependency-review" aria-label="Open-buffer import dependency review">
    <button type="button" aria-expanded={expanded} onClick={()=>{setExpanded(v=>!v);setShowReport(false);}}>
      {expanded?'Hide dependency review':'Review import dependencies'}
    </button>
    {review&&<>
      <p className="insights-disclaimer">Observed lexical links between already-open, Explorer-listed buffers only.
        No unopened source is read. This is not a compiler module graph or build order.</p>
      <dl className="activity-metrics">
        <div><dt>Open nodes</dt><dd>{review.nodes.length}</dd></div>
        <div><dt>Unresolved/frontier edges</dt><dd>{review.unknownTargetEdges}</dd></div>
        <div><dt>Cyclic components</dt><dd>{review.components.filter(c=>c.cyclic).length}</dd></div>
        <div><dt>Repeated aliases</dt><dd>{review.duplicateAliases.length}</dd></div>
      </dl>
      {review.incomplete&&<p role="status">Coverage is incomplete or has unresolved targets. Absence of a path or cycle is not conclusive.</p>}
      {root?<><p>Selected root: {root.name} · {root.outgoing.length} direct open dependencies · {root.incoming.length} direct open dependents</p>
        <select aria-label="Import dependency direction" value={direction} onChange={event=>{
          if(event.target.value==='dependencies'||event.target.value==='dependents'){setDirection(event.target.value);setPage(1);}
        }}><option value="dependencies">Reachable dependencies</option><option value="dependents">Reachable dependents</option></select>
        <input type="search" aria-label="Filter reachable import sources" maxLength={120} value={query}
          onChange={event=>{setQuery(event.target.value);setPage(1);}} placeholder="Filter reachable sources"/>
        <p role="status">{visible.length} matching of {reachable.length} reachable open sources</p>
        <ol className="dependency-path-list">{visible.slice((currentPage-1)*DEPENDENCY_PAGE,currentPage*DEPENDENCY_PAGE).map(item=>
          <li key={item.node.id}><strong>{item.node.name}</strong><span>{item.distance} observed edge(s)</span>
            <small>{item.route.map(node=>node.name).join(direction==='dependencies'?' → ':' ← ')}</small>
          </li>)}</ol>
        {pages>1&&<div className="insights-pages">
          <button type="button" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>Previous paths</button>
          <span>{currentPage}/{pages}</span><button type="button" disabled={currentPage===pages} onClick={()=>setPage(currentPage+1)}>Next paths</button>
        </div>}
      </>:<p>Open a listed source to inspect its reachable links.</p>}
      <h4>Observed cyclic components</h4>
      {review.components.filter(component=>component.cyclic).map(component=><details key={component.id}>
        <summary>{component.members.length} source(s) in one cyclic component</summary>
        <ul>{component.members.map(node=><li key={node.id}>{node.name}</li>)}</ul>
      </details>)}
      {!review.components.some(component=>component.cyclic)&&<p>No cycle observed in indexed open links.</p>}
      <h4>Repeated import alias hints</h4>
      {review.duplicateAliases.map(item=><details key={JSON.stringify([item.documentId,item.alias])}>
        <summary>{item.sourceName} · {item.alias} ({item.edges.length})</summary>
        <ul>{item.edges.map(edge=><li key={edge.id}>Line {edge.line}: {edge.specifier}</li>)}</ul>
      </details>)}
      {!review.duplicateAliases.length&&<p>No repeated aliases observed.</p>}
      <button type="button" aria-expanded={showLayers} onClick={()=>setShowLayers(v=>!v)}>
        {showLayers?'Hide dependency layers':'Inspect observed dependency layers'}
      </button>
      {showLayers&&<div className="dependency-layers"><p>Layer zero has no observed outgoing component edges. Missing/unopened sources may change every layer.</p>
        {layers.map(layer=><details key={layer.number}><summary>Layer {layer.number} · {layer.components.length} component(s)</summary>
          <ul>{layer.components.map(component=><li key={component.id}>{component.members.map(node=>node.name).join(', ')}{component.cyclic?' (cyclic)':''}</li>)}</ul>
        </details>)}
      </div>}
      <button type="button" aria-expanded={showReport} onClick={()=>setShowReport(v=>!v)}>
        {showReport?'Hide dependency report':'Review dependency report'}
      </button>
      {showReport&&<label>Read-only observed graph summary (includes relative filenames)
        <textarea aria-label="Import dependency report" readOnly rows={8} value={dependencyReport(review).text}/>
      </label>}
    </>}
  </section>;
}
