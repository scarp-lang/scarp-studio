import {useMemo,useRef,useState} from 'react';
import {ProjectSearchScopeControls} from './ProjectSearchScopeControls';
import {DEFAULT_PROJECT_SEARCH_SCOPE,type ProjectSearchScope} from '../model/projectSearchScope';
import type {ProjectSearchSource} from '../model/projectSearch';
import type {EditorState} from '../model/editorState';
import type {InspectionControl,InspectionProgress} from '../model/projectInspection';
import {MAX_MIGRATION_RULES,MAX_MIGRATION_SITES,MIGRATION_ROLES,MIGRATION_ROLE_LABELS,MIGRATION_WARNING_LABELS,
  type MigrationRule} from '../model/migrationRules';
import {prepareProjectMigration,planProjectMigration,migrationInventoryIsCurrent,filterMigrationSites,
  pageMigrationSites,migrationInventoryReport,DEFAULT_MIGRATION_FILTER,
  type MigrationInventory,type ProjectMigrationReview,type ProjectMigrationPlan,type MigrationFilter,
  type MigrationScanExecution,type MigrationOutcome} from '../model/projectIdentifierMigration';

interface Props{
  editor:EditorState;
  listed:readonly ProjectSearchSource[];
  listingLimited:boolean;
  available:boolean;
  busy:boolean;
  onScan:(review:ProjectMigrationReview,scope:ProjectSearchScope,rules:readonly MigrationRule[],
    control:InspectionControl)=>Promise<MigrationScanExecution>;
  onApply:(plan:ProjectMigrationPlan,control:InspectionControl)=>Promise<MigrationOutcome>;
  undoAvailable:boolean;
  onUndo:()=>void;
}
const blank=():MigrationRule=>({from:'',to:''});
function MigrationReview({review,onConfirm,onCancel,busy}:{
  review:ProjectMigrationReview;onConfirm:()=>void;onCancel:()=>void;busy:boolean;
}){
  const [labels,setLabels]=useState(false);
  const plan=review.inspection;
  return <section className="project-scope-coverage" aria-label="Review identifier migration scan">
    <p><strong>Review identifier migration scan</strong></p>
    <p>{plan.selected} selected of {plan.listed} listed sources · {plan.excluded} excluded · {plan.deferred} outside this batch.</p>
    <ol>{review.rules.map((rule,index)=><li key={index}><code>{rule.from}</code> → <code>{rule.to}</code></li>)}</ol>
    <p>Read current working buffers first, then bounded disk sources. No changes are made by this scan.
      All selected files must be read and scanned completely.</p>
    <button type="button" aria-expanded={labels} onClick={()=>setLabels(!labels)}>
      {labels?'Hide migration source labels':'Review migration source labels'}
    </button>
    {labels&&<div className="project-scope-inventory"><ul>{plan.sources.map(source=>
      <li key={source.name}><code dir="auto">{source.name}</code></li>)}</ul></div>}
    <button type="button" disabled={busy} onClick={onConfirm}>Confirm migration scan</button>
    <button type="button" onClick={onCancel}>Cancel migration scan review</button>
  </section>;
}
function MigrationSelection({inventory,editor,busy,onApply,onDismiss}:{
  inventory:MigrationInventory;editor:EditorState;busy:boolean;onApply:(plan:ProjectMigrationPlan)=>void;onDismiss:()=>void;
}){
  const [selected,setSelected]=useState<readonly string[]>([]);
  const [filter,setFilter]=useState(DEFAULT_MIGRATION_FILTER);
  const [page,setPage]=useState(1);
  const [ack,setAck]=useState(false);
  const [plan,setPlan]=useState<ProjectMigrationPlan|null>(null);
  const [notice,setNotice]=useState('');
  const [showWarnings,setShowWarnings]=useState(false);
  const [warningPage,setWarningPage]=useState(1);
  const [showReport,setShowReport]=useState(false);
  const [labels,setLabels]=useState(false);
  const [rules,setRules]=useState(false);
  const rows=useMemo(()=>filterMigrationSites(inventory,filter,selected),[inventory,filter,selected]);
  const visible=pageMigrationSites(rows,page);
  const warnings=pageMigrationSites(inventory.warnings,warningPage);
  const current=migrationInventoryIsCurrent(inventory,editor);
  const blocked=busy||!current;
  const selectedSet=new Set(selected);
  const output=useMemo(()=>showReport?migrationInventoryReport(inventory,selected,labels,rules):'',
    [inventory,selected,labels,rules,showReport]);
  function select(next:readonly string[]){setSelected(next);setPlan(null);setNotice('');}
  function toggle(id:string){if(!blocked)select(selectedSet.has(id)?selected.filter(value=>value!==id):[...selected,id]);}
  function update(patch:Partial<MigrationFilter>){setFilter(old=>({...old,...patch}));setPage(1);}
  function preview(){
    if(blocked)return;
    const result=planProjectMigration(inventory,selected,ack,editor);
    if(!result.ok){setNotice(result.error);setPlan(null);return;}
    setPlan(result.value);setNotice('');
  }
  return <section className="project-scope-coverage" aria-label="Project identifier migration selection">
    <p role="status"><strong>Complete scan of reviewed selected sources</strong></p>
    <p>Literal code-token substitutions only. Mappings are simultaneous, not sequential. They do not resolve scopes,
      imports, types or overloads. Select each intended occurrence; comments and strings are excluded.</p>
    {!current&&<p role="alert">Editor session changed. Discard this private review and scan again.</p>}
    <dl className="project-scope-stats">
      <div><dt>Scanned sources</dt><dd>{inventory.snapshots.length}</dd></div>
      <div><dt>Retained sites</dt><dd>{inventory.sites.length}</dd></div>
      <div><dt>Selected sites</dt><dd>{selected.length}</dd></div>
      <div><dt>Spelling warnings</dt><dd>{inventory.warnings.length}</dd></div>
    </dl>
    {inventory.warnings.length>0&&<>
      <p>Observed target spellings, shared targets and mapping chains can cause unintended name changes.
        Warnings are not semantic collision analysis.</p>
      <button type="button" aria-expanded={showWarnings} onClick={()=>setShowWarnings(!showWarnings)}>
        {showWarnings?'Hide migration warnings':'Review migration warnings'}
      </button>
      {showWarnings&&<section aria-label="Migration spelling warnings">
        <ul>{warnings.rows.map((warning,index)=><li key={warnings.page+':'+index}>
          <strong>Mapping {warning.rule+1}</strong> · {MIGRATION_WARNING_LABELS[warning.kind]} · {warning.count}
          {warning.source&&<p><code dir="auto">{warning.source}</code></p>}
        </li>)}</ul>
        <button type="button" disabled={warnings.page===1} onClick={()=>setWarningPage(warnings.page-1)}>Previous warning page</button>
        <span>Page {warnings.page} of {warnings.pages}</span>
        <button type="button" disabled={warnings.page===warnings.pages} onClick={()=>setWarningPage(warnings.page+1)}>Next warning page</button>
        <label><input type="checkbox" checked={ack} disabled={blocked} onChange={event=>{
          setAck(event.target.checked);setPlan(null);
        }}/>I reviewed the observed spelling warnings</label>
      </section>}
    </>}
    <div className="project-scope-fields">
      <label>Source<select aria-label="Migration source filter" value={filter.source} onChange={event=>update({source:event.target.value})}>
        <option value="">All scanned labels</option>{inventory.snapshots.map(snapshot=>
          <option key={snapshot.name} value={snapshot.name}>{snapshot.name}</option>)}
      </select></label>
      <label>Mapping<select aria-label="Migration mapping filter" value={filter.rule??''} onChange={event=>
        update({rule:event.target.value===''?null:Number(event.target.value)})}>
        <option value="">All mappings</option>{inventory.review.rules.map((rule,index)=>
          <option key={index} value={index}>{rule.from} → {rule.to}</option>)}
      </select></label>
      <label>Role<select aria-label="Migration role filter" value={filter.role} onChange={event=>{
        const value=event.target.value as MigrationFilter['role'];
        if(value==='all'||MIGRATION_ROLES.includes(value))update({role:value});
      }}><option value="all">Any lexical role</option>{MIGRATION_ROLES.map(role=>
        <option key={role} value={role}>{MIGRATION_ROLE_LABELS[role]}</option>)}</select></label>
      <label><input type="checkbox" checked={filter.selectedOnly} onChange={event=>update({selectedOnly:event.target.checked})}/>
        Show selected migration sites only</label>
      <button type="button" onClick={()=>{setFilter(DEFAULT_MIGRATION_FILTER);setPage(1);}}>Reset migration filters</button>
    </div>
    <p>{rows.length} matching sites · Page {visible.page} of {visible.pages}</p>
    <div className="project-scope-inventory"><ul>{visible.rows.map(site=><li key={site.id}>
      <label><input type="checkbox" checked={selectedSet.has(site.id)} disabled={blocked} onChange={()=>toggle(site.id)}/>
        <code dir="auto">{site.source}:{site.line}:{site.column}</code> · Mapping {site.rule+1}</label>
      <p>{MIGRATION_ROLE_LABELS[site.role]} · <code>{inventory.review.rules[site.rule].from}</code> → <code>{inventory.review.rules[site.rule].to}</code></p>
      <p>Before: <code dir="auto">{site.clippedBefore?'…':''}{site.before}{site.clippedAfter?'…':''}</code></p>
      <p>After: <code dir="auto">{site.clippedBefore?'…':''}{site.after}{site.clippedAfter?'…':''}</code></p>
    </li>)}</ul></div>
    {!rows.length&&<p>No migration sites match these filters.</p>}
    <button type="button" disabled={visible.page===1} onClick={()=>setPage(visible.page-1)}>Previous migration site page</button>
    <button type="button" disabled={visible.page===visible.pages} onClick={()=>setPage(visible.page+1)}>Next migration site page</button>
    <button type="button" disabled={blocked||!visible.rows.length} onClick={()=>
      select([...new Set([...selected,...visible.rows.map(site=>site.id)])])}>Select visible migration sites</button>
    <button type="button" disabled={blocked||!selected.length} onClick={()=>select([])}>Clear migration selection</button>
    <button type="button" disabled={blocked||!selected.length||(inventory.warnings.length>0&&!ack)} onClick={preview}>Review selected migration changes</button>
    {notice&&<p role="alert">{notice}</p>}
    {plan&&<section aria-label="Confirm selected identifier migration">
      <p>{plan.replacements} replacements in {plan.changes.length} sources · {plan.newTabs} new tabs · {plan.dirtyTabs} previously modified tabs.</p>
      <ul>{plan.changes.map(change=><li key={change.source}>
        <code dir="auto">{change.source}</code> · {change.sites.length} sites · {change.document?'Existing working tab':'Open as unsaved edit'}
      </li>)}</ul>
      <p>All closed-source snapshots from this scan will be read again. A mismatch cancels the operation.
        No disk writes; changed tabs are held from autosave until explicitly reviewed.</p>
      <button type="button" disabled={blocked} onClick={()=>onApply(plan)}>Confirm migration into open buffers</button>
      <button type="button" disabled={busy} onClick={()=>setPlan(null)}>Cancel selected migration review</button>
    </section>}
    <button type="button" aria-expanded={showReport} onClick={()=>{setShowReport(!showReport);if(showReport){setLabels(false);setRules(false);}}}>
      {showReport?'Hide migration report':'Review migration report'}
    </button>
    {showReport&&<>
      <label><input type="checkbox" checked={labels} onChange={event=>setLabels(event.target.checked)}/>Include relative migration labels</label>
      <label><input type="checkbox" checked={rules} onChange={event=>setRules(event.target.checked)}/>Include identifier mappings</label>
      <textarea aria-label="Migration inventory report" readOnly rows={10} value={output}/>
      <p>No source text, previews or native paths are exported.</p>
    </>}
    <button type="button" disabled={busy} onClick={onDismiss}>Discard private migration review</button>
  </section>;
}

