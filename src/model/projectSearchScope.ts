import { isScarpPath, sameFilePath } from './documents';
import { MAX_DISPLAYED_SCARP_FILES, safeRelativeScarpDirectory, safeRelativeScarpSourceName } from './folderListing';
import { MAX_PROJECT_SEARCH_FILES, PROJECT_SEARCH_FILE_STATES, type ProjectSearchFileEvidence, type ProjectSearchFileState, type ProjectSearchSource, type ProjectSearchResult } from './projectSearch';
import { assertWellFormedUtf16 } from './utf8Text';

export const MAX_SCOPE_NAME_QUERY=120;
export const MAX_SCOPE_REPORT_UNITS=24*1024;
export const MAX_SCOPE_PREVIEW_FILES=200;
export interface ProjectSearchScope {
  readonly directory:string;
  readonly descendants:boolean;
  readonly filename:string;
}
export const DEFAULT_PROJECT_SEARCH_SCOPE:ProjectSearchScope=Object.freeze({directory:'',descendants:true,filename:''});
export interface ProjectScopeDirectory{
  readonly name:string;
  readonly direct:number;
  readonly descendants:number;
}
export interface ProjectScopeInventory{
  readonly sources:readonly ProjectSearchSource[];
  readonly directories:readonly ProjectScopeDirectory[];
  readonly invalid:number;
  readonly ambiguous:number;
  readonly uninspected:number;
  readonly listed:number;
}
export interface ScopedProjectSearchPlan{
  readonly scope:ProjectSearchScope;
  readonly sources:readonly ProjectSearchSource[];
  readonly listed:number;
  readonly eligible:number;
  readonly excluded:number;
  readonly invalid:number;
  readonly ambiguous:number;
  readonly uninspected:number;
}
export type ScopeResult<T>={readonly ok:true;readonly value:T}|{readonly ok:false;readonly error:string};
const fail=(error:string):ScopeResult<never>=>({ok:false,error});
function parent(name:string){return name.slice(0,Math.max(0,name.lastIndexOf('/')));}
function basename(name:string){return name.slice(name.lastIndexOf('/')+1);}
function isWithin(name:string,directory:string,descendants:boolean){
  const p=parent(name);
  return p===directory||descendants&&(directory===''||p.startsWith(directory+'/'));
}
/** Inventory only existing Explorer source entries, never enumerate, join
 * native paths or treat typed directory names as permission to read. Reject
 * both members of an ambiguous name or path rather than pick the first. */
