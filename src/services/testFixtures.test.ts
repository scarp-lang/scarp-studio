import { describe,expect,it,vi } from 'vitest';
import { scanTestFixtures,inspectTestFixture,createTestFixture,type FixtureNative,type FixtureOperation } from './testFixtures';
import { planFixtureCreation,buildFixtureInventory,type FixtureEntry } from '../model/testFixtures';
const file=(name:string):FixtureEntry=>({name,isFile:true,isDirectory:false,isSymlink:false});
const directory=(name:string):FixtureEntry=>({name,isFile:false,isDirectory:true,isSymlink:false});
const target={workspace:'/work',directory:'demo',folder:'/work/demo'};
const operation:FixtureOperation={target,isCurrent:()=>true};
function fake(){
  const children:FixtureEntry[]=[file('a.srp'),file('a.stdin')];
  const contents=new Map<string,Uint8Array>([['/work/demo/tests/a.stdin',new TextEncoder().encode('hello\r\n')]]);
  const listings=new Map<string,FixtureEntry[]>([['/work',[directory('demo')]],
    ['/work/demo',[file('scarp.project'),directory('tests')]],['/work/demo/tests',children]]);
  const close=vi.fn(async()=>{});
  const openRead=vi.fn(async(path:string)=>{
    const bytes=contents.get(path);if(!bytes)throw Error('missing');
    let offset=0;
    return {stat:async()=>({isFile:true,size:bytes.length,mtime:new Date(1)}),
      read:async(buffer:Uint8Array)=>{
        if(offset===bytes.length)return null;
        const size=Math.min(2,buffer.length,bytes.length-offset);
        buffer.set(bytes.subarray(offset,offset+size));offset+=size;return size;
      },close};
  });
  const openNew=vi.fn(async(path:string)=>{
    if(contents.has(path))throw Error('exists');
    contents.set(path,new Uint8Array());
    children.push(file(path.split('/').at(-1)!));
    return {write:async(buffer:Uint8Array)=>{
      const previous=contents.get(path)!;
      const count=Math.min(2,buffer.length),next=new Uint8Array(previous.length+count);
      next.set(previous);next.set(buffer.subarray(0,count),previous.length);contents.set(path,next);return count;
    },close};
  });
  const io:FixtureNative={join:async(...parts)=>parts.join('/'),readDir:async(path)=>{
    const entries=listings.get(path);if(!entries)throw Error('missing directory');return entries;
  },openRead,openNew};
  return {io,children,contents,listings,openRead,openNew,close};
}
function plan(){
  const inventory=buildFixtureInventory([file('a.srp')]);
  if(!inventory.ok)throw Error(inventory.error);
  const result=planFixtureCreation(inventory.value,{testName:'a.srp',stream:'stdout',text:'hello 🙂',lineEnding:'LF',finalNewline:true});
  if(!result.ok)throw Error(result.error);
  return result.value;
}
describe('native fixture review',()=>{
  it('scans metadata without opening source or fixture content',async()=>{
    const f=fake(),result=await scanTestFixtures(operation,f.io);
    expect(result.ok).toBe(true);expect(f.openRead).not.toHaveBeenCalled();expect(f.openNew).not.toHaveBeenCalled();
  });
  it('reads exact observed bytes with short reads and closes the handle',async()=>{
    const f=fake(),result=await inspectTestFixture(operation,'a.srp','stdin',f.io);
    expect(result.ok&&result.value).toMatchObject({bytes:7,crlf:1,finalEnding:'CRLF'});
    expect(f.openRead).toHaveBeenCalledExactlyOnceWith('/work/demo/tests/a.stdin');
    expect(f.close).toHaveBeenCalledTimes(1);
  });
  it('revalidates nested parent, manifest and tests directory before opening',async()=>{
    const f=fake();f.listings.set('/work',[{...directory('demo'),isSymlink:true}]);
    expect((await inspectTestFixture(operation,'a.srp','stdin',f.io)).ok).toBe(false);
    expect(f.openRead).not.toHaveBeenCalled();
    const g=fake();g.listings.set('/work/demo',[directory('tests')]);
    expect((await scanTestFixtures(operation,g.io)).ok).toBe(false);
  });
  it('rejects unobserved, case-colliding or unsafe fixture identities',async()=>{
    const f=fake();f.children.push(file('A.stdin'));
    expect((await inspectTestFixture(operation,'a.srp','stdin',f.io)).ok).toBe(false);
    expect((await inspectTestFixture(operation,'../a.srp','stdin',f.io)).ok).toBe(false);
    expect(f.openRead).not.toHaveBeenCalled();
  });
  it('closes handles on unexpected growth and stale operations',async()=>{
    const f=fake();f.io.openRead=async()=>({stat:async()=>({isFile:true,size:0}),
      read:async(buffer)=>{buffer[0]=65;return 1;},close:f.close});
    expect((await inspectTestFixture(operation,'a.srp','stdin',f.io)).ok).toBe(false);
    expect(f.close).toHaveBeenCalledTimes(1);
    expect((await scanTestFixtures({...operation,isCurrent:()=>false},f.io)).ok).toBe(false);
  });
});
describe('exclusive fixture creation',()=>{
  it('writes short chunks and verifies the exact reviewed bytes',async()=>{
    const f=fake(),review=plan();
    const result=await createTestFixture(operation,review,f.io);
    expect(result.status).toBe('created');
    expect(f.openNew).toHaveBeenCalledExactlyOnceWith('/work/demo/tests/a.stdout');
    expect(new TextDecoder().decode(f.contents.get('/work/demo/tests/a.stdout'))).toBe(review.content);
    expect(f.close).toHaveBeenCalledTimes(2);
  });
  it('never opens an existing destination or a forged preview',async()=>{
    const f=fake();f.children.push(file('a.stdout'));
    expect((await createTestFixture(operation,plan(),f.io)).status).toBe('blocked');
    expect(f.openNew).not.toHaveBeenCalled();
    const g=fake();
    expect((await createTestFixture(operation,{...plan(),content:'forged'},g.io)).status).toBe('blocked');
    expect(g.openNew).not.toHaveBeenCalled();
  });
  it('reports uncertainty on a partial write without cleanup or retries',async()=>{
    const f=fake();f.io.openNew=async()=>({write:async()=>0,close:f.close});
    const result=await createTestFixture(operation,plan(),f.io);
    expect(result.status).toBe('uncertain');
    expect(result.message).toContain('No cleanup or overwrite');
    expect(f.close).toHaveBeenCalledTimes(1);
  });
  it('detects a readback mismatch after creation',async()=>{
    const f=fake();f.io.openRead=async()=>({stat:async()=>({isFile:true,size:0}),read:async()=>null,close:f.close});
    expect((await createTestFixture(operation,plan(),f.io)).status).toBe('uncertain');
    expect(f.openNew).toHaveBeenCalledTimes(1);
  });
});
