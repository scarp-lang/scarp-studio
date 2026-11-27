import { describe,expect,it } from 'vitest';
import { createProjectScaffold,type ScaffoldNative,type ScaffoldOptions,type ScaffoldEntry } from './projectScaffold';
import { planProjectScaffold } from '../model/projectScaffold';
const root='C:/workspace';
const folder=(name:string,isSymlink=false):ScaffoldEntry=>({name,isDirectory:true,isFile:false,isSymlink});
const regular=(name:string):ScaffoldEntry=>({name,isDirectory:false,isFile:true,isSymlink:false});
function setup(){
  const result=planProjectScaffold({parent:'practice',folderName:'app',projectName:'नमस्ते 🌍',version:'0.1.0',template:'calculator',includeTests:true},['','practice']);
  if(!result.ok)throw Error(result.error);
  const project=root+'/practice/app';
  const dirs=new Map<string,ScaffoldEntry[]>([[root,[folder('practice')]],[root+'/practice',[]]]);
  const data=new Map<string,number[]>();
  const events:string[]=[];
  const parent=(path:string)=>path.slice(0,path.lastIndexOf('/'));
  const name=(path:string)=>path.slice(path.lastIndexOf('/')+1);
  let current=true;
  const io:ScaffoldNative={
    join:async(...parts)=>parts.join('/'),
    readDir:async path=>{const entries=dirs.get(path);if(!entries)throw Error('not a directory');return entries;},
    mkdir:async path=>{
      const entries=dirs.get(parent(path))!;
      if(!entries||entries.some(entry=>entry.name.toLowerCase()===name(path).toLowerCase()))throw Error('already exists');
      events.push('mkdir '+path);entries.push(folder(name(path)));dirs.set(path,[]);
    },
    openNew:async path=>{
      const entries=dirs.get(parent(path))!;
      if(!entries||entries.some(entry=>entry.name.toLowerCase()===name(path).toLowerCase()))throw Error('already exists');
      events.push('create '+path);entries.push(regular(name(path)));const bytes:number[]=[];data.set(path,bytes);
      return {write:async input=>{const count=Math.min(7,input.length);bytes.push(...input.slice(0,count));return count;},close:async()=>{}};
    },
    openRead:async path=>{
      const bytes=data.get(path);if(!bytes)throw Error('missing file');
      let offset=0;
      return {stat:async()=>({isFile:true,size:bytes.length}),read:async buffer=>{
        const count=Math.min(buffer.length,5,bytes.length-offset);if(count===0)return null;
        buffer.set(bytes.slice(offset,offset+count));offset+=count;return count;
      },close:async()=>{}};
    },
  };
  const options:ScaffoldOptions={root,targets:['','practice'],plan:result.value,isCurrent:()=>current,openPaths:()=>[]};
  return {project,dirs,data,events,io,options,invalidate:()=>{current=false;}};
}
describe('exclusive scoped project creation',()=>{
  it('creates exact preview bytes with partial handle writes and manifest last',async()=>{
    const s=setup(),result=await createProjectScaffold(s.options,s.io);
    expect(result.status).toBe('complete');
    expect(result.uncertain).toEqual([]);
    expect(result.created.length).toBe(3+s.options.plan.files.length);
    expect(s.events.at(-1)).toBe('create '+s.project+'/scarp.project');
    for(const file of s.options.plan.files)
      expect(new TextDecoder().decode(Uint8Array.from(s.data.get(s.project+'/'+file.path)!))).toBe(file.content);
  });
  it('rejects a forged plan before native writes',async()=>{
    const s=setup();
    const result=await createProjectScaffold({...s.options,plan:{...s.options.plan,directory:'other'}},s.io);
    expect(result.status).toBe('blocked');expect(s.events).toEqual([]);
  });
  it('rejects existing case-insensitive root and linked or ambiguous parents',async()=>{
    for(const collision of ['root','link','ambiguous']){
      const s=setup();
      if(collision==='root')s.dirs.get(root+'/practice')!.push(folder('APP'));
      if(collision==='link')s.dirs.set(root,[folder('practice',true)]);
      if(collision==='ambiguous')s.dirs.set(root,[folder('practice'),folder('PRACTICE')]);
      expect((await createProjectScaffold(s.options,s.io)).status).toBe('blocked');
      expect(s.events).toEqual([]);
    }
  });
  it('preflights even open paths whose files do not exist on disk',async()=>{
    const s=setup();
    const result=await createProjectScaffold({...s.options,openPaths:()=>[s.project.toUpperCase()+'/SRC/MAIN.SRP']},s.io);
    expect(result.status).toBe('blocked');expect(s.events).toEqual([]);
  });
  it('stops on a failed create without overwriting or rolling back anything',async()=>{
    const s=setup(),original=s.io.openNew;
    s.io.openNew=async path=>{if(path.endsWith('math.srp'))throw Error('denied');return original(path);};
    const result=await createProjectScaffold(s.options,s.io);
    expect(result.status).toBe('partial');
    expect(result.created.some(step=>step.relativePath.endsWith('main.srp'))).toBe(true);
    expect(result.uncertain).toEqual([{kind:'file',relativePath:'practice/app/src/math.srp'}]);
    expect(s.data.has(s.project+'/scarp.project')).toBe(false);
    expect(s.data.has(s.project+'/src/main.srp')).toBe(true);
  });
  it('reports invalid write count and closes handle without attempting another destination',async()=>{
    const s=setup(),original=s.io.openNew;let closed=0;
    s.io.openNew=async path=>{const handle=await original(path);return {write:async()=>0,close:async()=>{closed++;await handle.close();}};};
    const result=await createProjectScaffold(s.options,s.io);
    expect(result.status).toBe('partial');
    expect(result.error).toContain('Invalid native write count');
    expect(closed).toBe(1);
    expect(s.data.size).toBe(1);
  });
  it('fails closed if created bytes are externally changed before verification',async()=>{
    const s=setup(),original=s.io.openRead;
    s.io.openRead=async path=>{s.data.get(path)![0]^=1;return original(path);};
    const result=await createProjectScaffold(s.options,s.io);
    expect(result.status).toBe('partial');
    expect(result.error).toContain('bytes differ');
    expect(s.data.has(s.project+'/scarp.project')).toBe(false);
  });
  it('closes handles and stops when the workspace changes during writing',async()=>{
    const s=setup(),original=s.io.openNew;let closed=false;
    s.io.openNew=async path=>{
      const handle=await original(path);
      return {write:async input=>{const count=await handle.write(input);s.invalidate();return count;},
        close:async()=>{closed=true;await handle.close();}};
    };
    const result=await createProjectScaffold(s.options,s.io);
    expect(result.status).toBe('partial');expect(closed).toBe(true);
    expect(result.uncertain).toHaveLength(1);expect(s.data.size).toBe(1);
  });
});
