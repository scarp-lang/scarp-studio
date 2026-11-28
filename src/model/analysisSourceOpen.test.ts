import {describe,expect,it,vi} from 'vitest';
import {createUntitled,type StudioDocument} from './documents';
import {editorReducer,type EditorState} from './editorState';
import {analysisSourceCandidates,describeAnalysisCandidates,prepareAnalysisOpen,confirmAnalysisOpen,
  readAnalysisOpenSources,analysisOpenSatisfied,MAX_ANALYSIS_OPEN_FILES,MAX_ANALYSIS_OPEN_FILE_BYTES,
  MAX_ANALYSIS_OPEN_TOTAL_BYTES,type AnalysisOpenControl} from './analysisSourceOpen';

const a='src/a.srp',b='src/b.srp',c='tests/c.srp';
const entry=(name:string)=>({name,path:'C:/private-root/'+name});
const listed=[a,b,c].map(entry);
const candidates=analysisSourceCandidates([{source:a},{source:b},{source:a},{source:c}]);
const initial:EditorState={documents:[createUntitled(1)],activeId:'untitled-1',nextUntitled:2,sessionRevision:0};
const control:AnalysisOpenControl={isCurrent:()=>true,isCancelled:()=>false};
function value<T>(result:{ok:true;value:T}|{ok:false;error:string}):T{
  if(!result.ok)throw Error(result.error);return result.value;
}
function dirty(name:string):StudioDocument{
  return {id:'open:'+name,name,path:entry(name).path,content:'unsaved text',savedContent:'saved text',revision:5};
}
function editorWith(...docs:StudioDocument[]):EditorState{
  return {...initial,documents:[...initial.documents,...docs],sessionRevision:1};
}
function plan(selected=[a,b],active:string|null=null,editor=initial){
  return value(prepareAnalysisOpen(candidates,selected,active,listed,editor));
}
describe('reviewed analysis source selection',()=>{
  it('groups retained labels without accepting invalid path-shaped sources',()=>{
    const values=analysisSourceCandidates([{source:b},{source:a},{source:a},{source:'../bad.srp'},
      {source:'C:/absolute.srp'},{source:'/root.srp'},{source:'bad.txt'}]);
    expect(values).toEqual([{name:a,occurrences:2},{name:b,occurrences:1}]);
    expect(Object.isFrozen(values)).toBe(true);
    expect(Object.isFrozen(values[0])).toBe(true);
  });
  it('distinguishes current availability, dirty tabs, missing and ambiguous labels',()=>{
    const editor=editorWith(dirty(a));
    const rows=describeAnalysisCandidates(candidates,[entry(a),entry(b),entry(b)],editor.documents);
    expect(rows).toEqual([
      {name:a,occurrences:2,state:'open',modified:true},
      {name:b,occurrences:1,state:'ambiguous',modified:false},
      {name:c,occurrences:1,state:'missing',modified:false},
    ]);
  });
  it('pins exact path, active target and whole editor revision without retaining text',()=>{
    const editor=editorWith(dirty(a));
    const review=plan([a,b],b,editor);
    expect(review).toMatchObject({newCount:1,existingCount:1,activeLabel:b,activePath:entry(b).path,
      editorRevision:editor.sessionRevision,editorActiveId:editor.activeId});
    expect(review.rows[0]).toMatchObject({kind:'open',documentId:dirty(a).id,modified:true});
    expect(review.rows[1]).toMatchObject({kind:'available',documentId:null,modified:false});
    expect(JSON.stringify(review)).not.toContain('unsaved text');
    expect(JSON.stringify(review)).not.toContain('saved text');
    expect(Object.isFrozen(review.rows[0])).toBe(true);
  });
  it('rejects invalid, duplicate, excessive or unobserved labels',()=>{
    for(const selected of [[],[a,a],['unknown.srp'],['../bad.srp'],Array(MAX_ANALYSIS_OPEN_FILES+1).fill(a)]){
      expect(prepareAnalysisOpen(candidates,selected,null,listed,initial).ok).toBe(false);
    }
    expect(prepareAnalysisOpen(candidates,[a],b,listed,initial).ok).toBe(false);
    expect(prepareAnalysisOpen(candidates,[a],null,[entry(a),entry(a)],initial).ok).toBe(false);
    expect(prepareAnalysisOpen(candidates,[a],null,[{name:a,path:'relative.srp'}],initial).ok).toBe(false);
  });
  it('rejects aliases and multiple matching open tabs',()=>{
    const aliases=[entry(a),{name:b,path:entry(a).path.toUpperCase()}];
    expect(prepareAnalysisOpen(candidates,[a,b],null,aliases,initial).ok).toBe(false);
    expect(prepareAnalysisOpen(candidates,[a],null,listed,editorWith(dirty(a),{...dirty(a),id:'duplicate'})).ok).toBe(false);
  });
  it('requires re-review when editor generation or listing identity changes',()=>{
    const editor=editorWith(dirty(a));
    const review=plan([a,b],b,editor);
    expect(confirmAnalysisOpen(review,candidates,listed,editor).ok).toBe(true);
    expect(confirmAnalysisOpen(review,candidates,[...listed].reverse(),editor).ok).toBe(true);
    expect(confirmAnalysisOpen(review,candidates,listed,{...editor,sessionRevision:2}).ok).toBe(false);
    expect(confirmAnalysisOpen(review,candidates,listed,{...editor,activeId:dirty(a).id}).ok).toBe(false);
    expect(confirmAnalysisOpen(review,candidates,listed.map(source=>source.name===b?{...source,path:'D:/new/b.srp'}:source),editor).ok).toBe(false);
    expect(confirmAnalysisOpen(review,candidates.filter(item=>item.name!==b),listed,editor).ok).toBe(false);
    expect(confirmAnalysisOpen({...review,newCount:99},candidates,listed,editor).ok).toBe(false);
  });
});
describe('atomic read staging and editor commit',()=>{
  it('reads closed sources only and preserves dirty buffers through one reducer transition',async()=>{
    const editor=editorWith(dirty(a));
    const review=plan([a,b,c],b,editor);
    const read=vi.fn(async(path:string,_limit:number)=>path.endsWith(b)?'bind b = 1;':'bind c = 2;');
    const progress=vi.fn();
    const staged=await readAnalysisOpenSources(review,read,{...control,onProgress:progress});
    expect(staged.kind).toBe('prepared');
    if(staged.kind!=='prepared')throw Error('No staged sources');
    expect(read.mock.calls.map(call=>call[0])).toEqual([entry(b).path,entry(c).path]);
    expect(read.mock.calls.every(call=>call[1]<=MAX_ANALYSIS_OPEN_FILE_BYTES)).toBe(true);
    expect(progress.mock.calls.map(call=>call[0])).toEqual([
      {completed:0,total:2},{completed:1,total:2},{completed:2,total:2},
    ]);
    const after=editorReducer(editor,{type:'restore-workspace-tabs',files:staged.value.files,activePath:staged.value.activePath});
    expect(after.sessionRevision).toBe(editor.sessionRevision+1);
    expect(after.documents.find(doc=>doc.id===dirty(a).id)).toEqual(dirty(a));
    expect(after.documents.find(doc=>doc.id===after.activeId)?.path).toBe(entry(b).path);
    expect(analysisOpenSatisfied(review,after)).toBe(true);
    expect(analysisOpenSatisfied(review,editor)).toBe(false);
  });
  it('reuses existing tabs without any read and supports explicit activation',async()=>{
    const editor=editorWith(dirty(a),dirty(b));
    const review=plan([a,b],b,editor);
    const read=vi.fn(async()=>{throw Error('Unexpected read');});
    const staged=await readAnalysisOpenSources(review,read,control);
    expect(read).not.toHaveBeenCalled();
    if(staged.kind!=='prepared')throw Error('No staged sources');
    expect(staged.value.files).toEqual([]);
    const after=editorReducer(editor,{type:'restore-workspace-tabs',files:[],activePath:staged.value.activePath});
    expect(after.activeId).toBe(dirty(b).id);
    expect(after.documents).toBe(editor.documents);
    expect(analysisOpenSatisfied(review,after)).toBe(true);
  });
  it('keeps the current active tab when no target is requested',async()=>{
    const review=plan();
    const staged=await readAnalysisOpenSources(review,async()=>'',control);
    if(staged.kind!=='prepared')throw Error('No staged sources');
    const after=editorReducer(initial,{type:'restore-workspace-tabs',files:staged.value.files,activePath:null});
    expect(after.activeId).toBe(initial.activeId);
    expect(analysisOpenSatisfied(review,after)).toBe(true);
  });
  it('discards all staged bytes when a later native read fails',async()=>{
    const review=plan();
    const result=await readAnalysisOpenSources(review,async path=>{
      if(path.endsWith(b))throw Error('private failure at C:/secret');
      return 'private first source';
    },control);
    expect(result.kind).toBe('failed');
    expect(JSON.stringify(result)).not.toContain('private first source');
    expect(JSON.stringify(result)).not.toContain('C:/secret');
    expect('value' in result).toBe(false);
  });
  it('rejects oversized and malformed source text before returning a prepared batch',async()=>{
    for(const content of ['x'.repeat(MAX_ANALYSIS_OPEN_FILE_BYTES+1),'😀'.repeat(MAX_ANALYSIS_OPEN_FILE_BYTES/4+1),'\ud800']){
      expect((await readAnalysisOpenSources(plan([a]),async()=>content,control)).kind).toBe('failed');
    }
  });
  it('enforces the aggregate read budget before requesting another source',async()=>{
    const sources=Array.from({length:10},(_,index)=>entry('src/file-'+index+'.srp'));
    const labels=sources.map(source=>source.name);
    const review=value(prepareAnalysisOpen(analysisSourceCandidates(labels.map(source=>({source}))),
      labels,null,sources,initial));
    const read=vi.fn(async(_path:string,limit:number)=>'x'.repeat(limit));
    const result=await readAnalysisOpenSources(review,read,control);
    expect(result.kind).toBe('failed');
    expect(read.mock.calls.reduce((sum,call)=>sum+call[1],0)).toBe(MAX_ANALYSIS_OPEN_TOTAL_BYTES);
  });
  it('honors cancellation and workspace changes before or after staged reads',async()=>{
    let cancelled=false;
    const read=vi.fn(async()=>{cancelled=true;return 'private staged';});
    expect(await readAnalysisOpenSources(plan(),read,{...control,isCancelled:()=>cancelled})).toEqual({kind:'cancelled'});
    expect(read).toHaveBeenCalledTimes(1);
    let current=true;
    expect(await readAnalysisOpenSources(plan(),async()=>{current=false;return '';},
      {...control,isCurrent:()=>current})).toEqual({kind:'invalidated'});
    const untouched=vi.fn(async()=> '');
    cancelled=false;
    expect(await readAnalysisOpenSources(plan(),untouched,{...control,isCancelled:()=>cancelled,
      yieldBetweenFiles:async()=>{cancelled=true;}})).toEqual({kind:'cancelled'});
    expect(untouched).not.toHaveBeenCalled();
  });
});
