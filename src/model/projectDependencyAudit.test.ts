import { describe,expect,it,vi } from 'vitest';
import { auditListedProjectDependencies,normalizeProjectImportLabel,resolveAuditFile,filterAuditEdges,auditSummary,
  MAX_AUDIT_FILES,MAX_AUDIT_FILE_BYTES,MAX_AUDIT_TOTAL_BYTES } from './projectDependencyAudit';
import { createUntitled,type StudioDocument } from './documents';
import type { TestSourceListing } from './projectTestNavigation';
import { reachableImportNodes } from './importDependencyReview';
const root='C:/workspace',folder=root+'/app';
const file=(name:string)=>({name,path:root+'/'+name});
const listing:TestSourceListing={path:root,projectRoots:[{directory:'app',path:folder},{directory:'other',path:root+'/other'}],
  files:['app/src/main.srp','app/src/lib.srp','app/tests/check.srp','app/src/unused.srp','other/src/main.srp'].map(file)};
const content:Record<string,string>={
  [folder+'/src/main.srp']:'import "lib.srp" as lib;\nprint(lib.x);',
  [folder+'/src/lib.srp']:'import "main.srp" as main;\npub bind x=1;',
  [folder+'/tests/check.srp']:'import "../src/lib.srp" as lib;\nassert(lib.x==1);',
  [folder+'/src/unused.srp']:'import "../../other/src/main.srp" as external;\nimport "missing.srp" as missing;',
};
function document(path:string,text:string,saved=text):StudioDocument{
  return {...createUntitled(1),id:'open:'+path,path,name:path.split('/').at(-1)!,content:text,savedContent:saved,revision:1};
}
async function run(mode:'working'|'saved'='working',docs:StudioDocument[]=[],selected=listing,limited=false){
  const read=vi.fn(async(path:string,_max:number)=>{if(!(path in content))throw Error('Not readable');return content[path];});
  const response=await auditListedProjectDependencies(selected,folder,mode,docs,limited,read,()=>true);
  if(!response.ok)throw Error(response.error);
  return {audit:response.audit,read};
}
describe('project-relative import label normalization',()=>{
  it.each([['src/main.srp','lib.srp','src/lib.srp'],['tests/check.srp','../src/lib.srp','src/lib.srp'],
    ['src/nested/main.srp','../../lib.srp','lib.srp'],['src/main.srp','./a.srp','src/a.srp'],
    ['main.srp','हिंदी.srp','हिंदी.srp']])('normalizes %s + %s without native path joining',(source,specifier,expected)=>{
    expect(normalizeProjectImportLabel(source,specifier)).toBe(expected);
  });
  it.each(['../../outside.srp','/absolute.srp','C:/file.srp','a\\b.srp','src//a.srp','a.txt','../.hidden/x.srp',
    '../target/a.srp','x\u0000.srp','x\u202e.srp','\ud800.srp'])('rejects unsupported or outside label %j',specifier=>{
    expect(normalizeProjectImportLabel('src/main.srp',specifier)).toBeNull();
  });
});
describe('bounded project import audit',()=>{
  it('reads only selected nested project sources and discovers cycles across unopened files',async()=>{
    const {audit,read}=await run();
    expect(read).toHaveBeenCalledTimes(4);
    expect(read.mock.calls.every(([path])=>path.startsWith(folder+'/'))).toBe(true);
    expect(audit.files.map(file=>file.name)).toEqual(['src/main.srp','src/lib.srp','tests/check.srp','src/unused.srp']);
    expect(audit.counts).toMatchObject({observed:3,outside:1,missing:1});
    expect(audit.dependency.components.filter(component=>component.cyclic).map(component=>component.members.map(node=>node.name)))
      .toEqual([['src/lib.srp','src/main.srp']]);
    const test=audit.files.find(file=>file.name==='tests/check.srp')!;
    expect(reachableImportNodes(audit.dependency,test.id,'dependencies').map(item=>item.node.name)).toEqual(['src/lib.srp','src/main.srp']);
    expect(audit.dependency.incomplete).toBe(true);
  });
  it('uses open working text only when explicitly requested',async()=>{
    const path=folder+'/src/main.srp',docs=[document(path,'import "unused.srp" as x;',content[path])];
    const working=await run('working',docs);
    const saved=await run('saved',docs);
    expect(working.read.mock.calls.some(([name])=>name===path)).toBe(false);
    expect(saved.read.mock.calls.some(([name])=>name===path)).toBe(true);
    expect(working.audit.files.find(file=>file.path===path)).toMatchObject({origin:'open-buffer',dirty:true});
    expect(saved.audit.files.find(file=>file.path===path)).toMatchObject({origin:'disk',dirty:true});
    expect(working.audit.edges.find(edge=>edge.from===working.audit.files[0].id)?.targetLabel).toBe('src/unused.srp');
    expect(saved.audit.edges.find(edge=>edge.from===saved.audit.files[0].id)?.targetLabel).toBe('src/lib.srp');
  });
  it('never treats duplicate listing names or aliased paths as uniquely readable targets',async()=>{
    const duplicate={...listing,files:[...listing.files,{name:'app/src/lib.srp',path:folder+'/other/lib.srp'}]};
    const {audit,read}=await run('working',[],duplicate);
    expect(read.mock.calls.some(([path])=>path===folder+'/src/lib.srp')).toBe(false);
    expect(audit.counts.ambiguous).toBe(2);
    expect(audit.files.filter(file=>file.name==='src/lib.srp').every(file=>file.state==='not-scanned')).toBe(true);
    const alias={...listing,files:[...listing.files,{name:'other/src/alias.srp',path:folder+'/SRC/LIB.SRP'}]};
    expect((await run('working',[],alias)).audit.counts.ambiguous).toBe(2);
  });
  it('discloses unreadable targets, partial lexical scans and listing limits',async()=>{
    const selected={...listing,files:[...listing.files,file('app/src/unknown.srp')]};
    const docs=[document(folder+'/src/lib.srp','print("""unterminated')];
    const {audit}=await run('working',docs,selected,true);
    expect(audit.files.find(file=>file.name==='src/lib.srp')?.state).toBe('partial');
    expect(audit.files.find(file=>file.name==='src/unknown.srp')?.state).toBe('unavailable');
    expect(audit.listingLimited).toBe(true);
    expect(audit.dependency.incomplete).toBe(true);
  });
  it('bounds file count and read bytes, distinguishing frontier from missing',async()=>{
    const many:TestSourceListing={path:folder,projectRoots:[{directory:'',path:folder}],files:
      Array.from({length:MAX_AUDIT_FILES+3},(_,i)=>({name:'src/'+String(i).padStart(2,'0')+'.srp',path:folder+'/src/'+String(i).padStart(2,'0')+'.srp'}))};
    const read=vi.fn(async(path:string,_max:number)=>path.endsWith('00.srp')?'import "26.srp" as last;':'');
    const result=await auditListedProjectDependencies(many,folder,'saved',[],false,read,()=>true);
    if(!result.ok)throw Error(result.error);
    expect(read).toHaveBeenCalledTimes(MAX_AUDIT_FILES);
    expect(result.audit.counts.frontier).toBe(1);
    expect(result.audit.files.filter(file=>file.state==='not-scanned')).toHaveLength(3);
    expect(read.mock.calls.every(([,limit])=>limit<=MAX_AUDIT_FILE_BYTES)).toBe(true);
    expect(result.audit.bytes).toBeLessThanOrEqual(MAX_AUDIT_TOTAL_BYTES);
  });
  it('aborts on stale generation and rejects a missing manifest root',async()=>{
    let current=true;
    const read=vi.fn(async()=>{current=false;return 'print(1);';});
    const stale=await auditListedProjectDependencies(listing,folder,'saved',[],false,read,()=>current);
    expect(stale.ok).toBe(false);
    const missing=await auditListedProjectDependencies(listing,root,'saved',[],false,read,()=>true);
    expect(missing.ok).toBe(false);
  });
  it('opens only an exact current listed source and reports privacy-safe counts',async()=>{
    const {audit}=await run();
    const first=audit.files[0];
    expect(resolveAuditFile(audit,first.id,listing,folder)).toBe(first.path);
    expect(resolveAuditFile(audit,first.id,{...listing},folder)).toBeNull();
    expect(resolveAuditFile(audit,first.id,listing,root+'/other')).toBeNull();
    expect(resolveAuditFile(audit,'invented',listing,folder)).toBeNull();
    expect(filterAuditEdges(audit,{query:'lib',status:'observed',file:'all'})).toHaveLength(3);
    expect(auditSummary(audit)).not.toContain('src/lib.srp');
    expect(auditSummary(audit,true)).toContain('src/lib.srp');
    expect(auditSummary(audit,true)).not.toContain(root);
  });
});
