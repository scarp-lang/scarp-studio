import type {StudioDocument} from './documents';
import {readInspectionSnapshot,INSPECTION_READ_LIMITS,type InspectionControl,type InspectionSettings,
  type InspectionOrigin,type ProjectInspectionPlan} from './projectInspection';
import {MAX_SCOPE_REPORT_UNITS} from './projectSearchScope';
import {safeRelativeScarpSourceName} from './folderListing';
import {assertWellFormedUtf16,utf8ByteLength} from './utf8Text';

export const MANIFEST_PAGE_SIZE=20;
export const MANIFEST_STATES=['hashed','read-failed','byte-limit','ambiguous-buffer','hash-failed','not-observed'] as const;
export type ManifestState=typeof MANIFEST_STATES[number];
export const MANIFEST_STATE_LABELS:Readonly<Record<ManifestState,string>>=Object.freeze({
  hashed:'SHA-256 observed','read-failed':'Read unavailable','byte-limit':'Read budget',
  'ambiguous-buffer':'Ambiguous working buffer','hash-failed':'Digest unavailable','not-observed':'Not observed',
});
export interface SourceTextMetrics{
  readonly units:number;
  readonly lines:number;
  readonly blankLines:number;
  readonly lf:number;
  readonly crlf:number;
  readonly cr:number;
  readonly finalNewline:boolean;
  readonly eol:'none'|'lf'|'crlf'|'cr'|'mixed';
}
/** Counts exact UTF-16 source units and physical editor lines without
 * allocating a line array. An empty file has one blank editor line. */
export function sourceTextMetrics(content:string):SourceTextMetrics{
  let lf=0,crlf=0,cr=0,lines=1,blankLines=0,lineBlank=true;
  for(let index=0;index<content.length;index++){
    const char=content[index];
    if(char==='\r'||char==='\n'){
      if(lineBlank)blankLines++;
      lineBlank=true;lines++;
      if(char==='\r'&&content[index+1]==='\n'){crlf++;index++;}
      else if(char==='\r')cr++;
      else lf++;
    }else if(char!==' '&&char!=='\t')lineBlank=false;
  }
  if(lineBlank)blankLines++;
  const kinds=[lf>0,crlf>0,cr>0].filter(Boolean).length;
  const eol=kinds===0?'none':kinds>1?'mixed':lf?'lf':crlf?'crlf':'cr';
  return Object.freeze({units:content.length,lines,blankLines,lf,crlf,cr,
    finalNewline:content.endsWith('\n')||content.endsWith('\r'),eol});
}
export type SourceDigest=(content:string)=>Promise<string>;
export function validSourceDigest(value:unknown):value is string{
  return typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
}
/** Hash exact UTF-8 source text, including all newline units, with local
 * Web Crypto. No upload, filesystem access, or compiler invocation. */
export async function sha256SourceText(content:string):Promise<string>{
  if(content.length>INSPECTION_READ_LIMITS.fileBytes||utf8ByteLength(content)>INSPECTION_READ_LIMITS.fileBytes)throw Error('Source exceeds digest byte budget');
  assertWellFormedUtf16(content,'Source digest');
  if(!globalThis.crypto?.subtle)throw Error('Local SHA-256 unavailable');
  const digest=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(content));
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
export interface ManifestFile{
  readonly name:string;
  readonly state:ManifestState;
  readonly origin:InspectionOrigin;
  readonly bytes:number|null;
  readonly digest:string|null;
  readonly metrics:SourceTextMetrics|null;
  readonly dirty:boolean;
}
export interface ProjectSourceManifest{
  readonly status:'completed'|'cancelled';
  readonly settings:InspectionSettings;
  readonly listed:number;
  readonly selected:number;
  readonly excluded:number;
  readonly deferred:number;
  readonly withheld:number;
  readonly bytes:number;
  readonly files:readonly ManifestFile[];
  readonly complete:boolean;
}
export type ManifestExecution={readonly kind:'report';readonly report:ProjectSourceManifest}|{readonly kind:'invalidated'};
function unavailable(name:string,state:ManifestState,origin:InspectionOrigin,dirty=false):ManifestFile{
  return Object.freeze({name,state,origin,bytes:null,digest:null,metrics:null,dirty});
}
/** Hash only completed reviewed snapshots. Failures preserve an explicit
 * coverage row; no fake empty digest or zero-byte evidence is fabricated.
 * The result retains metadata, never full source text or native paths. */
