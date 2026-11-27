import { describe,expect,it } from 'vitest';
import { fixtureProjectTarget,buildFixtureInventory,fixtureName,fixtureSlot,planFixtureCreation,fixturePlanMatches,
  summarizeFixtureBytes,MAX_FIXTURE_BYTES,MAX_FIXTURE_CREATE_BYTES,MAX_FIXTURE_DIRECTORY_ENTRIES,
  type FixtureEntry,type FixtureResult } from './testFixtures';
const file=(name:string):FixtureEntry=>({name,isFile:true,isDirectory:false,isSymlink:false});
function value<T>(result:FixtureResult<T>):T{if(!result.ok)throw Error(result.error);return result.value;}
describe('project fixture inventory',()=>{
  it('uses observed manifest roots, not report labels or an arbitrary path',()=>{
    const selection={path:'/work',files:[],projectRoots:[{directory:'demo',path:'/work/demo'}]};
    expect(fixtureProjectTarget(selection,'/work/demo')).toEqual({workspace:'/work',folder:'/work/demo',directory:'demo'});
    expect(fixtureProjectTarget(selection,'/work/other')).toBeNull();
    expect(fixtureProjectTarget({...selection,projectRoots:[...selection.projectRoots,...selection.projectRoots]},'/work/demo')).toBeNull();
  });
  it('pairs exact streams and distinguishes absent, unsafe and case-ambiguous files',()=>{
    const inventory=value(buildFixtureInventory([file('a.srp'),file('a.stdin'),
      {...file('a.stdout'),isSymlink:true},file('A.stderr'),file('orphan.stdout'),file('B.SRP')]));
    expect(inventory.tests).toHaveLength(1);
    expect(inventory.tests[0].slots.map(slot=>slot.status)).toEqual(['regular','unsafe','ambiguous']);
    expect(inventory.unpaired).toEqual(['A.stderr','orphan.stdout']);
    expect(inventory.ignoredUppercaseTests).toBe(1);
  });
  it('rejects unsafe direct tests, nonportable names and excess entries',()=>{
    for(const name of ['../a.srp','a/b.srp','C:a.srp','a\\b.srp','.a.srp','con.srp','\ud800.srp','a\u202e.srp']){
      expect(fixtureName(name,'stdin')).toBeNull();
      expect(buildFixtureInventory([file(name)]).ok).toBe(false);
    }
    expect(buildFixtureInventory([{...file('a.srp'),isSymlink:true}]).ok).toBe(false);
    expect(buildFixtureInventory([file('a.srp'),file('A.SRP')]).ok).toBe(false);
    expect(buildFixtureInventory(Array.from({length:65},(_,i)=>file(i+'.srp'))).ok).toBe(false);
    expect(buildFixtureInventory(Array.from({length:MAX_FIXTURE_DIRECTORY_ENTRIES+1},(_,i)=>file(i+'.txt'))).ok).toBe(false);
  });
  it('handles Unicode stems and multiple dots without inferring nested paths',()=>{
    expect(fixtureName('हिंदी.v2.srp','stderr')).toBe('हिंदी.v2.stderr');
    expect(fixtureSlot(value(buildFixtureInventory([file('हिंदी.v2.srp')])),'हिंदी.v2.srp','stderr')?.status).toBe('absent');
  });
});
describe('exact fixture byte review',()=>{
  it('distinguishes BOM, CRLF, LF, CR, NUL and final newline',()=>{
    const bytes=new TextEncoder().encode('\ufeffa\r\nb\nc\rd\0🙂\r\n');
    const result=value(summarizeFixtureBytes(bytes));
    expect(result).toMatchObject({bytes:bytes.length,utf8Valid:true,bom:true,crlf:2,lf:1,cr:1,nul:1,finalEnding:'CRLF'});
    expect(result.textPreview).toContain('\\r\\n');
    expect(result.hexPreview).toContain('ef bb bf');
  });
  it('retains hex evidence for invalid UTF-8 without pretending it is decoded text',()=>{
    const result=value(summarizeFixtureBytes(new Uint8Array([255,0,13])));
    expect(result).toMatchObject({utf8Valid:false,textPreview:null,hexPreview:'ff 00 0d',nul:1,finalEnding:'CR'});
  });
  it('bounds previews without cutting surrogate pairs and rejects oversized bytes',()=>{
    const result=value(summarizeFixtureBytes(new TextEncoder().encode('x'.repeat(4095)+'🙂more')));
    expect(result.textTruncated).toBe(true);
    expect(result.textPreview).toContain('🙂');
    expect(result.hexTruncated).toBe(true);
    expect(result.hexPreview.split(' ')).toHaveLength(256);
    expect(summarizeFixtureBytes(new Uint8Array(MAX_FIXTURE_BYTES+1)).ok).toBe(false);
  });
});
describe('fixture creation plan',()=>{
  const inventory=value(buildFixtureInventory([file('a.srp'),file('a.stderr')]));
  const request={testName:'a.srp',stream:'stdout' as const,text:'one  \r\ntwo\rthree\n',lineEnding:'CRLF' as const,finalNewline:false};
  it('normalizes only line endings with explicit user choices',()=>{
    const plan=value(planFixtureCreation(inventory,request));
    expect(plan.content).toBe('one  \r\ntwo\r\nthree\r\n');
    expect(plan.summary.crlf).toBe(3);
    expect(fixturePlanMatches(plan,inventory)).toBe(true);
    expect(fixturePlanMatches({...plan,content:'forged'},inventory)).toBe(false);
  });
  it('distinguishes empty output from appending an explicit newline',()=>{
    expect(value(planFixtureCreation(inventory,{...request,text:''})).summary.bytes).toBe(0);
    expect(value(planFixtureCreation(inventory,{...request,text:'',finalNewline:true})).content).toBe('\r\n');
  });
  it('rejects existing slots and malformed or oversized Unicode drafts',()=>{
    expect(planFixtureCreation(inventory,{...request,stream:'stderr'}).ok).toBe(false);
    expect(planFixtureCreation(inventory,{...request,text:'\ud800'}).ok).toBe(false);
    expect(planFixtureCreation(inventory,{...request,text:'🙂'.repeat(MAX_FIXTURE_CREATE_BYTES/4+1)}).ok).toBe(false);
  });
});
