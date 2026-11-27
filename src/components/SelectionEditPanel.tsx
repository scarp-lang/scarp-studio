import { useState } from 'react';
import type { EditorState } from '../model/editorState';
import { DEFAULT_SELECTION_REQUEST, SELECTION_OPERATIONS, SELECTION_LABELS, MAX_SELECTION_AFFIX,
  MAX_SELECTION_REPEAT, MAX_SELECTION_COUNT, selectionCaptureIsCurrent, selectionEditIsCurrent,
  planSelectionEdit, type SelectionCapture, type SelectionEditPlan, type SelectionRequest,
  type SelectionResult, type SelectionOperation } from '../model/selectionEdit';
import { visibleRangeText } from '../model/lineRangeTools';

interface Props{
  editor:EditorState;
  busy:boolean;
  undoAvailable:boolean;
  onCapture:()=>SelectionResult<SelectionCapture>;
  onApply:(plan:SelectionEditPlan)=>boolean;
  onUndo:()=>void;
}
export function SelectionEditPanel({editor,busy,undoAvailable,onCapture,onApply,onUndo}:Props){
  const [expanded,setExpanded]=useState(false);
  const [capture,setCapture]=useState<SelectionCapture|null>(null);
  const [request,setRequest]=useState<SelectionRequest>(DEFAULT_SELECTION_REQUEST);
  const [plan,setPlan]=useState<SelectionEditPlan|null>(null);
  const [notice,setNotice]=useState('');
  const stale=capture!==null&&!selectionCaptureIsCurrent(capture,editor);
  function update(patch:Partial<SelectionRequest>){
    setRequest(previous=>({...previous,...patch}));setPlan(null);setNotice('');
  }
  function captureNow(){
    setPlan(null);setCapture(null);
    const result=onCapture();
    if(result.ok){setCapture(result.value);setNotice('Captured exact selection ranges.');}
    else setNotice(result.error);
  }
  function review(){
    if(!capture)return;
    setPlan(null);
    const result=planSelectionEdit(editor,capture,request);
    if(result.ok){setPlan(result.value);setNotice('');}
    else setNotice(result.error);
  }
  const affix=request.operation==='surround'||request.operation==='unwrap';
  return <section className="sidebar-section selection-edit" aria-label="Reviewed selection editing">
    <div className="sidebar-heading">SELECTION EDITING</div>
    <button type="button" className="insights-toggle" aria-expanded={expanded} aria-controls="selection-edit-body"
      onClick={()=>setExpanded(value=>!value)}>
      <span aria-hidden="true">{expanded?'▾':'▸'}</span><span>{expanded?'Hide selection editing':'Review selection edits'}</span>
    </button>
    <div id="selection-edit-body" hidden={!expanded}>
      {expanded&&<div className="insights-body">
        <p>Select text in the editor, then capture it here. Up to {MAX_SELECTION_COUNT} separate nonempty selections
          are supported. The exact captured ranges, not a later cursor position, determine the preview.</p>
        <button type="button" disabled={busy||!editor.activeId} onClick={captureNow}>Capture editor selections</button>
        {capture&&<p>{capture.document.name} · {capture.spans.length} captured range(s)</p>}
        {stale&&<p role="alert">Source or editor session changed. Capture the selections again.</p>}
        <label>Selection operation<select aria-label="Selection operation" value={request.operation} onChange={event=>{
          const operation=event.target.value as SelectionOperation;
          if(SELECTION_OPERATIONS.includes(operation))update({operation});
        }}>{SELECTION_OPERATIONS.map(operation=><option key={operation} value={operation}>{SELECTION_LABELS[operation]}</option>)}</select></label>
        {affix&&<div className="range-tools-inputs">
          <label>Outer prefix<input aria-label="Selection outer prefix" value={request.prefix} maxLength={MAX_SELECTION_AFFIX}
            onChange={event=>update({prefix:event.target.value})}/></label>
          <label>Outer suffix<input aria-label="Selection outer suffix" value={request.suffix} maxLength={MAX_SELECTION_AFFIX}
            onChange={event=>update({suffix:event.target.value})}/></label>
        </div>}
        {request.operation==='unwrap'&&<p>Every selection must already contain both matching outer texts. Partial matches reject the entire edit.</p>}
        {request.operation==='duplicate'&&<label>Total copies<select aria-label="Selection total copies" value={request.copies}
          onChange={event=>update({copies:Number(event.target.value)})}>
          {Array.from({length:MAX_SELECTION_REPEAT-1},(_,i)=>i+2).map(copies=><option key={copies} value={copies}>{copies}</option>)}
        </select></label>}
        {request.operation==='replace-literal'&&<div className="range-tools-inputs">
          <label>Find literal<input aria-label="Selection find literal" value={request.find} maxLength={MAX_SELECTION_AFFIX}
            onChange={event=>update({find:event.target.value})}/></label>
          <label>Replace with<input aria-label="Selection replace literal" value={request.replacement} maxLength={MAX_SELECTION_AFFIX}
            onChange={event=>update({replacement:event.target.value})}/></label>
          <p>Case-sensitive, non-overlapping matches. Replacement text is literal; dollar signs have no special meaning.</p>
        </div>}
        {(request.operation==='uppercase'||request.operation==='lowercase')&&<p>Unicode case conversion can change the length of selected text and alter Scarp identifiers.</p>}
        {request.operation==='delete'&&<p>All captured ranges will be removed. Unselected text remains unchanged.</p>}
        <button type="button" disabled={busy||!capture||stale} onClick={review}>Review selection transformation</button>
        {plan&&<section className="transfer-review" role="group" aria-label="Confirm selection transformation">
          <strong>{SELECTION_LABELS[plan.request.operation]} · {plan.changed} changed range(s)</strong>
          <p>Review complete escaped text. This is a literal editing operation, not syntax validation or semantic refactoring.</p>
          <ol className="selection-preview-list">{plan.previews.map(row=><li key={row.span.start}>
            <strong>Line {row.line}, column {row.column} · offsets {row.span.start}–{row.span.end}</strong>
            {plan.request.operation==='replace-literal'&&<p>{row.occurrences} literal occurrence(s)</p>}
            <div className="selection-preview-row"><span>Before</span><code dir="auto">{visibleRangeText(row.before)}</code></div>
            <div className="selection-preview-row"><span>After</span><code dir="auto">{visibleRangeText(row.after)}</code></div>
          </li>)}</ol>
          <p>Confirm requires the same editor session, source and live selected ranges. Auto Save is held for reviewed changes until another explicit user action.</p>
          <button type="button" disabled={busy||!selectionEditIsCurrent(plan,editor)} onClick={()=>{
            const applied=onApply(plan);setPlan(null);setCapture(null);
            setNotice(applied?'Applied in memory. Review or Undo before saving.':'Selection edit rejected. Capture and review again.');
          }}>Confirm selection transformation</button>
          <button type="button" onClick={()=>setPlan(null)}>Cancel selection transformation</button>
        </section>}
        <button type="button" disabled={busy||!undoAvailable} onClick={onUndo}>Undo last selection transformation</button>
        {notice&&<p role="status">{notice}</p>}
      </div>}
    </div>
  </section>;
}