export function buildProjectScopeInventory(listed:readonly ProjectSearchSource[]):ProjectScopeInventory{
  const scanned=listed.slice(0,MAX_DISPLAYED_SCARP_FILES);
  const sources:ProjectSearchSource[]=[];
  let invalid=0,ambiguous=0;
  for(let i=0;i<scanned.length;i++){
    const source=scanned[i];
    if(!safeRelativeScarpSourceName(source.name)||!isScarpPath(source.path)){
      invalid++;continue;
    }
    if(scanned.some((other,j)=>j!==i&&(other.name===source.name||sameFilePath(other.path,source.path)))){
      ambiguous++;continue;
    }
    sources.push(Object.freeze({...source}));
  }
  const names=new Set<string>(['']);
  for(const source of sources){
    const segments=parent(source.name).split('/').filter(Boolean);
    for(let i=1;i<=segments.length;i++){
      const name=segments.slice(0,i).join('/');
      if(safeRelativeScarpDirectory(name))names.add(name);
    }
  }
  const directories=[...names].sort((a,b)=>a.localeCompare(b,'en',{numeric:true})).map(name=>Object.freeze({
    name,direct:sources.filter(source=>isWithin(source.name,name,false)).length,
    descendants:sources.filter(source=>isWithin(source.name,name,true)).length,
  }));
  return Object.freeze({
    sources:Object.freeze(sources),directories:Object.freeze(directories),
    invalid,ambiguous,uninspected:Math.max(0,listed.length-scanned.length),listed:listed.length,
  });
}
function validFilenameQuery(query:string):boolean{
  if(typeof query!=='string'||query.length>MAX_SCOPE_NAME_QUERY||
    /[/\\\x00-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/.test(query))return false;
  try{assertWellFormedUtf16(query,'Filename query');return true;}catch{return false;}
}
/** Directory choices must be observed, and filename filtering is literal,
 * case-insensitive basename matching (not a glob, regex or native path).
 * Scope changes do not change content search options. */
export function planScopedProjectSearch(inventory:ProjectScopeInventory,scope:ProjectSearchScope):ScopeResult<ScopedProjectSearchPlan>{
  if(typeof scope.descendants!=='boolean'||!inventory.directories.some(dir=>dir.name===scope.directory))
    return fail('Choose a directory from the current Explorer listing.');
  if(!validFilenameQuery(scope.filename))return fail('Enter a filename substring of at most 120 characters, without path separators or controls.');
  const query=scope.filename.toLowerCase();
  const sources=inventory.sources.filter(source=>isWithin(source.name,scope.directory,scope.descendants)&&
    basename(source.name).toLowerCase().includes(query));
  return {ok:true,value:Object.freeze({
    scope:Object.freeze({...scope}),sources:Object.freeze(sources),listed:inventory.listed,
    eligible:inventory.sources.length,excluded:inventory.sources.length-sources.length,
    invalid:inventory.invalid,ambiguous:inventory.ambiguous,uninspected:inventory.uninspected,
  })};
}
export function sameProjectScope(a:ProjectSearchScope,b:ProjectSearchScope):boolean{
  return a.directory===b.directory&&a.descendants===b.descendants&&a.filename===b.filename;
}
export function scopeLabel(scope:ProjectSearchScope):string{
  return (scope.directory||'Workspace root')+(scope.descendants?' and descendants':' only');
}
export interface ScopedSearchFileRow{
  readonly name:string;
  readonly hits:number;
  readonly openBuffer:boolean;
}
export interface ScopedFileCoverageRow{
  readonly name:string;
  readonly state:ProjectSearchFileState;
  readonly origin:ProjectSearchFileEvidence['origin'];
  readonly hits:number;
}
export const SEARCH_COVERAGE_LABELS:Readonly<Record<ProjectSearchFileState,string>>=Object.freeze({
  scanned:'Fully scanned','file-limit':'File count limit','read-failed':'Read unavailable',
  'byte-limit':'Byte budget','content-limit':'Content or match budget','invalid-listing':'Invalid listing identity',
});
export interface ScopedSearchSummary{
  readonly fileCoverage?:readonly ScopedFileCoverageRow[];
  readonly scope:ProjectSearchScope;
  readonly listed:number;
  readonly inScope:number;
  readonly excluded:number;
  readonly withheld:number;
  readonly searched:number;
  readonly skipped:number;
  readonly hits:number;
  readonly matchingFiles:number;
  readonly incomplete:boolean;
  readonly rows:readonly ScopedSearchFileRow[];
}
export function summarizeScopedSearch(plan:ScopedProjectSearchPlan,result:ProjectSearchResult):ScopeResult<ScopedSearchSummary>{
  if(result.error)return fail('Search did not complete successfully.');
  if(result.totalListedFiles!==plan.sources.length||!Number.isSafeInteger(result.searchedFiles)||
    !Number.isSafeInteger(result.skippedFiles)||result.searchedFiles<0||result.skippedFiles<0||
    result.searchedFiles+result.skippedFiles!==plan.sources.length)
    return fail('Search counts do not match the selected source inventory.');
  const groups=new Map<string,{name:string;hits:number;openBuffer:boolean}>();
  for(const hit of result.hits){
    const source=plan.sources.find(source=>source.name===hit.name&&sameFilePath(source.path,hit.path));
    if(!source)return fail('A search result falls outside the reviewed source scope.');
    const group=groups.get(source.name);
    if(group){
      if(group.openBuffer!==hit.fromOpenTab)return fail('Search result contains mixed source origins.');
      group.hits++;
    }else groups.set(source.name,{name:source.name,hits:1,openBuffer:hit.fromOpenTab});
  }
  const rows=[...groups.values()].sort((a,b)=>b.hits-a.hits||a.name.localeCompare(b.name,'en',{numeric:true}));
  let fileCoverage:readonly ScopedFileCoverageRow[]|undefined;
  if(result.fileEvidence){
    const evidence=result.fileEvidence;
    if(evidence.length!==plan.sources.length||
      evidence.filter(row=>row.state==='scanned').length!==result.searchedFiles)
      return fail('Per-file coverage does not agree with search counts.');
    const checked:ScopedFileCoverageRow[]=[];
    for(const source of plan.sources){
      const candidates=evidence.filter(row=>row.name===source.name&&sameFilePath(row.path,source.path));
      if(candidates.length!==1)return fail('Per-file coverage does not match the selected source inventory.');
      const row=candidates[0],group=groups.get(source.name);
      if(!PROJECT_SEARCH_FILE_STATES.includes(row.state)||
        (row.origin!==null&&row.origin!=='disk'&&row.origin!=='open-buffer')||
        (row.state==='scanned'&&row.origin===null)||
        (group&&(row.state!=='scanned'&&row.state!=='content-limit'||
          row.origin!==(group.openBuffer?'open-buffer':'disk'))))
        return fail('Per-file coverage contains inconsistent source evidence.');
      checked.push(Object.freeze({name:source.name,state:row.state,origin:row.origin,hits:group?.hits??0}));
    }
    fileCoverage=Object.freeze(checked);
  }
  const withheld=plan.invalid+plan.ambiguous+plan.uninspected;
  return {ok:true,value:Object.freeze({
    scope:plan.scope,listed:plan.listed,inScope:plan.sources.length,excluded:plan.excluded,
    withheld,searched:result.searchedFiles,skipped:result.skippedFiles,hits:result.hits.length,matchingFiles:rows.length,
    incomplete:result.truncated||result.skippedFiles>0||withheld>0,
    rows:Object.freeze(rows.map(row=>Object.freeze(row))),
    ...(fileCoverage?{fileCoverage}:{}),
  })};
}
export interface ScopeReportOptions{
  readonly includeLabels:boolean;
  readonly includeFilenameQuery:boolean;
}
/** Counts-only is the default shareable view. Even with labels enabled,
 * never include absolute paths, matched source text or the content query. */
export function scopedSearchReport(summary:ScopedSearchSummary,options:ScopeReportOptions={includeLabels:false,includeFilenameQuery:false}):string{
  const lines=[
    'Scarp Studio — bounded project search',
    'Coverage applies only to the listed sources, not the full filesystem.',
    summary.scope.descendants?'Directory scope includes descendants.':'Directory scope excludes descendants.',
    'Listed sources: '+summary.listed,
    'Eligible sources in scope: '+summary.inScope,
    'Excluded by scope: '+summary.excluded,
    'Invalid, ambiguous or uninspected listing entries: '+summary.withheld,
    'Fully scanned sources: '+summary.searched,
    'Not fully scanned: '+summary.skipped,
    'Displayed matches: '+summary.hits,
    'Files with displayed matches: '+summary.matchingFiles,
    'Coverage: '+(summary.incomplete?'incomplete':'complete for selected listed sources'),
    'Read budget: at most '+MAX_PROJECT_SEARCH_FILES+' sources per search.',
  ];
  if(summary.fileCoverage){
    for(const state of PROJECT_SEARCH_FILE_STATES){
      const count=summary.fileCoverage.filter(row=>row.state===state).length;
      if(count)lines.push(SEARCH_COVERAGE_LABELS[state]+': '+count);
    }
  }
  if(options.includeFilenameQuery)lines.push('Filename substring: '+JSON.stringify(summary.scope.filename));
  if(options.includeLabels){
    lines.push('Directory label: '+JSON.stringify(summary.scope.directory||'(root)'));
    let length=lines.join('\n').length;
    const reportRows=summary.fileCoverage??summary.rows.map(row=>({
      name:row.name,hits:row.hits,state:'scanned' as const,origin:row.openBuffer?'open-buffer' as const:'disk' as const,
    }));
    for(const row of reportRows){
      const line=JSON.stringify(row.name)+' — '+row.hits+' displayed match(es), '+SEARCH_COVERAGE_LABELS[row.state]+
        (row.origin?', '+row.origin:'');
      if(length+line.length+1>MAX_SCOPE_REPORT_UNITS-100){
        lines.push('Additional file rows omitted from report due to size limit.');break;
      }
      lines.push(line);length+=line.length+1;
    }
  }
  return lines.join('\n');
}
