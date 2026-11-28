import {useMemo,useRef,useState} from 'react';
import {ListedCallTopologyPanel} from './ListedCallTopologyPanel';
import {ProjectSearchScopeControls} from './ProjectSearchScopeControls';
import {DEFAULT_PROJECT_SEARCH_SCOPE,type ProjectSearchScope} from '../model/projectSearchScope';
import {prepareProjectInspection,INSPECTION_READ_LIMITS,INSPECTION_ORIGIN_LABELS,
  type InspectionSettings,type InspectionMode,type InspectionControl,type ProjectInspectionPlan,type InspectionProgress} from '../model/projectInspection';
import type {ProjectSearchSource} from '../model/projectSearch';
import {SYMBOL_COVERAGE_LABELS} from '../model/workspaceSymbols';
import {
  DEFAULT_LISTED_SYMBOL_FILTER,LISTED_SITE_KINDS,LISTED_SITE_LABELS,LISTED_SYMBOL_STATES,LISTED_SYMBOL_STATE_LABELS,
  LISTED_CANDIDATE_LABELS,filterListedSymbols,groupListedCalls,repeatedListedNames,pageListedSymbols,listedSymbolReportText,
  type ListedSymbolFilter,type ListedSymbolSite,type ListedSymbolReport,type ListedSymbolExecution,
  type ListedSymbolState,type ListedCandidateStatus,
} from '../model/listedSymbolIndex';

interface Props{
  listed:readonly ProjectSearchSource[];
  listingLimited:boolean;
  available:boolean;
  busy:boolean;
  onRun:(plan:ProjectInspectionPlan,settings:InspectionSettings,control:InspectionControl)=>Promise<ListedSymbolExecution>;
  onNavigate:(report:ListedSymbolReport,site:ListedSymbolSite)=>void;
}
type View='sites'|'calls'|'repeated'|'coverage';
const VIEW_LABELS:Record<View,string>={sites:'Declaration and call sites',calls:'Call candidate groups',
  repeated:'Repeated declaration names',coverage:'File coverage'};
const CALL_STATUSES=Object.keys(LISTED_CANDIDATE_LABELS) as ListedCandidateStatus[];

