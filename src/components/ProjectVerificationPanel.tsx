import { useMemo, useRef, useState } from 'react';
import { VerificationProfilesPanel } from './VerificationProfilesPanel';
import { ProjectSearchScopeControls } from './ProjectSearchScopeControls';
import { DEFAULT_PROJECT_SEARCH_SCOPE, type ProjectSearchScope } from '../model/projectSearchScope';
import type { ProjectSearchSource } from '../model/projectSearch';
import { INSPECTION_READ_LIMITS, INSPECTION_ORIGIN_LABELS,
  type InspectionSettings, type InspectionMode, type InspectionProgress } from '../model/projectInspection';
import {
  prepareProjectVerification, filterVerificationFiles, pageVerificationFiles, verificationReportText,
  MAX_VERIFICATION_RULES, VERIFICATION_EXPECTATIONS, VERIFICATION_EXPECTATION_LABELS,
  VERIFICATION_STATUS_LABELS, VERIFICATION_FILE_LABELS,
  type VerificationRule, type ProjectVerificationPlan, type ProjectVerificationReport,
  type VerificationExecution, type VerificationControl, type VerificationFileFilter, type VerificationExpectation,
} from '../model/projectVerification';

interface Props {
  listed: readonly ProjectSearchSource[];
  listingLimited: boolean;
  available: boolean;
  busy: boolean;
  onRun: (plan: ProjectVerificationPlan, settings: InspectionSettings,
    rules: readonly VerificationRule[], control: VerificationControl) => Promise<VerificationExecution>;
}
interface RuleDraft { readonly id: number; readonly rule: VerificationRule }
function blankRule(id: number): RuleDraft {
  return { id, rule: { name: 'Rule ' + id, query: '', options: { caseSensitive: true, wholeWord: false }, expectation: 'observe' } };
}
export function VerificationRuleEditor({ drafts, busy, onUpdate, onAdd, onRemove, onMove }: {
  drafts: readonly RuleDraft[]; busy: boolean;
  onUpdate: (id: number, rule: VerificationRule) => void;
  onAdd: () => void; onRemove: (id: number) => void; onMove: (id: number, direction: -1 | 1) => void;
}) {
  return <div className="project-scope-coverage" aria-label="Literal verification rules">
    <p>Configure up to {MAX_VERIFICATION_RULES} literal rules. Queries may match comments and strings;
      they are not compiler assertions or semantic references.</p>
    {drafts.map((draft,index) => <fieldset key={draft.id} className="project-verification-rule">
      <legend>Rule {index+1}</legend>
      <label>Name<input aria-label={'Verification rule '+(index+1)+' name'} maxLength={64}
        value={draft.rule.name} disabled={busy} onChange={event => onUpdate(draft.id,{...draft.rule,name:event.target.value})}/></label>
      <label>Literal query<input aria-label={'Verification rule '+(index+1)+' query'} maxLength={120}
        value={draft.rule.query} disabled={busy} onChange={event => onUpdate(draft.id,{...draft.rule,query:event.target.value})}/></label>
      <label><input type="checkbox" checked={draft.rule.options.caseSensitive} disabled={busy}
        onChange={event=>onUpdate(draft.id,{...draft.rule,options:{...draft.rule.options,caseSensitive:event.target.checked}})}/>
        Match case for rule {index+1}</label>
      <label><input type="checkbox" checked={draft.rule.options.wholeWord} disabled={busy}
        onChange={event=>onUpdate(draft.id,{...draft.rule,options:{...draft.rule.options,wholeWord:event.target.checked}})}/>
        Whole word for rule {index+1}</label>
      <label>Expectation<select aria-label={'Verification rule '+(index+1)+' expectation'} value={draft.rule.expectation}
        disabled={busy} onChange={event => {
          const value=event.target.value;
          if(VERIFICATION_EXPECTATIONS.includes(value as VerificationExpectation))
            onUpdate(draft.id,{...draft.rule,expectation:value as VerificationExpectation});
        }}>
        {VERIFICATION_EXPECTATIONS.map(value=><option key={value} value={value}>{VERIFICATION_EXPECTATION_LABELS[value]}</option>)}
      </select></label>
      <div className="project-scope-fields">
        <button type="button" disabled={busy||index===0} onClick={()=>onMove(draft.id,-1)}>Move rule {index+1} earlier</button>
        <button type="button" disabled={busy||index===drafts.length-1} onClick={()=>onMove(draft.id,1)}>Move rule {index+1} later</button>
        <button type="button" disabled={busy||drafts.length===1} onClick={()=>onRemove(draft.id)}>Remove rule {index+1}</button>
      </div>
    </fieldset>)}
    <button type="button" disabled={busy||drafts.length>=MAX_VERIFICATION_RULES} onClick={onAdd}>Add verification rule</button>
  </div>;
}