export function ProjectIdentifierMigrationPanel({editor,listed,listingLimited,available,busy,onScan,onApply,undoAvailable,onUndo}:Props){
  const [expanded,setExpanded]=useState(false);
  const [scope,setScope]=useState<ProjectSearchScope>(DEFAULT_PROJECT_SEARCH_SCOPE);
  const [rules,setRules]=useState<readonly MigrationRule[]>([blank()]);
  const [review,setReview]=useState<ProjectMigrationReview|null>(null);
  const [inventory,setInventory]=useState<MigrationInventory|null>(null);
  const [phase,setPhase]=useState<'scan'|'apply'|null>(null);
  const [progress,setProgress]=useState<InspectionProgress|null>(null);
  const [cancelRequested,setCancelRequested]=useState(false);
  const [notice,setNotice]=useState('');
  const [failed,setFailed]=useState(false);
  const active=useRef<{cancelled:boolean}|null>(null);
  const blocked=busy||phase!==null||!available;
  function resetReview(){setReview(null);setInventory(null);setNotice('');setFailed(false);}
  function update(next:readonly MigrationRule[]){setRules(next);resetReview();}
  function preview(){
    if(blocked)return;
    const result=prepareProjectMigration(listed,scope,listingLimited,rules);
    if(!result.ok){setReview(null);setInventory(null);setNotice(result.error);setFailed(true);return;}
    setReview(result.value);setInventory(null);setNotice('');setFailed(false);
  }
  function start(next:'scan'|'apply'){
    const token={cancelled:false};active.current=token;
    setPhase(next);setProgress(null);setCancelRequested(false);setNotice('');setFailed(false);
    const control:InspectionControl={
      isCurrent:()=>active.current===token,isCancelled:()=>token.cancelled,
      onProgress:value=>{if(active.current===token)setProgress(value);},
    };
    return control;
  }
  function finish(){active.current=null;setPhase(null);setProgress(null);setCancelRequested(false);}
  async function scan(){
    if(blocked||!review||active.current)return;
    const control=start('scan'),plan=review;setReview(null);
    try{
      const response=await onScan(plan,scope,rules,control);
      if(response.kind==='inventory')setInventory(response.value);
      else{setFailed(true);setNotice(response.kind==='failed'?response.error:'Migration scan '+response.kind+'. No edit review created.');}
    }catch{setFailed(true);setNotice('Migration scan failed. No edit review created.');}
    finally{finish();}
  }
  async function apply(plan:ProjectMigrationPlan){
    if(blocked||!inventory||plan.inventory!==inventory||active.current)return;
    const control=start('apply');
    try{
      const response=await onApply(plan,control);
      if(response.ok){setInventory(null);setNotice('Staged '+response.replacements+' identifier replacements in '+response.files+' unsaved source(s).');}
      else{setInventory(null);setFailed(true);setNotice(response.error);}
    }catch{setInventory(null);setFailed(true);setNotice('Migration could not complete. Scan again.');}
    finally{finish();}
  }
  return <section className="sidebar-section" aria-label="Project identifier migration">
    <div className="sidebar-heading">PROJECT IDENTIFIER MIGRATION</div>
    <button type="button" className="insights-toggle" disabled={phase!==null} aria-expanded={expanded}
      onClick={()=>{setExpanded(!expanded);if(expanded)resetReview();}}>
      {expanded?'Hide project identifier migration':'Review project identifier migration'}
    </button>
    {expanded&&<>
      <p>Stage up to {MAX_MIGRATION_SITES} exact code-token changes from up to {MAX_MIGRATION_RULES} simultaneous mappings.
        Review every chosen source and edit. This is not a compiler-aware rename.</p>
      {!available&&<p>Choose a project in the desktop application.</p>}
      <div aria-label="Identifier migration mappings">{rules.map((rule,index)=><div key={index} className="project-scope-fields">
        <label>Original<input aria-label={'Migration original '+(index+1)} maxLength={128} disabled={blocked}
          value={rule.from} onChange={event=>update(rules.map((item,i)=>i===index?{...item,from:event.target.value}:item))}/></label>
        <label>Replacement<input aria-label={'Migration replacement '+(index+1)} maxLength={128} disabled={blocked}
          value={rule.to} onChange={event=>update(rules.map((item,i)=>i===index?{...item,to:event.target.value}:item))}/></label>
        <button type="button" disabled={blocked||rules.length===1} onClick={()=>update(rules.filter((_,i)=>i!==index))}>Remove mapping {index+1}</button>
      </div>)}</div>
      <button type="button" disabled={blocked||rules.length>=MAX_MIGRATION_RULES} onClick={()=>update([...rules,blank()])}>Add identifier mapping</button>
      <ProjectSearchScopeControls listed={listed} scope={scope} busy={blocked} onChange={next=>{setScope(next);resetReview();}}/>
      <button type="button" disabled={blocked} onClick={preview}>Review migration source scan</button>
      {review&&<MigrationReview review={review} busy={blocked} onConfirm={()=>void scan()} onCancel={()=>setReview(null)}/>}
      {inventory&&<MigrationSelection inventory={inventory} editor={editor} busy={blocked}
        onApply={plan=>void apply(plan)} onDismiss={()=>setInventory(null)}/>}
      {phase&&<div role="status">
        <p>{phase==='scan'?'Scanning selected sources':'Rechecking disk snapshots'} · {progress?progress.observed+' / '+progress.total:'Preparing'}</p>
        <button type="button" disabled={cancelRequested} onClick={()=>{if(active.current)active.current.cancelled=true;setCancelRequested(true);}}>
          {cancelRequested?'Migration cancellation requested':'Cancel migration operation'}
        </button>
      </div>}
      {notice&&<p role={failed?'alert':'status'}>{notice}</p>}
      <button type="button" disabled={blocked||!undoAvailable} onClick={()=>{onUndo();resetReview();}}>Undo last staged migration</button>
      <p>Undo restores the original in-memory content. Newly opened tabs remain open. Save or another edit may invalidate undo.</p>
    </>}
  </section>;
}
