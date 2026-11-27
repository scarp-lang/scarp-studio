import { describe,expect,it,vi } from 'vitest';
import { editorReducer,initialEditorState } from './editorState';
import type { StudioDocument } from './documents';
import { planProjectCommandDiskCheck,projectCommandDiskPlanCurrent,checkProjectCommandDisk,projectDiskCheckMessage,
  applyProjectDiskFreshness,MAX_PROJECT_COMMAND_CHECK_FILES,MAX_PROJECT_COMMAND_CHECK_BYTES,type DiskGuardResult } from './projectCommandDiskGuard';
import { projectResultFreshness } from './resultFreshness';

function doc(path:string,content='print("ok")',id=path):StudioDocument{
  return {id,path,name:path.split(/[\\/]/).at(-1)!,content,savedContent:content,revision:1};
}
function value<T>(result:DiskGuardResult<T>):T{if(!result.ok)throw Error(result.error);return result.value;}
describe('project command disk inventory',()=>{
  it('uses only named Scarp sources under the chosen root',()=>{
    const sources=[doc('/project/main.srp'),doc('/project/lib/a.srp'),doc('/project-other/main.srp'),doc('/project/note.txt'),
      {...doc('/project/unsaved.srp'),path:null},doc('/other/main.srp')];
    const plan=value(planProjectCommandDiskCheck(sources,'/project'));
    expect(plan.sources.map(source=>source.path)).toEqual(['/project/main.srp','/project/lib/a.srp']);
    expect(Object.isFrozen(plan.sources)).toBe(true);
  });
  it('handles Windows separators, case and safe lexical aliases',()=>{
    const sources=[doc('C:\\Work\\Project\\src\\main.srp'),doc('c:/work/project/lib/../a.srp'),
      doc('C:/Work/Project2/main.srp')];
    expect(value(planProjectCommandDiskCheck(sources,'c:/work/project')).sources).toHaveLength(2);
  });
  it('rejects dirty project buffers while ignoring unrelated dirty sources',()=>{
    const active=doc('/project/main.srp');
    expect(planProjectCommandDiskCheck([{...active,content:'new'}],'/project').ok).toBe(false);
    expect(planProjectCommandDiskCheck([active,{...doc('/other/main.srp'),content:'new'}],'/project').ok).toBe(true);
  });
  it('rejects duplicated path aliases and over-budget inventories',()=>{
    expect(planProjectCommandDiskCheck([doc('C:/Work/main.srp'),doc('c:\\work\\main.srp','different','other')],'c:/work').ok).toBe(false);
    const sources=Array.from({length:MAX_PROJECT_COMMAND_CHECK_FILES+1},(_,i)=>doc('/project/'+i+'.srp'));
    expect(planProjectCommandDiskCheck(sources,'/project').ok).toBe(false);
    const large='x'.repeat(MAX_PROJECT_COMMAND_CHECK_BYTES/4);
    expect(planProjectCommandDiskCheck(Array.from({length:5},(_,i)=>doc('/project/'+i+'.srp',large)),'/project').ok).toBe(false);
  });
  it('does not change an inventory on unrelated buffer mutations or tab focus',()=>{
    const active=doc('/project/main.srp'),other=doc('/other/main.srp');
    const plan=value(planProjectCommandDiskCheck([active,other],'/project'));
    expect(projectCommandDiskPlanCurrent(plan,[other,active])).toBe(true);
    expect(projectCommandDiskPlanCurrent(plan,[active,{...other,content:'edit',revision:2}])).toBe(true);
    expect(projectCommandDiskPlanCurrent(plan,[active,doc('/project/lib.srp')])).toBe(false);
    expect(projectCommandDiskPlanCurrent(plan,[{...active,revision:2}])).toBe(false);
    expect(projectCommandDiskPlanCurrent(plan,[])).toBe(false);
  });
  it('rejects edit-and-revert through the editor reducer',()=>{
    const opened=editorReducer(initialEditorState,{type:'open',path:'/project/main.srp',content:'original'});
    const plan=value(planProjectCommandDiskCheck(opened.documents,'/project'));
    const changed=editorReducer(opened,{type:'edit',id:opened.activeId!,content:'edit'});
    const reverted=editorReducer(changed,{type:'edit',id:opened.activeId!,content:'original'});
    expect(projectCommandDiskPlanCurrent(plan,reverted.documents)).toBe(false);
  });
});
describe('bounded disk check execution',()=>{
  it('checks exact UTF-8 content without writing or retaining it in the result',async()=>{
    const sources=[doc('/project/a.srp','🙂\r\n'),doc('/project/b.srp','')];
    const plan=value(planProjectCommandDiskCheck(sources,'/project'));
    expect(plan.expectedBytes).toBe(6);
    const read=vi.fn(async(path:string)=>sources.find(source=>source.path===path)!.content);
    const result=await checkProjectCommandDisk(plan,read,()=>true);
    expect(read.mock.calls).toEqual([['/project/a.srp',7],['/project/b.srp',1]]);
    expect(result).toEqual({status:'matched',checked:2,total:2,rows:[
      {id:'/project/a.srp',name:'a.srp',status:'matched'},{id:'/project/b.srp',name:'b.srp',status:'matched'}]});
    expect(JSON.stringify(result)).not.toContain('🙂');
    expect(projectDiskCheckMessage(result,'before')).toBeNull();
  });
  it('stops at the first changed source and never claims subsequent checks',async()=>{
    const plan=value(planProjectCommandDiskCheck([doc('/p/a.srp','a'),doc('/p/b.srp','b')],'/p'));
    const read=vi.fn(async()=>'x');
    const result=await checkProjectCommandDisk(plan,read,()=>true);
    expect(result).toMatchObject({status:'changed',checked:1,total:2});
    expect(read).toHaveBeenCalledTimes(1);
    expect(projectDiskCheckMessage(result,'before')).toContain('Project command was not launched');
  });
  it('does not equate unreadable, missing or oversized files with matching contents',async()=>{
    const plan=value(planProjectCommandDiskCheck([doc('/p/a.srp')],'/p'));
    const result=await checkProjectCommandDisk(plan,async()=>{throw Error('/private/native/path');},()=>true);
    expect(result.status).toBe('unavailable');
    expect(projectDiskCheckMessage(result,'after')).toContain('structured results are withheld');
    expect(JSON.stringify(result)).not.toContain('/private/native/path');
  });
  it('respects cancellation before and after asynchronous reads',async()=>{
    const plan=value(planProjectCommandDiskCheck([doc('/p/a.srp','a')],'/p'));
    const read=vi.fn(async()=>'a');
    expect((await checkProjectCommandDisk(plan,read,()=>false)).status).toBe('cancelled');
    expect(read).not.toHaveBeenCalled();
    let current=true;
    const result=await checkProjectCommandDisk(plan,async()=>{current=false;return 'a';},()=>current);
    expect(result).toMatchObject({status:'cancelled',checked:0,total:1});
  });
  it('reports empty coverage honestly',async()=>{
    const plan=value(planProjectCommandDiskCheck([],'/p'));
    const read=vi.fn(async()=>'');
    expect(await checkProjectCommandDisk(plan,read,()=>true)).toEqual({status:'matched',checked:0,total:0,rows:[]});
    expect(read).not.toHaveBeenCalled();
  });
});
describe('post-command freshness',()=>{
  it('withholds structured tests on a failed disk check without discarding raw output',async()=>{
    const identity={epoch:1,listing:{}},fresh=projectResultFreshness('run-tests',identity,identity);
    expect(fresh.allowStructuredTests).toBe(true);
    const plan=value(planProjectCommandDiskCheck([doc('/p/a.srp','a')],'/p'));
    const review=await checkProjectCommandDisk(plan,async()=>'changed',()=>true);
    const guarded=applyProjectDiskFreshness(fresh,review);
    expect(guarded.stale).toBe(true);
    expect(guarded.allowStructuredTests).toBe(false);
    expect(guarded.warning).toContain('historical');
  });
  it('retains existing staleness even when disk check succeeds',()=>{
    const fresh=projectResultFreshness('verify',{epoch:1,listing:null},{epoch:2,listing:null});
    expect(applyProjectDiskFreshness(fresh,{status:'matched',checked:0,total:0,rows:[]})).toBe(fresh);
    expect(applyProjectDiskFreshness(fresh,null)).toBe(fresh);
    const guarded=applyProjectDiskFreshness(fresh,{status:'cancelled',checked:0,total:1,rows:[]});
    expect(guarded.warning).toContain(fresh.warning!);
    expect(guarded.warning).toContain('interrupted');
  });
});
