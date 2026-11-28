import {useMemo,useRef,useState} from 'react';
import type {EditorState} from '../model/editorState';
import type {ProjectSearchSource} from '../model/projectSearch';
import {DEFAULT_PROJECT_SEARCH_SCOPE,type ProjectSearchScope} from '../model/projectSearchScope';
import type {InspectionControl,InspectionProgress} from '../model/projectInspection';
import {ProjectSearchScopeControls} from './ProjectSearchScopeControls';
import {
  DEFAULT_LITERAL_REPLACE,LITERAL_DOMAINS,LITERAL_DOMAIN_LABELS,LITERAL_REGION_LABELS,
  MAX_LITERAL_REPLACEMENT_UNITS,MAX_LITERAL_REPLACEMENT_SITES,type LiteralReplaceSettings,type LiteralReplaceSite,
} from '../model/literalSourceReplacement';
import {
  prepareProjectLiteralReplacement,planProjectLiteralReplacement,literalInventoryIsCurrent,
  filterLiteralSites,pageLiteralSites,summarizeLiteralInventory,literalInventoryReport,DEFAULT_LITERAL_SELECTION_FILTER,
  type ProjectLiteralReview,type ProjectLiteralInventory,type ProjectLiteralPlan,type LiteralScanExecution,
  type LiteralReplaceOutcome,type LiteralSelectionFilter,
} from '../model/projectLiteralReplacement';