export function ListedSymbolReview({plan,busy,onConfirm,onCancel}:{
  plan:ProjectInspectionPlan;busy:boolean;onConfirm:()=>void;onCancel:()=>void;
}){
  const [labels,setLabels]=useState(false);
  return <section className="project-scope-coverage" aria-label="Review listed symbol index">
    <p><strong>Review lexical symbol inventory</strong></p>
    <p>{plan.selected} selected of {plan.listed} listed files · {plan.deferred} deferred ·
      {' '}{plan.excluded} excluded · {plan.withheld} withheld.</p>
    <p>{plan.settings.mode==='working'?'Working buffers take precedence.':'Saved disk snapshots only.'}
      {plan.settings.listingLimited?' Explorer listing is known to be limited.':''}</p>
    <p>Names are lexical observations. Imported modules, types and language scopes are not resolved.
      No source modifications or compiler execution occur.</p>
    <button type="button" aria-expanded={labels} onClick={()=>setLabels(v=>!v)}>
      {labels?'Hide symbol source labels':'Review symbol source labels'}
    </button>
    {labels&&<div className="project-scope-inventory"><ul>{plan.sources.map(source=>
      <li key={source.name}><code dir="auto">{source.name}</code></li>)}</ul></div>}
    <button type="button" disabled={busy} onClick={onConfirm}>Confirm listed symbol index</button>
    <button type="button" onClick={onCancel}>Cancel symbol review</button>
  </section>;
}
function SiteRow({site,busy,onNavigate}:{site:ListedSymbolSite;busy:boolean;onNavigate:()=>void}){
  return <li className="symbol-entry">
    <strong><code dir="auto">{site.name}</code></strong> · {LISTED_SITE_LABELS[site.kind]}
    <p><code dir="auto">{site.source}:{site.line}:{site.column}</code></p>
    {site.scope&&<p>{site.scope}{site.visibility==='public'?' · pub':''}{site.pure?' · pure':''}</p>}
    {site.enclosing&&<p>Nearest observed function: <code>{site.enclosing}</code></p>}
    <button type="button" disabled={busy} onClick={onNavigate}>Recheck and open symbol</button>
  </li>;
}
export function ListedSymbolResults({report,busy,onNavigate}:{
  report:ListedSymbolReport;busy:boolean;onNavigate:(site:ListedSymbolSite)=>void;
}){
  const [view,setView]=useState<View>('sites');
  const [filter,setFilter]=useState(DEFAULT_LISTED_SYMBOL_FILTER);
  const [page,setPage]=useState(1);
  const [coverage,setCoverage]=useState<ListedSymbolState|'all'>('all');
  const [status,setStatus]=useState<ListedCandidateStatus|'all'>('all');
  const [detail,setDetail]=useState<string|null>(null);
  const [detailPage,setDetailPage]=useState(1);
  const [showReport,setShowReport]=useState(false);
  const [labels,setLabels]=useState(false);
  const [names,setNames]=useState(false);
  const sites=useMemo(()=>filterListedSymbols(report,filter),[report,filter]);
  const calls=useMemo(()=>groupListedCalls(report),[report]);
  const repeated=useMemo(()=>repeatedListedNames(report),[report]);
  const query=filter.query.trim().toLowerCase();
  const callGroups=calls.filter(group=>(status==='all'||group.status===status)&&
    (!query||group.name.toLowerCase().includes(query))&&
    (!filter.source||group.calls.some(site=>site.source===filter.source)));
  const repeats=repeated.filter(group=>(!query||group.name.toLowerCase().includes(query))&&
    (!filter.source||group.declarations.some(site=>site.source===filter.source)));
  const files=report.files.filter(file=>(coverage==='all'||file.state===coverage)&&
    (!filter.source||file.name===filter.source)&&(!query||file.name.toLowerCase().includes(query)));
  const sitePage=pageListedSymbols(sites,page),callPage=pageListedSymbols(callGroups,page),
    repeatPage=pageListedSymbols(repeats,page),filePage=pageListedSymbols(files,page);
  const active=view==='sites'?sitePage:view==='calls'?callPage:view==='repeated'?repeatPage:filePage;
  const count=view==='sites'?sites.length:view==='calls'?callGroups.length:view==='repeated'?repeats.length:files.length;
  const selectedCall=view==='calls'?callGroups.find(group=>group.name===detail):undefined;
  const selectedRepeat=view==='repeated'?repeats.find(group=>group.name===detail):undefined;
  const detailRows=selectedCall?[...selectedCall.candidates,...selectedCall.calls]:selectedRepeat?.declarations??[];
  const detailVisible=pageListedSymbols(detailRows,detailPage);
  const output=useMemo(()=>showReport?listedSymbolReportText(report,labels,names):'', [report,showReport,labels,names]);
  function reset(){setPage(1);setDetail(null);setDetailPage(1);}
  function update(patch:Partial<ListedSymbolFilter>){setFilter(old=>({...old,...patch}));reset();}
  function selectDetail(name:string){setDetail(old=>old===name?null:name);setDetailPage(1);}
  return <section className="project-scope-coverage" aria-label="Listed symbol index results">
    <p role="status"><strong>Symbol index {report.status}</strong> · {report.complete?'Complete for chosen listed scope':'Incomplete coverage'}</p>
    <p>Historical lexical inventory. Recheck opens only a matching current source site; it does not resolve a call.</p>
    <dl className="project-scope-stats">
      <div><dt>Selected sources</dt><dd>{report.selected}</dd></div>
      <div><dt>Fully indexed</dt><dd>{report.files.filter(file=>file.state==='scanned').length}</dd></div>
      <div><dt>Declaration sites</dt><dd>{report.declarations.length}</dd></div>
      <div><dt>Call-like sites</dt><dd>{report.calls.length}</dd></div>
      <div><dt>Repeated spellings</dt><dd>{repeated.length}</dd></div>
      <div><dt>Deferred / withheld</dt><dd>{report.deferred} / {report.withheld}</dd></div>
    </dl>
    <label>Symbol view<select aria-label="Listed symbol view" value={view} onChange={event=>{
      const next=event.target.value as View;if(Object.hasOwn(VIEW_LABELS,next)){setView(next);reset();}
    }}>{(Object.keys(VIEW_LABELS) as View[]).map(item=><option key={item} value={item}>{VIEW_LABELS[item]}</option>)}</select></label>
    <div className="project-scope-fields">
      <label>Filter<input type="search" aria-label="Filter listed symbol observations" maxLength={120}
        value={filter.query} onChange={event=>update({query:event.target.value})}/></label>
      <label>Source label<select aria-label="Listed symbol source filter" value={filter.source}
        onChange={event=>update({source:event.target.value})}>
        <option value="">All selected labels</option>
        {report.files.map(file=><option key={file.name} value={file.name}>{file.name}</option>)}
      </select></label>
      {view==='sites'&&<>
        <label>Site kind<select aria-label="Listed symbol kind" value={filter.kind} onChange={event=>{
          const value=event.target.value as ListedSymbolFilter['kind'];
          if(value==='all'||LISTED_SITE_KINDS.includes(value))update({kind:value});
        }}><option value="all">All site kinds</option>
          {LISTED_SITE_KINDS.map(kind=><option key={kind} value={kind}>{LISTED_SITE_LABELS[kind]}</option>)}
        </select></label>
        <label>Nesting<select aria-label="Listed symbol nesting" value={filter.scope} onChange={event=>{
          const value=event.target.value;if(value==='all'||value==='top-level'||value==='nested')update({scope:value});
        }}><option value="all">Any nesting</option><option value="top-level">Top level</option><option value="nested">Nested</option></select></label>
        <label><input type="checkbox" checked={filter.publicOnly} onChange={event=>update({publicOnly:event.target.checked})}/>Public declarations only</label>
        <label><input type="checkbox" checked={filter.pureOnly} onChange={event=>update({pureOnly:event.target.checked})}/>Pure functions only</label>
        <label>Order<select aria-label="Listed symbol order" value={filter.order} onChange={event=>{
          const value=event.target.value;if(value==='source'||value==='name'||value==='kind')update({order:value});
        }}><option value="source">Source order</option><option value="name">Name order</option><option value="kind">Kind order</option></select></label>
      </>}
      {view==='calls'&&<label>Candidate status<select aria-label="Listed call candidate status" value={status} onChange={event=>{
        const value=event.target.value as ListedCandidateStatus|'all';
        if(value==='all'||CALL_STATUSES.includes(value)){setStatus(value);reset();}
      }}><option value="all">Any status</option>{CALL_STATUSES.map(item=><option key={item} value={item}>{LISTED_CANDIDATE_LABELS[item]}</option>)}</select></label>}
      {view==='coverage'&&<label>Coverage<select aria-label="Listed symbol coverage filter" value={coverage} onChange={event=>{
        const value=event.target.value as ListedSymbolState|'all';
        if(value==='all'||LISTED_SYMBOL_STATES.includes(value)){setCoverage(value);reset();}
      }}><option value="all">All coverage states</option>
        {LISTED_SYMBOL_STATES.map(item=><option key={item} value={item}>{LISTED_SYMBOL_STATE_LABELS[item]}</option>)}
      </select></label>}
      <button type="button" onClick={()=>{setFilter(DEFAULT_LISTED_SYMBOL_FILTER);setStatus('all');setCoverage('all');reset();}}>Reset listed symbol filters</button>
    </div>
    <p role="status">{count} matching observations · Page {active.page} of {active.pages}</p>
    <div className="project-scope-inventory">
      {view==='sites'&&<ul>{sitePage.rows.map(site=><SiteRow key={site.id} site={site} busy={busy} onNavigate={()=>onNavigate(site)}/>)}</ul>}
      {view==='calls'&&<><p>Same-file and other-file names are candidates only. No semantic resolution is asserted.</p>
        <ul>{callPage.rows.map(group=><li key={group.name}>
          <button type="button" aria-pressed={detail===group.name} onClick={()=>selectDetail(group.name)}>{group.name}</button>
          <p>{LISTED_CANDIDATE_LABELS[group.status]} · {group.calls.length} call-like sites · {group.candidates.length} candidates</p>
          <p>{group.sameFileCalls} call sites with same-file candidates · {group.crossFileOnlyCalls} with other-file candidates only</p>
        </li>)}</ul></>}
      {view==='repeated'&&<><p>Repeated spellings can be legitimate in different files and scopes.</p>
        <ul>{repeatPage.rows.map(group=><li key={group.name}>
          <button type="button" aria-pressed={detail===group.name} onClick={()=>selectDetail(group.name)}>{group.name}</button>
          <p>{group.declarations.length} observed declarations across {group.sources} labels</p>
        </li>)}</ul></>}
      {view==='coverage'&&<table><caption>Listed symbol file evidence</caption>
        <thead><tr><th>Source</th><th>Coverage</th><th>Origin</th><th>Declarations</th><th>Calls</th></tr></thead>
        <tbody>{filePage.rows.map(file=><tr key={file.name}>
          <td><code dir="auto">{file.name}</code></td><td>{LISTED_SYMBOL_STATE_LABELS[file.state]}
            {file.reasons.length>0&&<p>{file.reasons.map(reason=>SYMBOL_COVERAGE_LABELS[reason]).join(', ')}</p>}</td>
          <td>{INSPECTION_ORIGIN_LABELS[file.origin]}</td><td>{file.declarations}</td><td>{file.calls}</td>
        </tr>)}</tbody></table>}
      {!count&&<p>No observations match these filters.</p>}
    </div>
    <button type="button" disabled={active.page===1} onClick={()=>setPage(active.page-1)}>Previous symbol page</button>
    <button type="button" disabled={active.page===active.pages} onClick={()=>setPage(active.page+1)}>Next symbol page</button>
    {detail&&(selectedCall||selectedRepeat)&&<section aria-label="Listed symbol group details">
      <h4>{detail}</h4><p>{detailRows.length} retained sites · Page {detailVisible.page} of {detailVisible.pages}</p>
      <ul>{detailVisible.rows.map(site=><SiteRow key={site.id} site={site} busy={busy} onNavigate={()=>onNavigate(site)}/>)}</ul>
      <button type="button" disabled={detailVisible.page===1} onClick={()=>setDetailPage(detailVisible.page-1)}>Previous group page</button>
      <button type="button" disabled={detailVisible.page===detailVisible.pages} onClick={()=>setDetailPage(detailVisible.page+1)}>Next group page</button>
      <button type="button" onClick={()=>setDetail(null)}>Close symbol group</button>
    </section>}
    <ListedCallTopologyPanel report={report} busy={busy} onNavigate={onNavigate}/>
    <button type="button" aria-expanded={showReport} onClick={()=>{setShowReport(!showReport);if(showReport){setLabels(false);setNames(false);}}}>
      {showReport?'Hide listed symbol report':'Review listed symbol report'}
    </button>
    {showReport&&<>
      <label><input type="checkbox" checked={labels} onChange={event=>setLabels(event.target.checked)}/>Include relative file labels</label>
      <label><input type="checkbox" checked={names} onChange={event=>setNames(event.target.checked)}/>Include lexical symbol names</label>
      <textarea aria-label="Listed symbol inventory report" readOnly rows={10} value={output}/>
      <p>Default reports contain counts only. Both optional fields can contain private information.</p>
    </>}
  </section>;
}