export async function executeSourceManifest(plan:ProjectInspectionPlan,documents:readonly StudioDocument[],
  read:(path:string,maxBytes:number)=>Promise<string>,control:InspectionControl,
  digest:SourceDigest=sha256SourceText):Promise<ManifestExecution>{
  const files:ManifestFile[]=[];
  let bytes=0;
  const stopped=()=>!control.isCurrent()||control.isCancelled();
  for(const source of plan.sources){
    if(stopped())break;
    control.onProgress?.({observed:files.length,total:plan.selected});
    if(control.yieldBetweenFiles)await control.yieldBetweenFiles();
    if(stopped())break;
    const snapshot=await readInspectionSnapshot(source,documents,plan.settings.mode,
      INSPECTION_READ_LIMITS.totalBytes-bytes,read,stopped);
    if(snapshot.kind==='stopped'||stopped())break;
    if(snapshot.kind==='unavailable'){
      files.push(unavailable(source.name,snapshot.state,snapshot.origin,snapshot.dirtyTab));
      continue;
    }
    bytes+=snapshot.bytes;
    let fingerprint:string|null=null;
    try{
      const value=await digest(snapshot.content);
      if(validSourceDigest(value))fingerprint=value;
    }catch{/* A local crypto failure never turns into an empty digest. */}
    if(stopped())break;
    files.push(Object.freeze({name:source.name,state:fingerprint?'hashed':'hash-failed',origin:snapshot.origin,
      bytes:snapshot.bytes,digest:fingerprint,metrics:sourceTextMetrics(snapshot.content),dirty:snapshot.dirtyTab}));
  }
  if(!control.isCurrent())return {kind:'invalidated'};
  const observed=files.length;
  for(const source of plan.sources.slice(observed))files.push(unavailable(source.name,'not-observed','none'));
  control.onProgress?.({observed,total:plan.selected});
  if(!control.isCurrent())return {kind:'invalidated'};
  const status=control.isCancelled()?'cancelled':'completed';
  return {kind:'report',report:Object.freeze({
    status,settings:plan.settings,listed:plan.listed,selected:plan.selected,excluded:plan.excluded,
    deferred:plan.deferred,withheld:plan.withheld,bytes,files:Object.freeze(files),
    complete:status==='completed'&&!plan.settings.listingLimited&&!plan.deferred&&!plan.withheld&&files.every(file=>file.state==='hashed'),
  })};
}
export interface ManifestSummary{
  readonly hashed:number;
  readonly unread:number;
  readonly hashFailed:number;
  readonly observedBytes:number;
  readonly observedLines:number;
  readonly dirty:number;
  readonly mixedEndings:number;
  readonly missingFinalNewline:number;
  readonly duplicateGroups:number;
}
export interface DuplicateContentGroup{
  readonly id:number;
  readonly digest:string;
  readonly bytes:number;
  readonly files:readonly ManifestFile[];
}
export function groupManifestDuplicates(report:ProjectSourceManifest):readonly DuplicateContentGroup[]{
  const groups=new Map<string,ManifestFile[]>();
  for(const file of report.files){
    if(file.state!=='hashed'||!validSourceDigest(file.digest)||file.bytes===null)continue;
    const key=JSON.stringify([file.digest,file.bytes]);
    const group=groups.get(key)??[];
    group.push(file);groups.set(key,group);
  }
  return [...groups.values()].filter(group=>group.length>1)
    .sort((a,b)=>b.length-a.length||(a[0].name<b[0].name?-1:a[0].name>b[0].name?1:0))
    .map((files,index)=>Object.freeze({id:index+1,digest:files[0].digest!,bytes:files[0].bytes!,files:Object.freeze(files)}));
}
export function summarizeManifest(report:ProjectSourceManifest):ManifestSummary{
  const observed=report.files.filter(file=>file.metrics!==null&&file.bytes!==null);
  return {hashed:report.files.filter(file=>file.state==='hashed').length,
    unread:report.files.filter(file=>file.state!=='hashed'&&file.state!=='hash-failed').length,
    hashFailed:report.files.filter(file=>file.state==='hash-failed').length,
    observedBytes:observed.reduce((sum,file)=>sum+file.bytes!,0),
    observedLines:observed.reduce((sum,file)=>sum+file.metrics!.lines,0),
    dirty:report.files.filter(file=>file.dirty).length,
    mixedEndings:observed.filter(file=>file.metrics!.eol==='mixed').length,
    missingFinalNewline:observed.filter(file=>file.bytes!>0&&!file.metrics!.finalNewline).length,
    duplicateGroups:groupManifestDuplicates(report).length};
}
export interface ManifestFilter{
  readonly query:string;
  readonly state:ManifestState|'all';
  readonly origin:InspectionOrigin|'all';
  readonly eol:SourceTextMetrics['eol']|'all';
  readonly duplicateOnly:boolean;
  readonly order:'source'|'bytes'|'lines';
}
export const DEFAULT_MANIFEST_FILTER:ManifestFilter=Object.freeze({
  query:'',state:'all',origin:'all',eol:'all',duplicateOnly:false,order:'source',
});
const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;
export function filterManifestFiles(report:ProjectSourceManifest,filter:ManifestFilter):readonly ManifestFile[]{
  if(filter.query.length>120||/[\x00-\x1f\x7f]/.test(filter.query))return [];
  const query=filter.query.trim().toLowerCase();
  const duplicates=new Set(filter.duplicateOnly?groupManifestDuplicates(report).flatMap(group=>group.files.map(file=>file.name)):[]);
  return report.files.filter(file=>(!query||file.name.toLowerCase().includes(query))&&
    (filter.state==='all'||file.state===filter.state)&&(filter.origin==='all'||file.origin===filter.origin)&&
    (filter.eol==='all'||file.metrics?.eol===filter.eol)&&(!filter.duplicateOnly||duplicates.has(file.name)))
    .sort((a,b)=>(filter.order==='bytes'?(b.bytes??-1)-(a.bytes??-1):
      filter.order==='lines'?(b.metrics?.lines??-1)-(a.metrics?.lines??-1):0)||compare(a.name,b.name));
}
export function pageManifest<T>(rows:readonly T[],requested:number){
  const pages=Math.max(1,Math.ceil(rows.length/MANIFEST_PAGE_SIZE));
  const page=Math.min(pages,Math.max(1,Number.isSafeInteger(requested)?requested:1));
  return {page,pages,rows:rows.slice((page-1)*MANIFEST_PAGE_SIZE,page*MANIFEST_PAGE_SIZE)};
}
export interface ManifestExportOptions{readonly labels:boolean;readonly digests:boolean}
export const PRIVATE_MANIFEST_EXPORT:ManifestExportOptions=Object.freeze({labels:false,digests:false});
export function manifestReportText(report:ProjectSourceManifest,options=PRIVATE_MANIFEST_EXPORT):string{
  const summary=summarizeManifest(report);
  const lines=['Scarp Studio — reviewed source snapshot manifest',
    'SHA-256 of exact local UTF-8 source snapshots; no source text or native paths included.',
    'Snapshot mode: '+report.settings.mode,'Status: '+report.status,
    'Selected / listed: '+report.selected+' / '+report.listed,
    'Excluded / deferred / withheld: '+report.excluded+' / '+report.deferred+' / '+report.withheld,
    'Coverage: '+(report.complete?'complete for chosen listed scope':'incomplete'),
    'Hashed sources: '+summary.hashed,'Unavailable observations: '+summary.unread,'Digest failures: '+summary.hashFailed,
    'Observed bytes: '+summary.observedBytes,'Observed editor lines: '+summary.observedLines,
    'Dirty matching tabs: '+summary.dirty,'Mixed EOL sources: '+summary.mixedEndings,
    'Nonempty sources without final newline: '+summary.missingFinalNewline,
    'Observed identical digest + length groups: '+summary.duplicateGroups,
    'A digest is snapshot evidence, not a signature, permission grant or proof of compiler correctness.'];
  let units=lines.join('\n').length;
  if(options.labels||options.digests)for(const [index,file] of report.files.entries()){
    const line='Source '+(index+1)+(options.labels&&safeRelativeScarpSourceName(file.name)?' '+JSON.stringify(file.name):'')+
      '; '+MANIFEST_STATE_LABELS[file.state]+'; '+file.origin+'; bytes: '+(file.bytes??'unknown')+
      (options.digests&&validSourceDigest(file.digest)?'; SHA-256: '+file.digest:'');
    if(units+line.length+1>MAX_SCOPE_REPORT_UNITS-100){lines.push('Additional manifest evidence omitted.');break;}
    lines.push(line);units+=line.length+1;
  }
  return lines.join('\n');
}
