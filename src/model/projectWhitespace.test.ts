import {describe,expect,it,vi} from 'vitest';
import {createUntitled,type StudioDocument} from './documents';
import {editorReducer,type EditorState} from './editorState';
import {canUndoOpenFileReplace} from './openFileReplaceUndo';
import {createReviewedStageUndo,prepareReviewedSourceSet,readReviewedSourceSet,validateReviewedSourceSet,
  prepareReviewedStage,revalidateReviewedStage} from './reviewedSourceStage';
import {DEFAULT_PROJECT_SEARCH_SCOPE,PROJECT_SEARCH_BATCH_SIZE,MAX_SCOPE_REPORT_UNITS} from './projectSearchScope';
import {DEFAULT_WHITESPACE_OPTIONS} from './sourceWhitespace';
import {prepareProjectWhitespace,confirmProjectWhitespace,scanProjectWhitespace,planProjectWhitespace,
  prepareWhitespaceApply,whitespaceInventoryIsCurrent,summarizeProjectWhitespace,filterWhitespaceFiles,
  pageWhitespace,projectWhitespaceReport,DEFAULT_WHITESPACE_FILTER,type ProjectWhitespaceInventory} from './projectWhitespace';

const a='src/a.srp',b='src/b.srp',c='tests/c.srp';
const entry=(name:string)=>({name,path:'C:/private-root/'+name});
const listed=[a,b,c].map(entry);
const aSaved='bind x = 1;\n',aWorking='bind x = 9;  \r\nprint(x);  ';
const bDisk='\tprint("private literal  "); \r\n';
const cDisk='// private untouched\n';
const disk={[a]:aSaved,[b]:bDisk,[c]:cDisk};
const working:StudioDocument={id:'working',name:'a.srp',path:entry(a).path,
  content:aWorking,savedContent:aSaved,revision:4};
