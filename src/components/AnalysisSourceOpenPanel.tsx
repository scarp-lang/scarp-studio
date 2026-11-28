import {useMemo,useRef,useState} from 'react';
import type {ProjectSearchSource} from '../model/projectSearch';
import {describeAnalysisCandidates,prepareAnalysisOpen,MAX_ANALYSIS_OPEN_FILES,MAX_ANALYSIS_OPEN_TOTAL_BYTES,
  type AnalysisSourceCandidate,type AnalysisOpenEditor,type AnalysisOpenPlan,type AnalysisOpenControl,
  type AnalysisOpenOutcome,type AnalysisOpenProgress,type CandidateState} from '../model/analysisSourceOpen';

const PAGE=12;
const STATE_LABELS:Readonly<Record<CandidateState,string>>=Object.freeze({
  available:'Available to open',open:'Already open',missing:'No longer listed',ambiguous:'Ambiguous source',
});
export interface AnalysisSourceOpenContext{
  readonly editor:AnalysisOpenEditor;
  readonly listed:readonly ProjectSearchSource[];
  readonly onOpen:(plan:AnalysisOpenPlan,candidates:readonly AnalysisSourceCandidate[],control:AnalysisOpenControl)=>Promise<AnalysisOpenOutcome>;
}
export function AnalysisSourceOpenPanel({candidates,context,busy}:{
  candidates:readonly AnalysisSourceCandidate[];context:AnalysisSourceOpenContext;busy:boolean;
}){
  const [expanded,setExpanded]=useState(false);
  const [selected,setSelected]=useState<readonly string[]>([]);
  const [activeLabel,setActiveLabel]=useState<string|null>(null);
  const [query,setQuery]=useState('');
  const [state,setState]=useState<CandidateState|'all'>('all');
  const [page,setPage]=useState(1);
  const [review,setReview]=useState<AnalysisOpenPlan|null>(null);
  const [running,setRunning]=useState(false);
  const [progress,setProgress]=useState<AnalysisOpenProgress|null>(null);
  const [cancelRequested,setCancelRequested]=useState(false);
  const [notice,setNotice]=useState('');
  const [failed,setFailed]=useState(false);
  const token=useRef<{cancelled:boolean}|null>(null);
  const rows=useMemo(()=>expanded?describeAnalysisCandidates(candidates,context.listed,context.editor.documents):[],
    [expanded,candidates,context.listed,context.editor.documents]);
  const matches=rows.filter(row=>(state==='all'||row.state===state)&&row.name.toLowerCase().includes(query.toLowerCase()));
  const pages=Math.max(1,Math.ceil(matches.length/PAGE));
  const current=Math.min(page,pages);
  const visible=matches.slice((current-1)*PAGE,current*PAGE);
  const blocked=busy||running;
  const stale=review!==null&&(review.editorRevision!==context.editor.sessionRevision||
    review.editorActiveId!==context.editor.activeId);
  function select(next:readonly string[]){
    setSelected(next);setReview(null);setNotice('');setFailed(false);
    if(activeLabel!==null&&!next.includes(activeLabel))setActiveLabel(null);
  }
  function toggle(name:string){
    if(blocked)return;
    if(selected.includes(name))select(selected.filter(item=>item!==name));
    else if(selected.length<MAX_ANALYSIS_OPEN_FILES)select([...selected,name]);
  }
  function preview(){
    if(blocked)return;
    const result=prepareAnalysisOpen(candidates,selected,activeLabel,context.listed,context.editor);
    if(!result.ok){setReview(null);setNotice(result.error);setFailed(true);return;}
    setReview(result.value);setNotice('');setFailed(false);
  }
  async function run(){
    if(blocked||!review||stale||token.current)return;
    const active={cancelled:false};token.current=active;
    const plan=review;
    setRunning(true);setReview(null);setNotice('');setFailed(false);setCancelRequested(false);setProgress(null);
    try{
      const result=await context.onOpen(plan,candidates,{
        isCurrent:()=>token.current===active,isCancelled:()=>active.cancelled,
        onProgress:value=>{if(token.current===active)setProgress(value);},
      });
      if(result.ok){
        setNotice('Opened '+result.opened+' new source(s); preserved '+result.reused+' existing tab(s).');
        setSelected([]);setActiveLabel(null);
      }else{setNotice(result.error);setFailed(true);}
    }catch{setNotice('The reviewed open operation did not complete. Review the source listing again.');setFailed(true);}
    finally{token.current=null;setRunning(false);setProgress(null);setCancelRequested(false);}
  }
  return <section aria-label="Open observed source files" className="project-scope-coverage">
    <button type="button" aria-expanded={expanded} disabled={running} onClick={()=>{
      setExpanded(!expanded);if(expanded){setReview(null);setNotice('');setFailed(false);}
    }}>{expanded?'Hide observed source opener':'Review opening observed source files'}</button>
    {expanded&&<>
      <p>Open up to {MAX_ANALYSIS_OPEN_FILES} source labels with retained observations. This opens current files,
        not historical match locations. Existing tabs, including dirty tabs, are reused without reading or overwriting them.</p>
      <p>{candidates.length} observed labels · {selected.length} selected · up to {MAX_ANALYSIS_OPEN_TOTAL_BYTES/1024/1024} MiB of new reads.</p>
      <label>Find source<input aria-label="Filter observed source open labels" maxLength={120} value={query}
        onChange={event=>{setQuery(event.target.value);setPage(1);}}/></label>
      <label>Current state<select aria-label="Observed source open state" value={state} onChange={event=>{
        const value=event.target.value as CandidateState|'all';
        if(value==='all'||Object.hasOwn(STATE_LABELS,value)){setState(value);setPage(1);}
      }}><option value="all">All states</option>{(Object.keys(STATE_LABELS) as CandidateState[]).map(value=>
        <option key={value} value={value}>{STATE_LABELS[value]}</option>)}</select></label>
      <div className="project-scope-inventory"><ul>{visible.map(row=>{
        const checked=selected.includes(row.name);
        return <li key={row.name}><label>
          <input type="checkbox" checked={checked} disabled={blocked||(!checked&&(selected.length>=MAX_ANALYSIS_OPEN_FILES||
            row.state==='missing'||row.state==='ambiguous'))} onChange={()=>toggle(row.name)}/>
          <code dir="auto">{row.name}</code>
        </label><p>{row.occurrences} retained sites · {STATE_LABELS[row.state]}{row.modified?' · modified tab preserved':''}</p></li>;
      })}</ul></div>
      {!visible.length&&<p>No source labels match the filters.</p>}
      <button type="button" disabled={current===1} onClick={()=>setPage(current-1)}>Previous source selection page</button>
      <span>Page {current} of {pages}</span>
      <button type="button" disabled={current===pages} onClick={()=>setPage(current+1)}>Next source selection page</button>
      <button type="button" disabled={blocked||!visible.some(row=>row.state==='open'||row.state==='available')}
        onClick={()=>select([...new Set([...selected,...visible.filter(row=>row.state==='open'||row.state==='available')
          .map(row=>row.name)])].slice(0,MAX_ANALYSIS_OPEN_FILES))}>Select available labels on this page</button>
      <button type="button" disabled={blocked||!selected.length} onClick={()=>select([])}>Clear selected source labels</button>
      <label>Active source after opening<select aria-label="Active observed source after opening" value={activeLabel??''}
        disabled={blocked} onChange={event=>{setActiveLabel(event.target.value||null);setReview(null);}}>
        <option value="">Keep current active tab</option>{selected.map(name=><option key={name} value={name}>{name}</option>)}
      </select></label>
      <button type="button" disabled={blocked||!selected.length} onClick={preview}>Review selected source open</button>
      {review&&<section aria-label="Confirm opening observed sources">
        <p>{review.newCount} new reads · {review.existingCount} existing tabs reused.</p>
        <p>{review.activeLabel?'Activate '+review.activeLabel+' after opening.':'Preserve the current active tab.'}</p>
        <ul>{review.rows.map(row=><li key={row.name}>
          <code>{row.name}</code> · {row.kind==='open'?'Reuse existing tab':'Read current disk source'}
          {row.modified?' · preserve unsaved changes':''}
        </li>)}</ul>
        <p>No source writes. All new reads must succeed before publishing one editor transition.</p>
        {stale&&<p role="alert">Editor changed since review. Review the selected files again.</p>}
        <button type="button" disabled={blocked||stale} onClick={()=>void run()}>Confirm opening observed sources</button>
        <button type="button" onClick={()=>setReview(null)}>Cancel observed source review</button>
      </section>}
      {running&&<div role="status">
        <p>{progress?progress.completed+' / '+progress.total+' new reads staged':'Preparing source reads'}</p>
        <button type="button" disabled={cancelRequested} onClick={()=>{if(token.current)token.current.cancelled=true;setCancelRequested(true);}}>
          {cancelRequested?'Source open cancellation requested':'Cancel opening observed sources'}
        </button>
      </div>}
      {notice&&<p role={failed?'alert':'status'}>{notice}</p>}
    </>}
  </section>;
}