export function ProjectVerificationReview({ plan, busy, onConfirm, onCancel }: {
  plan: ProjectVerificationPlan; busy: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const [labels,setLabels]=useState(false);
  const {inspection,rules}=plan;
  return <section className="project-scope-coverage" aria-label="Review project verification">
    <p><strong>Review literal verification run</strong></p>
    <p>{inspection.selected} selected of {inspection.listed} listed sources · {inspection.deferred} deferred ·
      {' '}{inspection.excluded} excluded · {inspection.withheld} withheld.</p>
    <p>{inspection.settings.mode==='working'?'Working buffers take precedence.':'Saved disk files only.'}
      {' '}{inspection.settings.listingLimited?'Explorer listing known limited.':''}</p>
    <ol>{rules.map((rule,index)=><li key={index}>
      <strong>{rule.name}</strong> · {VERIFICATION_EXPECTATION_LABELS[rule.expectation]}
      <p><code dir="auto">{JSON.stringify(rule.query)}</code> · {rule.options.caseSensitive?'Case sensitive':'Ignore case'} ·
        {' '}{rule.options.wholeWord?'Whole word':'Substring'}</p>
    </li>)}</ol>
    <p>One bounded read per selected source supplies all rules. Observed matches may establish presence
      or contradict absence; zero matches are conclusive only when the scope is complete.</p>
    <button type="button" aria-expanded={labels} onClick={()=>setLabels(value=>!value)}>
      {labels?'Hide verification source labels':'Review verification source labels'}
    </button>
    {labels&&<div className="project-scope-inventory"><ul>{inspection.sources.map(source=>
      <li key={source.name}><code dir="auto">{source.name}</code></li>)}</ul></div>}
    <button type="button" disabled={busy} onClick={onConfirm}>Confirm and run verification</button>
    <button type="button" onClick={onCancel}>Cancel verification review</button>
  </section>;
}

export function ProjectVerificationResults({ report }: { report: ProjectVerificationReport }) {
  const [selected,setSelected]=useState(0);
  const [filter,setFilter]=useState<VerificationFileFilter>('all');
  const [page,setPage]=useState(1);
  const [showReport,setShowReport]=useState(false);
  const [names,setNames]=useState(false);
  const [labels,setLabels]=useState(false);
  const rule=report.rules.find(item=>item.index===selected)??report.rules[0];
  const rows=useMemo(()=>rule?filterVerificationFiles(rule,filter):[],[rule,filter]);
  const visible=pageVerificationFiles(rows,page);
  const text=useMemo(()=>showReport?verificationReportText(report,{includeRuleNames:names,includeSourceLabels:labels}):'',
    [showReport,report,names,labels]);
  return <section className="project-scope-coverage" aria-label="Project verification results">
    <p role="status"><strong>Verification {report.status}</strong> · {report.rules.length} rules over {report.selected} selected sources.</p>
    <p>Sequential source observations. Literal expectations do not establish program correctness or semantic safety.</p>
    <dl className="project-scope-stats">
      <div><dt>Expectations satisfied</dt><dd>{report.rules.filter(item=>item.status==='pass').length}</dd></div>
      <div><dt>Expectations contradicted</dt><dd>{report.rules.filter(item=>item.status==='fail').length}</dd></div>
      <div><dt>Inconclusive rules</dt><dd>{report.rules.filter(item=>item.status==='inconclusive').length}</dd></div>
      <div><dt>Observation-only rules</dt><dd>{report.rules.filter(item=>item.status==='observed').length}</dd></div>
      <div><dt>UTF-8 bytes analyzed once</dt><dd>{report.bytes}</dd></div>
      <div><dt>Deferred / withheld</dt><dd>{report.deferred} / {report.withheld}</dd></div>
    </dl>
    <div className="project-scope-inventory"><ul>{report.rules.map(item=><li key={item.index}>
      <button type="button" aria-pressed={rule?.index===item.index} onClick={()=>{setSelected(item.index);setFilter('all');setPage(1);}}>
        {item.name}
      </button>
      <p>{VERIFICATION_EXPECTATION_LABELS[item.expectation]} · {VERIFICATION_STATUS_LABELS[item.status]}</p>
      <p>{item.matches} observed matches · {item.fullyScanned} fully searched · {item.partial} partial · {item.unread} unread</p>
    </li>)}</ul></div>
    {rule&&<>
      <p><strong>Evidence for {rule.name}</strong></p>
      <p>{rule.complete?'Complete for chosen listed scope':'Incomplete scope coverage; zero matches are not conclusive.'}</p>
      <label>Evidence filter<select aria-label="Verification file evidence filter" value={filter} onChange={event=>{
        const value=event.target.value;
        if(value==='all'||value==='matches'||value==='incomplete'||value==='zero-scanned'){setFilter(value);setPage(1);}
      }}>
        <option value="all">All selected labels</option><option value="matches">Observed matches</option>
        <option value="incomplete">Incomplete evidence</option><option value="zero-scanned">Fully searched, zero matches</option>
      </select></label>
      <div className="project-scope-inventory"><table>
        <caption>Verification file evidence</caption>
        <thead><tr><th>Source label</th><th>Coverage</th><th>Origin</th><th>Observed matches</th></tr></thead>
        <tbody>{visible.rows.map(row=><tr key={row.name}>
          <td><code dir="auto">{row.name}</code></td><td>{VERIFICATION_FILE_LABELS[row.state]}</td>
          <td>{INSPECTION_ORIGIN_LABELS[row.origin]}</td><td>{row.matches}</td>
        </tr>)}</tbody>
      </table></div>
      {!rows.length&&<p>No file evidence matches this filter.</p>}
      <div className="project-scope-fields">
        <button type="button" disabled={visible.page===1} onClick={()=>setPage(visible.page-1)}>Previous verification page</button>
        <span>Page {visible.page} of {visible.pages}</span>
        <button type="button" disabled={visible.page===visible.pages} onClick={()=>setPage(visible.page+1)}>Next verification page</button>
      </div>
    </>}
    <button type="button" aria-expanded={showReport} onClick={()=>setShowReport(value=>!value)}>
      {showReport?'Hide verification report':'Review verification report'}
    </button>
    {showReport&&<>
      <label><input type="checkbox" checked={names} onChange={event=>setNames(event.target.checked)}/>Include rule names in verification report</label>
      <label><input type="checkbox" checked={labels} onChange={event=>setLabels(event.target.checked)}/>Include source labels in verification report</label>
      <label>Copyable verification report<textarea aria-label="Project verification report" rows={10} readOnly value={text}/></label>
      <p>Queries, native paths, matched text and source snapshots are excluded. Rule names and source labels are separate opt-ins.</p>
    </>}
  </section>;
}

export function ProjectVerificationPanel({listed,listingLimited,available,busy,onRun}:Props) {
  const [expanded,setExpanded]=useState(false);
  const [scope,setScope]=useState<ProjectSearchScope>(DEFAULT_PROJECT_SEARCH_SCOPE);
  const [mode,setMode]=useState<InspectionMode>('working');
  const [drafts,setDrafts]=useState<readonly RuleDraft[]>(()=>[blankRule(1)]);
  const sequence=useRef(2);
  const [review,setReview]=useState<ProjectVerificationPlan|null>(null);
  const [result,setResult]=useState<ProjectVerificationReport|null>(null);
  const [running,setRunning]=useState(false);
  const [cancelled,setCancelled]=useState(false);
  const [progress,setProgress]=useState<InspectionProgress|null>(null);
  const [error,setError]=useState('');
  const active=useRef<{cancelled:boolean}|null>(null);
  const settings={scope,mode,listingLimited};
  const blocked=busy||running||!available;
  function updateDrafts(next:readonly RuleDraft[]){setDrafts(next);setReview(null);setError('');}
  function preview(){
    if(blocked)return;
    const plan=prepareProjectVerification(listed,settings,drafts.map(draft=>draft.rule));
    if(!plan.ok){setReview(null);setError(plan.error);return;}
    setReview(plan.value);setError('');
  }
  async function run(){
    if(blocked||!review||active.current)return;
    const token={cancelled:false};active.current=token;
    const plan=review;
    setRunning(true);setCancelled(false);setResult(null);setReview(null);setError('');setProgress(null);
    try{
      const response=await onRun(plan,settings,drafts.map(draft=>draft.rule),{
        isCurrent:()=>active.current===token,isCancelled:()=>token.cancelled,
        onProgress:value=>{if(active.current===token)setProgress(value);},
      });
      if(response.kind==='report')setResult(response.report);
      else setError('Verification invalidated. Review the current source scope again.');
    }catch{setError('Verification could not complete. Review the rules and source scope again.');}
    finally{active.current=null;setRunning(false);setCancelled(false);setProgress(null);}
  }
  return <section className="sidebar-section" aria-label="Listed project verification">
    <div className="sidebar-heading">LITERAL SOURCE VERIFICATION</div>
    <button type="button" className="insights-toggle" aria-expanded={expanded} disabled={running}
      onClick={()=>setExpanded(value=>!value)}>{expanded?'Hide literal source verification':'Verify literal project rules'}</button>
    {expanded&&<>
      <p>Run reviewed literal expectations across up to {INSPECTION_READ_LIMITS.files} listed files and
        {' '}{INSPECTION_READ_LIMITS.totalBytes/1024/1024} MiB. No compiler execution or file writes.</p>
      {!available&&<p>Choose a workspace in the desktop application.</p>}
      <label>Snapshot mode<select aria-label="Verification snapshot mode" value={mode} disabled={blocked}
        onChange={event=>{const value=event.target.value;if(value==='working'||value==='saved'){setMode(value);setReview(null);}}}>
        <option value="working">Working buffers and disk</option><option value="saved">Saved disk only</option>
      </select></label>
      <ProjectSearchScopeControls listed={listed} scope={scope} busy={blocked} onChange={value=>{setScope(value);setReview(null);}}/>
      <VerificationRuleEditor drafts={drafts} busy={blocked}
        onUpdate={(id,rule)=>updateDrafts(drafts.map(draft=>draft.id===id?{id,rule}:draft))}
        onAdd={()=>{if(drafts.length<MAX_VERIFICATION_RULES)updateDrafts([...drafts,blankRule(sequence.current++)]);}}
        onRemove={id=>{if(drafts.length>1)updateDrafts(drafts.filter(draft=>draft.id!==id));}}
        onMove={(id,direction)=>{
          const index=drafts.findIndex(draft=>draft.id===id),target=index+direction;
          if(index<0||target<0||target>=drafts.length)return;
          const next=[...drafts];[next[index],next[target]]=[next[target],next[index]];updateDrafts(next);
        }}/>
      <VerificationProfilesPanel current={drafts.map(draft=>draft.rule)} busy={blocked}
        onApply={rules=>{
          if(blocked)return false;
          updateDrafts(rules.map(rule=>({id:sequence.current++,rule})));
          return true;
        }}/>
      <button type="button" disabled={blocked} onClick={preview}>Review project verification</button>
      {review&&<ProjectVerificationReview plan={review} busy={blocked} onConfirm={()=>void run()} onCancel={()=>setReview(null)}/>}
      {running&&<div role="status">
        <p>{progress?progress.observed+' / '+progress.total+' sources observed':'Starting verification'}</p>
        <button type="button" disabled={cancelled} onClick={()=>{if(active.current)active.current.cancelled=true;setCancelled(true);}}>
          {cancelled?'Verification cancellation requested':'Cancel project verification'}
        </button>
      </div>}
      {error&&<p role="alert">{error}</p>}
      {result&&<><ProjectVerificationResults report={result}/><button type="button" disabled={running} onClick={()=>setResult(null)}>Dismiss verification results</button></>}
    </>}
  </section>;
}
