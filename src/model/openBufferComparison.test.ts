import { describe,expect,it } from 'vitest';
import { editorReducer,initialEditorState,type EditorState } from './editorState';
import { compareOpenBuffers,reviewBufferTransfer,planBufferTransfer,bufferTransferIsCurrent,
  bufferComparisonIsCurrent,MAX_TRANSFER_BLOCK_UNITS,MAX_TRANSFER_BLOCKS,visibleTransferText,
  type BufferComparisonRequest } from './openBufferComparison';
import { exactSnapshotEditBlocks,countSnapshotLines,compareScarpSnapshots } from './sourceDiff';
import { AutoSaveReviewGate } from './autoSaveReviewGate';
import { createOpenFileReplaceUndo,canUndoOpenFileReplace } from './openFileReplaceUndo';

function fixture(left:string,right:string){
  let editor=editorReducer(initialEditorState,{type:'open',path:'C:/work/target.srp',content:left});
  const target=editor.activeId!;
  editor=editorReducer(editor,{type:'open',path:'C:/work/reference.srp',content:right});
  const reference=editor.activeId!;
  const request:BufferComparisonRequest={target:{documentId:target,version:'working'},reference:{documentId:reference,version:'working'}};
  return {editor,target,reference,request};
}
function compare(editor:EditorState,request:BufferComparisonRequest){
  const result=compareOpenBuffers(editor,request);
  if(!result.ok)throw Error(result.error);
  return result.value;
}
function review(editor:EditorState,request:BufferComparisonRequest){
  const result=reviewBufferTransfer(compare(editor,request),editor);
  if(!result.ok)throw Error(result.error);
  return result.value;
}
function applyAll(left:string,right:string){
  const {editor,request}=fixture(left,right);
  const reviewed=review(editor,request);
  const plan=planBufferTransfer(reviewed,reviewed.blocks.map(block=>block.id),editor);
  if(!plan.ok)throw Error(plan.error);
  return plan.value;
}
describe('exact bounded snapshot edit blocks',()=>{
  it.each([
    ['a','b'],['','a'],['a',''],['a\n','a'],['a','a\n'],
    ['a\nb\nc','a\nc'],['a\nc','a\nb\nc'],['a\r\nb\rc','a\r\nx\rc'],
    ['a\nb\n','b\na\n'],['a\r\n','a\n'],['\n','\r'],['😀\na','😀\nb'],
  ])('reconstructs the reference using only exact spans: %j → %j',(left,right)=>{
    const result=exactSnapshotEditBlocks(left,right);
    if(!result.ok)throw Error(result.error);
    let offset=0;
    const chunks:string[]=[];
    for(const block of result.blocks){
      expect(block.beforeStart).toBeGreaterThanOrEqual(offset);
      chunks.push(left.slice(offset,block.beforeStart),right.slice(block.afterStart,block.afterEnd));
      offset=block.beforeEnd;
    }
    chunks.push(left.slice(offset));
    expect(chunks.join('')).toBe(right);
    expect(applyAll(left,right).change.content).toBe(right);
  });
  it('does not invent edits for identical text',()=>{
    expect(exactSnapshotEditBlocks('a\r\n','a\r\n')).toEqual({ok:true,blocks:[]});
  });
  it('uses separate non-context blocks even if their preview hunks overlap',()=>{
    const left='old\nsame\nold\n',right='new\nsame\nnew\n';
    const result=exactSnapshotEditBlocks(left,right);
    if(!result.ok)throw Error(result.error);
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks.map(block=>left.slice(block.beforeStart,block.beforeEnd))).toEqual(['old\n','old\n']);
  });
  it('bounds diff complexity and counts huge line inventories without splitting them',()=>{
    expect(countSnapshotLines('\r\n\r\nx\rx\n')).toBe(5);
    expect(countSnapshotLines('\n'.repeat(100000))).toBe(100001);
    expect(exactSnapshotEditBlocks('a\n'.repeat(1000),'b\n'.repeat(1000)).ok).toBe(false);
    expect(exactSnapshotEditBlocks('a\n'.repeat(2401),'b').ok).toBe(false);
    expect(compareScarpSnapshots('\n'.repeat(100000),'changed')).toMatchObject({status:'limited',beforeLines:100001});
  });
  it('does not split surrogate pairs in the shared compact preview',()=>{
    const report=compareScarpSnapshots('a'+'😀'.repeat(150),'different');
    const line=report.hunks.flatMap(h=>h.lines).find(l=>l.kind==='removed')!;
    expect(line.previewTruncated).toBe(true);
    expect(new TextDecoder().decode(new TextEncoder().encode(line.preview))).toBe(line.preview);
  });
});
describe('open-buffer comparison',()=>{
  it('compares independently selected working and saved snapshots',()=>{
    const {editor,target,reference,request}=fixture('old','reference');
    const changed=editorReducer(editor,{type:'edit',id:target,content:'working'});
    const report=compare(changed,{...request,reference:{documentId:target,version:'saved'}});
    expect(report.targetText).toBe('working');
    expect(report.referenceText).toBe('old');
    expect(report.reference.id).toBe(target);
    expect(compare(changed,request).reference.id).toBe(reference);
  });
  it('refuses identical side selectors or unavailable buffers',()=>{
    const {editor,request}=fixture('old','new');
    expect(compareOpenBuffers(editor,{target:request.target,reference:request.target}).ok).toBe(false);
    expect(compareOpenBuffers(editor,{...request,reference:{documentId:'missing',version:'working'}}).ok).toBe(false);
  });
  it('does not allow transferring into a saved snapshot',()=>{
    const {editor,request}=fixture('old','new');
    const report=compare(editor,{...request,target:{...request.target,version:'saved'}});
    expect(reviewBufferTransfer(report,editor).ok).toBe(false);
  });
  it('rejects stale and forged comparisons, even after edit/revert',()=>{
    const {editor,target,request}=fixture('old','new');
    const report=compare(editor,request);
    const edited=editorReducer(editor,{type:'edit',id:target,content:'different'});
    const restored=editorReducer(edited,{type:'edit',id:target,content:'old'});
    expect(bufferComparisonIsCurrent(report,restored)).toBe(false);
    expect(reviewBufferTransfer(report,restored).ok).toBe(false);
    expect(reviewBufferTransfer({...report,referenceText:'fabricated'},editor).ok).toBe(false);
    expect(reviewBufferTransfer({...report,target:{...report.target,content:'fabricated'}},editor).ok).toBe(false);
  });
  it('rejects an exact transfer review when changed blocks exceed the full preview budget',()=>{
    const {editor,request}=fixture('a'.repeat(MAX_TRANSFER_BLOCK_UNITS+1),'new');
    expect(reviewBufferTransfer(compare(editor,request),editor).ok).toBe(false);
    const left=Array.from({length:MAX_TRANSFER_BLOCKS+1},(_,i)=>'old'+i+'\nanchor'+i).join('\n');
    const right=left.replaceAll('old','new');
    const many=fixture(left,right);
    expect(reviewBufferTransfer(compare(many.editor,many.request),many.editor).ok).toBe(false);
  });
});
describe('selected exact transfer and undo',()=>{
  it('copies a selected block only and preserves both reference and saved source',()=>{
    const {editor,target,reference,request}=fixture('old1\nsame\nold2\n','new1\nsame\nnew2\n');
    const reviewed=review(editor,request);
    const selected=planBufferTransfer(reviewed,[reviewed.blocks[1].id],editor);
    if(!selected.ok)throw Error(selected.error);
    expect(selected.value.change.content).toBe('old1\nsame\nnew2\n');
    expect(bufferTransferIsCurrent(selected.value,editor)).toBe(true);
    const applied=editorReducer(editor,{type:'replace-open-files',changes:[selected.value.change],allSnapshots:editor.documents});
    expect(applied.documents.find(doc=>doc.id===reference)).toBe(editor.documents.find(doc=>doc.id===reference));
    const doc=applied.documents.find(doc=>doc.id===target)!;
    expect(doc.savedContent).toBe('old1\nsame\nold2\n');
    const gate=new AutoSaveReviewGate();gate.holdReplacements(applied.documents,[target]);
    expect(gate.canWrite(doc,doc,true)).toBe(false);
    const undo=createOpenFileReplaceUndo(editor.documents,applied.documents)!;
    expect(canUndoOpenFileReplace(undo,applied)).toBe(true);
    const restored=editorReducer(applied,{type:'replace-open-files',changes:undo.changes,allSnapshots:undo.after});
    expect(restored.documents.find(doc=>doc.id===target)?.content).toBe(doc.savedContent);
  });
  it('rejects forged blocks, selected IDs and changed target content',()=>{
    const {editor,request}=fixture('old','new');
    const reviewed=review(editor,request);
    for(const ids of [[],[999],[1,1]])expect(planBufferTransfer(reviewed,ids,editor).ok).toBe(false);
    expect(planBufferTransfer({...reviewed,blocks:[{...reviewed.blocks[0],after:'fake'}]},[1],editor).ok).toBe(false);
    const result=planBufferTransfer(reviewed,[1],editor);
    if(!result.ok)throw Error(result.error);
    expect(bufferTransferIsCurrent({...result.value,change:{...result.value.change,content:'fake'}},editor)).toBe(false);
  });
  it('shows escape characters and empty text explicitly in full previews',()=>{
    expect(visibleTransferText('')).toBe('""');
    expect(visibleTransferText('a\r\nb\t')).toBe('"a\\r\\nb\\t"');
    expect(visibleTransferText('a\u202eb')).toBe('"a\\u202eb"');
  });
});
