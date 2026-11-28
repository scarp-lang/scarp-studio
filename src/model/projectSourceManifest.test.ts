import {describe,expect,it,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {createUntitled} from './documents';
import {DEFAULT_PROJECT_SEARCH_SCOPE} from './projectSearchScope';
import {prepareProjectInspection,INSPECTION_READ_LIMITS,type InspectionSettings,type InspectionControl} from './projectInspection';
import {executeSourceManifest,sourceTextMetrics,groupManifestDuplicates,filterManifestFiles,pageManifest,
  summarizeManifest,manifestReportText,DEFAULT_MANIFEST_FILTER,validSourceDigest,type SourceDigest,type ProjectSourceManifest} from './projectSourceManifest';
import {captureManifestBaseline,compareManifestBaselines,exportManifestBaseline,parseManifestBackup,
  filterManifestComparison,manifestComparisonReport,DEFAULT_MANIFEST_COMPARISON_FILTER,
  MAX_MANIFEST_BACKUP_UNITS,type SourceManifestBaseline} from './sourceManifestComparison';
const digest:SourceDigest=async text=>createHash('sha256').update(text,'utf8').digest('hex');
const settings:InspectionSettings={scope:DEFAULT_PROJECT_SEARCH_SCOPE,mode:'working',listingLimited:false};
const control:InspectionControl={isCurrent:()=>true,isCancelled:()=>false};
const entries=['src/a.srp','src/b.srp','src/c.srp'].map(name=>({name,path:'C:/private-root/'+name}));
function plan(listed=entries,config=settings){
  const result=prepareProjectInspection(listed,config);
  if(!result.ok)throw Error(result.error);
  return result.value;
}
async function scan(texts:string[],config=settings,documents=[] as ReturnType<typeof createUntitled>[],
  hash=digest):Promise<ProjectSourceManifest>{
  const result=await executeSourceManifest(plan(entries.slice(0,texts.length),config),documents,
    async path=>texts[entries.findIndex(entry=>entry.path===path)],control,hash);
  if(result.kind!=='report')throw Error('No manifest');
  return result.report;
}
function baseline(report:ProjectSourceManifest):SourceManifestBaseline{
  const result=captureManifestBaseline(report);
  if(!result.ok)throw Error(result.error);
  return result.value;
}
function backup(b:SourceManifestBaseline):string{
  const result=exportManifestBaseline(b);
  if(!result.ok)throw Error(result.error);
  return result.value;
}
describe('exact source snapshot metrics',()=>{
  it('counts empty and final blank editor lines',()=>{
    expect(sourceTextMetrics('')).toEqual({units:0,lines:1,blankLines:1,lf:0,crlf:0,cr:0,finalNewline:false,eol:'none'});
    expect(sourceTextMetrics('x\n')).toMatchObject({units:2,lines:2,blankLines:1,lf:1,finalNewline:true,eol:'lf'});
    expect(sourceTextMetrics(' \t\r\n\n\r😀')).toMatchObject({units:8,lines:4,blankLines:3,lf:1,crlf:1,cr:1,finalNewline:false,eol:'mixed'});
  });
  it('preserves distinction between physical line and UTF-16 metrics',()=>{
    expect(sourceTextMetrics('😀\r\n')).toMatchObject({units:4,lines:2,blankLines:1,crlf:1,eol:'crlf'});
    expect(sourceTextMetrics('\t')).toMatchObject({units:1,lines:1,blankLines:1,eol:'none'});
    expect(sourceTextMetrics('\u00a0')).toMatchObject({blankLines:0});
  });
  it('only accepts canonical lowercase SHA-256 strings',()=>{
    expect(validSourceDigest('a'.repeat(64))).toBe(true);
    for(const value of ['A'.repeat(64),'g'.repeat(64),'a'.repeat(63),'a'.repeat(65),null,42])expect(validSourceDigest(value)).toBe(false);
  });
});
describe('bounded manifest execution',()=>{
  it('keeps empty digest distinct from unavailable and hashes UTF-8 exactly',async()=>{
    const report=await scan(['','abc','😀\r\n']);
    expect(report.complete).toBe(true);
    expect(report.files[0]).toMatchObject({state:'hashed',bytes:0,digest:'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'});
    expect(report.files[1].digest).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(report.files[2]).toMatchObject({bytes:6,metrics:{units:4,crlf:1}});
    expect(report.bytes).toBe(9);
    expect(JSON.stringify(report)).not.toContain('private-root');
    expect(JSON.stringify(report)).not.toContain('😀');
  });
  it('prefers working buffers but saved mode reads disk even with dirty tabs',async()=>{
    const doc={...createUntitled(1),name:entries[0].name,path:entries[0].path,content:'dirty private text',savedContent:'saved'};
    const reader=vi.fn(async()=> 'disk private text');
    const first=await executeSourceManifest(plan(),[doc],reader,control,digest);
    if(first.kind!=='report')throw Error('No result');
    expect(reader).toHaveBeenCalledTimes(2);
    expect(first.report.files[0]).toMatchObject({origin:'open-buffer',dirty:true,digest:await digest(doc.content)});
    const second=await executeSourceManifest(plan(entries,{...settings,mode:'saved'}),[doc],reader,control,digest);
    if(second.kind!=='report')throw Error('No result');
    expect(reader).toHaveBeenCalledTimes(5);
    expect(second.report.files[0]).toMatchObject({origin:'disk',dirty:true,digest:await digest('disk private text')});
    expect(JSON.stringify(first.report)).not.toContain('dirty private text');
  });
  it('does not read ambiguous buffers',async()=>{
    const docs=[1,2].map(id=>({...createUntitled(id),path:entries[0].path,content:'x'}));
    const reader=vi.fn(async()=> '');
    const result=await executeSourceManifest(plan(entries.slice(0,1)),docs,reader,control,digest);
    if(result.kind!=='report')throw Error('No result');
    expect(reader).not.toHaveBeenCalled();
    expect(result.report.files[0]).toMatchObject({state:'ambiguous-buffer',digest:null,metrics:null,bytes:null});
    expect(result.report.complete).toBe(false);
  });
  it('distinguishes read failures, digest failures and independent byte limits',async()=>{
    const result=await executeSourceManifest(plan(),[],async path=>{
      if(path===entries[0].path)throw Error('private native failure');
      if(path===entries[1].path)return 'a'.repeat(INSPECTION_READ_LIMITS.fileBytes+1);
      return 'available';
    },control,async()=>{throw Error('crypto failure');});
    if(result.kind!=='report')throw Error('No result');
    expect(result.report.files.map(file=>file.state)).toEqual(['read-failed','byte-limit','hash-failed']);
    expect(result.report.files[2]).toMatchObject({bytes:9,metrics:{units:9},digest:null});
    expect(result.report.complete).toBe(false);
    expect(summarizeManifest(result.report)).toMatchObject({hashed:0,unread:2,hashFailed:1,observedBytes:9});
    expect(JSON.stringify(result.report)).not.toMatch(/private native failure|crypto failure|available"/);
  });
  it('marks remaining sources not observed after cancellation during hashing',async()=>{
    let cancelled=false;
    const reader=vi.fn(async()=> 'x');
    const result=await executeSourceManifest(plan(),[],reader,{...control,isCancelled:()=>cancelled},
      async text=>{cancelled=true;return digest(text);});
    if(result.kind!=='report')throw Error('No result');
    expect(result.report.status).toBe('cancelled');
    expect(reader).toHaveBeenCalledTimes(1);
    expect(result.report.files.every(file=>file.state==='not-observed'&&file.digest===null)).toBe(true);
    expect(result.report.complete).toBe(false);
  });
  it('discards all observations after workspace invalidation',async()=>{
    let current=true;
    const result=await executeSourceManifest(plan(),[],async()=> 'x',{...control,isCurrent:()=>current},
      async text=>{current=false;return digest(text);});
    expect(result).toEqual({kind:'invalidated'});
  });
  it('groups exact digest and byte counts but not distinct newline snapshots',async()=>{
    const report=await scan(['secret\n','secret\n','secret\r\n']);
    expect(groupManifestDuplicates(report)).toEqual([expect.objectContaining({bytes:7,files:[report.files[0],report.files[1]]})]);
    expect(filterManifestFiles(report,{...DEFAULT_MANIFEST_FILTER,duplicateOnly:true})).toHaveLength(2);
    expect(filterManifestFiles(report,{...DEFAULT_MANIFEST_FILTER,eol:'crlf'})).toEqual([report.files[2]]);
    expect(filterManifestFiles(report,{...DEFAULT_MANIFEST_FILTER,order:'bytes'})[0]).toEqual(report.files[2]);
    expect(filterManifestFiles(report,{...DEFAULT_MANIFEST_FILTER,query:'\u0000'})).toEqual([]);
    expect(pageManifest(report.files,99).page).toBe(1);
    const privateReport=manifestReportText(report);
    expect(privateReport).not.toContain('src/a.srp');
    expect(privateReport).not.toContain(report.files[0].digest!);
    const labels=manifestReportText(report,{labels:true,digests:false});
    expect(labels).toContain('src/a.srp');
    expect(labels).not.toContain(report.files[0].digest!);
    const hashes=manifestReportText(report,{labels:false,digests:true});
    expect(hashes).not.toContain('src/a.srp');
    expect(hashes).toContain(report.files[0].digest!);
    expect(hashes).not.toContain('secret');
  });
});
describe('portable manifest evidence',()=>{
  it('round-trips a complete baseline without source contents or native paths',async()=>{
    const b=baseline(await scan(['private text','😀','']));
    const raw=backup(b);
    expect(raw).not.toContain('private text');
    expect(raw).not.toContain('private-root');
    expect(parseManifestBackup(raw)).toEqual({ok:true,value:b});
  });
  it('rejects unknown authority fields, malformed labels, hashes and metrics',async()=>{
    const b=baseline(await scan(['abc','x','']));
    const raw=backup(b);
    const mutations:((value:any)=>void)[]=[
      v=>{v.baseline.root='C:/private-root';},
      v=>{v.version=2;},
      v=>{v.baseline.files[0].name='../escape.srp';},
      v=>{v.baseline.files[0].digest='A'.repeat(64);},
      v=>{v.baseline.files[0].metrics.lines=99;},
      v=>{v.baseline.files[0].bytes=-1;},
      v=>{v.baseline.files[1].name=v.baseline.files[0].name;},
      v=>{v.baseline.files[0].sourceText='abc';},
      v=>{v.baseline.files[0].state='read-failed';},
      v=>{v.baseline.scope.filename='a/b';},
    ];
    for(const mutate of mutations){const value=JSON.parse(raw);mutate(value);expect(parseManifestBackup(JSON.stringify(value)).ok).toBe(false);}
    expect(parseManifestBackup(' '.repeat(MAX_MANIFEST_BACKUP_UNITS+1)).ok).toBe(false);
    expect(parseManifestBackup('not json').ok).toBe(false);
  });
  it('recognizes same digest with reordered metric JSON properties',async()=>{
    const b=baseline(await scan(['abc']));
    const raw=JSON.parse(backup(b));
    raw.baseline.files[0].metrics=Object.fromEntries(Object.entries(raw.baseline.files[0].metrics).reverse());
    const parsed=parseManifestBackup(JSON.stringify(raw));
    if(!parsed.ok)throw Error(parsed.error);
    const compared=compareManifestBaselines(b,parsed.value);
    if(!compared.ok)throw Error(compared.error);
    expect(compared.value.counts['same-digest']).toBe(1);
  });
  it('compares changes and reports only same-origin comparable deltas',async()=>{
    const earlier=baseline(await scan(['one\n','same','old']));
    const doc={...createUntitled(1),path:entries[2].path,content:'working',savedContent:'old'};
    const current=baseline(await scan(['one\ntwo\n','same','old'],settings,[doc]));
    const result=compareManifestBaselines(earlier,current);
    if(!result.ok)throw Error(result.error);
    expect(result.value.counts).toMatchObject({'changed-digest':1,'same-digest':1,'origin-changed':1});
    expect(result.value).toMatchObject({comparable:2,byteDelta:4,lineDelta:1});
    expect(filterManifestComparison(result.value,{...DEFAULT_MANIFEST_COMPARISON_FILTER,changedOnly:true})).toHaveLength(2);
    expect(manifestComparisonReport(result.value)).not.toContain('src/a.srp');
    expect(manifestComparisonReport(result.value,true,false)).toContain('src/a.srp');
    expect(manifestComparisonReport(result.value,false,true)).toContain(earlier.files[0].digest!);
  });
  it('rejects differing reviewed scopes and snapshot modes',async()=>{
    const a=baseline(await scan(['x']));
    expect(compareManifestBaselines(a,{...a,mode:'saved'}).ok).toBe(false);
    expect(compareManifestBaselines(a,{...a,scope:{...a.scope,filename:'a'}}).ok).toBe(false);
  });
  it('distinguishes incomplete evidence and labels selected in one baseline only',async()=>{
    const a=baseline(await scan(['x','y','z']));
    const unavailable=baseline(await scan(['x','y'],settings,[],async()=> 'bad'));
    const result=compareManifestBaselines(a,unavailable);
    if(!result.ok)throw Error(result.error);
    expect(result.value.counts).toMatchObject({incomplete:2,'earlier-only':1});
    expect(result.value.comparable).toBe(0);
  });
  it('does not claim equivalence when supplied digest evidence contradicts metrics',async()=>{
    const a=baseline(await scan(['abc']));
    const b=baseline(await scan(['abcd'],settings,[],async()=>a.files[0].digest!));
    const result=compareManifestBaselines(a,b);
    if(!result.ok)throw Error(result.error);
    expect(result.value.counts.inconsistent).toBe(1);
    expect(result.value.comparable).toBe(0);
  });
});
