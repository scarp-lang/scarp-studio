import { describe,expect,it,vi } from 'vitest';
import { editorReducer,initialEditorState,type EditorState } from './editorState';
import { searchListedProjectSources,type ProjectSearchResult,type ProjectSearchSource } from './projectSearch';
import { prepareProjectReplacement,readProjectReplacementSources,planStagedProjectReplacement,stagedProjectReplacementIsCurrent,
  projectReplacementInventoryIsCurrent,replacementTextError,visibleProjectReplacementText,MAX_PROJECT_REPLACEMENT_HITS,
  type ReplacementRequest } from './projectReplacement';
import { createOpenFileReplaceUndo,canUndoOpenFileReplace } from './openFileReplaceUndo';
import { AutoSaveReviewGate } from './autoSaveReviewGate';
const options={caseSensitive:true,wholeWord:true};
const a={name:'first/src/main.srp',path:'C:/workspace/first/src/main.srp'};
const b={name:'second/src/main.srp',path:'C:/workspace/second/src/main.srp'};
const c={name:'third/src/main.srp',path:'C:/workspace/third/src/main.srp'};
const listed=[a,b,c];
const texts=new Map([[a.path,'bind name=1;\nprint(name); // name'],[b.path,'print("name");\r\nprint(name);'],[c.path,'print(other);']]);
const reader=async(path:string)=>{const value=texts.get(path);if(value===undefined)throw Error('not listed');return value;};
function openFirst(){
  return editorReducer(initialEditorState,{type:'open',path:a.path,content:texts.get(a.path)!});
}
async function scan(editor:EditorState,files:readonly ProjectSearchSource[]=listed){
  const result=await searchListedProjectSources(files,editor.documents,'name',options,reader);
  if(!result)throw Error('unexpected stale search');
  return result;
}
function prepare(result:ProjectSearchResult,editor:EditorState,selected:number[],patch:Partial<ReplacementRequest>={}){
  const inventory=prepareProjectReplacement(result,{query:'name',replacement:'counter',options,selected,...patch},listed,editor);
  if(!inventory.ok)throw Error(inventory.error);
  return inventory.value;
}
async function stage(editor:EditorState,inventory:ReturnType<typeof prepare>){
  const read=await readProjectReplacementSources(inventory,reader,()=>true);
  if(!read.ok)throw Error(read.error);
  const staged=editorReducer(editor,{type:'restore-workspace-tabs',files:read.value,activePath:null});
  const result=planStagedProjectReplacement(inventory,staged);
  if(!result.ok)throw Error(result.error);
  return {staged,plan:result.value};
}
describe('review selected project search occurrences',()=>{
  it('stages only selected unopened files and preserves exact existing working text',async()=>{
    const editor=openFirst(),result=await scan(editor);
    const selected=result.hits.map((hit,index)=>({hit,index})).filter(({hit})=>hit.match.line===2&&
      (hit.path===a.path&&hit.match.column===7||hit.path===b.path)).map(row=>row.index);
    const inventory=prepare(result,editor,selected);
    expect(inventory.sources.map(source=>source.path)).toEqual([a.path,b.path]);
    const read=vi.fn(reader);
    const response=await readProjectReplacementSources(inventory,read,()=>true);
    expect(response).toEqual({ok:true,value:[{path:b.path,content:texts.get(b.path)}]});
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith(b.path,512*1024);
    const {staged,plan}=await stage(editor,inventory);
    expect(staged.documents.find(doc=>doc.path===c.path)).toBeUndefined();
    expect(plan.changes.map(change=>change.content)).toEqual([
      'bind name=1;\nprint(counter); // name','print("name");\r\nprint(counter);',
    ]);
    expect(plan.inventory.occurrences.every(site=>site.before.includes('name')&&site.after.includes('counter'))).toBe(true);
    expect(stagedProjectReplacementIsCurrent(plan,staged)).toBe(true);
  });
  it('applies selected sites only even if search coverage is incomplete',async()=>{
    const editor=openFirst(),result=await scan(editor);
    const partial={...result,truncated:true,skippedFiles:1};
    const index=partial.hits.findIndex(hit=>hit.path===a.path&&hit.match.line===1);
    const inventory=prepare(partial,editor,[index]);
    const {plan}=await stage(editor,inventory);
    expect(plan.changes).toHaveLength(1);
    expect(plan.changes[0].content).toBe('bind counter=1;\nprint(name); // name');
  });
  it('keeps dirty open buffers authoritative without disk reads',async()=>{
    let editor=openFirst();
    editor=editorReducer(editor,{type:'edit',id:editor.activeId!,content:'bind name=2;\nprint(name);'});
    const result=await scan(editor);
    const index=result.hits.findIndex(hit=>hit.path===a.path);
    const inventory=prepare(result,editor,[index]);
    const forbidden=vi.fn(async()=>{throw Error('must not read open source');});
    expect(await readProjectReplacementSources(inventory,forbidden,()=>true)).toEqual({ok:true,value:[]});
    expect(forbidden).not.toHaveBeenCalled();
    const plan=planStagedProjectReplacement(inventory,editor);
    expect(plan.ok&&plan.value.changes[0].content).toBe('bind counter=2;\nprint(name);');
  });
  it('rejects unknown, duplicate and excessive selections',async()=>{
    const editor=openFirst(),result=await scan(editor);
    for(const selected of [[],[-1],[99],[0,0],[0.5],Array.from({length:MAX_PROJECT_REPLACEMENT_HITS+1},(_,i)=>i)]){
      expect(prepareProjectReplacement(result,{query:'name',replacement:'counter',options,selected},listed,editor).ok).toBe(false);
    }
  });
  it('rejects changed source snapshots and forged coordinates',async()=>{
    const editor=openFirst(),result=await scan(editor);
    const index=result.hits.findIndex(hit=>hit.path===a.path);
    const modified=editorReducer(editor,{type:'edit',id:editor.activeId!,content:'name'});
    expect(prepareProjectReplacement(result,{query:'name',replacement:'counter',options,selected:[index]},listed,modified).ok).toBe(false);
    const hit=result.hits[index];
    const forged={...result,hits:result.hits.map((item,i)=>i===index?{...hit,match:{...hit.match,offset:0}}:item)};
    expect(prepareProjectReplacement(forged,{query:'name',replacement:'counter',options,selected:[index]},listed,editor).ok).toBe(false);
  });
  it('rejects ambiguous listing aliases or names',async()=>{
    const editor=openFirst(),result=await scan(editor);
    const index=result.hits.findIndex(hit=>hit.path===a.path);
    for(const files of [[...listed,a],[...listed,{name:'alias.srp',path:a.path}],[...listed,{name:a.name,path:'C:/different/main.srp'}],listed.slice(1)]){
      expect(prepareProjectReplacement(result,{query:'name',replacement:'counter',options,selected:[index]},files,editor).ok).toBe(false);
    }
  });
  it('does not apply text that is unchanged or outside the replacement budget',async()=>{
    const editor=openFirst(),result=await scan(editor);
    expect(prepareProjectReplacement(result,{query:'name',replacement:'name',options,selected:[0]},listed,editor).ok).toBe(false);
    for(const replacement of ['x'.repeat(257),'a\nb','\ud800','a\u202eb','a\u0000b'])expect(replacementTextError('name',replacement)).not.toBeNull();
    expect(replacementTextError('name','')).toBeNull();
    expect(replacementTextError('name','नमस्ते 🌍')).toBeNull();
    expect(visibleProjectReplacementText('a\r\n\u202eb')).toBe('"a\\r\\n\\u202eb"');
  });
});
describe('project staging transaction',()=>{
  it('aborts the complete batch on changed disk text or read error',async()=>{
    const editor=openFirst(),result=await scan(editor),selected=[result.hits.findIndex(hit=>hit.path===b.path)];
    const inventory=prepare(result,editor,selected);
    expect((await readProjectReplacementSources(inventory,async()=> 'changed',()=>true)).ok).toBe(false);
    expect((await readProjectReplacementSources(inventory,async()=>{throw Error('denied');},()=>true)).ok).toBe(false);
    expect(planStagedProjectReplacement(inventory,editor).ok).toBe(false);
  });
  it('checks freshness after asynchronous reads and detects editor ABA',async()=>{
    const editor=openFirst(),result=await scan(editor),selected=[result.hits.findIndex(hit=>hit.path===b.path)];
    const inventory=prepare(result,editor,selected);
    let current=true;
    const response=await readProjectReplacementSources(inventory,async path=>{current=false;return reader(path);},()=>current);
    expect(response.ok).toBe(false);
    const changed=editorReducer(editor,{type:'edit',id:editor.activeId!,content:'changed'});
    const restored=editorReducer(changed,{type:'edit',id:editor.activeId!,content:texts.get(a.path)!});
    expect(projectReplacementInventoryIsCurrent(inventory,restored)).toBe(false);
  });
  it('stages clean disk snapshots and holds Auto Save until explicitly reviewed',async()=>{
    const editor=openFirst(),result=await scan(editor),selected=result.hits.map((_,i)=>i);
    const {staged,plan}=await stage(editor,prepare(result,editor,selected));
    const applied=editorReducer(staged,{type:'replace-open-files',changes:plan.changes,allSnapshots:staged.documents});
    const gate=new AutoSaveReviewGate();
    gate.holdReplacements(applied.documents,plan.changes.map(change=>change.id));
    for(const doc of applied.documents.filter(doc=>doc.path!==null)){
      expect(doc.savedContent).toBe(texts.get(doc.path!));
      expect(gate.canWrite(doc,doc,true)).toBe(false);
    }
    const undo=createOpenFileReplaceUndo(staged.documents,applied.documents)!;
    expect(canUndoOpenFileReplace(undo,applied)).toBe(true);
    const restored=editorReducer(applied,{type:'replace-open-files',changes:undo.changes,allSnapshots:undo.after});
    expect(restored.documents.map(doc=>doc.content)).toEqual(staged.documents.map(doc=>doc.content));
    expect(restored.documents.some(doc=>doc.path===b.path)).toBe(true);
  });
  it('rejects post-stage changes and forged replacement contents',async()=>{
    const editor=openFirst(),result=await scan(editor);
    const {staged,plan}=await stage(editor,prepare(result,editor,[0]));
    const changed=editorReducer(staged,{type:'new'});
    expect(stagedProjectReplacementIsCurrent(plan,changed)).toBe(false);
    const forged={...plan,changes:[{...plan.changes[0],content:'forged'}]};
    expect(stagedProjectReplacementIsCurrent(forged,staged)).toBe(false);
  });
});
