import type { StudioDocument } from './documents';
import { sameFilePath } from './documents';
import { indexSymbolFile, MAX_WORKSPACE_SYMBOLS, MAX_WORKSPACE_CALLS, SYMBOL_KINDS,
  SYMBOL_KIND_LABELS, SYMBOL_COVERAGE_LABELS, type SymbolKind, type SymbolScope,
  type SymbolVisibility, type SymbolCoverageReason } from './workspaceSymbols';
import { INSPECTION_READ_LIMITS, readInspectionSnapshot, type InspectionControl,
  type InspectionOrigin, type InspectionSettings, type ProjectInspectionPlan } from './projectInspection';
import { buildProjectScopeInventory, MAX_SCOPE_REPORT_UNITS } from './projectSearchScope';
import type { ProjectSearchSource } from './projectSearch';
import { validRelativeLabel } from './projectSearchComparison';
import { scarpInsightIdentifier } from '../language/sourceLex';
import { captureScarpFunctionInterfaces, type InterfaceShapeEvidence } from '../language/scarpFunctionInterfaces';

export const LISTED_SYMBOL_PAGE_SIZE = 20;
export type ListedSiteKind = SymbolKind | 'call';
export const LISTED_SITE_KINDS = [...SYMBOL_KINDS, 'call'] as const;
export const LISTED_SITE_LABELS: Readonly<Record<ListedSiteKind,string>> = Object.freeze({
  ...SYMBOL_KIND_LABELS, call:'Call-like identifier',
});
export interface ListedSymbolSite {
  readonly id: string;
  readonly source: string;
  readonly name: string;
  readonly kind: ListedSiteKind;
  readonly line: number;
  readonly column: number;
  readonly offset: number;
  readonly end: number;
  readonly scope: SymbolScope | null;
  readonly visibility: SymbolVisibility | null;
  readonly pure: boolean;
  readonly enclosing: string | null;
  /** Retained exact declaration identity; null when unavailable or at file level. */
  readonly enclosingId: string | null;
}
export type ListedSymbolState = 'scanned' | 'partial' | 'read-failed' | 'byte-limit' |
  'ambiguous-buffer' | 'not-observed';
export const LISTED_SYMBOL_STATES = ['scanned','partial','read-failed','byte-limit',
  'ambiguous-buffer','not-observed'] as const;
export const LISTED_SYMBOL_STATE_LABELS: Readonly<Record<ListedSymbolState,string>> = Object.freeze({
  scanned:'Fully indexed', partial:'Partial lexical index', 'read-failed':'Read unavailable',
  'byte-limit':'Byte budget', 'ambiguous-buffer':'Ambiguous working buffer', 'not-observed':'Not observed',
});
export interface ListedSymbolFile {
  readonly name: string;
  readonly state: ListedSymbolState;
  readonly origin: InspectionOrigin;
  readonly bytes: number | null;
  readonly reasons: readonly SymbolCoverageReason[];
  readonly declarations: number;
  readonly calls: number;
}
export interface ListedFunctionInterface {
  readonly site: ListedSymbolSite;
  readonly evidence: InterfaceShapeEvidence;
}
export interface ListedSymbolReport {
  readonly status: 'completed' | 'cancelled';
  readonly settings: InspectionSettings;
  readonly listed: number;
  readonly selected: number;
  readonly deferred: number;
  readonly excluded: number;
  readonly withheld: number;
  readonly bytes: number;
  readonly files: readonly ListedSymbolFile[];
  readonly declarations: readonly ListedSymbolSite[];
  /** Explicit opt-in; canonical interface shapes may contain private identifiers. */
  readonly interfaces: readonly ListedFunctionInterface[] | null;
  readonly calls: readonly ListedSymbolSite[];
  readonly complete: boolean;
}
export type ListedSymbolExecution =
  { readonly kind:'report'; readonly report:ListedSymbolReport } | { readonly kind:'invalidated' };

function unobserved(name:string,state:ListedSymbolState,origin:InspectionOrigin):ListedSymbolFile{
  return Object.freeze({name,state,origin,bytes:null,reasons:Object.freeze([]),declarations:0,calls:0});
}
function siteId(source:string,kind:ListedSiteKind,offset:number):string{
  return JSON.stringify([source,kind,offset]);
}

/** Index only reviewed sources through the shared bounded snapshot reader.
 * Retain no full source, native path, synthetic editor ID or source header.
 * Calls are lexical candidates; imported modules and scopes are not resolved.
 */
