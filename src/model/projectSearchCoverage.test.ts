import { describe,expect,it,vi } from 'vitest';
import { createUntitled } from './documents';
import { searchOpenFiles, MAX_SEARCH_RESULTS } from './openFileSearch';
import { searchListedProjectSources, MAX_PROJECT_SEARCH_FILES, MAX_PROJECT_SEARCH_READ_BYTES,
  MAX_PROJECT_SEARCH_TOTAL_BYTES, type ProjectSearchResult } from './projectSearch';
import { buildProjectScopeInventory,planScopedProjectSearch,summarizeScopedSearch,scopedSearchReport,
  DEFAULT_PROJECT_SEARCH_SCOPE, searchCoverageOrigin } from './projectSearchScope';

const options={caseSensitive:true,wholeWord:false};
const entry=(name:string)=>({name,path:'C:/work/'+name});
const doc=(name:string,content:string,revision=1)=>({
  ...createUntitled(revision),id:'id:'+name,name,path:'C:/work/'+name,content,savedContent:'',revision,
});
function review(entries:readonly ReturnType<typeof entry>[],result:ProjectSearchResult){
  const plan=planScopedProjectSearch(buildProjectScopeInventory(entries),DEFAULT_PROJECT_SEARCH_SCOPE);
  if(!plan.ok)throw Error(plan.error);
  const summary=summarizeScopedSearch(plan.value,result);
  if(!summary.ok)throw Error(summary.error);
  return summary.value;
}
describe('per-source search evidence',()=>{
  it('distinguishes fully scanned zero-match files from read failures',async()=>{
    const sources=['a.srp','b.srp','c.srp'].map(entry);
    const read=vi.fn(async(path:string,_limit:number)=>{
      if(path.endsWith('b.srp'))throw Error('private native failure C:/secret');
      return path.endsWith('a.srp')?'needle':'unrelated';
    });
    const result=await searchListedProjectSources(sources,[],'needle',options,read);
    expect(result?.fileEvidence).toEqual([
      {...sources[0],state:'scanned',origin:'disk'},
      {...sources[1],state:'read-failed',origin:'disk'},
      {...sources[2],state:'scanned',origin:'disk'},
    ]);
    const summary=review(sources,result!);
    expect(summary.fileCoverage).toEqual([
      {name:'a.srp',state:'scanned',origin:'disk',hits:1},
      {name:'b.srp',state:'read-failed',origin:'disk',hits:0},
      {name:'c.srp',state:'scanned',origin:'disk',hits:0},
    ]);
    const report=scopedSearchReport(summary);
    expect(report.split('\n')).toContain('Fully scanned sources: 2');
    expect(report).toContain('Read unavailable: 1');
    expect(report).not.toContain('C:/secret');
    expect(report).not.toContain('a.srp');
  });
  it('records open-buffer origin without reading a stale disk snapshot',async()=>{
    const sources=['a.srp','b.srp'].map(entry);
    const open=doc('a.srp','needle needle');
    const reader=vi.fn(async(_path:string,_limit:number)=>'needle');
    const result=await searchListedProjectSources(sources,[open],'needle',options,reader);
    expect(reader.mock.calls).toEqual([['C:/work/b.srp',expect.any(Number)]]);
    expect(review(sources,result!).fileCoverage).toEqual([
      {name:'a.srp',state:'scanned',origin:'open-buffer',hits:2},
      {name:'b.srp',state:'scanned',origin:'disk',hits:1},
    ]);
  });
  it('distinguishes omitted file count from scanned empty source text',async()=>{
    const sources=Array.from({length:MAX_PROJECT_SEARCH_FILES+2},(_,i)=>entry(i+'.srp'));
    const reader=vi.fn(async(_path:string,_limit:number)=>'');
    const result=await searchListedProjectSources(sources,[],'needle',options,reader);
    const summary=review(sources,result!);
    expect(summary.fileCoverage?.filter(row=>row.state==='scanned')).toHaveLength(MAX_PROJECT_SEARCH_FILES);
    expect(summary.fileCoverage?.filter(row=>row.state==='file-limit')).toHaveLength(2);
    expect(summary.fileCoverage?.filter(row=>row.state==='file-limit').every(row=>row.origin===null)).toBe(true);
    expect(summary.skipped).toBe(2);
    expect(summary.hits).toBe(0);
    expect(summary.incomplete).toBe(true);
    expect(reader).toHaveBeenCalledTimes(MAX_PROJECT_SEARCH_FILES);
  });
  it('discloses open buffers that exceed the bounded source read size',async()=>{
    const sources=['a.srp','b.srp'].map(entry);
    const open=doc('a.srp','é'.repeat(MAX_PROJECT_SEARCH_READ_BYTES));
    const reader=vi.fn(async(_path:string,_limit:number)=>'needle');
    const result=await searchListedProjectSources(sources,[open],'needle',options,reader);
    expect(review(sources,result!).fileCoverage).toEqual([
      {name:'a.srp',state:'byte-limit',origin:'open-buffer',hits:0},
      {name:'b.srp',state:'scanned',origin:'disk',hits:1},
    ]);
    expect(reader).toHaveBeenCalledTimes(1);
  });
  it('discloses every remaining candidate when total source bytes run out',async()=>{
    const count=MAX_PROJECT_SEARCH_TOTAL_BYTES/MAX_PROJECT_SEARCH_READ_BYTES;
    const sources=Array.from({length:count+2},(_,i)=>entry(i+'.srp'));
    const reader=vi.fn(async(_path:string,_limit:number)=>'x'.repeat(MAX_PROJECT_SEARCH_READ_BYTES));
    const result=await searchListedProjectSources(sources,[],'needle',options,reader);
    expect(reader).toHaveBeenCalledTimes(count);
    const summary=review(sources,result!);
    expect(summary.fileCoverage?.filter(row=>row.state==='scanned')).toHaveLength(count);
    expect(summary.fileCoverage?.filter(row=>row.state==='byte-limit')).toHaveLength(2);
    expect(summary.fileCoverage?.filter(row=>row.state==='byte-limit').every(row=>row.origin===null)).toBe(true);
  });
  it('distinguishes partial matching and unstarted in-memory scans from fully scanned files',async()=>{
    const sources=['a.srp','b.srp','c.srp'].map(entry);
    const contents=[doc('a.srp','needle'),doc('b.srp','needle '.repeat(MAX_SEARCH_RESULTS+5),2),doc('c.srp','needle',3)];
    const result=await searchListedProjectSources(sources,contents,'needle',options,async()=>{throw Error('must use open buffers');});
    const summary=review(sources,result!);
    expect(summary.hits).toBe(MAX_SEARCH_RESULTS);
    expect(summary.fileCoverage).toEqual([
      {name:'a.srp',state:'scanned',origin:'open-buffer',hits:1},
      {name:'b.srp',state:'content-limit',origin:'open-buffer',hits:MAX_SEARCH_RESULTS-1},
      {name:'c.srp',state:'content-limit',origin:'open-buffer',hits:0},
    ]);
    expect(summary.searched).toBe(1);
    expect(summary.skipped).toBe(2);
  });
  it('does not call the fully scanned observer for a partially scanned document',()=>{
    const docs=[doc('a.srp','needle'),doc('b.srp','needle '.repeat(MAX_SEARCH_RESULTS+5),2)];
    const observed:string[]=[];
    const result=searchOpenFiles(docs,'needle',options,id=>observed.push(id));
    expect(observed).toEqual(['id:a.srp']);
    expect(result.searchedDocuments).toBe(1);
    expect(result.truncated).toBe(true);
  });
  it('does not return a coverage report from a cancelled generation',async()=>{
    const sources=['a.srp','b.srp'].map(entry);
    let current=true;
    const result=await searchListedProjectSources(sources,[],'needle',options,async()=>{
      current=false;return 'needle';
    },()=>current);
    expect(result).toBeNull();
  });
});
describe('coverage provenance and export',()=>{
  async function fixture(){
    const entries=['src/a.srp','src/b.srp'].map(entry);
    const plan=planScopedProjectSearch(buildProjectScopeInventory(entries),DEFAULT_PROJECT_SEARCH_SCOPE);
    if(!plan.ok)throw Error(plan.error);
    const result=await searchListedProjectSources(entries,[],'needle',options,async()=> 'needle');
    return {plan:plan.value,result:result!,rows:result!.fileEvidence!};
  }
  it('rejects evidence with missing rows, duplicate identities or forged paths',async()=>{
    const {plan,result,rows}=await fixture();
    for(const fileEvidence of [
      rows.slice(0,1),
      [rows[0],rows[0]],
      [{...rows[0],path:'C:/outside/a.srp'},rows[1]],
      [{...rows[0],name:'other.srp'},rows[1]],
    ])expect(summarizeScopedSearch(plan,{...result,fileEvidence}).ok).toBe(false);
  });
  it('rejects claimed complete scans without a source origin',async()=>{
    const {plan,result,rows}=await fixture();
    expect(summarizeScopedSearch(plan,{...result,fileEvidence:[{...rows[0],origin:null},rows[1]]}).ok).toBe(false);
  });
  it('rejects inconsistent scanned totals and impossible hits in unread files',async()=>{
    const {plan,result,rows}=await fixture();
    const fileEvidence=[{...rows[0],state:'read-failed' as const},rows[1]];
    expect(summarizeScopedSearch(plan,{...result,fileEvidence}).ok).toBe(false);
    expect(summarizeScopedSearch(plan,{...result,fileEvidence,searchedFiles:1,skippedFiles:1,truncated:true}).ok).toBe(false);
  });
  it('rejects evidence that attributes hits to the wrong snapshot origin',async()=>{
    const {plan,result,rows}=await fixture();
    const fileEvidence=[{...rows[0],origin:'open-buffer' as const},rows[1]];
    expect(summarizeScopedSearch(plan,{...result,fileEvidence}).ok).toBe(false);
  });
  it('supports old reports without fabricating per-file coverage',async()=>{
    const {plan,result}=await fixture();
    const {fileEvidence:_,...legacy}=result;
    const summary=summarizeScopedSearch(plan,legacy);
    expect(summary.ok&&summary.value.fileCoverage).toBeUndefined();
  });
  it('uses file labels only when explicitly requested, including zero-match sources',async()=>{
    const sources=['src/private-match.srp','src/private-miss.srp'].map(entry);
    const result=await searchListedProjectSources(sources,[],'secret needle',options,async path=>
      path.endsWith('match.srp')?'secret needle':'other');
    const summary=review(sources,result!);
    expect(scopedSearchReport(summary)).not.toContain('private-');
    const report=scopedSearchReport(summary,{includeLabels:true,includeFilenameQuery:false});
    expect(report).toContain('"src/private-match.srp" — 1 displayed match(es), Fully scanned');
    expect(report).toContain('"src/private-miss.srp" — 0 displayed match(es), Fully scanned');
    expect(report).not.toContain('secret needle');
    expect(report).not.toContain('C:/work');
  });
});

describe('coverage origin wording',()=>{
  it('does not imply an unavailable disk file supplied a snapshot',()=>{
    const row={name:'a.srp',hits:0,origin:'disk' as const};
    expect(searchCoverageOrigin({...row,state:'read-failed'})).toBe('Disk read attempt');
    expect(searchCoverageOrigin({...row,state:'byte-limit'})).toBe('Disk read attempt');
    expect(searchCoverageOrigin({...row,state:'scanned'})).toBe('Disk snapshot');
    expect(searchCoverageOrigin({...row,state:'content-limit'})).toBe('Disk snapshot');
    expect(searchCoverageOrigin({...row,state:'file-limit',origin:null})).toBe('Not read');
    expect(searchCoverageOrigin({...row,state:'byte-limit',origin:'open-buffer'})).toBe('Open buffer');
  });
  it('does not count completed files twice in the report',async()=>{
    const entries=[entry('a.srp')];
    const result=await searchListedProjectSources(entries,[],'needle',options,async()=> 'needle');
    const report=scopedSearchReport(review(entries,result!));
    expect(report.split('\n').filter(line=>line.startsWith('Fully scanned'))).toEqual(['Fully scanned sources: 1']);
  });
});
