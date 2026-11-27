import { useState } from 'react';
import type { EditorState } from '../model/editorState';
import { isDirty } from '../model/documents';
import { canReloadReviewedDiskRow,diskReviewCandidates,summarizeWorkspaceDiskReview,workspaceDiskReviewCurrent,
  MAX_DISK_REVIEW_FILES,MAX_DISK_REVIEW_BYTES,type WorkspaceDiskReview,type WorkspaceDiskResult,type WorkspaceDiskRow } from '../model/workspaceDiskReview';

interface Props{
  editor:EditorState;
  busy:boolean;
  native:boolean;
  onScan:()=>Promise<WorkspaceDiskResult<WorkspaceDiskReview>>;
  onReload:(review:WorkspaceDiskReview,ids:readonly string[])=>Promise<WorkspaceDiskResult<number>>;
}
const statusLabel=(row:WorkspaceDiskRow):string=>{
  if(row.kind==='unavailable')return 'Could not read';
  if(row.kind==='skipped')return 'Not checked';
  switch(row.report.status){
    case 'unchanged':return 'Disk unchanged';
    case 'external-change':return 'External changes';
    case 'conflict':return 'Disk and unsaved changes differ';
    case 'disk-matches-editor':return 'Disk matches editor, saved baseline differs';
  }
};

