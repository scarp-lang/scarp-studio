import { describe, expect, it, vi } from 'vitest';
import { editorReducer,initialEditorState,currentActiveDocument } from './editorState';
import { isDirty } from './documents';
import { buildReconciliationGroups,createDiskReconciliationReview,initialReconciliationResolutions,
  planDiskReconciliation,diskReconciliationPlanCurrent,recheckDiskReconciliation,visibleReconciliationText,
  MAX_RECONCILIATION_GROUP_UNITS,MAX_RECONCILIATION_READ_BYTES,type ReconciliationResult } from './diskReconciliation';

function value<T>(result:ReconciliationResult<T>):T{
  if(!result.ok)throw new Error(result.error);
  return result.value;
}
function setup(base='a\nmiddle\nb\n',local='A\nmiddle\nb\n',disk='a\nmiddle\nB\n'){
  const opened=editorReducer(initialEditorState,{type:'open',path:'/project/main.srp',content:base});
  const id=opened.activeId!;
  const editor=editorReducer(opened,{type:'edit',id,content:local});
  const snapshot=currentActiveDocument(editor)!;
  const review=value(createDiskReconciliationReview(editor,snapshot,disk));
  return {editor,snapshot,review,disk,id};
}
describe('exact reconciliation regions',()=>{
  it('preserves disjoint changes and their base coordinates',()=>{
    const {editor,review}=setup();
    expect(review.groups.map(group=>group.kind)).toEqual(['local-only','disk-only']);
    expect(review.groups.map(group=>group.base)).toEqual(['a\n','b\n']);
    const plan=value(planDiskReconciliation(review,initialReconciliationResolutions(review.groups),editor));
    expect(plan.content).toBe('A\nmiddle\nB\n');
  });
  it('requires a decision for conflicting replacements',()=>{
    const {editor,review}=setup('a\n','local\n','disk\n');
    expect(review.groups).toHaveLength(1);
    expect(review.groups[0].kind).toBe('conflict');
    expect(initialReconciliationResolutions(review.groups)).toEqual([]);
    expect(planDiskReconciliation(review,[],editor).ok).toBe(false);
    for(const [choice,expected] of [['local','local\n'],['disk','disk\n'],['base','a\n']] as const){
      expect(value(planDiskReconciliation(review,[{id:1,choice}],editor)).content).toBe(expected);
    }
  });
  it('groups touching changes instead of silently combining them',()=>{
    const groups=value(buildReconciliationGroups('a\nb\n','A\nb\n','a\nB\n'));
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('conflict');
    expect(groups[0].local).toBe('A\nb\n');
    expect(groups[0].disk).toBe('a\nB\n');
  });
  it('groups insertions at the same boundary',()=>{
    const groups=value(buildReconciliationGroups('a\n','local\na\n','disk\na\n'));
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({start:0,end:0,base:'',local:'local\n',disk:'disk\n',kind:'conflict'});
  });
  it('suggests one copy of identical changes',()=>{
    const {editor,review}=setup('a\n','A\n','A\n');
    expect(review.groups[0].kind).toBe('identical');
    const plan=value(planDiskReconciliation(review,initialReconciliationResolutions(review.groups),editor));
    expect(plan.content).toBe('A\n');
    expect(plan.content).toBe(plan.diskContent);
  });
  it('handles deletion and a separated insertion',()=>{
    const {editor,review}=setup('a\nmiddle\nb\n','middle\nb\n','a\nmiddle\nb\nc\n');
    const plan=value(planDiskReconciliation(review,initialReconciliationResolutions(review.groups),editor));
    expect(plan.content).toBe('middle\nb\nc\n');
  });
  it('preserves mixed line endings and Unicode outside manual edits',()=>{
    const {editor,review}=setup('a\r\n🙂\nb\r\n','A\r\n🙂\nb\r\n','a\r\n🙂\nβ\r\n');
    const plan=value(planDiskReconciliation(review,initialReconciliationResolutions(review.groups),editor));
    expect(plan.content).toBe('A\r\n🙂\nβ\r\n');
    expect(visibleReconciliationText('\r\n\u202e')).toBe('"\\r\\n\\u202e"');
  });
  it('rejects oversized region and malformed UTF-16',()=>{
    expect(buildReconciliationGroups('a','x'.repeat(MAX_RECONCILIATION_GROUP_UNITS+1),'b').ok).toBe(false);
    expect(buildReconciliationGroups('a','\ud800','b').ok).toBe(false);
  });
});
describe('review and plan identity',()=>{
  it('supports explicit bounded manual resolution',()=>{
    const {editor,review}=setup('a\n','local\n','disk\n');
    const plan=value(planDiskReconciliation(review,[{id:1,choice:'manual',manual:'merged\n'}],editor));
    expect(plan.content).toBe('merged\n');
    expect(diskReconciliationPlanCurrent(plan,editor)).toBe(true);
    expect(diskReconciliationPlanCurrent({...plan,content:'forged'},editor)).toBe(false);
  });
  it('rejects missing, duplicate, unknown and malformed decisions',()=>{
    const {editor,review}=setup();
    for(const resolutions of [[],[{id:1,choice:'local'},{id:1,choice:'disk'}],
      [{id:1,choice:'local'},{id:999,choice:'disk'}],
      [{id:1,choice:'manual',manual:'\ud800'},{id:2,choice:'disk'}],
      [{id:1,choice:'manual',manual:'x'.repeat(MAX_RECONCILIATION_GROUP_UNITS+1)},{id:2,choice:'disk'}]] as const){
      expect(planDiskReconciliation(review,resolutions,editor).ok).toBe(false);
    }
  });
  it('rejects an altered preview even with otherwise valid choices',()=>{
    const {editor,review}=setup();
    const forged={...review,groups:review.groups.map(group=>({...group,disk:'forged'}))};
    expect(planDiskReconciliation(forged,initialReconciliationResolutions(review.groups),editor).ok).toBe(false);
  });
  it('rejects edit-and-revert and unrelated editor transitions',()=>{
    const {editor,review,id,snapshot}=setup();
    const choices=initialReconciliationResolutions(review.groups);
    const edited=editorReducer(editor,{type:'edit',id,content:'changed'});
    const reverted=editorReducer(edited,{type:'edit',id,content:snapshot.content});
    expect(planDiskReconciliation(review,choices,reverted).ok).toBe(false);
    expect(planDiskReconciliation(review,choices,editorReducer(editor,{type:'new'})).ok).toBe(false);
  });
  it('requires a dirty named source with a changed disk baseline',()=>{
    const {editor,snapshot}=setup();
    expect(createDiskReconciliationReview(editor,snapshot,snapshot.savedContent).ok).toBe(false);
    const clean=editorReducer(editor,{type:'edit',id:snapshot.id,content:snapshot.savedContent});
    expect(createDiskReconciliationReview(clean,currentActiveDocument(clean)!,'external').ok).toBe(false);
    expect(createDiskReconciliationReview(initialEditorState,currentActiveDocument(initialEditorState)!,'external').ok).toBe(false);
  });
});
describe('native read recheck and atomic application',()=>{
  it('independently rereads the reviewed file within a bounded budget',async()=>{
    const {editor,review,disk}=setup();
    const plan=value(planDiskReconciliation(review,initialReconciliationResolutions(review.groups),editor));
    const read=vi.fn(async()=>disk);
    expect(await recheckDiskReconciliation(plan,editor,read,()=>true)).toEqual({ok:true,value:plan});
    expect(read).toHaveBeenCalledExactlyOnceWith('/project/main.srp',MAX_RECONCILIATION_READ_BYTES);
  });
  it('rejects changed or unreadable disk and a stale native result',async()=>{
    const {editor,review,disk}=setup();
    const plan=value(planDiskReconciliation(review,initialReconciliationResolutions(review.groups),editor));
    expect((await recheckDiskReconciliation(plan,editor,async()=>disk+'!',()=>true)).ok).toBe(false);
    expect((await recheckDiskReconciliation(plan,editor,async()=>{throw Error('denied');},()=>true)).ok).toBe(false);
    let current=true;
    expect((await recheckDiskReconciliation(plan,editor,async()=>{current=false;return disk;},()=>current)).ok).toBe(false);
  });
  it('does not read when the preview is already stale',async()=>{
    const {editor,review}=setup();
    const plan=value(planDiskReconciliation(review,initialReconciliationResolutions(review.groups),editor));
    const read=vi.fn(async()=>plan.diskContent);
    expect((await recheckDiskReconciliation(plan,editor,read,()=>false)).ok).toBe(false);
    expect(read).not.toHaveBeenCalled();
  });
  it('adopts verified disk baseline without pretending merged text was saved',()=>{
    const {editor,review,snapshot,disk}=setup();
    const plan=value(planDiskReconciliation(review,initialReconciliationResolutions(review.groups),editor));
    const next=editorReducer(editor,{type:'reconcile-disk-source',snapshot,allSnapshots:editor.documents,content:plan.content,diskContent:disk});
    const active=currentActiveDocument(next)!;
    expect(active.savedContent).toBe(disk);
    expect(active.content).toBe('A\nmiddle\nB\n');
    expect(isDirty(active)).toBe(true);
    expect(active.revision).toBe(snapshot.revision+1);
    expect(next.sessionRevision).toBe(editor.sessionRevision+1);
    const undo=editorReducer(next,{type:'replace-open-files',allSnapshots:next.documents,
      changes:[{id:active.id,snapshot:active,content:snapshot.content}]});
    expect(currentActiveDocument(undo)?.content).toBe(snapshot.content);
    expect(currentActiveDocument(undo)?.savedContent).toBe(disk);
  });
  it('rejects a stale or malformed reducer action',()=>{
    const {editor,snapshot,disk}=setup();
    const action={type:'reconcile-disk-source' as const,snapshot,allSnapshots:editor.documents,content:'merged',diskContent:disk};
    expect(editorReducer(editor,{...action,content:'\ud800'})).toBe(editor);
    const newer=editorReducer(editor,{type:'edit',id:snapshot.id,content:'newer'});
    expect(editorReducer(newer,action)).toBe(newer);
    expect(editorReducer(editor,{...action,diskContent:snapshot.savedContent})).toBe(editor);
  });
});