export function ListedSymbolPanel({listed,listingLimited,available,busy,onRun,onNavigate}:Props){
  const [expanded,setExpanded]=useState(false);
  const [scope,setScope]=useState<ProjectSearchScope>(DEFAULT_PROJECT_SEARCH_SCOPE);
  const [mode,setMode]=useState<InspectionMode>('working');
  const [review,setReview]=useState<ProjectInspectionPlan|null>(null);
  const [report,setReport]=useState<ListedSymbolReport|null>(null);
  const [running,setRunning]=useState(false);
  const [cancelRequested,setCancelRequested]=useState(false);
  const [progress,setProgress]=useState<InspectionProgress|null>(null);
  const [error,setError]=useState('');
  const active=useRef<{cancelled:boolean}|null>(null);
  const settings={scope,mode,listingLimited};
  const blocked=busy||running||!available;
  function preview(){
    if(blocked)return;
    const planned=prepareProjectInspection(listed,settings);
    if(!planned.ok){setReview(null);setError(planned.error);return;}
    setReview(planned.value);setError('');
  }
  async function run(){
    if(blocked||!review||active.current)return;
    const token={cancelled:false};active.current=token;
    const plan=review;
    setReview(null);setReport(null);setRunning(true);setProgress(null);setCancelRequested(false);setError('');
    try{
      const response=await onRun(plan,settings,{
        isCurrent:()=>active.current===token,isCancelled:()=>token.cancelled,
        onProgress:value=>{if(active.current===token)setProgress(value);},
      });
      if(response.kind==='report')setReport(response.report);
      else setError('Symbol index invalidated. Review the current listing again.');
    }catch{setError('Symbol index could not complete. Review the scope again.');}
    finally{active.current=null;setRunning(false);setProgress(null);setCancelRequested(false);}
  }
  return <section className="sidebar-section" aria-label="Listed project symbols">
    <div className="sidebar-heading">LISTED PROJECT SYMBOLS</div>
    <button type="button" className="insights-toggle" aria-expanded={expanded} disabled={running}
      onClick={()=>{setExpanded(!expanded);if(expanded)setReview(null);}}>
      {expanded?'Hide listed symbols':'Index listed project symbols'}
    </button>
    {expanded&&<>
      <p>Index up to {INSPECTION_READ_LIMITS.files} listed Scarp sources and {INSPECTION_READ_LIMITS.totalBytes/1024/1024} MiB per reviewed run.</p>
      {!available&&<p>Choose a project in the desktop application.</p>}
      <label>Snapshot mode<select aria-label="Listed symbol snapshot mode" disabled={blocked} value={mode} onChange={event=>{
        const value=event.target.value;if(value==='working'||value==='saved'){setMode(value);setReview(null);}
      }}><option value="working">Working buffers and disk</option><option value="saved">Saved disk only</option></select></label>
      <ProjectSearchScopeControls listed={listed} scope={scope} busy={blocked} onChange={next=>{setScope(next);setReview(null);}}/>
      <button type="button" disabled={blocked} onClick={preview}>Review listed symbol index</button>
      {review&&<ListedSymbolReview plan={review} busy={blocked} onConfirm={()=>void run()} onCancel={()=>setReview(null)}/>}
      {running&&<div role="status">
        <p>{progress?progress.observed+' / '+progress.total+' source observations':'Starting index'}</p>
        <button type="button" disabled={cancelRequested} onClick={()=>{if(active.current)active.current.cancelled=true;setCancelRequested(true);}}>
          {cancelRequested?'Symbol cancellation requested':'Cancel listed symbol index'}
        </button>
      </div>}
      {error&&<p role="alert">{error}</p>}
      {report&&<><ListedSymbolResults report={report} busy={blocked} onNavigate={site=>onNavigate(report,site)}/>
        <button type="button" disabled={running} onClick={()=>setReport(null)}>Dismiss listed symbol results</button></>}
    </>}
  </section>;
}