const editor:EditorState={documents:[createUntitled(1),working],activeId:working.id,nextUntitled:2,sessionRevision:5};
const options={...DEFAULT_WHITESPACE_OPTIONS,indentation:'spaces' as const,endings:'lf' as const};
const control={isCurrent:()=>true,isCancelled:()=>false};
function value<T>(result:{ok:true;value:T}|{ok:false;error:string}):T{
  if(!result.ok)throw Error(result.error);return result.value;
}
function reader(contents:Record<string,string>=disk){
  return vi.fn(async(path:string,_limit:number)=>{
    const name=path.replace('C:/private-root/','');
    if(!Object.hasOwn(contents,name))throw Error('private native failure');
    return contents[name];
  });
}
function review(){
  return value(prepareProjectWhitespace(listed,DEFAULT_PROJECT_SEARCH_SCOPE,false,options));
}
async function scan(state=editor,contents=disk):Promise<ProjectWhitespaceInventory>{
  const result=await scanProjectWhitespace(review(),state,reader(contents),control);
  if(result.kind!=='ready')throw Error('No inventory');
  return result.value;
}
describe('shared reviewed source staging',()=>{
  it('requires a complete current listed scope or an explicit numbered batch',()=>{
    expect(prepareReviewedSourceSet(listed,DEFAULT_PROJECT_SEARCH_SCOPE,true).ok).toBe(false);
    expect(prepareReviewedSourceSet([...listed,entry(a)],DEFAULT_PROJECT_SEARCH_SCOPE,false).ok).toBe(false);
    const entries=Array.from({length:PROJECT_SEARCH_BATCH_SIZE+2},(_,index)=>entry('src/f'+index+'.srp'));
    const plan=value(prepareReviewedSourceSet(entries,{...DEFAULT_PROJECT_SEARCH_SCOPE,batch:1},false));
    expect(plan.selected).toBe(PROJECT_SEARCH_BATCH_SIZE);
    expect(plan.deferred).toBe(2);
  });
  it('captures only complete reviewed sources and exact editor snapshots',async()=>{
    const plan=value(prepareReviewedSourceSet(listed,DEFAULT_PROJECT_SEARCH_SCOPE,false));
    const read=reader();
    const result=await readReviewedSourceSet(plan,editor,read,control);
    if(result.kind!=='ready')throw Error('No set');
    const set=result.value;
    expect(validateReviewedSourceSet(set)).toBe(true);
    expect(set.files.find(file=>file.name===a)?.content).toBe(aWorking);
    expect(read).toHaveBeenCalledTimes(2);
    expect(validateReviewedSourceSet({...set,bytes:set.bytes+1})).toBe(false);
    expect(validateReviewedSourceSet({...set,files:set.files.slice(1)})).toBe(false);
    expect(validateReviewedSourceSet({...set,files:[{...set.files[0],path:'relative.srp'},...set.files.slice(1)]})).toBe(false);
    expect(prepareReviewedStage(set,[{source:'unknown.srp',content:'new'}],editor).ok).toBe(false);
    expect(prepareReviewedStage(set,[{source:a,content:aWorking}],editor).ok).toBe(false);
  });
  it('refuses a failed read without exposing native error or partially staged content',async()=>{
    const plan=value(prepareReviewedSourceSet(listed,DEFAULT_PROJECT_SEARCH_SCOPE,false));
    const result=await readReviewedSourceSet(plan,editor,reader({[a]:aSaved,[b]:bDisk}),control);
    expect(result.kind).toBe('failed');
    expect(JSON.stringify(result)).not.toContain('private native failure');
    expect(JSON.stringify(result)).not.toContain('private literal');
  });
  it('revalidates untouched closed files and rejects changed editor generations',async()=>{
    const plan=value(prepareReviewedSourceSet(listed,DEFAULT_PROJECT_SEARCH_SCOPE,false));
    const captured=await readReviewedSourceSet(plan,editor,reader(),control);
    if(captured.kind!=='ready')throw Error('No set');
    const stage=value(prepareReviewedStage(captured.value,[{source:b,content:bDisk+' '}],editor));
    expect((await revalidateReviewedStage(stage,listed,false,editor,reader({...disk,[c]:'changed'}),control)).kind).toBe('failed');
    expect((await revalidateReviewedStage(stage,listed,false,{...editor,sessionRevision:6},reader(),control)).kind).toBe('failed');
    expect((await revalidateReviewedStage(stage,listed.slice(0,2),false,editor,reader(),control)).kind).toBe('failed');
  });
});
describe('project whitespace review',()=>{
  it('pins exact options and scope prior to any read',()=>{
    const current=review();
    expect(confirmProjectWhitespace(current,listed,DEFAULT_PROJECT_SEARCH_SCOPE,false,options).ok).toBe(true);
    expect(confirmProjectWhitespace(current,listed,DEFAULT_PROJECT_SEARCH_SCOPE,false,{...options,tabWidth:8}).ok).toBe(false);
    expect(confirmProjectWhitespace(current,listed.slice(1),DEFAULT_PROJECT_SEARCH_SCOPE,false,options).ok).toBe(false);
    expect(confirmProjectWhitespace(current,listed,DEFAULT_PROJECT_SEARCH_SCOPE,true,options).ok).toBe(false);
  });
  it('observes dirty and saved snapshots with accurate changed and selected counts',async()=>{
    const data=await scan();
    expect(data.files).toHaveLength(3);
    expect(data.files.find(file=>file.source===a)?.result.content).toBe('bind x = 9;\nprint(x);\n');
    expect(data.files.find(file=>file.source===b)?.result.content).toBe('    print("private literal  ");\n');
    expect(data.files.find(file=>file.source===c)?.result.edits).toEqual([]);
    const summary=summarizeProjectWhitespace(data,[b]);
    expect(summary).toMatchObject({sources:3,changed:2,selected:1,edits:7,selectedEdits:3,
      counts:{trailing:3,indentation:1,'line-ending':2,'final-newline':1}});
    expect(filterWhitespaceFiles(data,{...DEFAULT_WHITESPACE_FILTER,state:'changed'},[])).toHaveLength(2);
    expect(filterWhitespaceFiles(data,{...DEFAULT_WHITESPACE_FILTER,state:'unchanged'},[]).map(file=>file.source)).toEqual([c]);
    expect(filterWhitespaceFiles(data,{...DEFAULT_WHITESPACE_FILTER,selectedOnly:true},[b]).map(file=>file.source)).toEqual([b]);
    expect(filterWhitespaceFiles(data,{...DEFAULT_WHITESPACE_FILTER,query:'A.SRP'},[]).map(file=>file.source)).toEqual([a]);
    expect(pageWhitespace([],999)).toEqual({page:1,pages:1,rows:[]});
  });
  it('rejects malformed or unread selected sources without a partial cleanup review',async()=>{
    expect((await scanProjectWhitespace(review(),editor,reader({...disk,[c]:'bind x = "unfinished'}),control)).kind).toBe('failed');
    expect((await scanProjectWhitespace(review(),editor,reader({[a]:aSaved,[b]:bDisk}),control)).kind).toBe('failed');
  });
  it('filters protected literal observations even when no edits are proposed',async()=>{
    const data=await scan(editor,{...disk,[c]:'bind x = """inside  \r\n  text""";\n'});
    const protectedFiles=filterWhitespaceFiles(data,{...DEFAULT_WHITESPACE_FILTER,state:'protected'},[]);
    expect(protectedFiles.map(file=>file.source)).toEqual([c]);
    expect(summarizeProjectWhitespace(data,[]).protectedEndings).toBe(1);
  });
  it('requires exact selected changed sources, canonical outputs and current editor snapshots',async()=>{
    const data=await scan();
    expect(planProjectWhitespace(data,[],editor).ok).toBe(false);
    expect(planProjectWhitespace(data,[a,a],editor).ok).toBe(false);
    expect(planProjectWhitespace(data,[c],editor).ok).toBe(false);
    expect(planProjectWhitespace(data,['unknown'],editor).ok).toBe(false);
    expect(planProjectWhitespace(data,[a],{...editor,sessionRevision:6}).ok).toBe(false);
    const forged={...data,files:data.files.map(file=>file.source===a?{...file,result:{...file.result,content:'forged'}}:file)};
    expect(planProjectWhitespace(forged,[a],editor).ok).toBe(false);
    expect(whitespaceInventoryIsCurrent(data,editor)).toBe(true);
  });
});
describe('staged whitespace application and undo',()=>{
  it('opens closed selected sources as unsaved changes without altering saved baselines',async()=>{
    const data=await scan();
    const plan=value(planProjectWhitespace(data,[a,b],editor));
    const read=reader();
    const prepared=await prepareWhitespaceApply(plan,listed,false,editor,read,control);
    if(prepared.kind!=='ready')throw Error('No action');
    expect(read).toHaveBeenCalledTimes(2);
    expect(prepared.value.edits).toBe(7);
    const next=editorReducer(editor,prepared.value.action);
    expect(next.sessionRevision).toBe(editor.sessionRevision+1);
    expect(next.activeId).toBe(editor.activeId);
    expect(next.documents.find(document=>document.id===working.id)).toMatchObject({
      content:'bind x = 9;\nprint(x);\n',savedContent:aSaved,
    });
    const opened=next.documents.find(document=>document.path===entry(b).path)!;
    expect(opened.content).toBe('    print("private literal  ");\n');
    expect(opened.savedContent).toBe(bDisk);
    expect(next.documents.find(document=>document.path===entry(c).path)).toBeUndefined();
    const undo=createReviewedStageUndo(prepared.value.staged.changes,next)!;
    expect(canUndoOpenFileReplace(undo,next)).toBe(true);
    const restored=editorReducer(next,{type:'replace-open-files',changes:undo.changes,allSnapshots:undo.after});
    expect(restored.documents.find(document=>document.id===working.id)?.content).toBe(aWorking);
    expect(restored.documents.find(document=>document.id===opened.id)?.content).toBe(bDisk);
    expect(restored.documents).toHaveLength(next.documents.length);
  });
  it('refuses any changed disk evidence and cancels before publication',async()=>{
    const data=await scan();
    const plan=value(planProjectWhitespace(data,[b],editor));
    expect((await prepareWhitespaceApply(plan,listed,false,editor,reader({...disk,[c]:'different'}),control)).kind).toBe('failed');
    let cancelled=false;
    const result=await prepareWhitespaceApply(plan,listed,false,editor,async()=>{cancelled=true;return bDisk;},
      {...control,isCancelled:()=>cancelled});
    expect(result).toEqual({kind:'cancelled'});
    let current=true;
    expect(await prepareWhitespaceApply(plan,listed,false,editor,async()=>{current=false;return bDisk;},
      {...control,isCurrent:()=>current})).toEqual({kind:'invalidated'});
  });
  it('reports only counts by default and labels on opt-in, never source contents',async()=>{
    const data=await scan();
    const plain=projectWhitespaceReport(data,[a,b]);
    for(const secret of [a,b,c,'private literal','private untouched','C:/private-root','bind x'])expect(plain).not.toContain(secret);
    const full=projectWhitespaceReport(data,[a,b],true);
    expect(full).toContain(a);
    expect(full).toContain(b);
    expect(full).not.toContain('private literal');
    expect(full).not.toContain('C:/private-root');
    expect(full.length).toBeLessThanOrEqual(MAX_SCOPE_REPORT_UNITS);
  });
});
