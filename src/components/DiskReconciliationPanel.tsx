import { useMemo,useState } from 'react';
import type { StudioDocument } from '../model/documents';
import type { EditorState } from '../model/editorState';
import { createDiskReconciliationReview,initialReconciliationResolutions,planDiskReconciliation,visibleReconciliationText,
  MAX_RECONCILIATION_GROUP_UNITS,type DiskReconciliationReview,type DiskReconciliationPlan,type ReconciliationResolution,
  type ResolutionKind,type ReconciliationResult,type ReconciliationGroup } from '../model/diskReconciliation';
interface Props{
  editor:EditorState;
  snapshot:StudioDocument;
  diskContent:string|null;
  busy:boolean;
  onApply:(plan:DiskReconciliationPlan)=>Promise<ReconciliationResult<boolean>>;
}
const labels:Record<ReconciliationGroup['kind'],string>={ 'local-only':'Local changes only','disk-only':'External changes only',
  identical:'Identical changes',conflict:'Overlapping or touching changes' };
const choices:readonly ResolutionKind[]=['local','disk','base','manual'];
const choiceLabels:Record<ResolutionKind,string>={local:'Keep working text',disk:'Use disk text',base:'Use old baseline text',manual:'Manual text'};
export function DiskReconciliationPanel({editor,snapshot,diskContent,busy,onApply}:Props){
  const [review,setReview]=useState<DiskReconciliationReview|null>(null);
  const [resolutions,setResolutions]=useState<readonly ReconciliationResolution[]>([]);
  const [pending,setPending]=useState(false);
  const [notice,setNotice]=useState('');
  const [page,setPage]=useState(1);
  const [preview,setPreview]=useState(false);
  const [ack,setAck]=useState(false);
  const [showAll,setShowAll]=useState(false);
  const result=useMemo(()=>review&&preview?planDiskReconciliation(review,resolutions,editor):null,[review,resolutions,editor,preview]);
  const conflictCount=review?.groups.filter(group=>group.kind==='conflict').length??0;
  const unresolved=review?.groups.filter(group=>!resolutions.some(resolution=>resolution.id===group.id)).length??0;
  const shown=review?.groups.filter(group=>showAll||group.kind==='conflict')??[];
  const pages=Math.max(1,Math.ceil(shown.length/4)),currentPage=Math.min(page,pages);
  function start(){
    if(diskContent===null)return;
    const next=createDiskReconciliationReview(editor,snapshot,diskContent);
    if(!next.ok){setNotice(next.error);return;}
    setReview(next.value);setResolutions(initialReconciliationResolutions(next.value.groups));
    setPage(1);setPreview(false);setAck(false);setNotice('');
    setShowAll(!next.value.groups.some(group=>group.kind==='conflict'));
  }
  function choose(id:number,choice:ResolutionKind,manual?:string){
    setResolutions(previous=>[...previous.filter(item=>item.id!==id),{id,choice,...(choice==='manual'?{manual:manual??''}:{})}]);
    setPreview(false);setAck(false);
  }
  async function apply(){
    if(!result?.ok||!ack||pending||busy)return;
    setPending(true);
    try{
      const response=await onApply(result.value);
      if(response.ok){setNotice('Reconciled editor memory against the verified disk baseline.');setReview(null);setPreview(false);}
      else setNotice(response.error);
    }catch(error){setNotice(error instanceof Error?error.message:String(error));}
    finally{setPending(false);setAck(false);}
  }
  return <section className="disk-reconciliation" aria-label="Reviewed three-way disk reconciliation">
    {!review?<button type="button" disabled={busy||diskContent===null} onClick={start}>Review three-way reconciliation</button>:<>
      <p>Compare last saved text, current working text and reviewed external disk text. Non-overlapping regions have suggested
        choices; touching/overlapping edits require explicit resolution. This is a textual merge, not semantic compiler validation. Region previews escape line endings; manual text uses the browser's newline handling.</p>
      <p>{review.groups.length} changed region(s) · {conflictCount} overlapping/touching · {unresolved} unresolved.</p>
      <label><input type="checkbox" checked={showAll} disabled={pending} onChange={event=>{setShowAll(event.target.checked);setPage(1);}}/>Show all changed regions, including suggested choices</label>
      {!shown.length&&<p>No overlapping regions. Review the suggested changes using Show all changed regions.</p>}
      {shown.slice((currentPage-1)*4,currentPage*4).map(group=>{
        const selected=resolutions.find(item=>item.id===group.id);
        return <div className="transfer-review" key={group.id}>
          <strong>Region {group.id} · saved line {group.baseLine} · {labels[group.kind]}</strong>
          <div className="reconciliation-columns">
            <div><strong>Old saved baseline</strong><pre>{visibleReconciliationText(group.base)}</pre></div>
            <div><strong>Working text</strong><pre>{visibleReconciliationText(group.local)}</pre></div>
            <div><strong>Reviewed disk text</strong><pre>{visibleReconciliationText(group.disk)}</pre></div>
          </div>
          <select aria-label={'Resolve region '+group.id} value={selected?.choice??''} disabled={pending||busy} onChange={event=>{
            const choice=event.target.value as ResolutionKind;
            if(choices.includes(choice))choose(group.id,choice,choice==='manual'?group.local:undefined);
          }}>
            {!selected&&<option value="">Choose resolution</option>}
            {choices.map(choice=><option key={choice} value={choice}>{choiceLabels[choice]}</option>)}
          </select>
          {selected?.choice==='manual'&&<textarea aria-label={'Manual resolution for region '+group.id} maxLength={MAX_RECONCILIATION_GROUP_UNITS}
            value={selected.manual??''} disabled={pending||busy} onChange={event=>choose(group.id,'manual',event.target.value)} rows={5}/>}
        </div>;
      })}
      {pages>1&&<div className="insights-pages"><button type="button" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>Previous regions</button>
        <span>{currentPage}/{pages}</span><button type="button" disabled={currentPage===pages} onClick={()=>setPage(currentPage+1)}>Next regions</button></div>}
      <button type="button" disabled={busy||pending||unresolved>0} onClick={()=>{setPreview(true);setAck(false);}}>Review complete reconciliation</button>
      {result&&!result.ok&&<p role="alert">{result.error}</p>}
      {result?.ok&&<div className="transfer-review">
        <p>Complete result: {result.value.content.length} UTF-16 units.
          {result.value.content===result.value.diskContent?' Working result equals disk.':' Working result remains unsaved.'}
          Studio will reread the disk snapshot and adopt it as the new saved baseline, without writing the file.</p>
        <textarea aria-label="Complete reconciled source preview" readOnly value={result.value.content} rows={10}/>
        <label><input type="checkbox" checked={ack} disabled={busy||pending} onChange={event=>setAck(event.target.checked)}/>
          I reviewed the result and agree to replace the editor text and adopt the reread disk baseline.</label>
        <button type="button" disabled={!ack||busy||pending} onClick={()=>void apply()}>{pending?'Rechecking disk…':'Apply reviewed reconciliation in memory'}</button>
      </div>}
      <button type="button" disabled={pending} onClick={()=>{setReview(null);setPreview(false);setResolutions([]);setAck(false);}}>Cancel reconciliation review</button>
    </>}
    {diskContent===null&&<p>Disk text exceeds the bounded reconciliation preview. Preserve edits using Save As and resolve manually.</p>}
    {notice&&<p role="status">{notice}</p>}
  </section>;
}
