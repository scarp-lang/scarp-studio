import { join } from '@tauri-apps/api/path';
import { mkdir,open,readDir } from '@tauri-apps/plugin-fs';
import { sameFilePath } from '../model/documents';
import { planProjectScaffold,scaffoldPlanIsCurrent,MAX_SCAFFOLD_FILE_BYTES,
  type ProjectScaffoldPlan,type ScaffoldCompletion,type ScaffoldStep } from '../model/projectScaffold';

export interface ScaffoldEntry {
  readonly name:string;
  readonly isDirectory:boolean;
  readonly isFile:boolean;
  readonly isSymlink:boolean;
}
export interface ScaffoldReadHandle {
  stat():Promise<{isFile:boolean;size:number}>;
  read(buffer:Uint8Array):Promise<number|null>;
  close():Promise<void>;
}
export interface ScaffoldWriteHandle {
  write(data:Uint8Array):Promise<number>;
  close():Promise<void>;
}
export interface ScaffoldNative {
  join(...parts:string[]):Promise<string>;
  readDir(path:string):Promise<readonly ScaffoldEntry[]>;
  mkdir(path:string):Promise<void>;
  openNew(path:string):Promise<ScaffoldWriteHandle>;
  openRead(path:string):Promise<ScaffoldReadHandle>;
}
const native:ScaffoldNative={
  join,readDir,
  mkdir:path=>mkdir(path,{recursive:false}),
  openNew:path=>open(path,{write:true,createNew:true}),
  openRead:path=>open(path,{read:true}),
};
export interface ScaffoldOptions {
  readonly root:string;
  readonly targets:readonly string[];
  readonly plan:ProjectScaffoldPlan;
  readonly isCurrent:()=>boolean;
  readonly openPaths:()=>readonly string[];
}
const reason=(value:unknown)=>value instanceof Error?value.message:String(value);
/** Verify exact newly created bytes via a bounded scoped file handle. */
async function verifyBytes(io:ScaffoldNative,path:string,expected:Uint8Array,requireCurrent:()=>void):Promise<void>{
  if(expected.length>MAX_SCAFFOLD_FILE_BYTES)throw Error('Invalid scaffold verification size.');
  requireCurrent();
  const handle=await io.openRead(path);
  try{
    requireCurrent();
    const before=await handle.stat();
    if(!before.isFile||before.size!==expected.length)throw Error('Created file size does not match preview.');
    let offset=0;
    while(offset<=expected.length){
      requireCurrent();
      const buffer=new Uint8Array(Math.min(4096,expected.length-offset+1));
      const count=await handle.read(buffer);
      requireCurrent();
      if(count===null)break;
      if(!Number.isSafeInteger(count)||count<=0||count>buffer.length||offset+count>expected.length){
        throw Error('Created file returned unexpected bytes.');
      }
      for(let i=0;i<count;i++)if(buffer[i]!==expected[offset+i])throw Error('Created file bytes differ from preview.');
      offset+=count;
    }
    const after=await handle.stat();
    requireCurrent();
    if(offset!==expected.length||!after.isFile||after.size!==expected.length)throw Error('Created file could not be verified.');
  }finally{await handle.close();}
}
async function writeExclusive(io:ScaffoldNative,path:string,content:string,requireCurrent:()=>void):Promise<void>{
  const bytes=new TextEncoder().encode(content);
  if(bytes.length>MAX_SCAFFOLD_FILE_BYTES)throw Error('Template byte budget exceeded.');
  requireCurrent();
  // Exclusive handle-bound writes, never create/truncate or writeTextFile.
  const handle=await io.openNew(path);
  try{
    let offset=0;
    while(offset<bytes.length){
      requireCurrent();
      const remaining=bytes.subarray(offset,Math.min(bytes.length,offset+4096));
      const count=await handle.write(remaining);
      requireCurrent();
      if(!Number.isSafeInteger(count)||count<=0||count>remaining.length)throw Error('Invalid native write count.');
      offset+=count;
    }
  }finally{await handle.close();}
  await verifyBytes(io,path,bytes,requireCurrent);
}
/** Sequential exclusive creation. No cleanup deletion or rollback: report
 * confirmed and uncertain relative destinations. Directory checks reduce
 * ordinary races; the actual permission boundary remains Tauri scope. */
