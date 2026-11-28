import {describe,expect,it,vi} from 'vitest';
import {createUntitled,type StudioDocument} from './documents';
import {editorReducer,type EditorState,type EditorAction} from './editorState';
import {canUndoOpenFileReplace} from './openFileReplaceUndo';
import {AutoSaveReviewGate} from './autoSaveReviewGate';
import {DEFAULT_PROJECT_SEARCH_SCOPE,PROJECT_SEARCH_BATCH_SIZE,MAX_SCOPE_REPORT_UNITS} from './projectSearchScope';
import type {InspectionControl} from './projectInspection';
import {prepareProjectMigration,confirmProjectMigration,scanProjectMigration,planProjectMigration,
  prepareMigrationApply,createMigrationUndo,migrationInventoryIsCurrent,filterMigrationSites,
  pageMigrationSites,migrationInventoryReport,DEFAULT_MIGRATION_FILTER,type MigrationInventory} from './projectIdentifierMigration';

const a='src/a.srp',b='src/b.srp',c='tests/check.srp';
const entry=(name:string)=>({name,path:'C:/private-workspace/'+name});
const listed=[a,b,c].map(entry);
const rules=[{from:'old_value',to:'new_value'},{from:'helper_fn',to:'worker_fn'}];
const working='bind old_value = 9; helper_fn(); // private comment';
const saved='bind old_value = 1;';
const sourceB='funcra helper_fn() { print(old_value); }';
const sourceC='// no matching code here';
const disk={[a]:saved,[b]:sourceB,[c]:sourceC};
const existing:StudioDocument={id:'working',name:'a.srp',path:entry(a).path,
  content:working,savedContent:saved,revision:4};
