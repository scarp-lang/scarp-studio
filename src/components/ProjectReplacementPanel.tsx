import { useState } from 'react';
import type { EditorState } from '../model/editorState';
import type { SearchOptions } from '../model/openFileSearch';
import type { ProjectSearchResult } from '../model/projectSearch';
import {
  PROJECT_REPLACEMENT_PAGE,MAX_PROJECT_REPLACEMENT_HITS,MAX_PROJECT_REPLACEMENT_FILES,replacementTextError,
  visibleProjectReplacementText,
  type ReplacementRequest,type ReplacementResult,type ProjectReplacementPlan,
} from '../model/projectReplacement';
interface Props{
  result:ProjectSearchResult;
  query:string;
  options:SearchOptions;
  editor:EditorState;
  busy:boolean;
  onStage:(result:ProjectSearchResult,request:ReplacementRequest)=>Promise<ReplacementResult<ProjectReplacementPlan>>;
  onApply:(plan:ProjectReplacementPlan)=>boolean;
}
export function ProjectReplacementPanel({result,query,options,editor,busy,onStage,onApply}:Props){
  const [expanded,setExpanded]=useState(false);
  const [replacement,setReplacement]=useState('');
  const [selected,setSelected]=useState<readonly number[]>([]);
  const [page,setPage]=useState(1);
  const [filter,setFilter]=useState('');
  const [plan,setPlan]=useState<ProjectReplacementPlan|null>(null);
  const [pending,setPending]=useState(false);
  const [ack,setAck]=useState(false);
  const [notice,setNotice]=useState('');
  const rows=result.hits.map((hit,index)=>({hit,index})).filter(row=>row.hit.name.toLowerCase().includes(filter.trim().toLowerCase()));
  const pages=Math.max(1,Math.ceil(rows.length/PROJECT_REPLACEMENT_PAGE)),shownPage=Math.min(page,pages);
  const stale=!!plan&&plan.sessionRevision!==editor.sessionRevision;
  const blocked=busy||pending;
  const validation=replacementTextError(query,replacement);
  function resetReview(){setPlan(null);setAck(false);setNotice('');}
  function toggle(id:number,checked:boolean){
    resetReview();
    setSelected(previous=>checked?[...previous,id]:previous.filter(value=>value!==id));
  }
  async function stage(){
    setNotice('');setPending(true);
    try{
      const resultValue=await onStage(result,{query,replacement,options,selected});
      if(resultValue.ok){setPlan(resultValue.value);setAck(false);}
      else setNotice(resultValue.error);
    }catch(error){setNotice(error instanceof Error?error.message:'Staging failed.');}
    finally{setPending(false);}
  }
  return <section className="project-replacement-panel" aria-label="Reviewed workspace search replacements">
    <button type="button" aria-expanded={expanded} disabled={pending} onClick={()=>{setExpanded(v=>!v);resetReview();}}>
      {expanded?'Hide reviewed replacement':'Review selected workspace replacements'}
    </button>
    {expanded&&<>
      <p>Literal text replacement, not semantic rename. Selected matches may occur in comments or strings.
        Stage selected unopened files as clean tabs, then review and apply only to editor memory.
        No automatic disk writes. Save independently after reviewing the result.</p>
      {result.truncated&&<p role="status">Search coverage is incomplete. Only displayed, individually selected occurrences can be replaced. This is not Replace All.</p>}
      <label>Replacement text<input aria-label="Workspace replacement text" maxLength={256} value={replacement}
        disabled={blocked||!!plan} onChange={event=>{setReplacement(event.target.value);resetReview();}}/></label>
      <label>Filter files<input type="search" aria-label="Filter workspace replacement files" maxLength={120} value={filter}
        disabled={blocked||!!plan} onChange={event=>{setFilter(event.target.value);setPage(1);}}/></label>
      <p role="status">{selected.length} selected of {result.hits.length} displayed matches. Maximum {MAX_PROJECT_REPLACEMENT_HITS} sites in {MAX_PROJECT_REPLACEMENT_FILES} files.</p>
      <div className="identifier-actions">
        <button type="button" disabled={blocked||!!plan||rows.length===0||rows.length>MAX_PROJECT_REPLACEMENT_HITS} onClick={()=>{
          setSelected(rows.map(row=>row.index));resetReview();
        }}>Select filtered displayed sites</button>
        <button type="button" disabled={blocked||!!plan||!selected.length} onClick={()=>{setSelected([]);resetReview();}}>Clear selected sites</button>
      </div>
      <div className="identifier-site-list">{rows.slice((shownPage-1)*PROJECT_REPLACEMENT_PAGE,shownPage*PROJECT_REPLACEMENT_PAGE).map(({hit,index})=>
        <label key={index} className="identifier-site">
          <span><input type="checkbox" checked={selected.includes(index)} disabled={blocked||!!plan||(!selected.includes(index)&&selected.length>=MAX_PROJECT_REPLACEMENT_HITS)}
            onChange={event=>toggle(index,event.target.checked)}/>{hit.name}:{hit.match.line}:{hit.match.column}{hit.fromOpenTab?' · open at search':' · disk at search'}</span>
          <code>{visibleProjectReplacementText(hit.match.preview)}</code>
        </label>)}</div>
      {pages>1&&<div className="insights-pages"><button type="button" disabled={shownPage===1} onClick={()=>setPage(shownPage-1)}>Previous occurrences</button>
        <span>{shownPage}/{pages}</span><button type="button" disabled={shownPage===pages} onClick={()=>setPage(shownPage+1)}>Next occurrences</button></div>}
      <button type="button" disabled={blocked||!!plan||!!validation||!selected.length} onClick={()=>void stage()}>Stage selected files and preview</button>
      {validation&&<p>{validation}</p>}
      {pending&&<p role="status">Checking selected source snapshots…</p>}
      {plan&&<div className="transfer-review" role="group" aria-label="Confirm workspace replacements">
        <p>{plan.inventory.occurrences.length} exact occurrence(s) in {plan.changes.length} staged/open buffer(s).
          Newly opened tabs remain open if you cancel. No file has been written.</p>
        {stale&&<p role="alert">Editor session changed. Cancel this preview and search again.</p>}
        <div className="project-replacement-preview">{plan.inventory.occurrences.map(site=><div key={site.index} className="identifier-site">
          <strong>{site.hit.name}:{site.hit.match.line}:{site.hit.match.column}</strong>
          <code>Before: {site.before}</code><code>After: {site.after}</code>
        </div>)}</div>
        <label><input type="checkbox" checked={ack} onChange={event=>setAck(event.target.checked)} disabled={blocked||stale}/>
          I reviewed these selected text changes, including possible comments and strings.</label>
        <button type="button" disabled={blocked||stale||!ack} onClick={()=>{
          const success=onApply(plan);resetReview();setNotice(success?'Applied selected replacements in memory.':'Replacement was rejected. Search again.');
        }}>Confirm workspace replacements</button>
        <button type="button" onClick={resetReview}>Cancel workspace replacement preview</button>
      </div>}
      {notice&&<p role="status">{notice}</p>}
    </>}
  </section>;
}
