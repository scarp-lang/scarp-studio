import {useMemo,useRef,useState} from 'react';
import {ProjectSearchScopeControls} from './ProjectSearchScopeControls';
import {DEFAULT_PROJECT_SEARCH_SCOPE,type ProjectSearchScope} from '../model/projectSearchScope';
import type {EditorState} from '../model/editorState';
import type {ProjectSearchSource} from '../model/projectSearch';
import type {InspectionControl,InspectionProgress} from '../model/projectInspection';
import {DEFAULT_WHITESPACE_OPTIONS,WHITESPACE_KINDS,WHITESPACE_LABELS,visibleWhitespace,MAX_WHITESPACE_EDITS,
  type WhitespaceOptions} from '../model/sourceWhitespace';
import {prepareProjectWhitespace,planProjectWhitespace,whitespaceInventoryIsCurrent,summarizeProjectWhitespace,
  filterWhitespaceFiles,pageWhitespace,projectWhitespaceReport,DEFAULT_WHITESPACE_FILTER,
  type ProjectWhitespaceReview,type ProjectWhitespaceInventory,type ProjectWhitespacePlan,type WhitespaceScanExecution,
  type WhitespaceFilter,type WhitespaceApplyOutcome} from '../model/projectWhitespace';

interface Props{
  editor:EditorState;
  listed:readonly ProjectSearchSource[];
  listingLimited:boolean;
  available:boolean;
  busy:boolean;
  onScan:(review:ProjectWhitespaceReview,scope:ProjectSearchScope,options:WhitespaceOptions,control:InspectionControl)=>Promise<WhitespaceScanExecution>;
  onApply:(plan:ProjectWhitespacePlan,control:InspectionControl)=>Promise<WhitespaceApplyOutcome>;
  undoAvailable:boolean;
  onUndo:()=>void;
}
function OptionSummary({options}:{options:WhitespaceOptions}){
  return <ul>
    <li>Trailing spaces and tabs: {options.trimTrailing?'trim':'preserve'}</li>
    <li>Leading indentation: {options.indentation}{options.indentation!=='preserve'?' · tab stops '+options.tabWidth:''}</li>
    <li>Line endings: {options.endings==='preserve'?'preserve':options.endings.toUpperCase()} outside literals</li>
    <li>Missing final newline: {options.finalNewline?'add where supported':'preserve'}</li>
  </ul>;
}
function Selection({inventory,editor,busy,onApply,onDismiss}:{
  inventory:ProjectWhitespaceInventory;editor:EditorState;busy:boolean;
  onApply:(plan:ProjectWhitespacePlan)=>void;onDismiss:()=>void;
}){
  const [selected,setSelected]=useState<readonly string[]>([]);
  const [filter,setFilter]=useState(DEFAULT_WHITESPACE_FILTER);
  const [page,setPage]=useState(1);
  const [detail,setDetail]=useState<string|null>(null);
  const [editPage,setEditPage]=useState(1);
  const [plan,setPlan]=useState<ProjectWhitespacePlan|null>(null);
  const [notice,setNotice]=useState('');
  const [showReport,setShowReport]=useState(false);
  const [labels,setLabels]=useState(false);
  const current=whitespaceInventoryIsCurrent(inventory,editor),blocked=busy||!current;
  const summary=useMemo(()=>summarizeProjectWhitespace(inventory,selected),[inventory,selected]);
  const files=useMemo(()=>filterWhitespaceFiles(inventory,filter,selected),[inventory,filter,selected]);
  const visible=pageWhitespace(files,page);
  const chosen=inventory.files.find(file=>file.source===detail);
  const detailEdits=pageWhitespace(chosen?.result.edits??[],editPage);
  const output=useMemo(()=>showReport?projectWhitespaceReport(inventory,selected,labels):'',[inventory,selected,labels,showReport]);
  function select(next:readonly string[]){setSelected(next);setPlan(null);setNotice('');}
  function toggle(name:string){if(!blocked)select(selected.includes(name)?selected.filter(item=>item!==name):[...selected,name]);}
  function update(patch:Partial<WhitespaceFilter>){setFilter(old=>({...old,...patch}));setPage(1);}
  function preview(){
    if(blocked)return;
    const result=planProjectWhitespace(inventory,selected,editor);
    if(!result.ok){setNotice(result.error);setPlan(null);return;}
    setPlan(result.value);setNotice('');
  }
  return <section aria-label="Project whitespace review results" className="project-scope-coverage">
    <p role="status"><strong>Complete scan of selected source snapshots</strong></p>
    {!current&&<p role="alert">Editor changed. Discard this private review and scan again.</p>}
    <dl className="project-scope-stats">
      <div><dt>Reviewed sources</dt><dd>{summary.sources}</dd></div>
      <div><dt>Changed sources</dt><dd>{summary.changed}</dd></div>
      <div><dt>Selected sources</dt><dd>{summary.selected}</dd></div>
      <div><dt>Proposed edits</dt><dd>{summary.edits}</dd></div>
      <div><dt>Selected edits</dt><dd>{summary.selectedEdits}</dd></div>
      {WHITESPACE_KINDS.map(kind=><div key={kind}><dt>{WHITESPACE_LABELS[kind]}</dt><dd>{summary.counts[kind]}</dd></div>)}
    </dl>
    <p>Protected literal whitespace: {summary.protectedTrailing} trailing ranges, {summary.protectedIndentation} indentation ranges,
      {' '}{summary.protectedEndings} line endings. Mixed-convention final newline withheld in {summary.mixedFinalNewlines} files.</p>
    <p>All code and string token slices must remain unchanged according to the bounded editor lexer.
      Compiler-level formatting equivalence is not established. Review source before saving.</p>
    <label>Filter source labels<input type="search" aria-label="Whitespace source filter" maxLength={120}
      value={filter.query} onChange={event=>update({query:event.target.value})}/></label>
    <label>File state<select aria-label="Whitespace file state" value={filter.state} onChange={event=>{
      const value=event.target.value;if(value==='all'||value==='changed'||value==='unchanged'||value==='protected')update({state:value});
    }}><option value="all">All observed sources</option><option value="changed">Proposed changes</option>
      <option value="unchanged">No changes proposed</option><option value="protected">Protected literal/convention ranges</option></select></label>
    <label><input type="checkbox" checked={filter.selectedOnly} onChange={event=>update({selectedOnly:event.target.checked})}/>
      Show selected whitespace sources only</label>
    <button type="button" onClick={()=>{setFilter(DEFAULT_WHITESPACE_FILTER);setPage(1);}}>Reset whitespace filters</button>
    <p>{files.length} matching sources · Page {visible.page} of {visible.pages}</p>
    <div className="project-scope-inventory"><ul>{visible.rows.map(file=><li key={file.source}>
      <label><input type="checkbox" checked={selected.includes(file.source)} disabled={blocked||!file.result.edits.length}
        onChange={()=>toggle(file.source)}/><code dir="auto">{file.source}</code></label>
      <p>{file.result.edits.length} edits · {file.origin==='open-buffer'?'Working buffer':'Disk snapshot'}</p>
      <p>{file.result.bytesBefore} → {file.result.bytesAfter} UTF-8 bytes</p>
      <button type="button" onClick={()=>{setDetail(detail===file.source?null:file.source);setEditPage(1);}}
        aria-expanded={detail===file.source}>Review whitespace edits for {file.source}</button>
    </li>)}</ul></div>
    {!files.length&&<p>No source labels match these filters.</p>}
    <button type="button" disabled={visible.page===1} onClick={()=>setPage(visible.page-1)}>Previous whitespace source page</button>
    <button type="button" disabled={visible.page===visible.pages} onClick={()=>setPage(visible.page+1)}>Next whitespace source page</button>
    {chosen&&<section aria-label="Selected whitespace file details">
      <h4><code dir="auto">{chosen.source}</code></h4>
      <p>Whitespace symbols: · space, → tab, CR carriage return, LF line feed. Only proposed whitespace is shown.</p>
      <p>{chosen.result.protected.literalTrailing} protected trailing ranges · {chosen.result.protected.literalIndentation} protected indentations ·
        {' '}{chosen.result.protected.literalEndings} protected line endings.</p>
      <ul>{detailEdits.rows.map(edit=><li key={edit.id}>
        <strong>Line {edit.line}, column {edit.column}</strong> · {WHITESPACE_LABELS[edit.kind]}
        <p>Before: <code>{visibleWhitespace(edit.original)}</code></p>
        <p>After: <code>{visibleWhitespace(edit.replacement)}</code></p>
      </li>)}</ul>
      {!chosen.result.edits.length&&<p>No whitespace edits proposed.</p>}
      <button type="button" disabled={detailEdits.page===1} onClick={()=>setEditPage(detailEdits.page-1)}>Previous whitespace edit page</button>
      <span>Page {detailEdits.page} of {detailEdits.pages}</span>
      <button type="button" disabled={detailEdits.page===detailEdits.pages} onClick={()=>setEditPage(detailEdits.page+1)}>Next whitespace edit page</button>
      <button type="button" onClick={()=>setDetail(null)}>Close whitespace file details</button>
    </section>}
    <button type="button" disabled={blocked||!visible.rows.some(file=>file.result.edits.length)}
      onClick={()=>select([...new Set([...selected,...visible.rows.filter(file=>file.result.edits.length).map(file=>file.source)])])}>
      Select changed sources on this page
    </button>
    <button type="button" disabled={blocked||!selected.length} onClick={()=>select([])}>Clear whitespace selection</button>
    <button type="button" disabled={blocked||!selected.length} onClick={preview}>Review staging selected whitespace changes</button>
    {notice&&<p role="alert">{notice}</p>}
    {plan&&<section aria-label="Confirm project whitespace changes">
      <p>{plan.edits} whitespace edits in {plan.staged.changes.length} sources · {plan.staged.newTabs} new tabs ·
        {' '}{plan.staged.dirtyTabs} previously modified tabs.</p>
      <OptionSummary options={inventory.review.options}/>
      <ul>{plan.staged.changes.map(change=><li key={change.source}>
        <code dir="auto">{change.source}</code> · {change.document?'Existing working tab':'Open as unsaved change'}
      </li>)}</ul>
      <p>Re-read all closed sources from the original review. Any changed or failed read cancels the entire edit.
        No disk write; changed tabs are held from autosave for review.</p>
      <button type="button" disabled={blocked} onClick={()=>onApply(plan)}>Confirm stage whitespace changes</button>
      <button type="button" disabled={busy} onClick={()=>setPlan(null)}>Cancel whitespace stage review</button>
    </section>}
    <button type="button" aria-expanded={showReport} onClick={()=>{setShowReport(!showReport);if(showReport)setLabels(false);}}>
      {showReport?'Hide project whitespace report':'Review project whitespace report'}
    </button>
    {showReport&&<>
      <label><input type="checkbox" checked={labels} onChange={event=>setLabels(event.target.checked)}/>Include relative whitespace source labels</label>
      <textarea aria-label="Project whitespace report" rows={10} readOnly value={output}/>
    </>}
    <button type="button" disabled={busy} onClick={onDismiss}>Discard whitespace review</button>
  </section>;
}
export function ProjectWhitespacePanel({editor,listed,listingLimited,available,busy,onScan,onApply,undoAvailable,onUndo}:Props){
  const [expanded,setExpanded]=useState(false);
  const [scope,setScope]=useState<ProjectSearchScope>(DEFAULT_PROJECT_SEARCH_SCOPE);
  const [options,setOptions]=useState(DEFAULT_WHITESPACE_OPTIONS);
  const [review,setReview]=useState<ProjectWhitespaceReview|null>(null);
  const [inventory,setInventory]=useState<ProjectWhitespaceInventory|null>(null);
  const [phase,setPhase]=useState<'scan'|'apply'|null>(null);
  const [progress,setProgress]=useState<InspectionProgress|null>(null);
  const [cancelRequested,setCancelRequested]=useState(false);
  const [notice,setNotice]=useState('');
  const [failed,setFailed]=useState(false);
  const active=useRef<{cancelled:boolean}|null>(null);
  const blocked=busy||phase!==null||!available;
  function reset(){setReview(null);setInventory(null);setNotice('');setFailed(false);}
  function update(patch:Partial<WhitespaceOptions>){setOptions(old=>({...old,...patch}));reset();}
  function preview(){
    if(blocked)return;
    const result=prepareProjectWhitespace(listed,scope,listingLimited,options);
    if(!result.ok){setNotice(result.error);setFailed(true);setReview(null);setInventory(null);return;}
    setReview(result.value);setInventory(null);setNotice('');setFailed(false);
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
    const control=begin('scan'),snapshot=review;setReview(null);
    try{
      const response=await onScan(snapshot,scope,options,control);
      if(response.kind==='ready')setInventory(response.value);
      else{setFailed(true);setNotice(response.kind==='failed'?response.error:'Whitespace scan '+response.kind+'. No review created.');}
    }catch{setFailed(true);setNotice('Whitespace scan failed. No review created.');}
    finally{finish();}
  }
  async function apply(plan:ProjectWhitespacePlan){
    if(blocked||!inventory||plan.inventory!==inventory||active.current)return;
    const control=begin('apply');
    try{
      const response=await onApply(plan,control);setInventory(null);
      if(response.ok)setNotice('Staged '+response.edits+' whitespace edits in '+response.files+' unsaved sources.');
      else{setFailed(true);setNotice(response.error);}
    }catch{setInventory(null);setFailed(true);setNotice('Whitespace operation failed. Scan again.');}
    finally{finish();}
  }
  return <section className="sidebar-section" aria-label="Project whitespace cleanup">
    <div className="sidebar-heading">PROJECT WHITESPACE CLEANUP</div>
    <button type="button" className="insights-toggle" aria-expanded={expanded} disabled={phase!==null}
      onClick={()=>{setExpanded(!expanded);if(expanded)reset();}}>
      {expanded?'Hide project whitespace cleanup':'Review project whitespace cleanup'}
    </button>
    {expanded&&<>
      <p>Review up to {MAX_WHITESPACE_EDITS} whitespace changes across listed Scarp sources.
        String contents and their line endings are protected. This is not a compiler formatter.</p>
      {!available&&<p>Choose a project in the desktop application.</p>}
      <label><input type="checkbox" checked={options.trimTrailing} disabled={blocked}
        onChange={event=>update({trimTrailing:event.target.checked})}/>Trim trailing spaces and tabs</label>
      <label>Indentation<select aria-label="Project whitespace indentation" value={options.indentation} disabled={blocked}
        onChange={event=>{const value=event.target.value;if(value==='preserve'||value==='spaces'||value==='tabs')update({indentation:value});}}>
        <option value="preserve">Preserve</option><option value="spaces">Spaces</option><option value="tabs">Tabs and remainder spaces</option>
      </select></label>
      <label>Tab width<select aria-label="Project whitespace tab width" value={options.tabWidth} disabled={blocked||options.indentation==='preserve'}
        onChange={event=>{const value=Number(event.target.value);if(value===2||value===4||value===8)update({tabWidth:value});}}>
        <option value={2}>2 columns</option><option value={4}>4 columns</option><option value={8}>8 columns</option>
      </select></label>
      <label>Line endings<select aria-label="Project whitespace line endings" value={options.endings} disabled={blocked}
        onChange={event=>{const value=event.target.value;if(value==='preserve'||value==='lf'||value==='crlf')update({endings:value});}}>
        <option value="preserve">Preserve original</option><option value="lf">LF outside strings</option><option value="crlf">CRLF outside strings</option>
      </select></label>
      <label><input type="checkbox" checked={options.finalNewline} disabled={blocked}
        onChange={event=>update({finalNewline:event.target.checked})}/>Ensure a supported final newline</label>
      <ProjectSearchScopeControls listed={listed} scope={scope} busy={blocked} onChange={next=>{setScope(next);reset();}}/>
      <button type="button" disabled={blocked} onClick={preview}>Review whitespace source scan</button>
      {review&&<section aria-label="Review project whitespace scan" className="project-scope-coverage">
        <p>{review.sources.selected} selected of {review.sources.listed} listed sources · {review.sources.excluded} excluded ·
          {' '}{review.sources.deferred} outside this batch.</p>
        <OptionSummary options={review.options}/>
        <p>Read complete selected sources. Existing working buffers take precedence. No edits during scan.</p>
        <button type="button" disabled={blocked} onClick={()=>void scan()}>Confirm whitespace scan</button>
        <button type="button" onClick={()=>setReview(null)}>Cancel whitespace scan review</button>
      </section>}
      {inventory&&<Selection inventory={inventory} editor={editor} busy={blocked}
        onApply={plan=>void apply(plan)} onDismiss={()=>setInventory(null)}/>}
      {phase&&<div role="status">
        <p>{phase==='scan'?'Reading reviewed snapshots':'Rechecking disk snapshots'} · {progress?progress.observed+' / '+progress.total:'Preparing'}</p>
        <button type="button" disabled={cancelRequested} onClick={()=>{if(active.current)active.current.cancelled=true;setCancelRequested(true);}}>
          {cancelRequested?'Whitespace cancellation requested':'Cancel whitespace operation'}
        </button>
      </div>}
      {notice&&<p role={failed?'alert':'status'}>{notice}</p>}
      <button type="button" disabled={blocked||!undoAvailable} onClick={()=>{onUndo();reset();}}>Undo last staged whitespace changes</button>
    </>}
  </section>;
}
