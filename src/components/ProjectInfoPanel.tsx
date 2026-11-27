import { useState } from 'react';
import { compareProjectInfo,projectInfoReport,PROJECT_INFO_FIELDS,PROJECT_INFO_LABELS,type ProjectInfoSnapshot,
  type EntryState } from '../model/projectInfo';
interface Props {
  snapshot:ProjectInfoSnapshot;
  entry:EntryState;
  baseline:ProjectInfoSnapshot|null;
  busy:boolean;
  onOpen:(snapshot:ProjectInfoSnapshot)=>void;
  onBaseline:(snapshot:ProjectInfoSnapshot|null)=>void;
  onHide:()=>void;
}
export function ProjectInfoPanel({snapshot,entry,baseline,busy,onOpen,onBaseline,onHide}:Props){
  const [review,setReview]=useState<{kind:'capture'|'clear';snapshot:ProjectInfoSnapshot;baseline:ProjectInfoSnapshot|null}|null>(null);
  const [showReport,setShowReport]=useState(false);
  const [labels,setLabels]=useState(false);
  const changes=baseline?compareProjectInfo(baseline,snapshot):null;
  const currentReview=review?.snapshot===snapshot&&review.baseline===baseline;
  return <section className="project-info-panel" aria-label="Saved project metadata">
    <header className="activity-header"><div><strong>Project information</strong>
      <p>Compiler-reported saved manifest metadata. This does not execute or verify the entry source.</p></div>
      <button type="button" onClick={onHide}>Hide project information</button></header>
    <dl className="project-info-fields">{PROJECT_INFO_FIELDS.map(field=><div key={field}>
      <dt>{PROJECT_INFO_LABELS[field]}</dt><dd>{snapshot.info[field]??'Unspecified (legacy manifest)'}</dd>
    </div>)}</dl>
    {snapshot.info.format==='legacy-v1'&&<p>The compiler recognizes this legacy manifest. No automatic migration or manifest rewrite is performed.</p>}
    <div className="transfer-review">
      <strong>Entry source</strong>
      {entry.kind==='listed'?<>
        <p>{entry.name} · {entry.open?entry.dirty?'Open with unsaved edits':'Open in editor':'Listed in Explorer'}</p>
        {entry.dirty&&<p>Opening focuses your working buffer, not the compiler's saved source snapshot.</p>}
        <button type="button" disabled={busy} onClick={()=>onOpen(snapshot)}>{entry.open?'Focus listed entry':'Open listed entry'}</button>
      </>:<p>{entry.reason} Refresh Explorer if needed; the compiler may know about files outside the bounded listing.</p>}
    </div>
    <div className="transfer-review">
      <strong>Manifest metadata baseline</strong>
      <p>Keep one explicit session-only snapshot. This compares reported metadata fields, not the contents of either manifest or source.</p>
      {baseline===null?<p>No baseline captured.</p>:changes===null?<p>The retained baseline belongs to another project.</p>:
        changes.length===0?<p>All six reported metadata fields match the retained baseline.</p>:<dl className="project-info-fields">
          {changes.map(change=><div key={change.field}><dt>{PROJECT_INFO_LABELS[change.field]}</dt>
            <dd><span>Previous: {change.before??'Unspecified'}</span><span>Current: {change.after??'Unspecified'}</span></dd></div>)}</dl>}
      <button type="button" disabled={busy||!!review} onClick={()=>setReview({kind:'capture',snapshot,baseline})}>{baseline?'Review baseline replacement':'Review baseline capture'}</button>
      <button type="button" disabled={busy||!baseline||!!review} onClick={()=>setReview({kind:'clear',snapshot,baseline})}>Review baseline removal</button>
      {review&&<div role="group" aria-label="Confirm project metadata baseline change">
        <p>{review.kind==='clear'?'Remove the retained metadata baseline?':baseline?'Replace the retained baseline with this saved metadata snapshot?':'Retain this saved metadata snapshot for this session?'}</p>
        {!currentReview&&<p role="alert">The reviewed snapshot or baseline changed. Cancel and review again.</p>}
        <button type="button" disabled={busy||!currentReview} onClick={()=>{onBaseline(review.kind==='clear'?null:snapshot);setReview(null);}}>Confirm metadata baseline change</button>
        <button type="button" onClick={()=>setReview(null)}>Cancel baseline change</button>
      </div>}
    </div>
    <button type="button" aria-expanded={showReport} onClick={()=>{setShowReport(v=>!v);setLabels(false);}}>{showReport?'Hide metadata report':'Review metadata report'}</button>
    {showReport&&<>
      <label><input type="checkbox" checked={labels} onChange={event=>setLabels(event.target.checked)}/> Include project name and entry label</label>
      <textarea aria-label="Project metadata report" readOnly rows={8} value={projectInfoReport(snapshot,baseline,labels)}/>
      <p>Review before copying. The selected absolute project path is never included.</p>
    </>}
  </section>;
}
