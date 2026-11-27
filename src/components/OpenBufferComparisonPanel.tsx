import { useState } from 'react';
import type { EditorState } from '../model/editorState';
import { bufferComparisonIsCurrent,compareOpenBuffers,planBufferTransfer,reviewBufferTransfer,visibleTransferText,
  type BufferComparison,type BufferSide,type BufferTransferPlan,type TransferReview,type BufferVersion } from '../model/openBufferComparison';
import type { InsightNavigation } from './SourceInsightsPanel';
interface Props{
  editor:EditorState;
  busy:boolean;
  undoAvailable:boolean;
  onApply:(plan:BufferTransferPlan)=>boolean;
  onUndo:()=>void;
  onNavigate:(target:InsightNavigation)=>void;
}
export function OpenBufferComparisonPanel({editor,busy,undoAvailable,onApply,onUndo,onNavigate}:Props){
  const [expanded,setExpanded]=useState(false);
  const [targetId,setTargetId]=useState('');
  const [referenceId,setReferenceId]=useState('');
  const [targetVersion,setTargetVersion]=useState<BufferVersion>('working');
  const [referenceVersion,setReferenceVersion]=useState<BufferVersion>('working');
  const [comparison,setComparison]=useState<BufferComparison|null>(null);
  const [review,setReview]=useState<TransferReview|null>(null);
  const [selected,setSelected]=useState<readonly number[]>([]);
  const [plan,setPlan]=useState<BufferTransferPlan|null>(null);
  const [context,setContext]=useState(true);
  const [notice,setNotice]=useState('');
  const [page,setPage]=useState(1);
  const target=editor.documents.some(doc=>doc.id===targetId)?targetId:editor.activeId??'';
  const reference=editor.documents.some(doc=>doc.id===referenceId)?referenceId:editor.documents.find(doc=>doc.id!==target)?.id??target;
  const stale=!!comparison&&!bufferComparisonIsCurrent(comparison,editor);
  function reset(){setComparison(null);setReview(null);setSelected([]);setPlan(null);setNotice('');setPage(1);}
  function prepare(){
    reset();
    const result=compareOpenBuffers(editor,{target:{documentId:target,version:targetVersion},reference:{documentId:reference,version:referenceVersion}});
    if(result.ok)setComparison(result.value);else setNotice(result.error);
  }
  function side(label:string,value:BufferSide,onId:(id:string)=>void,onVersion:(v:BufferVersion)=>void){
    return <div className="buffer-compare-side">
      <label>{label}<select aria-label={label+' buffer'} value={value.documentId} onChange={event=>{onId(event.target.value);reset();}}>
        <option value="" disabled>Choose an open buffer</option>
        {editor.documents.map((doc,index)=><option key={doc.id} value={doc.id}>{index+1}. {doc.name}</option>)}
      </select></label>
      <select aria-label={label+' version'} value={value.version} onChange={event=>{
        if(event.target.value==='working'||event.target.value==='saved'){onVersion(event.target.value);reset();}
      }}><option value="working">Working text</option><option value="saved">Last saved snapshot</option></select>
    </div>;
  }
  function navigate(which:'target'|'reference',line:number){
    if(!comparison||stale||busy||comparison.request[which].version!=='working')return;
    const doc=comparison[which];
    onNavigate({documentId:doc.id,revision:doc.revision,source:doc.content,line,column:1});
  }
  const pages=Math.max(1,Math.ceil((review?.blocks.length??0)/8)),shownPage=Math.min(page,pages);
  return <section className="sidebar-section open-buffer-comparison" aria-label="Compare open source buffers">
    <div className="sidebar-heading">COMPARE BUFFERS</div>
    <button type="button" className="insights-toggle" aria-expanded={expanded} onClick={()=>{setExpanded(v=>!v);reset();}}>
      <span aria-hidden="true">{expanded?'▾':'▸'}</span><span>{expanded?'Hide buffer comparison':'Compare open buffers'}</span>
    </button>
    {expanded&&<div className="insights-body">
      <p>Compare two open working or last-saved snapshots. This is not a disk comparison, Git merge or compiler analysis.</p>
      {side('Target',{documentId:target,version:targetVersion},setTargetId,setTargetVersion)}
      {side('Reference',{documentId:reference,version:referenceVersion},setReferenceId,setReferenceVersion)}
      <button type="button" disabled={busy||!target||!reference} onClick={prepare}>Compare selected snapshots</button>
      {comparison&&<>
        <p>Target → reference: {comparison.target.name} ({comparison.request.target.version}) → {comparison.reference.name} ({comparison.request.reference.version})</p>
        {stale&&<p role="alert">Editor session changed. This comparison is historical; compare again.</p>}
        {comparison.report.status==='clean'?<p role="status">Selected text is identical.</p>:
          comparison.report.status==='limited'?<p role="status">{comparison.report.message}</p>:<>
            <p role="status">+{comparison.report.addedLines} / −{comparison.report.removedLines} lines in reference relative to target.</p>
            {comparison.report.message&&<p>{comparison.report.message}</p>}
            <label><input type="checkbox" checked={context} onChange={event=>setContext(event.target.checked)}/> Show unchanged context</label>
            {comparison.report.hunks.map(hunk=><section className="changes-hunk" key={hunk.id}>
              <div className="changes-hunk-header">Target {hunk.beforeStart},{hunk.beforeCount} → reference {hunk.afterStart},{hunk.afterCount}</div>
              {comparison.request.target.version==='working'&&hunk.beforeCount>0&&<button type="button" disabled={busy||stale} onClick={()=>navigate('target',hunk.beforeStart)}>Go to target line {hunk.beforeStart}</button>}
              {comparison.request.reference.version==='working'&&hunk.afterCount>0&&<button type="button" disabled={busy||stale} onClick={()=>navigate('reference',hunk.afterStart)}>Go to reference line {hunk.afterStart}</button>}
              {hunk.lines.filter(line=>context||line.kind!=='context').map((line,i)=><div key={i} className={'changes-line changes-line-'+line.kind}>
                <span>{line.kind==='added'?'+':line.kind==='removed'?'−':'·'}</span><span>{line.beforeLine??'–'} → {line.afterLine??'–'}</span>
                <code dir="auto">{line.preview}{line.previewTruncated?'…':''}</code>
              </div>)}
            </section>)}
          </>}
        <button type="button" disabled={busy||stale||comparison.request.target.version!=='working'||comparison.report.status!=='ready'} onClick={()=>{
          setPlan(null);setSelected([]);setPage(1);
          const result=reviewBufferTransfer(comparison,editor);
          if(result.ok){setReview(result.value);setNotice('');}else{setReview(null);setNotice(result.error);}
        }}>Review exact transfer blocks</button>
      </>}
      {review&&<>
        <p>Select changed blocks to copy from reference into target. These previews show exact escaped text including separators. No source outside selected blocks is replaced.</p>
        <p role="status">{selected.length}/{review.blocks.length} blocks selected.</p>
        <div className="identifier-actions">
          <button type="button" disabled={busy||stale||!!plan} onClick={()=>setSelected(review.blocks.map(block=>block.id))}>Select all transfer blocks</button>
          <button type="button" disabled={busy||stale||!!plan} onClick={()=>setSelected([])}>Clear transfer selection</button>
        </div>
        {review.blocks.slice((shownPage-1)*8,shownPage*8).map(block=><label className="buffer-transfer-block" key={block.id}>
          <span><input type="checkbox" checked={selected.includes(block.id)} disabled={busy||stale||!!plan} onChange={event=>
            setSelected(event.target.checked?[...selected,block.id]:selected.filter(id=>id!==block.id))}/>
            Block {block.id} · target line {block.beforeLine} → reference line {block.afterLine}</span>
          <span>Target text ({block.before.length} units)</span><code dir="auto">{visibleTransferText(block.before)}</code>
          <span>Reference text ({block.after.length} units)</span><code dir="auto">{visibleTransferText(block.after)}</code>
        </label>)}
        {pages>1&&<div className="insights-pages"><button type="button" disabled={shownPage===1} onClick={()=>setPage(shownPage-1)}>Previous blocks</button>
          <span>{shownPage}/{pages}</span><button type="button" disabled={shownPage===pages} onClick={()=>setPage(shownPage+1)}>Next blocks</button></div>}
        <button type="button" disabled={busy||stale||!selected.length||!!plan} onClick={()=>{
          const result=planBufferTransfer(review,selected,editor);
          if(result.ok){setPlan(result.value);setNotice('');}else setNotice(result.error);
        }}>Review selected transfer</button>
      </>}
      {plan&&<div className="transfer-review" role="group" aria-label="Confirm buffer transfer">
        <p>Apply {plan.selectedIds.length} exact reviewed blocks to {plan.change.snapshot.name} in memory? The reference and all saved snapshots remain unchanged.</p>
        <button type="button" disabled={busy||stale} onClick={()=>{const success=onApply(plan);reset();setNotice(success?'Transfer applied. Review or Undo before Save.':'Transfer rejected. Compare again.');}}>Confirm buffer transfer</button>
        <button type="button" onClick={()=>setPlan(null)}>Cancel buffer transfer</button>
      </div>}
      <button type="button" disabled={busy||!undoAvailable} onClick={onUndo}>Undo last buffer transfer</button>
      {notice&&<p role="status">{notice}</p>}
    </div>}
  </section>;
}