interface Props{
  listed:readonly ProjectSearchSource[];listingLimited:boolean;available:boolean;busy:boolean;editor:EditorState;
  onScan:(review:ProjectLiteralReview,scope:ProjectSearchScope,settings:LiteralReplaceSettings,control:InspectionControl)=>Promise<LiteralScanExecution>;
  onApply:(plan:ProjectLiteralPlan,control:InspectionControl)=>Promise<LiteralReplaceOutcome>;
  undoAvailable:boolean;onUndo:()=>void;
}
function SettingsSummary({settings}:{settings:LiteralReplaceSettings}){
  return <div>
    <p>Literal query: <code dir="auto">{settings.query}</code></p>
    <p>Replacement: {settings.replacement?<code dir="auto">{settings.replacement}</code>:<strong>Delete matched text</strong>}</p>
    <p>{LITERAL_DOMAIN_LABELS[settings.domain]} · {settings.caseSensitive?'Match case':'Ignore case'} ·
      {' '}{settings.wholeWord?'Whole word':'Substring'}</p>
  </div>;
}
function SitePreview({site,replacement}:{site:LiteralReplaceSite;replacement:string}){
  return <div className="migration-token-preview">
    <p>Before: <code dir="auto">{site.clippedBefore?'…':''}{site.prefix}<mark>{site.original}</mark>{site.suffix}{site.clippedAfter?'…':''}</code></p>
    <p>After: <code dir="auto">{site.clippedBefore?'…':''}{site.prefix}<mark>{replacement||'∅'}</mark>{site.suffix}{site.clippedAfter?'…':''}</code></p>
  </div>;
}
function LiteralSelection({inventory,editor,busy,onApply,onDismiss}:{
  inventory:ProjectLiteralInventory;editor:EditorState;busy:boolean;
  onApply:(plan:ProjectLiteralPlan)=>void;onDismiss:()=>void;
}){
  const [selected,setSelected]=useState<readonly string[]>([]);
  const [filter,setFilter]=useState<LiteralSelectionFilter>(DEFAULT_LITERAL_SELECTION_FILTER);
  const [page,setPage]=useState(1);
  const [showPreview,setShowPreview]=useState<string|null>(null);
  const [acknowledged,setAcknowledged]=useState(false);
  const [plan,setPlan]=useState<ProjectLiteralPlan|null>(null);
  const [notice,setNotice]=useState('');
  const [report,setReport]=useState(false);
  const [labels,setLabels]=useState(false);
  const [values,setValues]=useState(false);
  const current=literalInventoryIsCurrent(inventory,editor);
  const blocked=busy||!current;
  const summary=useMemo(()=>summarizeLiteralInventory(inventory,selected),[inventory,selected]);
  const rows=useMemo(()=>filterLiteralSites(inventory,filter,selected),[inventory,filter,selected]);
  const visible=pageLiteralSites(rows,page);
  const output=useMemo(()=>report?literalInventoryReport(inventory,selected,labels,values):'',
    [report,inventory,selected,labels,values]);
  const ids=new Set(selected);
  const settings=inventory.review.settings;
  function select(next:readonly string[]){setSelected(next);setPlan(null);setNotice('');}
  function update(patch:Partial<LiteralSelectionFilter>){setFilter(old=>({...old,...patch}));setPage(1);setShowPreview(null);}
  function preview(){
    if(blocked)return;
    const result=planProjectLiteralReplacement(inventory,selected,editor,acknowledged);
    if(!result.ok){setNotice(result.error);setPlan(null);return;}
    setPlan(result.value);setNotice('');
  }
  return <section aria-label="Project literal replacement results" className="project-scope-coverage">
    <p role="status"><strong>Complete scan of selected source snapshots</strong></p>
    {!current&&<p role="alert">Editor changed. Discard this private review and scan again.</p>}
    <SettingsSummary settings={settings}/>
    <dl className="project-scope-stats">
      <div><dt>Scanned sources</dt><dd>{summary.sources}</dd></div>
      <div><dt>Literal candidates</dt><dd>{summary.candidates}</dd></div>
      <div><dt>Retained sites</dt><dd>{summary.sites}</dd></div>
      <div><dt>Excluded candidates</dt><dd>{summary.excluded}</dd></div>
      <div><dt>Already equal to replacement</dt><dd>{summary.unchanged}</dd></div>
      <div><dt>Selected sites</dt><dd>{summary.selected}</dd></div>
      <div><dt>Selected sources</dt><dd>{summary.selectedSources}</dd></div>
    </dl>
    <p>Selection is explicit. A lexical match is not necessarily a Scarp identifier or a valid refactoring.</p>
    <label>Source<select aria-label="Literal replacement source filter" value={filter.source}
      onChange={event=>update({source:event.target.value})}>
      <option value="">All scanned labels</option>
      {inventory.observations.map(file=><option key={file.source} value={file.source}>{file.source} · {file.sites} sites</option>)}
    </select></label>
    <label>Region<select aria-label="Literal replacement region filter" value={filter.region}
      onChange={event=>{const value=event.target.value;if(value==='all'||Object.hasOwn(LITERAL_REGION_LABELS,value))
        update({region:value as LiteralSelectionFilter['region']});}}>
      <option value="all">All retained regions</option>
      {Object.entries(LITERAL_REGION_LABELS).map(([region,label])=><option key={region} value={region}>{label}</option>)}
    </select></label>
    <label><input type="checkbox" checked={filter.selectedOnly} onChange={event=>update({selectedOnly:event.target.checked})}/>Show selected literal sites only</label>
    <button type="button" onClick={()=>{setFilter(DEFAULT_LITERAL_SELECTION_FILTER);setPage(1);setShowPreview(null);}}>Reset literal filters</button>
    <p>{rows.length} matching sites · Page {visible.page} of {visible.pages}</p>
    <div className="project-scope-inventory"><ul>{visible.rows.map(site=><li key={site.id}>
      <label><input type="checkbox" checked={ids.has(site.id)} disabled={blocked}
        onChange={()=>select(ids.has(site.id)?selected.filter(id=>id!==site.id):[...selected,site.id])}/>
        <code dir="auto">{site.source}:{site.line}:{site.column}</code></label>
      <p>{LITERAL_REGION_LABELS[site.region]}</p>
      <button type="button" aria-expanded={showPreview===site.id}
        onClick={()=>setShowPreview(showPreview===site.id?null:site.id)}>{showPreview===site.id?'Hide':'Review'} literal preview at line {site.line}, column {site.column}</button>
      {showPreview===site.id&&<SitePreview site={site} replacement={settings.replacement}/>}
    </li>)}
      {!rows.length&&<li>No matching replacement sites.</li>}
    </ul></div>
    <button type="button" disabled={visible.page===1} onClick={()=>{setPage(visible.page-1);setShowPreview(null);}}>Previous literal site page</button>
    <button type="button" disabled={visible.page===visible.pages} onClick={()=>{setPage(visible.page+1);setShowPreview(null);}}>Next literal site page</button>
    <button type="button" disabled={blocked||!visible.rows.length}
      onClick={()=>select([...new Set([...selected,...visible.rows.map(site=>site.id)])])}>Select visible literal sites</button>
    <button type="button" disabled={blocked||!selected.length} onClick={()=>select([])}>Clear literal selection</button>
    {settings.domain==='all'&&<label><input type="checkbox" checked={acknowledged} disabled={blocked}
      onChange={event=>{setAcknowledged(event.target.checked);setPlan(null);}}/>I reviewed possible changes to code, comments and string boundaries</label>}
    <button type="button" disabled={blocked||!selected.length||(settings.domain==='all'&&!acknowledged)}
      onClick={preview}>Review selected literal replacements</button>
    {notice&&<p role="alert">{notice}</p>}
    {plan&&<section aria-label="Confirm project literal replacement">
      <p>{plan.replacements} replacements in {plan.staged.changes.length} sources · {plan.staged.newTabs} newly opened unsaved buffers ·
        {' '}{plan.staged.dirtyTabs} previously modified buffers.</p>
      <ul>{plan.staged.changes.map(change=><li key={change.source}><code dir="auto">{change.source}</code> ·
        {' '}{change.document?'Working buffer':'Disk snapshot'}</li>)}</ul>
      <p>Every reviewed closed disk snapshot is read again before staging. No file is written. Edited buffers are held for explicit save.
        Restricted domains must preserve the expected comment and string layout; this does not replace a compiler check.</p>
      <button type="button" disabled={blocked} onClick={()=>onApply(plan)}>Confirm stage literal replacements</button>
      <button type="button" disabled={busy} onClick={()=>setPlan(null)}>Cancel literal apply review</button>
    </section>}
    <button type="button" aria-expanded={report} onClick={()=>{setReport(!report);setLabels(false);setValues(false);}}>
      {report?'Hide literal inventory report':'Review literal inventory report'}
    </button>
    {report&&<>
      <label><input type="checkbox" checked={labels} onChange={event=>setLabels(event.target.checked)}/>Include relative literal source labels</label>
      <label><input type="checkbox" checked={values} onChange={event=>setValues(event.target.checked)}/>Include private query and replacement text</label>
      <textarea aria-label="Literal replacement inventory report" value={output} readOnly rows={9}/>
    </>}
    <button type="button" disabled={busy} onClick={onDismiss}>Discard literal replacement review</button>
  </section>;
}
export function ProjectLiteralReplacementPanel({listed,listingLimited,available,busy,editor,onScan,onApply,undoAvailable,onUndo}:Props){
  const [expanded,setExpanded]=useState(false);
  const [scope,setScope]=useState<ProjectSearchScope>(DEFAULT_PROJECT_SEARCH_SCOPE);
  const [settings,setSettings]=useState<LiteralReplaceSettings>(DEFAULT_LITERAL_REPLACE);
  const [review,setReview]=useState<ProjectLiteralReview|null>(null);
  const [inventory,setInventory]=useState<ProjectLiteralInventory|null>(null);
  const [phase,setPhase]=useState<'scan'|'apply'|null>(null);
  const [progress,setProgress]=useState<InspectionProgress|null>(null);
  const [cancelRequested,setCancelRequested]=useState(false);
  const [notice,setNotice]=useState('');
  const [failed,setFailed]=useState(false);
  const active=useRef<{cancelled:boolean}|null>(null);
  const blocked=busy||phase!==null||!available;
  function reset(){setReview(null);setInventory(null);setNotice('');setFailed(false);}
  function update(patch:Partial<LiteralReplaceSettings>){setSettings(old=>({...old,...patch}));reset();}
  function preview(){
    if(blocked)return;
    const result=prepareProjectLiteralReplacement(listed,scope,listingLimited,settings);
    setInventory(null);setFailed(!result.ok);
    if(result.ok){setReview(result.value);setNotice('');}
    else{setReview(null);setNotice(result.error);}
  }
  function begin(next:'scan'|'apply'):InspectionControl{
    const token={cancelled:false};active.current=token;
    setPhase(next);setProgress(null);setCancelRequested(false);setNotice('');setFailed(false);
    return {isCurrent:()=>active.current===token,isCancelled:()=>token.cancelled,
      onProgress:value=>{if(active.current===token)setProgress(value);}};
  }
  function finish(){active.current=null;setPhase(null);setProgress(null);setCancelRequested(false);}
  async function scan(){
    if(blocked||!review||active.current)return;
    const confirmed=review,control=begin('scan');setReview(null);
    try{
      const result=await onScan(confirmed,scope,settings,control);
      if(result.kind==='ready')setInventory(result.value);
      else{setFailed(true);setNotice(result.kind==='failed'?result.error:'Literal scan '+result.kind+'. Nothing changed.');}
    }catch{setFailed(true);setNotice('Literal scan failed. Nothing changed.');}
    finally{finish();}
  }
  async function apply(plan:ProjectLiteralPlan){
    if(blocked||!inventory||plan.inventory!==inventory||active.current)return;
    const control=begin('apply');
    try{
      const result=await onApply(plan,control);setInventory(null);setFailed(!result.ok);
      setNotice(result.ok?'Staged '+result.replacements+' literal replacements in '+result.files+' unsaved sources.':result.error);
    }catch{setInventory(null);setFailed(true);setNotice('Literal apply failed. Scan again.');}
    finally{finish();}
  }
  return <section className="sidebar-section" aria-label="Project literal replacement">
    <div className="sidebar-heading">PROJECT LITERAL REPLACEMENT</div>
    <button type="button" className="insights-toggle" aria-expanded={expanded} disabled={phase!==null}
      onClick={()=>{setExpanded(!expanded);if(expanded)reset();}}>{expanded?'Hide project literal replacement':'Review project literal replacement'}</button>
    {expanded&&<>
      <p>Stage up to {MAX_LITERAL_REPLACEMENT_SITES} reviewed single-line literal substitutions across listed sources.
        No automatic save. Regex syntax and replacement capture expressions are not evaluated.</p>
      {!available&&<p>Choose a workspace folder in the desktop application.</p>}
      <label>Query<input aria-label="Project literal query" maxLength={120} value={settings.query}
        disabled={blocked} onChange={event=>update({query:event.target.value})}/></label>
      <label>Replacement<input aria-label="Project literal replacement text" maxLength={MAX_LITERAL_REPLACEMENT_UNITS}
        value={settings.replacement} disabled={blocked} onChange={event=>update({replacement:event.target.value})}/></label>
      <label><input type="checkbox" checked={settings.caseSensitive} disabled={blocked}
        onChange={event=>update({caseSensitive:event.target.checked})}/>Match literal case</label>
      <label><input type="checkbox" checked={settings.wholeWord} disabled={blocked}
        onChange={event=>update({wholeWord:event.target.checked})}/>Match whole literal word</label>
      <label>Source region<select aria-label="Project literal region" value={settings.domain} disabled={blocked}
        onChange={event=>{const value=event.target.value;if(LITERAL_DOMAINS.includes(value as typeof LITERAL_DOMAINS[number]))
          update({domain:value as LiteralReplaceSettings['domain']});}}>
        {LITERAL_DOMAINS.map(domain=><option key={domain} value={domain}>{LITERAL_DOMAIN_LABELS[domain]}</option>)}
      </select></label>
      <ProjectSearchScopeControls listed={listed} scope={scope} busy={blocked} onChange={next=>{setScope(next);reset();}}/>
      <button type="button" disabled={blocked} onClick={preview}>Review literal source scan</button>
      {review&&<section aria-label="Review project literal scan" className="project-scope-coverage">
        <p>{review.sources.selected} selected of {review.sources.listed} listed sources · {review.sources.excluded} excluded ·
          {' '}{review.sources.deferred} outside this batch.</p>
        <SettingsSummary settings={review.settings}/>
        <p>Read complete selected snapshots. Existing working buffers take precedence. No files change during scan.</p>
        <button type="button" disabled={blocked} onClick={()=>void scan()}>Confirm literal source scan</button>
        <button type="button" onClick={()=>setReview(null)}>Cancel literal scan review</button>
      </section>}
      {inventory&&<LiteralSelection inventory={inventory} editor={editor} busy={blocked} onApply={plan=>void apply(plan)} onDismiss={()=>setInventory(null)}/>}
      {phase&&<div role="status"><p>{phase==='scan'?'Reading reviewed snapshots':'Rechecking reviewed disk sources'} ·
        {' '}{progress?progress.observed+' / '+progress.total:'Preparing'}</p>
        <button type="button" disabled={cancelRequested} onClick={()=>{if(active.current)active.current.cancelled=true;setCancelRequested(true);}}>
          {cancelRequested?'Literal cancellation requested':'Cancel literal replacement operation'}
        </button>
      </div>}
      {notice&&<p role={failed?'alert':'status'}>{notice}</p>}
      <button type="button" disabled={blocked||!undoAvailable} onClick={()=>{onUndo();reset();}}>Undo last staged literal replacement</button>
    </>}
  </section>;
}
