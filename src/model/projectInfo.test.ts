import { describe,expect,it } from 'vitest';
import { parseProjectInfo,projectInfoEntry,compareProjectInfo,projectInfoReport,MAX_PROJECT_INFO_UNITS,type ProjectInfoSnapshot } from './projectInfo';
import type { StudioDocument } from './documents';
import type { TestSourceListing } from './projectTestNavigation';
function fixture(){
  return {schema_version:1,name:'a "quoted" हिंदी 🌍',version:'2.3.4-rc.1+git.9',type:'application',
    entry:'src/main.srp',manifest:'scarp.project',format:'v2'};
}
function parsed(patch:Record<string,unknown>={}){
  const result=parseProjectInfo(JSON.stringify({...fixture(),...patch}));
  if(!result.ok)throw Error(result.reason);
  return result.info;
}
function snapshot(folder='C:/workspace/nested',patch:Record<string,unknown>={}):ProjectInfoSnapshot{
  return {folder,info:parsed(patch)};
}
const listing:TestSourceListing={path:'C:/workspace',projectRoots:[
  {directory:'',path:'C:/workspace'},{directory:'nested',path:'C:/workspace/nested'},
  {directory:'another',path:'C:/workspace/another'},
],files:[
  {name:'src/main.srp',path:'C:/workspace/src/main.srp'},
  {name:'nested/src/main.srp',path:'C:/workspace/nested/src/main.srp'},
  {name:'another/src/main.srp',path:'C:/workspace/another/src/main.srp'},
]};
function document(path:string,dirty=false):StudioDocument{
  return {id:'file'+path,path,name:'main.srp',content:dirty?'changed':'saved',savedContent:'saved',revision:1};
}
describe('official saved project metadata schema',()=>{
  it('preserves quoted Unicode labels and prerelease/build version',()=>{
    const info=parsed();
    expect(info).toEqual({name:fixture().name,version:'2.3.4-rc.1+git.9',type:'application',
      entry:'src/main.srp',manifest:'scarp.project',format:'v2'});
    expect(Object.isFrozen(info)).toBe(true);
  });
  it('accepts legacy metadata without inventing a version',()=>{
    for(const manifest of ['Scarp.project','scarp.project']){
      expect(parsed({format:'legacy-v1',manifest,version:null})).toMatchObject({format:'legacy-v1',version:null,manifest});
    }
  });
  it('rejects unsupported schemas, envelopes and mismatched version formats',()=>{
    for(const json of ['', 'null','[]','true','{','x'.repeat(MAX_PROJECT_INFO_UNITS+1)])
      expect(parseProjectInfo(json).ok).toBe(false);
    for(const patch of [
      {schema_version:2},{type:'library'},{format:'future'},{version:null},{format:'legacy-v1'},
      {manifest:'other.project'},{manifest:'../scarp.project'},{name:''},{name:'\ud800'},
      {name:'x\u202e'},{name:'x\u0000'},{entry:42},
    ])expect(parseProjectInfo(JSON.stringify({...fixture(),...patch})).ok).toBe(false);
  });
  it.each(['0.01.0','01.0.0','1.2','1.2.3-01','1.2.3+','v1.2.3','1.2.3-rc..1',' 1.2.3'])('rejects invalid semver %s',version=>{
    expect(parseProjectInfo(JSON.stringify({...fixture(),version})).ok).toBe(false);
  });
  it.each(['0.0.0','1.2.3-0','1.2.3-0a.1','1.2.3+01','1.2.3-alpha.1+build.9'])('accepts semver %s',version=>{
    expect(parsed({version}).version).toBe(version);
  });
  it.each(['../escape.srp','/src/main.srp','C:/src/main.srp','src\\main.srp','src/./main.srp','src//main.srp','src/../main.srp','src/main.txt','src/a\u0000.srp'])('rejects unsafe entry label %s',entry=>{
    expect(parseProjectInfo(JSON.stringify({...fixture(),entry})).ok).toBe(false);
  });
});
describe('project entry listing provenance',()=>{
  it('matches the exact selected nested root, never a same-name sibling',()=>{
    const entry=projectInfoEntry(snapshot(),listing,[]);
    expect(entry).toEqual({kind:'listed',path:'C:/workspace/nested/src/main.srp',name:'nested/src/main.srp',open:false,dirty:false});
    expect(projectInfoEntry(snapshot('C:/workspace'),listing,[])).toMatchObject({path:'C:/workspace/src/main.srp'});
    expect(projectInfoEntry(snapshot('C:/workspace/another'),listing,[])).toMatchObject({path:'C:/workspace/another/src/main.srp'});
  });
  it('distinguishes open dirty working text from saved metadata',()=>{
    const path='C:/WORKSPACE/nested/src/main.srp';
    expect(projectInfoEntry(snapshot(),listing,[document(path,true)])).toMatchObject({kind:'listed',open:true,dirty:true});
    expect(projectInfoEntry(snapshot(),listing,[document(path)])).toMatchObject({kind:'listed',open:true,dirty:false});
    expect(projectInfoEntry(snapshot(),listing,[document('C:/workspace/src/main.srp',true)])).toMatchObject({kind:'listed',open:false,dirty:false});
  });
  it('fails closed for missing roots, omitted files and ambiguous labels or paths',()=>{
    expect(projectInfoEntry(snapshot(),null,[]).kind).toBe('not-listed');
    expect(projectInfoEntry(snapshot('C:/different'),listing,[]).kind).toBe('not-listed');
    expect(projectInfoEntry(snapshot(),{...listing,files:listing.files.slice(0,1)},[]).kind).toBe('not-listed');
    expect(projectInfoEntry(snapshot(),{...listing,files:[...listing.files,listing.files[1]]},[]).kind).toBe('not-listed');
    expect(projectInfoEntry(snapshot(),{...listing,files:[...listing.files,{name:'alias.srp',path:'C:/WORKSPACE/nested/src/main.srp'}]},[]).kind).toBe('not-listed');
    expect(projectInfoEntry(snapshot(),{...listing,projectRoots:[...listing.projectRoots!,listing.projectRoots![1]]},[]).kind).toBe('not-listed');
    expect(projectInfoEntry(snapshot(),listing,[document(listing.files[1].path),document(listing.files[1].path)]).kind).toBe('not-listed');
  });
  it('allows metadata for a non-browsable source but refuses to open it',()=>{
    expect(projectInfoEntry(snapshot(undefined,{entry:'.hidden/main.srp'}),listing,[]).kind).toBe('not-listed');
    expect(projectInfoEntry(snapshot(undefined,{entry:'target/main.srp'}),listing,[]).kind).toBe('not-listed');
  });
});
describe('metadata baseline and reports',()=>{
  it('compares fields only across the same project identity',()=>{
    const before=snapshot(),after=snapshot('C:/WORKSPACE/nested',{name:'renamed',version:'3.0.0',entry:'src/next.srp'});
    expect(compareProjectInfo(before,after)).toEqual([
      {field:'name',before:fixture().name,after:'renamed'},
      {field:'version',before:fixture().version,after:'3.0.0'},
      {field:'entry',before:fixture().entry,after:'src/next.srp'},
    ]);
    expect(compareProjectInfo(before,before)).toEqual([]);
    expect(compareProjectInfo(before,snapshot('C:/another'))).toBeNull();
    expect(compareProjectInfo(snapshot('/a'),snapshot('/A'))).toBeNull();
  });
  it('does not hide the legacy-to-modern version and format change',()=>{
    const before=snapshot(undefined,{format:'legacy-v1',manifest:'Scarp.project',version:null});
    const after=snapshot();
    expect(compareProjectInfo(before,after)?.map(change=>change.field)).toEqual(['version','manifest','format']);
  });
  it('omits private labels in both current metadata and baseline change rows',()=>{
    const before=snapshot(undefined,{name:'Secret name',entry:'src/secret.srp'});
    const after=snapshot(undefined,{name:'New name',entry:'src/new.srp'});
    const text=projectInfoReport(after,before);
    for(const value of ['Secret name','New name','secret.srp','new.srp','C:/workspace'])expect(text).not.toContain(value);
    expect(text).toContain('Project name: changed (values omitted)');
    const shown=projectInfoReport(after,before,true);
    expect(shown).toContain('Secret name');
    expect(shown).toContain('src/new.srp');
    expect(shown).not.toContain('C:/workspace');
  });
});
