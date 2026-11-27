import { useMemo,useState } from 'react';
import { SYMBOL_KINDS,REFERENCE_KINDS } from '../model/compilerNavigation';
import { captureNavigationBaseline,compareNavigationSnapshots,filterComparison,comparisonPage,comparisonOwnerLabel,
  comparisonExport,CHANGE_KINDS,CHANGE_LABELS,DEFAULT_COMPARISON_FILTER,MAX_COMPARISON_QUERY,
  type NavigationSnapshot,type NavigationBaseline,type BaselineReview,type ComparisonFilter,type ComparisonRow,type SymbolProjection } from '../model/compilerNavigationComparison';
interface Props{
  readonly snapshot:NavigationSnapshot;
  readonly baseline:NavigationBaseline|null;
  readonly onBaseline:(baseline:NavigationBaseline|null)=>void;
}
function Projection({item}:{item:SymbolProjection|undefined}){
  if(!item)return <p>Not reported</p>;
  return <>
    <p>Snapshot-local ID #{item.id} · {item.public?'public':'not public'} · {item.mutable?'mutable':'not marked mutable'}</p>
    <p>{item.site?'Definition '+item.site.line+':'+item.site.column+' · bytes '+item.site.byteStart+'–'+item.site.byteEnd:'Implicit definition'}</p>
    {item.moduleLabel!==null&&<p>Target module: {item.moduleLabel}</p>}
    {item.references!==null&&<details><summary>{item.references.total} reported references</summary>
      <dl>{REFERENCE_KINDS.map(kind=><div key={kind}><dt>{kind.replaceAll('_',' ')}</dt><dd>{item.references!.byKind[kind]}</dd></div>)}</dl>
      <ul>{item.references.files.map(file=><li key={file.label}>{file.label} · {file.count}</li>)}</ul>
    </details>}
  </>;
}
function Detail({row}:{row:ComparisonRow}){
  if(row.change==='ambiguous')return <p>Cannot pair {row.before.length} baseline and {row.after.length} current symbol(s) uniquely
    {row.ambiguousAncestor?' because an ancestor label is ambiguous.':' because the structural label repeats.'}
    No rename, move or identity is inferred.</p>;
  return <div className="navigation-comparison-columns">
    <div><strong>Baseline</strong><Projection item={row.before[0]}/></div>
    <div><strong>Current</strong><Projection item={row.after[0]}/></div>
    {row.before.length===1&&row.after.length===1&&<p>
      Metadata: {row.metadataChanged?'changed':'matches'} · References: {row.referencesChanged?'changed':'no count change reported'} · Coordinates: {row.positionChanged?'changed':'match'}
    </p>}
  </div>;
}
export function CompilerNavigationComparison({snapshot,baseline,onBaseline}:Props){
  const [expanded,setExpanded]=useState(false);
  const [review,setReview]=useState<BaselineReview|null>(null);
  const [clear,setClear]=useState<NavigationBaseline|null>(null);
  const [filter,setFilter]=useState<ComparisonFilter>(DEFAULT_COMPARISON_FILTER);
  const [page,setPage]=useState(1);
  const [filePage,setFilePage]=useState(1);
  const [selected,setSelected]=useState<number|null>(null);
  const [showFiles,setShowFiles]=useState(false);
  const [showExport,setShowExport]=useState(false);
  const [labels,setLabels]=useState(false);
  const comparison=useMemo(()=>expanded?compareNavigationSnapshots(baseline,snapshot):null,[expanded,baseline,snapshot]);
  const result=comparison?.ok?comparison.value:null;
  const rows=useMemo(()=>result?filterComparison(result,filter):[],[result,filter]);
  const visible=comparisonPage(rows,page),files=comparisonPage(result?.files??[],filePage);
  const detail=selected===null?null:rows.find(row=>row.group.id===selected)??null;
  function reset(){setReview(null);setClear(null);setSelected(null);setPage(1);setFilePage(1);setShowExport(false);setLabels(false);}
  function update(patch:Partial<ComparisonFilter>){setFilter(previous=>({...previous,...patch}));setPage(1);setSelected(null);setShowExport(false);}
  return <section className="navigation-comparison" aria-label="Compiler inventory baseline comparison">
    <button type="button" aria-expanded={expanded} onClick={()=>{setExpanded(value=>!value);reset();}}>
      {expanded?'Hide inventory comparison':'Compare compiler inventories'}
    </button>
    {expanded&&<>
      <p>Retain one explicit session-only baseline. Compare opaque file labels, symbol names, kinds and owner groups,
        not report-local IDs. Renames, source edits and semantic identity are not inferred.</p>
      {baseline&&<p>Baseline: {baseline.report.kind} · {baseline.report.symbols.length} symbols · captured {new Date(baseline.capturedAt).toLocaleTimeString()}</p>}
      <div className="activity-filters">
        <button type="button" disabled={!!review||!!clear} onClick={()=>setReview({snapshot,previous:baseline})}>Review inventory baseline capture</button>
        <button type="button" disabled={!baseline||!!review||!!clear} onClick={()=>setClear(baseline)}>Review inventory baseline removal</button>
      </div>
      {review&&<div className="transfer-review" role="group" aria-label="Confirm inventory baseline capture">
        <p>{baseline?'Replace the retained inventory':'Retain this inventory'} for this session? No compiler command starts.</p>
        <button type="button" disabled={review.snapshot!==snapshot||review.previous!==baseline} onClick={()=>{
          const next=captureNavigationBaseline(review,snapshot,baseline,Date.now());
          if(next){onBaseline(next);reset();}
        }}>Confirm inventory baseline capture</button>
        <button type="button" onClick={()=>setReview(null)}>Cancel baseline capture</button>
      </div>}
      {clear&&<div className="transfer-review" role="group" aria-label="Confirm inventory baseline removal">
        <p>Remove the session baseline? The current report remains visible.</p>
        <button type="button" disabled={clear!==baseline} onClick={()=>{onBaseline(null);reset();}}>Confirm inventory baseline removal</button>
        <button type="button" onClick={()=>setClear(null)}>Cancel baseline removal</button>
      </div>}
      {comparison&&!comparison.ok&&<p role="status">{comparison.error}</p>}
      {result&&<>
        <dl className="activity-metrics">{CHANGE_KINDS.map(kind=><div key={kind}><dt>{CHANGE_LABELS[kind]}</dt><dd>{result.counts[kind]}</dd></div>)}</dl>
        <p>{result.baselineSymbols} → {result.currentSymbols} reported symbols.
          {result.includesReferences?' Reference counts include kinds and source-file counts, not individual reference identity.':' Reference data was not requested.'}</p>
        <div className="activity-filters">
          <input type="search" aria-label="Filter inventory comparison" value={filter.query} maxLength={MAX_COMPARISON_QUERY} onChange={event=>update({query:event.target.value})}/>
          <select aria-label="Inventory change kind" value={filter.change} onChange={event=>{
            const value=event.target.value as ComparisonFilter['change'];
            if(value==='all'||value==='changed'||CHANGE_KINDS.includes(value))update({change:value});
          }}><option value="changed">Changed or ambiguous groups</option><option value="all">All groups</option>
            {CHANGE_KINDS.map(kind=><option key={kind} value={kind}>{CHANGE_LABELS[kind]}</option>)}</select>
          <select aria-label="Inventory symbol kind" value={filter.kind} onChange={event=>{
            const value=event.target.value as ComparisonFilter['kind'];
            if(value==='all'||SYMBOL_KINDS.includes(value))update({kind:value});
          }}><option value="all">All symbol kinds</option>{SYMBOL_KINDS.map(kind=><option key={kind} value={kind}>{kind}</option>)}</select>
        </div>
        <p role="status">{rows.length} matching structural groups</p>
        <ul className="navigation-comparison-list">{visible.items.map(row=><li key={row.group.id}>
          <button type="button" className="activity-record" aria-pressed={selected===row.group.id} onClick={()=>setSelected(row.group.id)}>
            <strong>{row.group.name} · {row.group.kind}</strong>
            <span>{CHANGE_LABELS[row.change]} · {row.before.length} → {row.after.length}</span>
            <small>{row.group.fileLabel??'Implicit'} · {comparisonOwnerLabel(result,row.group)||'No owner'}</small>
          </button>
        </li>)}</ul>
        {!rows.length&&<p>No groups match.</p>}
        {visible.pages>1&&<div className="inspection-page-controls">
          <button type="button" disabled={visible.page===1} onClick={()=>setPage(visible.page-1)}>Previous groups</button>
          <span>{visible.page}/{visible.pages}</span>
          <button type="button" disabled={visible.page===visible.pages} onClick={()=>setPage(visible.page+1)}>Next groups</button>
        </div>}
        {detail&&<div className="activity-detail"><strong>{detail.group.name}</strong><Detail row={detail}/><button type="button" onClick={()=>setSelected(null)}>Close comparison detail</button></div>}
        <button type="button" aria-expanded={showFiles} onClick={()=>setShowFiles(value=>!value)}>{showFiles?'Hide file counts':'Compare file counts'}</button>
        {showFiles&&<>
          <ul className="navigation-comparison-list">{files.items.map(file=><li key={file.label}>
            <strong>{file.label}</strong><span>Definitions: {file.before??'Not reported'} → {file.after??'Not reported'}</span>
            {result.includesReferences&&<span>References from file: {file.referencesBefore??'Not reported'} → {file.referencesAfter??'Not reported'}</span>}
          </li>)}</ul>
          {files.pages>1&&<div className="inspection-page-controls">
            <button type="button" disabled={files.page===1} onClick={()=>setFilePage(files.page-1)}>Previous files</button><span>{files.page}/{files.pages}</span>
            <button type="button" disabled={files.page===files.pages} onClick={()=>setFilePage(files.page+1)}>Next files</button>
          </div>}
        </>}
        <button type="button" aria-expanded={showExport} onClick={()=>{setShowExport(value=>!value);setLabels(false);}}> {showExport?'Hide comparison report':'Review comparison report'}</button>
        {showExport&&<>
          <label><input type="checkbox" checked={labels} onChange={event=>setLabels(event.target.checked)}/>Include private file and symbol labels</label>
          <textarea aria-label="Compiler inventory comparison report" readOnly rows={8} value={comparisonExport(result,rows,labels).text}/>
        </>}
      </>}
    </>}
  </section>;
}
