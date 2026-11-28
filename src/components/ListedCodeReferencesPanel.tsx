import {useMemo,useRef,useState} from 'react';
import {AnalysisSourceOpenPanel,type AnalysisSourceOpenContext} from './AnalysisSourceOpenPanel';
import {analysisSourceCandidates} from '../model/analysisSourceOpen';
import {ProjectSearchScopeControls} from './ProjectSearchScopeControls';
import {DEFAULT_PROJECT_SEARCH_SCOPE,type ProjectSearchScope} from '../model/projectSearchScope';
import {INSPECTION_READ_LIMITS,INSPECTION_ORIGIN_LABELS,type InspectionSettings,type InspectionMode,
  type InspectionControl,type InspectionProgress} from '../model/projectInspection';
import type {ProjectSearchSource} from '../model/projectSearch';
import {prepareListedReferences,filterListedReferences,groupReferenceSpellings,pageListedReferences,
  listedReferenceReportText,DEFAULT_REFERENCE_FILTER,REFERENCE_ROLES,REFERENCE_ROLE_LABELS,
  REFERENCE_STATES,REFERENCE_STATE_LABELS,REFERENCE_REASON_LABELS,
  type ListedReferencePlan,type ListedReferenceQuery,type ListedReferenceExecution,type ListedReferenceReport,
  type ListedReferenceSite,type ListedReferenceState,type ListedReferenceFilter} from '../model/listedCodeReferences';