export async function createProjectScaffold(options:ScaffoldOptions,io:ScaffoldNative=native):Promise<ScaffoldCompletion>{
  const created:ScaffoldStep[]=[],uncertain:ScaffoldStep[]=[];
  let attempted:ScaffoldStep|null=null;
  const directory=options.plan.directory;
  function finish(status:ScaffoldCompletion['status'],error:string|null):ScaffoldCompletion{
    return Object.freeze({status,directory,created:Object.freeze([...created]),uncertain:Object.freeze([...uncertain]),error});
  }
  function requireCurrent(){
    if(!options.isCurrent())throw Error('Workspace changed during project creation.');
  }
  async function entries(path:string){
    requireCurrent();
    const result=await io.readDir(path);
    requireCurrent();
    return result;
  }
  async function pathFor(parts:readonly string[]):Promise<string>{
    let path=options.root;
    for(const component of parts){
      const listing=await entries(path);
      const matches=listing.filter(entry=>entry.name.toLowerCase()===component.toLowerCase());
      if(matches.length!==1||matches[0].name!==component||!matches[0].isDirectory||matches[0].isFile||matches[0].isSymlink){
        throw Error('A project parent is missing, ambiguous or linked. Refresh Explorer.');
      }
      path=await io.join(path,component);requireCurrent();
    }
    return path;
  }
  async function availableChild(parent:string,name:string):Promise<string>{
    const listing=await entries(parent);
    if(listing.some(entry=>entry.name.toLowerCase()===name.toLowerCase()))throw Error('Destination already exists: '+name);
    const path=await io.join(parent,name);requireCurrent();
    if(options.openPaths().some(openPath=>sameFilePath(openPath,path)))throw Error('Destination is already represented by an open editor.');
    return path;
  }
  try{
    requireCurrent();
    const validated=planProjectScaffold(options.plan.request,options.targets);
    if(!validated.ok||!scaffoldPlanIsCurrent(options.plan,options.targets))throw Error('Project preview changed. Review again.');
    const plan=validated.value;
    const parentParts=plan.request.parent?plan.request.parent.split('/'):[];
    const rootParts=[...parentParts,plan.request.folderName];
    const parent=await pathFor(parentParts);
    const project=await availableChild(parent,plan.request.folderName);
    for(const file of plan.files){
      const path=await io.join(project,...file.path.split('/'));requireCurrent();
      if(options.openPaths().some(openPath=>sameFilePath(openPath,path)))throw Error('A planned source already has an open editor.');
    }
    attempted={kind:'directory',relativePath:plan.directory};
    await io.mkdir(project);
    created.push(attempted);attempted=null;
    requireCurrent();
    for(const name of plan.directories){
      const root=await pathFor(rootParts);
      const path=await availableChild(root,name);
      attempted={kind:'directory',relativePath:plan.directory+'/'+name};
      await io.mkdir(path);
      created.push(attempted);attempted=null;requireCurrent();
    }
    // Manifest last: don't expose a partial project as a discovered project.
    const ordered=[...plan.files.filter(file=>file.kind!=='manifest'),...plan.files.filter(file=>file.kind==='manifest')];
    for(const file of ordered){
      const parts=file.path.split('/');
      const name=parts.pop()!;
      const parent=await pathFor([...rootParts,...parts]);
      const path=await availableChild(parent,name);
      attempted={kind:'file',relativePath:plan.directory+'/'+file.path};
      await writeExclusive(io,path,file.content,requireCurrent);
      created.push(attempted);attempted=null;requireCurrent();
    }
    return finish('complete',null);
  }catch(error){
    if(attempted)uncertain.push(attempted);
    return finish(created.length||uncertain.length?'partial':'blocked',reason(error));
  }
}