export async function executeListedSymbolIndex(plan:ProjectInspectionPlan,documents:readonly StudioDocument[],
  read:(path:string,maxBytes:number)=>Promise<string>,control:InspectionControl,captureInterfaces=false):Promise<ListedSymbolExecution>{
  const files:ListedSymbolFile[]=[];
  const declarations:ListedSymbolSite[]=[];
  const calls:ListedSymbolSite[]=[];
  const interfaces:ListedFunctionInterface[]=[];
  let bytes=0;
  const stopped=()=>!control.isCurrent()||control.isCancelled();
  for(const source of plan.sources){
    if(stopped())break;
    control.onProgress?.({observed:files.length,total:plan.selected});
    if(stopped())break;
    if(control.yieldBetweenFiles)await control.yieldBetweenFiles();
    if(stopped())break;
    const snapshot=await readInspectionSnapshot(source,documents,plan.settings.mode,
      INSPECTION_READ_LIMITS.totalBytes-bytes,read,stopped);
    if(snapshot.kind==='stopped')break;
    if(snapshot.kind==='unavailable'){
      files.push(unobserved(source.name,snapshot.state,snapshot.origin));
      continue;
    }
    bytes+=snapshot.bytes;
    const index=indexSymbolFile({
      id:'listed-symbol', name:source.name,path:null,content:snapshot.content,
      savedContent:snapshot.content,revision:0,
    });
    const keptSymbols=index.symbols.slice(0,Math.max(0,MAX_WORKSPACE_SYMBOLS-declarations.length));
    const keptCalls=index.calls.slice(0,Math.max(0,MAX_WORKSPACE_CALLS-calls.length));
    const functions=new Map(keptSymbols.filter(symbol=>symbol.kind==='function').map(symbol=>[symbol.id,symbol]));
    const localDeclarations:ListedSymbolSite[]=[];
    for(const symbol of keptSymbols)localDeclarations.push(Object.freeze({
      id:siteId(source.name,symbol.kind,symbol.offset),source:source.name,name:symbol.name,
      kind:symbol.kind,line:symbol.line,column:symbol.column,offset:symbol.offset,end:symbol.end,
      scope:symbol.scope,visibility:symbol.visibility,pure:symbol.pure,enclosing:null,enclosingId:null,
    }));
    declarations.push(...localDeclarations);
    if(captureInterfaces){
      const byOffset=new Map(localDeclarations.map(site=>[site.offset,site]));
      for(const item of captureScarpFunctionInterfaces(snapshot.content,keptSymbols)){
        const site=byOffset.get(item.offset);
        if(site)interfaces.push(Object.freeze({site,evidence:item.evidence}));
      }
    }
    for(const call of keptCalls)calls.push(Object.freeze({
      id:siteId(source.name,'call',call.offset),source:source.name,name:call.name,kind:'call',
      line:call.line,column:call.column,offset:call.offset,end:call.end,
      scope:null,visibility:null,pure:false,
      enclosing:call.enclosingSymbolId?functions.get(call.enclosingSymbolId)?.name??null:null,
      enclosingId:call.enclosingSymbolId&&functions.has(call.enclosingSymbolId)?
        siteId(source.name,'function',functions.get(call.enclosingSymbolId)!.offset):null,
    }));
    const reasons=[...index.reasons];
    if(keptSymbols.length!==index.symbols.length)reasons.push('workspace-symbol-limit');
    if(keptCalls.length!==index.calls.length)reasons.push('workspace-call-limit');
    files.push(Object.freeze({
      name:source.name,state:reasons.length?'partial':'scanned',origin:snapshot.origin,
      bytes:snapshot.bytes,reasons:Object.freeze(reasons),declarations:keptSymbols.length,calls:keptCalls.length,
    }));
  }
  if(!control.isCurrent())return {kind:'invalidated'};
  const observed=files.length;
  for(const source of plan.sources.slice(observed))files.push(unobserved(source.name,'not-observed','none'));
  control.onProgress?.({observed,total:plan.selected});
  if(!control.isCurrent())return {kind:'invalidated'};
  const status=control.isCancelled()?'cancelled':'completed';
  return {kind:'report',report:Object.freeze({
    status,settings:plan.settings,listed:plan.listed,selected:plan.selected,
    deferred:plan.deferred,excluded:plan.excluded,withheld:plan.withheld,bytes,
    files:Object.freeze(files),declarations:Object.freeze(declarations),calls:Object.freeze(calls),
    interfaces:captureInterfaces?Object.freeze(interfaces):null,
    complete:status==='completed'&&!plan.settings.listingLimited&&!plan.deferred&&!plan.withheld&&
      files.every(file=>file.state==='scanned'),
  })};
}