export function WorkspaceDiskReviewPanel({editor,busy,native,onScan,onReload}:Props){
  const [expanded,setExpanded]=useState(false);
  const [review,setReview]=useState<WorkspaceDiskReview|null>(null);
  const [selection,setSelection]=useState<readonly string[]>([]);
  const [acknowledged,setAcknowledged]=useState(false);
  const [pending,setPending]=useState(false);
  const [notice,setNotice]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [filter,setFilter]=useState<'all'|'changed'|'reloadable'>('all');
  const current=review!==null&&workspaceDiskReviewCurrent(review,editor);
  const locked=busy||pending||!native;
  const eligible=review?.rows.filter(canReloadReviewedDiskRow)??[];
  const summary=review?summarizeWorkspaceDiskReview(review):null;
  const rows=review?.rows.filter(row=>filter==='all'||
    (filter==='reloadable'?canReloadReviewedDiskRow(row):row.kind!=='read'||row.report.status!=='unchanged'))??[];

  function resetSelection(){setSelection([]);setAcknowledged(false);}
  async function scan(){
    if(locked)return;
    setPending(true);setReview(null);resetSelection();setError(null);setNotice(null);
    try{
      const result=await onScan();
      if(result.ok){setReview(result.value);setFilter('all');setNotice('Disk review finished. No editor buffers or files were changed.');}
      else setError(result.error);
    }catch(caught){setError(caught instanceof Error?caught.message:String(caught));}
    finally{setPending(false);}
  }
  async function reload(){
    if(locked||!review||!current||!selection.length||!acknowledged)return;
    setPending(true);setError(null);setNotice(null);
    try{
      const result=await onReload(review,selection);
      if(result.ok){setReview(null);setNotice('Reloaded '+result.value+' clean source tab(s). No disk writes were made.');}
      else setError(result.error);
    }catch(caught){setError(caught instanceof Error?caught.message:String(caught));}
    finally{resetSelection();setPending(false);}
  }
  function toggle(id:string,checked:boolean){
    setSelection(previous=>checked?[...previous.filter(item=>item!==id),id]:previous.filter(item=>item!==id));
    setAcknowledged(false);
  }

  return <section className="sidebar-section workspace-disk-review" aria-label="Open source disk review">
    <button type="button" className="insights-toggle" aria-expanded={expanded} aria-controls="workspace-disk-review"
      disabled={pending} onClick={()=>{setExpanded(value=>!value);setReview(null);resetSelection();}}>
      <span aria-hidden="true">{expanded?'▾':'▸'}</span><span>Review external file changes</span>
    </button>
    {expanded&&<div id="workspace-disk-review">
      <p>Compare already-open sources against disk and their last saved text. Untitled files are not scanned.
        No files are written. Dirty buffers cannot be batch reloaded.</p>
      <p>{diskReviewCandidates(editor.documents).length} file-backed tab(s). Review up to {MAX_DISK_REVIEW_FILES} files,
        {MAX_DISK_REVIEW_BYTES/1024/1024} MiB of source data.</p>
      <button type="button" disabled={locked||!diskReviewCandidates(editor.documents).length} onClick={()=>void scan()}>
        {pending?'Checking…':'Check open files against disk'}
      </button>
      {!native&&<p>Available in the desktop application.</p>}
      {notice&&<p role="status">{notice}</p>}
      {error&&<p role="alert">{error}</p>}
      {review&&summary&&<>
        {!current&&<p role="alert">Editor session changed. This historical result cannot authorize a reload.</p>}
        <dl className="disk-review-summary">
          <dt>Unchanged</dt><dd>{summary.unchanged}</dd>
          <dt>External changes</dt><dd>{summary.changed}</dd>
          <dt>Conflicts</dt><dd>{summary.conflicts}</dd>
          <dt>Disk matches dirty editor</dt><dd>{summary.matching}</dd>
          <dt>Unavailable</dt><dd>{summary.unavailable}</dd>
          <dt>Not checked</dt><dd>{summary.skipped}</dd>
        </dl>
        <label>Filter reviewed files<select aria-label="Disk review filter" value={filter}
          onChange={event=>setFilter(event.target.value as typeof filter)}>
          <option value="all">All reviewed files</option><option value="changed">Changes or unavailable</option>
          <option value="reloadable">Eligible clean tabs</option>
        </select></label>
        <button type="button" disabled={locked||!current||!eligible.length} onClick={()=>{
          setSelection(eligible.map(row=>row.snapshot.id));setAcknowledged(false);
        }}>Select all eligible clean tabs</button>
        <button type="button" disabled={locked||!selection.length} onClick={resetSelection}>Clear selection</button>
        <ul className="disk-review-results">
          {rows.map(row=><li key={row.snapshot.id}>
            <label><input type="checkbox" checked={selection.includes(row.snapshot.id)}
              disabled={locked||!current||!canReloadReviewedDiskRow(row)}
              onChange={event=>toggle(row.snapshot.id,event.target.checked)}/>
              <strong>{row.snapshot.name}</strong>{isDirty(row.snapshot)?' · Unsaved edits':''}</label>
            <span>{statusLabel(row)}</span>
            {row.snapshot.path&&<small title={row.snapshot.path}>{row.snapshot.path}</small>}
            {row.kind==='unavailable'&&<p>{row.error}</p>}
            {row.kind==='skipped'&&<p>{row.reason}</p>}
            {row.kind==='read'&&row.report.status!=='unchanged'&&<details>
              <summary>Review difference near line {row.report.externalLine??1}</summary>
              <p>Saved baseline</p><pre>{row.report.savedExcerpt??'(no excerpt)'}</pre>
              <p>Current disk</p><pre>{row.report.diskExcerpt??'(no excerpt)'}</pre>
              {row.report.editorDirty&&<><p>Unsaved editor</p><pre>{row.report.editorExcerpt??'(matches disk)'}</pre></>}
            </details>}
          </li>)}
        </ul>
        {!rows.length&&<p>No reviewed files match this filter.</p>}
        <p>{selection.length} clean tab(s) selected across all filters.</p>
        {selection.length>0&&<div className="transfer-review">
          <p>Reload only the selected clean tabs if every disk file still matches its preview.
            The whole batch is rejected on a failed recheck. Unsaved buffers are excluded.</p>
          <label><input type="checkbox" checked={acknowledged} disabled={locked||!current}
            onChange={event=>setAcknowledged(event.target.checked)}/>I reviewed the selected external changes.</label>
          <button type="button" disabled={locked||!current||!acknowledged}
            onClick={()=>void reload()}>Recheck and reload selected clean tabs</button>
        </div>}
        <button type="button" disabled={pending} onClick={()=>{setReview(null);resetSelection();}}>Dismiss review</button>
      </>}
    </div>}
  </section>;
}
