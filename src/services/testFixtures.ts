import { join } from '@tauri-apps/api/path';
import { open,readDir } from '@tauri-apps/plugin-fs';
import { sameFilePath } from '../model/documents';
import { buildFixtureInventory,fixtureSlot,fixturePlanMatches,summarizeFixtureBytes,
  MAX_FIXTURE_BYTES,MAX_FIXTURE_CREATE_BYTES,MAX_FIXTURE_DIRECTORY_ENTRIES,
  type FixtureInventory,type FixtureProjectTarget,type FixtureEntry,type FixtureStream,type FixtureResult,
  type FixtureByteSummary,type FixtureCreatePlan } from '../model/testFixtures';

interface ReadHandle{
  stat():Promise<{isFile:boolean;size:number;mtime?:Date|null}>;
  read(buffer:Uint8Array):Promise<number|null>;
  close():Promise<void>;
}
interface WriteHandle{
  write(buffer:Uint8Array):Promise<number>;
  close():Promise<void>;
}
export interface FixtureNative{
  join(...parts:string[]):Promise<string>;
  readDir(path:string):Promise<readonly FixtureEntry[]>;
  openRead(path:string):Promise<ReadHandle>;
  openNew(path:string):Promise<WriteHandle>;
}
const native:FixtureNative={join,readDir,openRead:path=>open(path,{read:true}),
  openNew:path=>open(path,{write:true,createNew:true})};
export interface FixtureOperation{
  readonly target:FixtureProjectTarget;
  readonly isCurrent:()=>boolean;
}
const fail=(error:string):FixtureResult<never>=>({ok:false,error});
function requireCurrent(operation:FixtureOperation){
  if(!operation.isCurrent())throw Error('Selected project or editor changed during fixture operation.');
}
function uniqueDirectory(entries:readonly FixtureEntry[],name:string){
  if(entries.length>MAX_FIXTURE_DIRECTORY_ENTRIES)throw Error('Directory exceeds fixture review entry budget.');
  const matches=entries.filter(entry=>entry.name.toLowerCase()===name.toLowerCase());
  if(matches.length!==1||matches[0].name!==name||!matches[0].isDirectory||matches[0].isFile||matches[0].isSymlink)
    throw Error('A fixture parent is missing, ambiguous or linked. Refresh the Explorer.');
}
/** Revalidate observed parent components; the actual permission boundary
 * remains native Tauri scope, not these best-effort directory checks. */
