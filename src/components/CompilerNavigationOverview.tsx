import { useMemo,useState } from 'react';
import { type CompilerNavigationReport } from '../model/compilerNavigation';
import {
  buildNavigationOverviewReport,buildOwnershipOverview,DEFAULT_USAGE_QUERY,overviewPage,querySymbolUsage,
  summarizeCompilerNavigation,visibleOwnershipRows,type UsageFilter,type UsageOrder,type UsageQuery,
} from '../model/compilerNavigationOverview';

interface Props {
  report:CompilerNavigationReport;
  onChoose:(id:number)=>void;
}
function Pager({page,pages,onPage}:{page:number;pages:number;onPage:(page:number)=>void}){
  return <div className="inspection-page-controls">
    <button type="button" disabled={page<=1} onClick={()=>onPage(page-1)}>Previous</button>
    <span>{page}/{pages}</span>
    <button type="button" disabled={page>=pages} onClick={()=>onPage(page+1)}>Next</button>
  </div>;
}
const show=(value:number|null)=>value===null?'Not requested':String(value);
const usageFilters:readonly [UsageFilter,string][]=[
  ['all','All symbols'],['has-references','Has observed references'],
  ['no-observed-references','No observed references'],['cross-file','Cross-file references'],['writes','Write or read/write references'],
];
const usageOrders:readonly [UsageOrder,string][]=[
  ['source','Compiler order'],['references','Most references'],['cross-file','Most cross-file references'],['name','Name'],
];
export function CompilerNavigationOverview({report,onChoose}:Props){
  const [expanded,setExpanded]=useState(false);
  const [view,setView]=useState<'files'|'usage'|'owners'|'report'>('files');
  const [filePage,setFilePage]=useState(1);
  const [linkPage,setLinkPage]=useState(1);
  const [usagePage,setUsagePage]=useState(1);
  const [ownerPage,setOwnerPage]=useState(1);
  const [query,setQuery]=useState<UsageQuery>(DEFAULT_USAGE_QUERY);
  const [openOwners,setOpenOwners]=useState<ReadonlySet<number>>(new Set());
  const [labels,setLabels]=useState(false);
  const overview=useMemo(()=>expanded?summarizeCompilerNavigation(report):null,[expanded,report]);
  const ownership=useMemo(()=>expanded&&view==='owners'?buildOwnershipOverview(report):null,[expanded,view,report]);
  const ownerRows=useMemo(()=>ownership?visibleOwnershipRows(ownership,openOwners):[],[ownership,openOwners]);
  const usage=useMemo(()=>overview&&view==='usage'?querySymbolUsage(report,overview,query):[],[report,overview,view,query]);
  const reportText=useMemo(()=>overview&&view==='report'?buildNavigationOverviewReport(report,overview,labels):null,[report,overview,view,labels]);
  function updateQuery(patch:Partial<UsageQuery>){setQuery(previous=>({...previous,...patch}));setUsagePage(1);}
  function toggleOwner(id:number){setOpenOwners(previous=>{const next=new Set(previous);if(next.has(id))next.delete(id);else next.add(id);return next;});}
  const files=overviewPage(overview?.files??[],filePage),links=overviewPage(overview?.links??[],linkPage);
  const uses=overviewPage(usage,usagePage),owners=overviewPage(ownerRows,ownerPage);
  function fileLabel(id:number){return '#'+id+' '+report.files[id].path;}
  return <section className="navigation-overview" aria-label="Compiler report overview">
    <button type="button" aria-expanded={expanded} onClick={()=>{setExpanded(v=>!v);setLabels(false);}}>
      {expanded?'Hide inspection overview':'Review inspection overview'}
    </button>
    {overview&&<>
      <p>Counts describe this compiler snapshot only. Cross-file references are not a complete module dependency or call graph.
        Zero observed references does not prove that a symbol is unused.</p>
      <dl className="activity-metrics">
        <div><dt>Local references</dt><dd>{show(overview.localReferences)}</dd></div>
        <div><dt>Cross-file references</dt><dd>{show(overview.crossFileReferences)}</dd></div>
        <div><dt>Implicit-target references</dt><dd>{show(overview.implicitTargetReferences)}</dd></div>
        <div><dt>Implicit definitions</dt><dd>{overview.implicitSymbols}</dd></div>
      </dl>
      <div className="navigation-overview-tabs" role="group" aria-label="Inspection overview view">
        {(['files','usage','owners','report'] as const).map(item=><button type="button" key={item} aria-pressed={view===item}
          onClick={()=>{setView(item);setLabels(false);}}>{({files:'Files & links',usage:'Symbol usage',owners:'Ownership',report:'Summary report'})[item]}</button>)}
      </div>
      {view==='files'&&<>
        <h4>File inventory</h4>
        {files.items.map(file=><details key={file.sourceId}>
          <summary>{fileLabel(file.sourceId)} · {file.symbols} definition(s)</summary>
          <dl className="activity-metrics">
            <div><dt>Public</dt><dd>{file.publicSymbols}</dd></div>
            <div><dt>Mutable</dt><dd>{file.mutableSymbols}</dd></div>
            <div><dt>References from</dt><dd>{show(file.referencesFrom)}</dd></div>
            <div><dt>References to</dt><dd>{show(file.referencesTo)}</dd></div>
            <div><dt>Cross-file from</dt><dd>{show(file.crossFileFrom)}</dd></div>
            <div><dt>Cross-file to</dt><dd>{show(file.crossFileTo)}</dd></div>
            <div><dt>Implicit targets</dt><dd>{show(file.implicitTargetReferences)}</dd></div>
          </dl>
          <p>{Object.entries(file.bySymbolKind).filter(([,count])=>count>0).map(([kind,count])=>kind.replaceAll('_',' ')+': '+count).join(' · ')||'No located definitions'}</p>
        </details>)}
        <Pager page={files.page} pages={files.pages} onPage={setFilePage}/>
        <h4>Observed cross-file links</h4>
        {!overview.includesReferences?<p>Inspect References is required for this view.</p>:<>
          {links.items.map(link=><details key={link.from+':'+link.to}>
            <summary>{fileLabel(link.from)} → {fileLabel(link.to)} · {link.references} reference(s)</summary>
            <p>{Object.entries(link.byKind).filter(([,count])=>count>0).map(([kind,count])=>kind.replaceAll('_',' ')+': '+count).join(' · ')}</p>
            <p>{link.distinctTargets.length} distinct compiler target ID(s).</p>
            {link.distinctTargets.slice(0,20).map(id=><button type="button" key={id} onClick={()=>onChoose(id)}>#{id} {report.symbols[id].name}</button>)}
            {link.distinctTargets.length>20&&<p>First 20 target IDs shown. Use Symbol Usage for more.</p>}
          </details>)}
          {!overview.links.length&&<p>No cross-file reference observed in this snapshot.</p>}
          <Pager page={links.page} pages={links.pages} onPage={setLinkPage}/>
        </>}
      </>}
      {view==='usage'&&<>
        <div className="activity-filters">
          <input type="search" aria-label="Search symbol usage" maxLength={120} value={query.query} onChange={event=>updateQuery({query:event.target.value})}/>
          <select aria-label="Symbol usage filter" value={query.filter} onChange={event=>{
            const value=usageFilters.find(([id])=>id===event.target.value)?.[0];if(value)updateQuery({filter:value});
          }}>{usageFilters.map(([id,label])=><option key={id} value={id} disabled={!overview.includesReferences&&id!=='all'}>{label}</option>)}</select>
          <select aria-label="Symbol usage order" value={query.order} onChange={event=>{
            const value=usageOrders.find(([id])=>id===event.target.value)?.[0];if(value)updateQuery({order:value});
          }}>{usageOrders.map(([id,label])=><option key={id} value={id} disabled={!overview.includesReferences&&(id==='references'||id==='cross-file')}>{label}</option>)}</select>
          <select aria-label="Symbol usage source" value={query.sourceId} onChange={event=>{
            const value=event.target.value;updateQuery({sourceId:value==='all'||value==='implicit'?value:Number(value)});
          }}><option value="all">All files and implicit symbols</option><option value="implicit">Implicit definitions</option>
            {report.files.map(file=><option key={file.id} value={file.id}>{fileLabel(file.id)}</option>)}</select>
          <button type="button" onClick={()=>{setQuery(DEFAULT_USAGE_QUERY);setUsagePage(1);}}>Reset usage filters</button>
        </div>
        <p role="status">{usage.length} matching symbols</p>
        <div className="inspection-symbol-list">{uses.items.map(row=><button type="button" key={row.symbol.id} className="activity-record" onClick={()=>onChoose(row.symbol.id)}>
          <strong>#{row.symbol.id} {row.symbol.name}</strong><span>{row.symbol.kind.replaceAll('_',' ')} · references {show(row.usage.references)}</span>
          <small>Local {show(row.usage.local)} · cross-file {show(row.usage.external)} · implicit target {show(row.usage.unknownDefinition)}</small>
        </button>)}</div>
        {!usage.length&&<p>No symbols match the usage filters.</p>}
        <Pager page={uses.page} pages={uses.pages} onPage={setUsagePage}/>
      </>}
      {view==='owners'&&ownership&&<>
        <p>Compiler owner links, not inferred lexical scopes. Expand a node to reveal its directly owned symbols.</p>
        <div className="navigation-overview-tabs">
          <button type="button" onClick={()=>{setOpenOwners(new Set());setOwnerPage(1);}}>Collapse all owners</button>
          <button type="button" onClick={()=>{setOpenOwners(new Set(ownership.nodes.filter(node=>node.childIds.length).map(node=>node.symbol.id)));setOwnerPage(1);}}>Expand all owners</button>
        </div>
        <p>{ownerRows.length} visible of {ownership.nodes.length} symbols</p>
        <div className="inspection-owner-list">{owners.items.map(row=>{
          const node=ownership.nodes[row.id],open=openOwners.has(row.id);
          return <div key={row.id} className="inspection-owner-row" style={{paddingInlineStart:Math.min(row.depth,10)*10}}>
            {node.childIds.length>0?<button type="button" aria-expanded={open} aria-label={(open?'Collapse ':'Expand ')+'owner #'+row.id}
              onClick={()=>toggleOwner(row.id)}>{open?'−':'+'}</button>:<span aria-hidden="true">·</span>}
            <button type="button" onClick={()=>onChoose(row.id)}>#{row.id} {node.symbol.name} · {node.symbol.kind}
              {node.childIds.length>0?' ('+node.descendantCount+' descendants)':''}{row.depth>10?' · depth '+row.depth:''}</button>
          </div>;
        })}</div>
        <Pager page={owners.page} pages={owners.pages} onPage={setOwnerPage}/>
      </>}
      {view==='report'&&reportText&&<>
        <p>Review this bounded, read-only summary. File paths and symbol names are excluded by default.</p>
        <label><input type="checkbox" checked={labels} onChange={event=>setLabels(event.target.checked)}/> Include file and symbol labels (may contain private names)</label>
        <textarea aria-label="Compiler inspection overview report" readOnly rows={10} value={reportText.text}/>
        {reportText.omitted>0&&<p>{reportText.omitted} row(s) omitted by size limit.</p>}
      </>}
    </>}
  </section>;
}