export interface ListedSymbolFilter {
  readonly query:string;
  readonly source:string;
  readonly kind:ListedSiteKind|'all';
  readonly scope:SymbolScope|'all';
  readonly publicOnly:boolean;
  readonly pureOnly:boolean;
  readonly order:'source'|'name'|'kind';
}
export const DEFAULT_LISTED_SYMBOL_FILTER:ListedSymbolFilter=Object.freeze({
  query:'',source:'',kind:'all',scope:'all',publicOnly:false,pureOnly:false,order:'source',
});
function compareText(a:string,b:string):number{return a<b?-1:a>b?1:0;}
function sourceOrder(a:ListedSymbolSite,b:ListedSymbolSite):number{
  return compareText(a.source,b.source)||a.offset-b.offset||compareText(a.kind,b.kind);
}
function safeQuery(query:string):boolean{
  return query.length<=120&&!/[\x00-\x1f\x7f]/.test(query);
}
export function filterListedSymbols(report:ListedSymbolReport,filter:ListedSymbolFilter):readonly ListedSymbolSite[]{
  if(!safeQuery(filter.query))return [];
  const query=filter.query.trim().toLowerCase();
  return [...report.declarations,...report.calls].filter(site=>
    (!filter.source||site.source===filter.source)&&(filter.kind==='all'||site.kind===filter.kind)&&
    (filter.scope==='all'||site.scope===filter.scope)&&(!filter.publicOnly||site.visibility==='public')&&
    (!filter.pureOnly||site.pure)&&(!query||[site.name,site.source,site.enclosing??''].join(' ').toLowerCase().includes(query)))
    .sort((a,b)=>(filter.order==='name'?compareText(a.name,b.name):
      filter.order==='kind'?compareText(a.kind,b.kind):0)||sourceOrder(a,b));
}
export type ListedCandidateStatus='one-observed'|'multiple-observed'|'none-observed';
export const LISTED_CANDIDATE_LABELS:Readonly<Record<ListedCandidateStatus,string>>=Object.freeze({
  'one-observed':'One observed declaration','multiple-observed':'Multiple observed declarations',
  'none-observed':'No observed declaration',
});
export interface ListedCallGroup {
  readonly name:string;
  readonly status:ListedCandidateStatus;
  readonly calls:readonly ListedSymbolSite[];
  readonly candidates:readonly ListedSymbolSite[];
  readonly sameFileCalls:number;
  readonly crossFileOnlyCalls:number;
  readonly coverageComplete:boolean;
}
export function groupListedCalls(report:ListedSymbolReport):readonly ListedCallGroup[]{
  const functions=new Map<string,ListedSymbolSite[]>();
  const calls=new Map<string,ListedSymbolSite[]>();
  for(const site of report.declarations){
    if(site.kind!=='function')continue;
    const bucket=functions.get(site.name)??[];
    bucket.push(site);functions.set(site.name,bucket);
  }
  for(const site of report.calls){
    const bucket=calls.get(site.name)??[];
    bucket.push(site);calls.set(site.name,bucket);
  }
  return [...calls.entries()].sort(([a],[b])=>compareText(a,b)).map(([name,sites])=>{
    const candidates=functions.get(name)??[];
    const candidateSources=new Set(candidates.map(site=>site.source));
    const sameFileCalls=sites.filter(site=>candidateSources.has(site.source)).length;
    return Object.freeze({name,status:candidates.length===0?'none-observed':candidates.length===1?'one-observed':'multiple-observed',
      calls:Object.freeze(sites),candidates:Object.freeze(candidates),sameFileCalls,
      crossFileOnlyCalls:candidates.length?sites.length-sameFileCalls:0,coverageComplete:report.complete});
  });
}
export interface RepeatedListedName {
  readonly name:string;
  readonly declarations:readonly ListedSymbolSite[];
  readonly sources:number;
}
export function repeatedListedNames(report:ListedSymbolReport):readonly RepeatedListedName[]{
  const groups=new Map<string,ListedSymbolSite[]>();
  for(const site of report.declarations){
    const group=groups.get(site.name)??[];group.push(site);groups.set(site.name,group);
  }
  return [...groups.entries()].filter(([,group])=>group.length>1).map(([name,declarations])=>({
    name,declarations:Object.freeze(declarations),sources:new Set(declarations.map(site=>site.source)).size,
  })).sort((a,b)=>b.sources-a.sources||b.declarations.length-a.declarations.length||compareText(a.name,b.name));
}
export function pageListedSymbols<T>(rows:readonly T[],requested:number){
  const pages=Math.max(1,Math.ceil(rows.length/LISTED_SYMBOL_PAGE_SIZE));
  const page=Math.min(pages,Math.max(1,Number.isSafeInteger(requested)?requested:1));
  return {page,pages,rows:rows.slice((page-1)*LISTED_SYMBOL_PAGE_SIZE,page*LISTED_SYMBOL_PAGE_SIZE)};
}