async function reviewDirectory(operation:FixtureOperation,io:FixtureNative){
  requireCurrent(operation);
  const {target}=operation;
  let folder=target.workspace;
  for(const component of target.directory?target.directory.split('/'):[]){
    if(!component||component==='.'||component==='..'||/[\\/:]/.test(component))throw Error('Invalid observed project directory.');
    const entries=await io.readDir(folder);requireCurrent(operation);
    uniqueDirectory(entries,component);
    folder=await io.join(folder,component);requireCurrent(operation);
  }
  if(!sameFilePath(folder,target.folder))throw Error('Selected project path changed.');
  const entries=await io.readDir(folder);requireCurrent(operation);
  if(entries.length>MAX_FIXTURE_DIRECTORY_ENTRIES)throw Error('Project directory exceeds fixture review budget.');
  if(!entries.some(entry=>(entry.name==='scarp.project'||entry.name==='Scarp.project')&&entry.isFile&&!entry.isDirectory&&!entry.isSymlink))
    throw Error('Project manifest is no longer present as a regular file.');
  if(!entries.some(entry=>entry.name.toLowerCase()==='tests'))return {directory:null,inventory:buildFixtureInventory([])};
  uniqueDirectory(entries,'tests');
  const directory=await io.join(folder,'tests');requireCurrent(operation);
  const children=await io.readDir(directory);requireCurrent(operation);
  return {directory,inventory:buildFixtureInventory(children)};
}
export async function scanTestFixtures(operation:FixtureOperation,io:FixtureNative=native):Promise<FixtureResult<FixtureInventory>>{
  try{return (await reviewDirectory(operation,io)).inventory;}
  catch(error){return fail(error instanceof Error?error.message:'Could not inspect test fixtures.');}
}
async function readBytes(operation:FixtureOperation,io:FixtureNative,path:string,limit:number):Promise<Uint8Array>{
  requireCurrent(operation);
  const handle=await io.openRead(path);
  try{
    requireCurrent(operation);
    const before=await handle.stat();requireCurrent(operation);
    if(!before.isFile||!Number.isSafeInteger(before.size)||before.size<0||before.size>limit)throw Error('Fixture is not a bounded regular file.');
    const result=new Uint8Array(before.size);
    let offset=0;
    while(true){
      const chunk=new Uint8Array(Math.min(16384,before.size-offset+1));
      const count=await handle.read(chunk);requireCurrent(operation);
      if(count===null)break;
      if(!Number.isSafeInteger(count)||count<=0||count>chunk.length||offset+count>before.size)throw Error('Fixture grew or returned invalid bytes during review.');
      result.set(chunk.subarray(0,count),offset);offset+=count;
    }
    const after=await handle.stat();requireCurrent(operation);
    if(offset!==before.size||!after.isFile||after.size!==before.size||after.mtime?.getTime()!==before.mtime?.getTime())
      throw Error('Fixture changed during review. Inspect it again.');
    return result;
  }finally{await handle.close();}
}
export async function inspectTestFixture(operation:FixtureOperation,testName:string,stream:FixtureStream,
  io:FixtureNative=native):Promise<FixtureResult<FixtureByteSummary>>{
  try{
    const checked=await reviewDirectory(operation,io);
    if(!checked.inventory.ok)return checked.inventory;
    const slot=fixtureSlot(checked.inventory.value,testName,stream);
    if(!checked.directory||!slot||slot.status!=='regular')return fail('Choose a uniquely observed regular fixture.');
    const path=await io.join(checked.directory,slot.name);requireCurrent(operation);
    const bytes=await readBytes(operation,io,path,MAX_FIXTURE_BYTES);
    requireCurrent(operation);
    return summarizeFixtureBytes(bytes);
  }catch(error){return fail(error instanceof Error?error.message:'Could not inspect fixture bytes.');}
}
export interface FixtureCreationOutcome{
  readonly status:'created'|'blocked'|'uncertain';
  readonly name:string;
  readonly message:string;
}
/** Exclusive creation only; never truncate or delete partial output. */
export async function createTestFixture(operation:FixtureOperation,plan:FixtureCreatePlan,
  io:FixtureNative=native):Promise<FixtureCreationOutcome>{
  let attempted=false;
  try{
    const checked=await reviewDirectory(operation,io);
    if(!checked.inventory.ok||!checked.directory||!fixturePlanMatches(plan,checked.inventory.value))
      throw Error('Fixture destination or reviewed bytes changed. Review again.');
    const path=await io.join(checked.directory,plan.name);requireCurrent(operation);
    const bytes=new TextEncoder().encode(plan.content);
    if(bytes.length>MAX_FIXTURE_CREATE_BYTES)throw Error('Fixture exceeds creation budget.');
    attempted=true;
    const handle=await io.openNew(path);
    try{
      requireCurrent(operation);
      let offset=0;
      while(offset<bytes.length){
        const remaining=bytes.subarray(offset,Math.min(bytes.length,offset+4096));
        const count=await handle.write(remaining);requireCurrent(operation);
        if(!Number.isSafeInteger(count)||count<=0||count>remaining.length)throw Error('Invalid native fixture write count.');
        offset+=count;
      }
    }finally{await handle.close();}
    const fresh=await reviewDirectory(operation,io);
    if(!fresh.inventory.ok||fixtureSlot(fresh.inventory.value,plan.request.testName,plan.request.stream)?.status!=='regular')
      throw Error('Created fixture identity could not be verified.');
    const observed=await readBytes(operation,io,path,MAX_FIXTURE_CREATE_BYTES);
    requireCurrent(operation);
    if(observed.length!==bytes.length||observed.some((value,index)=>value!==bytes[index]))throw Error('Readback bytes differ from reviewed fixture.');
    return {status:'created',name:plan.name,message:'Created and reread exact fixture bytes. No tests were executed.'};
  }catch(error){
    return {status:attempted?'uncertain':'blocked',name:plan.name,message:(error instanceof Error?error.message:'Fixture creation failed.')+
      (attempted?' A file may exist; inspect the directory before retrying. No cleanup or overwrite was attempted.':' No file was opened for creation.')};
  }
}