const editor:EditorState={documents:[createUntitled(1),existing],activeId:existing.id,nextUntitled:2,sessionRevision:7};
const control:InspectionControl={isCurrent:()=>true,isCancelled:()=>false};
function value<T>(result:{ok:true;value:T}|{ok:false;error:string}):T{
  if(!result.ok)throw Error(result.error);return result.value;
}
function review(){
  return value(prepareProjectMigration(listed,DEFAULT_PROJECT_SEARCH_SCOPE,false,rules));
}
function reader(contents:Record<string,string>=disk){
  return vi.fn(async(path:string,_limit:number)=>{
    const name=path.replace('C:/private-workspace/','');
    if(!Object.hasOwn(contents,name))throw Error('private read error');
    return contents[name];
  });
}
async function inventory(state=editor,contents=disk):Promise<MigrationInventory>{
  const result=await scanProjectMigration(review(),state,reader(contents),control);
  if(result.kind!=='inventory')throw Error('No migration inventory');
  return result.value;
}
function all(inventory:MigrationInventory,state=editor){
  return value(planProjectMigration(inventory,inventory.sites.map(site=>site.id),true,state));
}
describe('reviewed project migration scope',()=>{
  it('reviews exact source membership and ordered rule identity',()=>{
    const reviewed=review();
    expect(reviewed.inspection.selected).toBe(3);
    expect(confirmProjectMigration(reviewed,listed,DEFAULT_PROJECT_SEARCH_SCOPE,false,rules).ok).toBe(true);
    expect(confirmProjectMigration(reviewed,listed,DEFAULT_PROJECT_SEARCH_SCOPE,false,[...rules].reverse()).ok).toBe(false);
    expect(confirmProjectMigration(reviewed,listed.slice(1),DEFAULT_PROJECT_SEARCH_SCOPE,false,rules).ok).toBe(false);
    expect(confirmProjectMigration(reviewed,listed,DEFAULT_PROJECT_SEARCH_SCOPE,true,rules).ok).toBe(false);
    expect(confirmProjectMigration(reviewed,listed,{...DEFAULT_PROJECT_SEARCH_SCOPE,directory:'src'},false,rules).ok).toBe(false);
  });
  it('rejects withheld and limited inventory before reading any files',()=>{
    expect(prepareProjectMigration([...listed,entry(a)],DEFAULT_PROJECT_SEARCH_SCOPE,false,rules).ok).toBe(false);
    expect(prepareProjectMigration(listed,DEFAULT_PROJECT_SEARCH_SCOPE,true,rules).ok).toBe(false);
    expect(prepareProjectMigration([{name:a,path:'relative/a.srp'}],DEFAULT_PROJECT_SEARCH_SCOPE,false,rules).ok).toBe(false);
  });
  it('accepts an explicitly numbered batch and discloses deferred sources',()=>{
    const sources=Array.from({length:PROJECT_SEARCH_BATCH_SIZE+2},(_,index)=>entry('src/f'+index+'.srp'));
    const planned=value(prepareProjectMigration(sources,{...DEFAULT_PROJECT_SEARCH_SCOPE,batch:1},false,rules));
    expect(planned.inspection.selected).toBe(PROJECT_SEARCH_BATCH_SIZE);
    expect(planned.inspection.deferred).toBe(2);
  });
});
describe('project migration scan',()=>{
  it('reads closed sources once and uses exact dirty working contents instead of disk',async()=>{
    const read=reader();
    const progress=vi.fn();
    const result=await scanProjectMigration(review(),editor,read,{...control,onProgress:progress});
    if(result.kind!=='inventory')throw Error('No inventory');
    const data=result.value;
    expect(data.snapshots).toHaveLength(3);
    expect(data.sites).toHaveLength(4);
    expect(data.snapshots.find(snapshot=>snapshot.name===a)).toMatchObject({origin:'open-buffer',content:working});
    expect(data.snapshots.find(snapshot=>snapshot.name===b)).toMatchObject({origin:'disk',content:sourceB});
    expect(read).toHaveBeenCalledTimes(2);
    expect(read.mock.calls.every(call=>call[0]!==entry(a).path)).toBe(true);
    expect(progress.mock.calls.at(-1)?.[0]).toEqual({observed:3,total:3});
    expect(migrationInventoryIsCurrent(data,editor)).toBe(true);
    expect(Object.isFrozen(data.snapshots[0])).toBe(true);
  });
  it('refuses an entire inventory when any selected disk source fails, even without a match',async()=>{
    const result=await scanProjectMigration(review(),editor,reader({[a]:saved,[b]:sourceB}),control);
    expect(result.kind).toBe('failed');
    expect('value' in result).toBe(false);
    expect(JSON.stringify(result)).not.toContain('private read error');
    expect(JSON.stringify(result)).not.toContain('private comment');
  });
  it('refuses ambiguous buffers and malformed or over-cap scans',async()=>{
    const ambiguous={...editor,documents:[...editor.documents,{...existing,id:'duplicate'}]};
    expect((await scanProjectMigration(review(),ambiguous,reader(),control)).kind).toBe('failed');
    expect((await scanProjectMigration(review(),editor,reader({...disk,[c]:'"unfinished'}),control)).kind).toBe('failed');
    expect((await scanProjectMigration(review(),editor,reader({...disk,[c]:'old_value;'.repeat(241)}),control)).kind).toBe('failed');
  });
  it('cancellation and invalidation never expose partially scanned private text',async()=>{
    let cancelled=false;
    const result=await scanProjectMigration(review(),editor,async()=>{cancelled=true;return sourceB;},
      {...control,isCancelled:()=>cancelled});
    expect(result).toEqual({kind:'cancelled'});
    let current=true;
    expect(await scanProjectMigration(review(),editor,async()=>{current=false;return sourceB;},
      {...control,isCurrent:()=>current})).toEqual({kind:'invalidated'});
    const read=reader();
    cancelled=false;
    expect(await scanProjectMigration(review(),editor,read,{...control,isCancelled:()=>cancelled,
      yieldBetweenFiles:async()=>{cancelled=true;}})).toEqual({kind:'cancelled'});
    expect(read).not.toHaveBeenCalled();
  });
});
describe('selected migration plans',()=>{
  it('starts from exact reviewed site identities and preserves nonselected sites',async()=>{
    const data=await inventory();
    const selected=data.sites.filter(site=>site.source===b&&site.rule===1);
    const plan=value(planProjectMigration(data,selected.map(site=>site.id),false,editor));
    expect(plan.replacements).toBe(1);
    expect(plan.newTabs).toBe(1);
    expect(plan.changes).toHaveLength(1);
    expect(plan.changes[0].before).toBe(sourceB);
    expect(plan.changes[0].after).toBe('funcra worker_fn() { print(old_value); }');
  });
  it('rejects forged evidence, duplicate selections and stale editor generations',async()=>{
    const data=await inventory();
    const id=data.sites[0].id;
    expect(planProjectMigration(data,[],false,editor).ok).toBe(false);
    expect(planProjectMigration(data,[id,id],false,editor).ok).toBe(false);
    expect(planProjectMigration(data,['unknown'],false,editor).ok).toBe(false);
    expect(planProjectMigration(data,[id],false,{...editor,sessionRevision:8}).ok).toBe(false);
    expect(planProjectMigration({...data,sites:[{...data.sites[0],offset:0},...data.sites.slice(1)]},[id],true,editor).ok).toBe(false);
    const changed=editorReducer(editor,{type:'edit',id:existing.id,content:working+' '});
    expect(planProjectMigration(data,[id],true,changed).ok).toBe(false);
  });
  it('requires acknowledgement even when the target appears only in an unmatched source',async()=>{
    const data=await inventory(editor,{...disk,[c]:'bind new_value = 10;'});
    const ids=data.sites.map(site=>site.id);
    expect(data.warnings).toContainEqual({source:c,rule:0,kind:'existing-target',count:1});
    expect(planProjectMigration(data,ids,false,editor).ok).toBe(false);
    expect(planProjectMigration(data,ids,true,editor).ok).toBe(true);
  });
  it('filters selection, rule, role and source independently of actual edit state',async()=>{
    const data=await inventory();
    const selected=[data.sites[0].id];
    const defaults=DEFAULT_MIGRATION_FILTER;
    expect(filterMigrationSites(data,defaults,selected)).toHaveLength(4);
    expect(filterMigrationSites(data,{...defaults,source:b},selected)).toHaveLength(2);
    expect(filterMigrationSites(data,{...defaults,rule:0},selected)).toHaveLength(2);
    expect(filterMigrationSites(data,{...defaults,role:'declaration'},selected)).toHaveLength(2);
    expect(filterMigrationSites(data,{...defaults,selectedOnly:true},selected)).toHaveLength(1);
    expect(pageMigrationSites([],999)).toEqual({page:1,pages:1,rows:[]});
    expect(pageMigrationSites(data.sites,NaN).page).toBe(1);
  });
});
describe('apply transaction and undo',()=>{
  it('revalidates every closed source then commits edits to existing and new unsaved buffers atomically',async()=>{
    const plan=all(await inventory());
    const read=reader();
    const prepared=await prepareMigrationApply(plan,listed,false,editor,read,control);
    if(prepared.kind!=='prepared')throw Error('No prepared action');
    expect(read.mock.calls.map(call=>call[0]).sort()).toEqual([entry(b).path,entry(c).path].sort());
    const result=editorReducer(editor,prepared.action);
    expect(result.sessionRevision).toBe(editor.sessionRevision+1);
    expect(result.activeId).toBe(editor.activeId);
    expect(result.documents).toHaveLength(3);
    expect(result.documents.find(doc=>doc.id===existing.id)).toMatchObject({
      content:'bind new_value = 9; worker_fn(); // private comment',savedContent:saved,
    });
    const opened=result.documents.find(doc=>doc.path===entry(b).path)!;
    expect(opened).toMatchObject({content:'funcra worker_fn() { print(new_value); }',savedContent:sourceB});
    expect(result.documents.find(doc=>doc.path===entry(c).path)).toBeUndefined();
    expect(result.documents[0]).toBe(editor.documents[0]);
    const undo=createMigrationUndo(prepared.changes,result)!;
    expect(canUndoOpenFileReplace(undo,result)).toBe(true);
    const undone=editorReducer(result,{type:'replace-open-files',changes:undo.changes,allSnapshots:undo.after});
    expect(undone.documents.find(doc=>doc.id===existing.id)).toMatchObject({content:working,savedContent:saved});
    expect(undone.documents.find(doc=>doc.id===opened.id)).toMatchObject({content:sourceB,savedContent:sourceB});
    expect(undone.documents).toHaveLength(3);
    expect(canUndoOpenFileReplace(undo,undone)).toBe(false);
  });
  it('discards a prepared transaction if an unedited closed source changed since review',async()=>{
    const plan=all(await inventory());
    const result=await prepareMigrationApply(plan,listed,false,editor,reader({...disk,[c]:'bind new_value = 4;'}),control);
    expect(result.kind).toBe('failed');
    expect('action' in result).toBe(false);
    expect(JSON.stringify(result)).not.toContain('bind new_value');
  });
  it('rejects source listing, editor and plan changes before disk revalidation',async()=>{
    const plan=all(await inventory());
    const read=reader();
    expect((await prepareMigrationApply(plan,listed.slice(1),false,editor,read,control)).kind).toBe('failed');
    expect((await prepareMigrationApply(plan,listed,false,{...editor,sessionRevision:8},read,control)).kind).toBe('failed');
    const changed={...plan,changes:[{...plan.changes[0],after:'forged'},...plan.changes.slice(1)]};
    expect((await prepareMigrationApply(changed,listed,false,editor,read,control)).kind).toBe('failed');
    expect(read).not.toHaveBeenCalled();
  });
  it('blocks late cancellation and workspace change after a disk read',async()=>{
    const plan=all(await inventory());
    let cancelled=false;
    const result=await prepareMigrationApply(plan,listed,false,editor,async()=>{cancelled=true;return sourceB;},
      {...control,isCancelled:()=>cancelled});
    expect(result).toEqual({kind:'cancelled'});
    let current=true;
    expect(await prepareMigrationApply(plan,listed,false,editor,async()=>{current=false;return sourceB;},
      {...control,isCurrent:()=>current})).toEqual({kind:'invalidated'});
  });
  it('reducer rejects duplicate paths, mismatched snapshots and stale editor session',async()=>{
    const prepared=await prepareMigrationApply(all(await inventory()),listed,false,editor,reader(),control);
    if(prepared.kind!=='prepared'||prepared.action.type!=='stage-source-replacements')throw Error('Missing action');
    const action=prepared.action;
    const cases:EditorAction[]=[
      {...action,sessionRevision:8},
      {...action,activeId:'untitled-1'},
      {...action,changes:[action.changes[0],action.changes[0]]},
      {...action,changes:[{...action.changes[0],before:'forged'},...action.changes.slice(1)]},
      {...action,changes:[{...action.changes[0],path:'../bad.srp'},...action.changes.slice(1)]},
      {...action,changes:[{...action.changes[0],after:action.changes[0].before},...action.changes.slice(1)]},
    ];
    for(const invalid of cases)expect(editorReducer(editor,invalid)).toBe(editor);
    const changed=editorReducer(editor,{type:'edit',id:existing.id,content:working+' '});
    expect(editorReducer(changed,action)).toBe(changed);
  });
  it('holds every changed buffer, including newly opened files, from autosave',async()=>{
    const prepared=await prepareMigrationApply(all(await inventory()),listed,false,editor,reader(),control);
    if(prepared.kind!=='prepared')throw Error('No action');
    const next=editorReducer(editor,prepared.action);
    const undo=createMigrationUndo(prepared.changes,next)!;
    const gate=new AutoSaveReviewGate();
    gate.holdReplacements(next.documents,undo.changes.map(change=>change.id));
    for(const change of undo.changes){
      const live=next.documents.find(document=>document.id===change.id)!;
      expect(gate.isHeld(live)).toBe(true);
      expect(gate.canWrite(live,live,true)).toBe(false);
    }
  });
});
describe('migration report privacy',()=>{
  it('does not export private source text, snippets or paths and opts in separately to mappings and labels',async()=>{
    const data=await inventory();
    const ids=data.sites.map(site=>site.id);
    const plain=migrationInventoryReport(data,ids);
    for(const secret of [a,b,c,'old_value','new_value','helper_fn','worker_fn','private comment','C:/private-workspace'])expect(plain).not.toContain(secret);
    const labels=migrationInventoryReport(data,ids,true,false);
    expect(labels).toContain(a);
    expect(labels).not.toContain('old_value');
    const mappings=migrationInventoryReport(data,ids,false,true);
    expect(mappings).toContain('old_value');
    expect(mappings).not.toContain(a);
    const full=migrationInventoryReport(data,ids,true,true);
    expect(full).not.toContain('private comment');
    expect(full).not.toContain('C:/private-workspace');
    expect(full.length).toBeLessThanOrEqual(MAX_SCOPE_REPORT_UNITS);
  });
});
