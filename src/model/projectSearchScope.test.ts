import { describe,expect,it,vi } from 'vitest';
import { buildProjectScopeInventory,planScopedProjectSearch,scopeLabel,sameProjectScope,
  summarizeScopedSearch,scopedSearchReport,DEFAULT_PROJECT_SEARCH_SCOPE,MAX_SCOPE_REPORT_UNITS,
  type ProjectSearchScope } from './projectSearchScope';
import { searchListedProjectSources, MAX_PROJECT_SEARCH_FILES, type ProjectSearchResult } from './projectSearch';
import { createUntitled } from './documents';
const file=(name:string,path='C:/practice/'+name)=>({name,path});
const listed=[
  file('root.srp'),file('src/main.srp'),file('src/Math.srp'),file('src/nested/math.srp'),
  file('src-other/math.srp'),file('tests/math-test.srp'),file('examples/hello.srp'),
  file('practice/one/src/main.srp'),file('practice/two/src/main.srp'),
];
const inventory=buildProjectScopeInventory(listed);
function plan(scope:Partial<ProjectSearchScope>={}){
  const result=planScopedProjectSearch(inventory,{...DEFAULT_PROJECT_SEARCH_SCOPE,...scope});
  if(!result.ok)throw Error(result.error);
  return result.value;
}
function names(scope:Partial<ProjectSearchScope>={}){return plan(scope).sources.map(source=>source.name);}
describe('observed project scope inventory',()=>{
  it('retains original native paths and derives only observed ancestor directory labels',()=>{
    expect(inventory.sources).toEqual(listed);
    expect(inventory.directories.map(dir=>dir.name)).toEqual(['','examples','practice','practice/one','practice/one/src','practice/two','practice/two/src','src','src/nested','src-other','tests']);
    expect(inventory.directories.find(dir=>dir.name==='')).toEqual({name:'',direct:1,descendants:9});
    expect(inventory.directories.find(dir=>dir.name==='src')).toEqual({name:'src',direct:2,descendants:3});
    expect(inventory.directories.find(dir=>dir.name==='practice')).toEqual({name:'practice',direct:0,descendants:2});
    expect(Object.isFrozen(inventory.sources)).toBe(true);
    expect(Object.isFrozen(inventory.sources[0])).toBe(true);
  });
  it('refuses both duplicate path and duplicate label identities',()=>{
    const result=buildProjectScopeInventory([
      file('a.srp'),file('b.srp','c:\\PRACTICE\\a.srp'),
      file('dup.srp','C:/practice/x.srp'),file('dup.srp','C:/practice/y.srp'),
      file('valid.srp'),
    ]);
    expect(result.ambiguous).toBe(4);
    expect(result.sources.map(source=>source.name)).toEqual(['valid.srp']);
    expect(result.invalid).toBe(0);
  });
  it('withholds unsafe labels, unsupported source types and over-budget entries',()=>{
    const result=buildProjectScopeInventory([
      file('../outside.srp'),file('.git/hidden.srp'),file('target/output.srp'),file('src\\hidden.srp'),
      file('readme.txt'),file('main.srp','C:/practice/main.txt'),file('a.srp'),
      ...Array.from({length:200},(_,i)=>file('bulk/'+i+'.srp')),
    ]);
    expect(result.invalid).toBe(6);
    expect(result.uninspected).toBe(7);
    expect(result.sources.length+result.invalid+result.ambiguous+result.uninspected).toBe(result.listed);
    expect(result.directories.some(dir=>dir.name==='.git')).toBe(false);
  });
  it('keeps distinct POSIX path spelling and source label case',()=>{
    const result=buildProjectScopeInventory([file('X.srp','/project/X.srp'),file('x.srp','/project/x.srp')]);
    expect(result.sources).toHaveLength(2);
  });
});
describe('literal directory and basename search scopes',()=>{
  it('defaults to all eligible listed sources and supports root-only search',()=>{
    expect(names()).toEqual(listed.map(source=>source.name));
    expect(names({descendants:false})).toEqual(['root.srp']);
  });
  it('includes descendants only when requested and never matches sibling prefixes',()=>{
    expect(names({directory:'src'})).toEqual(['src/main.srp','src/Math.srp','src/nested/math.srp']);
    expect(names({directory:'src',descendants:false})).toEqual(['src/main.srp','src/Math.srp']);
    expect(names({directory:'practice'})).toEqual(['practice/one/src/main.srp','practice/two/src/main.srp']);
    expect(names({directory:'practice',descendants:false})).toEqual([]);
  });
  it('combines directory membership with literal case-insensitive basename matching',()=>{
    expect(names({directory:'src',filename:'MATH'})).toEqual(['src/Math.srp','src/nested/math.srp']);
    expect(names({filename:'practice'})).toEqual([]);
    expect(names({filename:'*.srp'})).toEqual([]);
    expect(names({filename:'.srp'})).toHaveLength(9);
    expect(names({filename:'math-test'})).toEqual(['tests/math-test.srp']);
  });
  it('rejects unobserved directory choices instead of silently broadening scope',()=>{
    for(const directory of ['unknown','..','src/../tests','src/','SRC','C:/practice','src\\nested']){
      expect(planScopedProjectSearch(inventory,{...DEFAULT_PROJECT_SEARCH_SCOPE,directory}).ok).toBe(false);
    }
  });
  it('rejects malformed, excessive and path-like filename terms',()=>{
    for(const filename of ['../math','src/math','src\\math','x\n','\u202e','\ud800','x'.repeat(121)]){
      expect(planScopedProjectSearch(inventory,{...DEFAULT_PROJECT_SEARCH_SCOPE,filename}).ok).toBe(false);
    }
  });
  it('provides explicit scope labels and exact option equality',()=>{
    expect(scopeLabel(DEFAULT_PROJECT_SEARCH_SCOPE)).toBe('Workspace root and descendants');
    expect(scopeLabel({...DEFAULT_PROJECT_SEARCH_SCOPE,directory:'src',descendants:false})).toBe('src only');
    expect(sameProjectScope(DEFAULT_PROJECT_SEARCH_SCOPE,{...DEFAULT_PROJECT_SEARCH_SCOPE})).toBe(true);
    expect(sameProjectScope(DEFAULT_PROJECT_SEARCH_SCOPE,{...DEFAULT_PROJECT_SEARCH_SCOPE,filename:'a'})).toBe(false);
  });
});
describe('actual scoped search and coverage reporting',()=>{
  it('reads only original in-scope paths and gives unsaved open content precedence',async()=>{
    const selected=plan({directory:'src',filename:'math'});
    const open={...createUntitled(1),id:'math',name:'Math.srp',path:'C:/practice/src/Math.srp',content:'needle needle',savedContent:'old',revision:4};
    const reader=vi.fn(async()=> 'needle');
    const result=await searchListedProjectSources(selected.sources,[open],'needle',{caseSensitive:true,wholeWord:true},reader);
    expect(reader.mock.calls).toEqual([['C:/practice/src/nested/math.srp',expect.any(Number)]]);
    const summary=summarizeScopedSearch(selected,result!);
    if(!summary.ok)throw Error(summary.error);
    expect(summary.value).toMatchObject({listed:9,inScope:2,excluded:7,withheld:0,searched:2,skipped:0,hits:3,matchingFiles:2,incomplete:false});
    expect(summary.value.rows).toEqual([
      {name:'src/Math.srp',hits:2,openBuffer:true},{name:'src/nested/math.srp',hits:1,openBuffer:false},
    ]);
  });
  it('preserves partial coverage when a file is unreadable',async()=>{
    const selected=plan({directory:'src'});
    const result=await searchListedProjectSources(selected.sources,[],'needle',{caseSensitive:false,wholeWord:false},async path=>{
      if(path.endsWith('main.srp'))throw Error('denied');
      return 'unrelated';
    });
    const summary=summarizeScopedSearch(selected,result!);
    expect(summary.ok&&summary.value).toMatchObject({searched:2,skipped:1,hits:0,incomplete:true});
  });
  it('distinguishes excluded files from files omitted by search limits',async()=>{
    const entries=Array.from({length:MAX_PROJECT_SEARCH_FILES+3},(_,i)=>file('src/'+i+'.srp'));
    entries.push(file('tests/skip.srp'));
    const scoped=planScopedProjectSearch(buildProjectScopeInventory(entries),{directory:'src',descendants:true,filename:''});
    if(!scoped.ok)throw Error(scoped.error);
    const result=await searchListedProjectSources(scoped.value.sources,[],'needle',{caseSensitive:false,wholeWord:false},async()=> 'none');
    expect(summarizeScopedSearch(scoped.value,result!)).toMatchObject({ok:true,value:{
      excluded:1,inScope:27,searched:24,skipped:3,incomplete:true,
    }});
  });
  it('does not claim complete coverage when inventory entries were withheld',()=>{
    const scoped=planScopedProjectSearch(buildProjectScopeInventory([file('a.srp'),file('../bad.srp')]),DEFAULT_PROJECT_SEARCH_SCOPE);
    if(!scoped.ok)throw Error(scoped.error);
    const result:ProjectSearchResult={hits:[],searchedFiles:1,skippedFiles:0,totalListedFiles:1,truncated:false,error:null};
    expect(summarizeScopedSearch(scoped.value,result)).toMatchObject({ok:true,value:{withheld:1,incomplete:true}});
  });
  it('rejects mismatched inventory counts and out-of-scope hits',async()=>{
    const scoped=plan({directory:'src',descendants:false});
    const result=await searchListedProjectSources(scoped.sources,[],'needle',{caseSensitive:true,wholeWord:false},async()=> 'needle');
    expect(summarizeScopedSearch(scoped,{...result!,totalListedFiles:99}).ok).toBe(false);
    expect(summarizeScopedSearch(scoped,{...result!,searchedFiles:99}).ok).toBe(false);
    expect(summarizeScopedSearch(scoped,{...result!,error:'bad'}).ok).toBe(false);
    const forged={...result!,hits:[{...result!.hits[0],path:'C:/outside/main.srp'}]};
    expect(summarizeScopedSearch(scoped,forged).ok).toBe(false);
  });
  it('exports counts only unless the user includes specific label fields',async()=>{
    const selected=plan({directory:'src',filename:'math'});
    const result=await searchListedProjectSources(selected.sources,[],'secret-match',{caseSensitive:true,wholeWord:false},async()=> 'secret-match');
    const summary=summarizeScopedSearch(selected,result!);
    if(!summary.ok)throw Error(summary.error);
    const safe=scopedSearchReport(summary.value);
    expect(safe).toContain('Displayed matches: 2');
    for(const value of ['src/Math.srp','C:/practice','secret-match','math'])expect(safe).not.toContain(value);
    const labeled=scopedSearchReport(summary.value,{includeLabels:true,includeFilenameQuery:false});
    expect(labeled).toContain('src/Math.srp');
    expect(labeled).not.toContain('Filename substring');
    const filter=scopedSearchReport(summary.value,{includeLabels:false,includeFilenameQuery:true});
    expect(filter).toContain('Filename substring: "math"');
    expect(filter).not.toContain('src/Math.srp');
    expect(labeled).not.toContain('C:/practice');
    expect(labeled).not.toContain('secret-match');
  });
  it('bounds optional report labels and discloses omitted rows',()=>{
    const summary={scope:DEFAULT_PROJECT_SEARCH_SCOPE,listed:200,inScope:200,excluded:0,withheld:0,searched:24,skipped:176,
      hits:200,matchingFiles:200,incomplete:true,rows:Array.from({length:200},(_,i)=>({name:i+'x'.repeat(1000)+'.srp',hits:1,openBuffer:false}))};
    const report=scopedSearchReport(summary,{includeLabels:true,includeFilenameQuery:true});
    expect(report.length).toBeLessThanOrEqual(MAX_SCOPE_REPORT_UNITS);
    expect(report).toContain('Additional file rows omitted');
  });
});
