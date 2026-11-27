import { describe,expect,it,vi } from 'vitest';
import { editorReducer,initialEditorState,type EditorState } from './editorState';
import { canReloadReviewedDiskRow,diskOperationCurrent,inspectWorkspaceDisk,prepareWorkspaceDiskReload,
  summarizeWorkspaceDiskReview,workspaceDiskReviewCurrent,MAX_DISK_REVIEW_FILES,MAX_DISK_REVIEW_BYTES } from './workspaceDiskReview';

function open(state:EditorState,path:string,content:string):EditorState{
  return editorReducer(state,{type:'open',path,content});
}
function edit(state:EditorState,path:string,content:string):EditorState{
  return editorReducer(state,{type:'edit',id:state.documents.find(doc=>doc.path===path)!.id,content});
}
function fixture(){
  let editor=initialEditorState;
  for(const name of ['same','changed','conflict','matching','missing'])editor=open(editor,'C:/work/'+name+'.srp','original');
  editor=edit(editor,'C:/work/conflict.srp','unsaved');
  editor=edit(editor,'C:/work/matching.srp','new editor');
  const data:Record<string,string>={
    'C:/work/same.srp':'original','C:/work/changed.srp':'new disk',
    'C:/work/conflict.srp':'external','C:/work/matching.srp':'new editor',
  };
  const read=vi.fn(async(path:string,_max:number)=>{
    if(!(path in data))throw Error('Not accessible');
    return data[path];
  });
  return {editor,read,data};
}
async function reviewFixture(){
  const f=fixture(),result=await inspectWorkspaceDisk(f.editor,f.read,()=>true);
  if(!result.ok)throw Error(result.error);
  return {...f,review:result.value};
}
describe('read-only multi-file disk review',()=>{
  it('classifies unchanged, external changes, conflicts, matching dirty and unavailable separately',async()=>{
    const {editor,read,review}=await reviewFixture();
    expect(review.rows.map(row=>row.kind==='read'?row.report.status:row.kind)).toEqual(
      ['unchanged','external-change','conflict','disk-matches-editor','unavailable']);
    expect(summarizeWorkspaceDiskReview(review)).toEqual({
      unchanged:1,changed:1,conflicts:1,matching:1,unavailable:1,skipped:0,eligible:1,
    });
    expect(review.rows.filter(canReloadReviewedDiskRow).map(row=>row.snapshot.name)).toEqual(['changed.srp']);
    expect(read).toHaveBeenCalledTimes(5);
    expect(editor.documents.find(doc=>doc.name==='changed.srp')?.content).toBe('original');
    expect(workspaceDiskReviewCurrent(review,editor)).toBe(true);
  });
  it('never reads untitled or non-source tabs',async()=>{
    const editor=open(open(initialEditorState,'/work/not-source.txt','text'),'/work/source.srp','');
    const read=vi.fn(async()=> '');
    const result=await inspectWorkspaceDisk(editor,read,()=>true);
    expect(result.ok).toBe(true);
    expect(read).toHaveBeenCalledTimes(1);
    expect(read.mock.calls[0]?.[0]).toBe('/work/source.srp');
  });
  it('limits scanned file count and accounts for omitted tabs',async()=>{
    let editor=initialEditorState;
    for(let i=0;i<MAX_DISK_REVIEW_FILES+3;i++)editor=open(editor,'/work/'+i+'.srp','');
    const read=vi.fn(async()=> '');
    const result=await inspectWorkspaceDisk(editor,read,()=>true);
    if(!result.ok)throw Error(result.error);
    expect(read).toHaveBeenCalledTimes(MAX_DISK_REVIEW_FILES);
    expect(result.value.omitted).toBe(3);
    expect(summarizeWorkspaceDiskReview(result.value).skipped).toBe(3);
  });
  it('bounds retained bytes and stops reading when the budget is consumed',async()=>{
    let editor=initialEditorState;
    for(let i=0;i<3;i++)editor=open(editor,'/work/'+i+'.srp','');
    const read=vi.fn(async(_path:string,max:number)=>'x'.repeat(max));
    const result=await inspectWorkspaceDisk(editor,read,()=>true);
    if(!result.ok)throw Error(result.error);
    expect(result.value.bytes).toBe(MAX_DISK_REVIEW_BYTES);
    expect(read).toHaveBeenCalledTimes(2);
    expect(result.value.rows[2].kind).toBe('skipped');
  });
  it('rejects unpaired surrogates and sources exceeding the reader budget',async()=>{
    const editor=open(initialEditorState,'/work/source.srp','');
    const result=await inspectWorkspaceDisk(editor,async()=>'\ud800',()=>true);
    expect(result.ok&&result.value.rows[0].kind).toBe('unavailable');
    const oversized=await inspectWorkspaceDisk(editor,async(_path,max)=>'x'.repeat(max+1),()=>true);
    expect(oversized.ok&&oversized.value.rows[0].kind).toBe('unavailable');
  });
  it('does not retain a partial report if editor changes mid-read',async()=>{
    const f=fixture();
    let current=true;
    const result=await inspectWorkspaceDisk(f.editor,async()=>{current=false;return 'original';},()=>current);
    expect(result.ok).toBe(false);
  });
  it('rejects same-content edit ABA and tab switch ABA',async()=>{
    const {editor,review}=await reviewFixture();
    const changed=edit(edit(editor,'C:/work/same.srp','other'),'C:/work/same.srp','original');
    expect(workspaceDiskReviewCurrent(review,changed)).toBe(false);
    const activated=editorReducer(editor,{type:'activate',id:editor.documents[0].id});
    const back=editorReducer(activated,{type:'activate',id:editor.activeId!});
    expect(workspaceDiskReviewCurrent(review,back)).toBe(false);
    expect(diskOperationCurrent(editor,back)).toBe(false);
  });
});
describe('reviewed clean-file reload',()=>{
  it('rereads exact reviewed content and updates both editor and saved baseline atomically',async()=>{
    const {editor,read,review}=await reviewFixture();
    const id=review.rows.find(row=>row.snapshot.name==='changed.srp')!.snapshot.id;
    read.mockClear();
    const result=await prepareWorkspaceDiskReload(review,[id],editor,read,()=>true);
    if(!result.ok)throw Error(result.error);
    expect(read).toHaveBeenCalledTimes(1);
    const next=editorReducer(editor,{type:'reload-clean-files',changes:result.value,allSnapshots:editor.documents});
    const before=editor.documents.find(doc=>doc.id===id)!;
    expect(next.documents.find(doc=>doc.id===id)).toEqual({...before,content:'new disk',savedContent:'new disk',revision:before.revision+1});
    expect(next.documents.find(doc=>doc.name==='conflict.srp')).toBe(editor.documents.find(doc=>doc.name==='conflict.srp'));
    expect(next.activeId).toBe(editor.activeId);
    expect(next.sessionRevision).toBe(editor.sessionRevision+1);
  });
  it('refuses dirty, unchanged, unavailable, missing, empty or duplicate selections',async()=>{
    const {editor,read,review}=await reviewFixture();
    const id=(name:string)=>review.rows.find(row=>row.snapshot.name===name+'.srp')!.snapshot.id;
    read.mockClear();
    for(const ids of [[],['missing-id'],[id('same')],[id('conflict')],[id('matching')],[id('missing')],[id('changed'),id('changed')]]){
      expect((await prepareWorkspaceDiskReload(review,ids,editor,read,()=>true)).ok).toBe(false);
    }
    expect(read).not.toHaveBeenCalled();
  });
  it('rejects the entire batch if the second file changes after review',async()=>{
    const editor=open(open(initialEditorState,'/a.srp','old'),'/b.srp','old');
    const scan=await inspectWorkspaceDisk(editor,async()=> 'new',()=>true);
    if(!scan.ok)throw Error(scan.error);
    const ids=scan.value.rows.map(row=>row.snapshot.id);
    const result=await prepareWorkspaceDiskReload(scan.value,ids,editor,async path=>path==='/a.srp'?'new':'changed again',()=>true);
    expect(result.ok).toBe(false);
    expect(editor.documents.filter(doc=>doc.path).map(doc=>doc.content)).toEqual(['old','old']);
  });
  it('rejects stale reviews before any additional disk read',async()=>{
    const {editor,read,review}=await reviewFixture();
    const id=review.rows.find(row=>row.snapshot.name==='changed.srp')!.snapshot.id;
    read.mockClear();
    expect((await prepareWorkspaceDiskReload(review,[id],editorReducer(editor,{type:'new'}),read,()=>true)).ok).toBe(false);
    expect(read).not.toHaveBeenCalled();
  });
  it('reducer independently refuses dirty, untitled, forged and invalid source changes',()=>{
    let editor=open(initialEditorState,'/a.srp','old');
    editor=edit(editor,'/a.srp','unsaved');
    for(const snapshot of editor.documents){
      const next=editorReducer(editor,{type:'reload-clean-files',allSnapshots:editor.documents,
        changes:[{id:snapshot.id,snapshot,content:'new'}]});
      expect(next).toBe(editor);
    }
    const clean=open(editor,'/b.srp','old');
    const snapshot=clean.documents.at(-1)!;
    expect(editorReducer(clean,{type:'reload-clean-files',allSnapshots:clean.documents,
      changes:[{id:snapshot.id,snapshot,content:'\ud800'}]})).toBe(clean);
    expect(editorReducer(clean,{type:'reload-clean-files',allSnapshots:clean.documents,
      changes:[{id:snapshot.id,snapshot:{...snapshot,revision:snapshot.revision-1},content:'new'}]})).toBe(clean);
  });
});
