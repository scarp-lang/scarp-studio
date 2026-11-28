import {useMemo,useState} from 'react';
import {CALL_ARGUMENT_ISSUES} from '../language/scarpCallArguments';
import {ARITY_LABELS,ARITY_STATUSES,DEFAULT_ARITY_FILTER,arityReviewText,buildArityReview,filterArityReview,groupArityByName,type ArityFilter,type ArityRow} from '../model/listedCallArity';
import {pageListedSymbols,type ListedSymbolReport,type ListedSymbolSite} from '../model/listedSymbolIndex';

function Row({row,busy,onNavigate}:{row:ArityRow;busy:boolean;onNavigate:(site:ListedSymbolSite)=>void}){
  const [expanded,setExpanded]=useState(false);
  return <li className="symbol-entry">
    <strong><code dir="auto">{row.call.name}</code></strong> · {ARITY_LABELS[row.status]}
    <p><code dir="auto">{row.call.source}:{row.call.line}:{row.call.column}</code></p>
    <p>Argument positions: {row.count??'unknown'} · Candidate parameter positions: {row.expected??'unknown'}</p>
    {row.explicitTypeCount!==null&&<p>Explicit type arguments observed: {row.explicitTypeCount}</p>}
    {row.issue&&<p>{CALL_ARGUMENT_ISSUES[row.issue]}</p>}
    {row.otherNameCandidates>0&&<p>{row.otherNameCandidates} observed non-function declarations use this spelling.</p>}
    <button type="button" disabled={busy} onClick={()=>onNavigate(row.call)}>Recheck and open call site</button>
    {!!row.candidates.length&&<>
      <button type="button" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>
        {expanded?'Hide':'Review'} {row.candidates.length} observed declaration candidates
      </button>
      {expanded&&<CandidateRows candidates={row.candidates} busy={busy} onNavigate={onNavigate}/>}
    </>}
  </li>;
}
function CandidateRows({candidates,busy,onNavigate}:{candidates:readonly ListedSymbolSite[];busy:boolean;onNavigate:(site:ListedSymbolSite)=>void}){
  const [page,setPage]=useState(1);
  const visible=pageListedSymbols(candidates,page);
  return <section aria-label="Observed declaration candidates">
    <ul>{visible.rows.map(site=><li key={site.id}>
      <code dir="auto">{site.source}:{site.line}:{site.column}</code> · {site.scope}
      <button type="button" disabled={busy} onClick={()=>onNavigate(site)}>Recheck and open declaration</button>
    </li>)}</ul>
    <p>Page {visible.page} of {visible.pages}</p>
    <button type="button" disabled={visible.page===1} onClick={()=>setPage(visible.page-1)}>Previous candidate page</button>
    <button type="button" disabled={visible.page===visible.pages} onClick={()=>setPage(visible.page+1)}>Next candidate page</button>
  </section>;
}
export function ListedCallArityPanel({report,busy,onNavigate}:{report:ListedSymbolReport;busy:boolean;onNavigate:(site:ListedSymbolSite)=>void}){
  const [expanded,setExpanded]=useState(false);
  const [filter,setFilter]=useState(DEFAULT_ARITY_FILTER);
  const [view,setView]=useState<'sites'|'groups'>('sites');
  const [page,setPage]=useState(1);
  const [showReport,setShowReport]=useState(false);
  const [labels,setLabels]=useState(false);
  const [names,setNames]=useState(false);
  const review=useMemo(()=>expanded?buildArityReview(report):null,[expanded,report]);
  const rows=useMemo(()=>review?filterArityReview(review,filter):[],[review,filter]);
  const groups=useMemo(()=>review?groupArityByName(review):[],[review]);
  const visible=pageListedSymbols(rows,page),groupPage=pageListedSymbols(groups,page);
  const output=useMemo(()=>review&&showReport?arityReviewText(review,labels,names):'',[review,showReport,labels,names]);
  function update(patch:Partial<ArityFilter>){setFilter(old=>({...old,...patch}));setPage(1);}
  if(!report.interfaces||!report.callArguments)return null;
  return <section className="project-scope-coverage" aria-label="Listed call argument counts">
    <button type="button" aria-expanded={expanded} onClick={()=>{setExpanded(!expanded);setShowReport(false);setLabels(false);setNames(false);}}>
      {expanded?'Hide':'Review'} lexical call argument counts
    </button>
    {expanded&&review&&<>
      <p>Compare positional counts only with observed same-spelling top-level declarations. Even matching counts do not establish
        resolution, type compatibility or contract satisfaction. Qualified calls are excluded by the lexical index.</p>
      {!review.complete&&<p role="status">Incomplete or excluded source coverage: declaration counts will not be compared.</p>}
      <dl className="project-scope-stats">{ARITY_STATUSES.map(status=><div key={status}><dt>{ARITY_LABELS[status]}</dt><dd>{review.counts[status]}</dd></div>)}</dl>
      <label>View<select aria-label="Call argument review view" value={view} onChange={event=>{
        const value=event.target.value;if(value==='sites'||value==='groups'){setView(value);setPage(1);}
      }}><option value="sites">Call sites</option><option value="groups">Count distributions by spelling</option></select></label>
      {view==='sites'&&<>
        <label>Filter<input type="search" aria-label="Call argument review filter" maxLength={120} value={filter.query}
          onChange={event=>update({query:event.target.value})}/></label>
        <label>Source<select aria-label="Call argument source filter" value={filter.source} onChange={event=>update({source:event.target.value})}>
          <option value="">All observed labels</option>{report.files.map(file=><option key={file.name} value={file.name}>{file.name}</option>)}
        </select></label>
        <label>Status<select aria-label="Call argument status filter" value={filter.status} onChange={event=>{
          const value=event.target.value as ArityFilter['status'];if(value==='all'||ARITY_STATUSES.includes(value))update({status:value});
        }}><option value="all">All statuses</option>{ARITY_STATUSES.map(status=><option key={status} value={status}>{ARITY_LABELS[status]}</option>)}</select></label>
        <label>Order<select aria-label="Call argument review order" value={filter.order} onChange={event=>{
          const value=event.target.value;if(value==='source'||value==='name'||value==='difference')update({order:value});
        }}><option value="source">Source order</option><option value="name">Spelling</option><option value="difference">Largest count difference</option></select></label>
        <button type="button" onClick={()=>{setFilter(DEFAULT_ARITY_FILTER);setPage(1);}}>Reset call argument filters</button>
        <p role="status">{rows.length} matching observations · Page {visible.page} of {visible.pages}</p>
        <div className="project-scope-inventory"><ul>{visible.rows.map(row=><Row key={row.call.id} row={row} busy={busy} onNavigate={onNavigate}/>)}</ul></div>
        {!rows.length&&<p>No observations match the filters.</p>}
      </>}
      {view==='groups'&&<>
        <p>Distributions include every observed call spelling, regardless of declaration availability.</p>
        <p>{groups.length} groups · Page {groupPage.page} of {groupPage.pages}</p>
        <div className="project-scope-inventory"><ul>{groupPage.rows.map(group=><li key={group.name}>
          <strong><code dir="auto">{group.name}</code></strong> · {group.calls} call-like sites
          <p>{group.differing} differing observed counts · {group.unavailable} unavailable counts</p>
          <ul>{group.observedCounts.map(item=><li key={item.count}>{item.count} positions: {item.calls} sites</li>)}</ul>
          <button type="button" onClick={()=>{setFilter({...DEFAULT_ARITY_FILTER,query:group.name});setView('sites');setPage(1);}}>Review spelling sites</button>
        </li>)}</ul></div>
      </>}
      <button type="button" disabled={page<=1} onClick={()=>setPage(page-1)}>Previous argument review page</button>
      <button type="button" disabled={page>=(view==='sites'?visible.pages:groupPage.pages)} onClick={()=>setPage(page+1)}>Next argument review page</button>
      <button type="button" aria-expanded={showReport} onClick={()=>{setShowReport(!showReport);setLabels(false);setNames(false);}}>
        {showReport?'Hide':'Review'} call argument report
      </button>
      {showReport&&<>
        <label><input type="checkbox" checked={labels} onChange={event=>setLabels(event.target.checked)}/>Include relative call labels</label>
        <label><input type="checkbox" checked={names} onChange={event=>setNames(event.target.checked)}/>Include call spellings</label>
        <textarea aria-label="Lexical call argument report" readOnly rows={10} value={output}/>
      </>}
    </>}
  </section>;
}