interface Props{
  listed:readonly ProjectSearchSource[];
  listingLimited:boolean;
  available:boolean;
  sourceOpen?:AnalysisSourceOpenContext;
  busy:boolean;
  cursorIdentifier:()=>string|null;
  onRun:(plan:ListedReferencePlan,settings:InspectionSettings,query:ListedReferenceQuery,control:InspectionControl)=>Promise<ListedReferenceExecution>;
  onNavigate:(report:ListedReferenceReport,hit:ListedReferenceSite)=>void;
}
export function ListedReferenceReview({plan,busy,onConfirm,onCancel}:{
  plan:ListedReferencePlan;busy:boolean;onConfirm:()=>void;onCancel:()=>void;
}){
  const [labels,setLabels]=useState(false);
  const p=plan.inspection;
  return <section aria-label="Review listed code references" className="project-scope-coverage">
    <p><strong>Review code identifier search</strong></p>
    <p>Identifier: <code dir="auto">{plan.query.identifier}</code> · {plan.query.caseSensitive?'Match case':'Ignore case'}</p>
    <p>{p.selected} selected of {p.listed} listed files · {p.deferred} deferred · {p.excluded} excluded · {p.withheld} withheld.</p>
    <p>{p.settings.mode==='working'?'Working buffers take precedence.':'Saved disk snapshots only.'}
      {p.settings.listingLimited?' Explorer listing known limited.':''}</p>
    <p>Search code tokens, not text inside comments or strings. Roles are lexical hints, not compiler-resolved references.</p>
    <button type="button" aria-expanded={labels} onClick={()=>setLabels(value=>!value)}>
      {labels?'Hide reference source labels':'Review reference source labels'}
    </button>
    {labels&&<div className="project-scope-inventory"><ul>{p.sources.map(source=>
      <li key={source.name}><code dir="auto">{source.name}</code></li>)}</ul></div>}
    <button type="button" disabled={busy} onClick={onConfirm}>Confirm listed code references</button>
    <button type="button" onClick={onCancel}>Cancel reference review</button>
  </section>;
}
export function ListedReferenceResults({report,busy,onNavigate}:{
  report:ListedReferenceReport;busy:boolean;onNavigate:(hit:ListedReferenceSite)=>void;
}){
  const [view,setView]=useState<'sites'|'files'>('sites');
  const [filter,setFilter]=useState(DEFAULT_REFERENCE_FILTER);
  const [fileState,setFileState]=useState<ListedReferenceState|'all'>('all');
  const [page,setPage]=useState(1);
  const [showReport,setShowReport]=useState(false);
  const [labels,setLabels]=useState(false);
  const [identifier,setIdentifier]=useState(false);
  const hits=useMemo(()=>filterListedReferences(report,filter),[report,filter]);
  const spellings=useMemo(()=>groupReferenceSpellings(report),[report]);
  const files=report.files.filter(file=>(!filter.source||file.name===filter.source)&&
    (fileState==='all'||file.state===fileState));
  const hitPage=pageListedReferences(hits,page),filePage=pageListedReferences(files,page);
  const selected=view==='sites'?hitPage:filePage;
  const count=view==='sites'?hits.length:files.length;
  const output=useMemo(()=>showReport?listedReferenceReportText(report,labels,identifier):'',
    [report,showReport,labels,identifier]);
  function update(patch:Partial<ListedReferenceFilter>){setFilter(old=>({...old,...patch}));setPage(1);}
  return <section aria-label="Listed code reference results" className="project-scope-coverage">
    <p role="status"><strong>Reference search {report.status}</strong> · {report.complete?'Complete for chosen listed scope':'Incomplete coverage'}</p>
    <p>Identifier: <code>{report.query.identifier}</code>. These are historical lexical observations, not semantic resolution.</p>
    <dl className="project-scope-stats">
      <div><dt>Selected sources</dt><dd>{report.selected}</dd></div>
      <div><dt>Fully searched files</dt><dd>{report.files.filter(file=>file.state==='scanned').length}</dd></div>
      <div><dt>Retained references</dt><dd>{report.hits.length}</dd></div>
      <div><dt>Deferred / withheld</dt><dd>{report.deferred} / {report.withheld}</dd></div>
      {REFERENCE_ROLES.map(role=><div key={role}><dt>{REFERENCE_ROLE_LABELS[role]}</dt><dd>{report.counts[role]}</dd></div>)}
    </dl>
    {!report.complete&&<p>Zero retained references do not establish absence in unobserved or partial sources.</p>}
    <label>View<select aria-label="Listed reference view" value={view} onChange={event=>{
      const value=event.target.value;if(value==='sites'||value==='files'){setView(value);setPage(1);}
    }}><option value="sites">Reference sites</option><option value="files">File evidence</option></select></label>
    <label>Source<select aria-label="Listed reference source" value={filter.source} onChange={event=>update({source:event.target.value})}>
      <option value="">All selected labels</option>{report.files.map(file=><option key={file.name} value={file.name}>{file.name}</option>)}
    </select></label>
    {view==='sites'&&<>
      <label>Role<select aria-label="Listed reference role" value={filter.role} onChange={event=>{
        const value=event.target.value as ListedReferenceFilter['role'];
        if(value==='all'||REFERENCE_ROLES.includes(value))update({role:value});
      }}><option value="all">All lexical roles</option>{REFERENCE_ROLES.map(role=>
        <option key={role} value={role}>{REFERENCE_ROLE_LABELS[role]}</option>)}</select></label>
      <label>Exact spelling<select aria-label="Listed reference spelling" value={filter.spelling} onChange={event=>update({spelling:event.target.value})}>
        <option value="">All observed spellings</option>{spellings.map(group=>
          <option key={group.token} value={group.token}>{group.token} ({group.hits} sites / {group.files} files)</option>)}
      </select></label>
      <label>Order<select aria-label="Listed reference order" value={filter.order} onChange={event=>{
        const value=event.target.value;if(value==='source'||value==='role'||value==='spelling')update({order:value});
      }}><option value="source">Source order</option><option value="role">Lexical role</option><option value="spelling">Exact spelling</option></select></label>
    </>}
    {view==='files'&&<label>Coverage<select aria-label="Listed reference coverage" value={fileState} onChange={event=>{
      const value=event.target.value as ListedReferenceState|'all';
      if(value==='all'||REFERENCE_STATES.includes(value)){setFileState(value);setPage(1);}
    }}><option value="all">All file states</option>{REFERENCE_STATES.map(state=>
      <option key={state} value={state}>{REFERENCE_STATE_LABELS[state]}</option>)}</select></label>}
    <button type="button" onClick={()=>{setFilter(DEFAULT_REFERENCE_FILTER);setFileState('all');setPage(1);}}>Reset reference filters</button>
    <p role="status">{count} matching observations · Page {selected.page} of {selected.pages}</p>
    <div className="project-scope-inventory">
      {view==='sites'&&<ul>{hitPage.rows.map(hit=><li key={hit.id}>
        <strong><code>{hit.token}</code></strong> · {REFERENCE_ROLE_LABELS[hit.role]}
        <p><code dir="auto">{hit.source}:{hit.line}:{hit.column}</code></p>
        <button type="button" disabled={busy} onClick={()=>onNavigate(hit)}>Recheck and open reference</button>
      </li>)}</ul>}
      {view==='files'&&<table>
        <caption>Per-file code reference evidence</caption>
        <thead><tr><th>Source</th><th>Coverage</th><th>Origin</th><th>Retained sites</th></tr></thead>
        <tbody>{filePage.rows.map(file=><tr key={file.name}>
          <td><code dir="auto">{file.name}</code></td><td>{REFERENCE_STATE_LABELS[file.state]}
            {file.reasons.length>0&&<p>{file.reasons.map(reason=>REFERENCE_REASON_LABELS[reason]).join(', ')}</p>}</td>
          <td>{INSPECTION_ORIGIN_LABELS[file.origin]}</td><td>{file.hits}</td>
        </tr>)}</tbody>
      </table>}
      {!count&&<p>No retained observations match the filters.</p>}
    </div>
    <button type="button" disabled={selected.page===1} onClick={()=>setPage(selected.page-1)}>Previous reference page</button>
    <button type="button" disabled={selected.page===selected.pages} onClick={()=>setPage(selected.page+1)}>Next reference page</button>
    <button type="button" aria-expanded={showReport} onClick={()=>{setShowReport(!showReport);if(showReport){setLabels(false);setIdentifier(false);}}}>
      {showReport?'Hide listed reference report':'Review listed reference report'}
    </button>
    {showReport&&<>
      <label><input type="checkbox" checked={identifier} onChange={event=>setIdentifier(event.target.checked)}/>Include identifier and observed spellings</label>
      <label><input type="checkbox" checked={labels} onChange={event=>setLabels(event.target.checked)}/>Include relative source labels</label>
      <textarea aria-label="Listed code reference report" rows={10} readOnly value={output}/>
      <p>Default reports contain counts only. No source text or native paths are included.</p>
    </>}
  </section>;
}
export function ListedCodeReferencesPanel({listed,listingLimited,available,busy,cursorIdentifier,onRun,onNavigate,sourceOpen}:Props){
  const [expanded,setExpanded]=useState(false);
  const [identifier,setIdentifier]=useState('');
  const [caseSensitive,setCaseSensitive]=useState(true);
  const [scope,setScope]=useState<ProjectSearchScope>(DEFAULT_PROJECT_SEARCH_SCOPE);
  const [mode,setMode]=useState<InspectionMode>('working');
  const [review,setReview]=useState<ListedReferencePlan|null>(null);
  const [result,setResult]=useState<ListedReferenceReport|null>(null);
  const [running,setRunning]=useState(false);
  const [cancelRequested,setCancelRequested]=useState(false);
  const [progress,setProgress]=useState<InspectionProgress|null>(null);
  const [notice,setNotice]=useState('');
  const active=useRef<{cancelled:boolean}|null>(null);
  const settings={scope,mode,listingLimited};
  const query={identifier,caseSensitive};
  const blocked=busy||running||!available;
  function preview(){
    if(blocked)return;
    const planned=prepareListedReferences(listed,settings,query);
    if(!planned.ok){setReview(null);setNotice(planned.error);return;}
    setReview(planned.value);setNotice('');
  }
  async function run(){
    if(blocked||!review||active.current)return;
    const token={cancelled:false};active.current=token;
    const plan=review;
    setReview(null);setResult(null);setRunning(true);setProgress(null);setCancelRequested(false);setNotice('');
    try{
      const response=await onRun(plan,settings,query,{
        isCurrent:()=>active.current===token,isCancelled:()=>token.cancelled,
        onProgress:value=>{if(active.current===token)setProgress(value);},
      });
      if(response.kind==='report')setResult(response.report);
      else setNotice('Reference search invalidated. Review the current listing again.');
    }catch{setNotice('Reference search could not complete. Review the source scope again.');}
    finally{active.current=null;setRunning(false);setProgress(null);setCancelRequested(false);}
  }
  return <section className="sidebar-section" aria-label="Listed project code references">
    <div className="sidebar-heading">LISTED CODE REFERENCES</div>
    <button type="button" className="insights-toggle" aria-expanded={expanded} disabled={running}
      onClick={()=>{setExpanded(!expanded);if(expanded)setReview(null);}}>
      {expanded?'Hide listed code references':'Find listed code references'}
    </button>
    {expanded&&<>
      <p>Find one lexical code identifier across up to {INSPECTION_READ_LIMITS.files} reviewed listed sources.
        Source text is not retained in results.</p>
      {!available&&<p>Choose a project in the desktop application.</p>}
      <label>Identifier<input type="search" aria-label="Listed code reference identifier" maxLength={128}
        disabled={blocked} value={identifier} onChange={event=>{setIdentifier(event.target.value);setReview(null);setNotice('');}}/></label>
      <button type="button" disabled={blocked} onClick={()=>{
        const token=cursorIdentifier();setReview(null);
        if(token){setIdentifier(token);setNotice('');}
        else setNotice('Move the editor cursor onto a complete code identifier.');
      }}>Use identifier at editor cursor</button>
      <label><input type="checkbox" checked={caseSensitive} disabled={blocked} onChange={event=>{
        setCaseSensitive(event.target.checked);setReview(null);
      }}/>Match case for listed references</label>
      <label>Snapshot mode<select aria-label="Listed reference snapshot mode" value={mode} disabled={blocked} onChange={event=>{
        const value=event.target.value;if(value==='working'||value==='saved'){setMode(value);setReview(null);}
      }}><option value="working">Working buffers and disk</option><option value="saved">Saved disk only</option></select></label>
      <ProjectSearchScopeControls listed={listed} scope={scope} busy={blocked} onChange={value=>{setScope(value);setReview(null);}}/>
      <button type="button" disabled={blocked} onClick={preview}>Review listed code reference search</button>
      {review&&<ListedReferenceReview plan={review} busy={blocked} onConfirm={()=>void run()} onCancel={()=>setReview(null)}/>}
      {running&&<div role="status">
        <p>{progress?progress.observed+' / '+progress.total+' source observations':'Starting reference search'}</p>
        <button type="button" disabled={cancelRequested} onClick={()=>{if(active.current)active.current.cancelled=true;setCancelRequested(true);}}>
          {cancelRequested?'Reference cancellation requested':'Cancel listed reference search'}
        </button>
      </div>}
      {notice&&<p role="alert">{notice}</p>}
      {result&&<><ListedReferenceResults report={result} busy={blocked} onNavigate={hit=>onNavigate(result,hit)}/>
        {sourceOpen&&<AnalysisSourceOpenPanel context={sourceOpen} busy={blocked} candidates={analysisSourceCandidates(result.hits)}/>}
        <button type="button" disabled={running} onClick={()=>setResult(null)}>Dismiss listed reference results</button></>}
    </>}
  </section>;
}