/** Resolve a label only against today's unique listing. Historical evidence
 * never grants access to a path and never authorizes a write.
 */
export function resolveListedSymbolPath(report:ListedSymbolReport,site:ListedSymbolSite,
  listed:readonly ProjectSearchSource[]):string|null{
  const collection=site.kind==='call'?report.calls:report.declarations;
  if(!collection.includes(site)||!validRelativeLabel(site.source))return null;
  const found=buildProjectScopeInventory(listed).sources.filter(source=>source.name===site.source);
  return found.length===1?found[0].path:null;
}

/** Re-index the current document and match the historical site's exact
 * spelling, kind and coordinates. This is a current lexical location,
 * not proof that the declaration's meaning or original content is unchanged.
 */
export function recheckListedSymbolSite(site:ListedSymbolSite,document:StudioDocument,path:string){
  if(!document.path||!sameFilePath(document.path,path)||!scarpInsightIdentifier(site.name))return null;
  const index=indexSymbolFile(document);
  if(!index.complete)return null;
  const candidate=site.kind==='call'?index.calls.find(item=>item.name===site.name&&item.offset===site.offset):
    index.symbols.find(item=>item.name===site.name&&item.kind===site.kind&&item.offset===site.offset&&
      item.scope===site.scope&&item.visibility===site.visibility&&item.pure===site.pure);
  if(!candidate||candidate.line!==site.line||candidate.column!==site.column||candidate.end!==site.end)return null;
  if(site.kind==='call'&&'enclosingSymbolId' in candidate){
    const owner=index.symbols.find(item=>item.id===candidate.enclosingSymbolId)?.name??null;
    if(owner!==site.enclosing)return null;
  }
  return {documentId:document.id,revision:document.revision,source:document.content,line:candidate.line,column:candidate.column};
}
export function listedSymbolReportText(report:ListedSymbolReport,includeLabels=false,includeNames=false):string{
  const lines=[
    'Scarp Studio — listed lexical symbol inventory',
    'Historical lexical observations, not compiler symbol resolution or a call graph.',
    'Status: '+report.status,
    'Snapshot mode: '+report.settings.mode,
    'Listed / selected: '+report.listed+' / '+report.selected,
    'Excluded / deferred / withheld: '+report.excluded+' / '+report.deferred+' / '+report.withheld,
    'Coverage: '+(report.complete?'complete for chosen listed scope':'incomplete'),
    'Bytes analyzed: '+report.bytes,
    'Declaration-like sites: '+report.declarations.length,
    'Call-like sites: '+report.calls.length,
    ...SYMBOL_KINDS.map(kind=>SYMBOL_KIND_LABELS[kind]+': '+report.declarations.filter(site=>site.kind===kind).length),
    'Repeated names and spelling matches are not diagnostics.',
    'No native paths, source headers or source text are exported by this report.',
  ];
  let units=lines.join('\n').length;
  const append=(line:string)=>{
    if(units+line.length+1>MAX_SCOPE_REPORT_UNITS-100)return false;
    lines.push(line);units+=line.length+1;return true;
  };
  for(const file of report.files){
    if(!includeLabels)break;
    if(!append(JSON.stringify(file.name)+' — '+LISTED_SYMBOL_STATE_LABELS[file.state]+
      '; declarations: '+file.declarations+'; calls: '+file.calls+
      (file.reasons.length?'; '+file.reasons.map(reason=>SYMBOL_COVERAGE_LABELS[reason]).join(', '):''))){
      lines.push('Additional evidence omitted due to report size limit.');return lines.join('\n');
    }
  }
  if(includeNames){
    for(const site of [...report.declarations,...report.calls]){
      if(!append(LISTED_SITE_LABELS[site.kind]+': '+JSON.stringify(site.name)+
        (includeLabels?' in '+JSON.stringify(site.source)+':'+site.line+':'+site.column:''))){
        lines.push('Additional evidence omitted due to report size limit.');break;
      }
    }
  }
  return lines.join('\n');
}
