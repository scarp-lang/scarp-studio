import {scanScarpSource,scarpInsightIdentifier,type InsightToken} from '../language/sourceLex';
import {functionCallOpenIndex} from '../language/genericSyntax';
import {sameFilePath,type StudioDocument} from './documents';
import {prepareProjectInspection,confirmProjectInspection,readInspectionSnapshot,INSPECTION_READ_LIMITS,
  type ProjectInspectionPlan,type InspectionSettings,type InspectionControl,type InspectionOrigin} from './projectInspection';
import {buildProjectScopeInventory,MAX_SCOPE_REPORT_UNITS} from './projectSearchScope';
import {validRelativeLabel} from './projectSearchComparison';
import type {ProjectSearchSource} from './projectSearch';

export const MAX_LISTED_REFERENCE_HITS=800;
export const MAX_LISTED_REFERENCES_PER_FILE=320;
export const LISTED_REFERENCE_PAGE=24;
export const REFERENCE_ROLES=['declaration-like','qualified-call','call-like','qualified-member',
  'assignment-like','type-position','other-identifier'] as const;
export type ListedReferenceRole=typeof REFERENCE_ROLES[number];
export const REFERENCE_ROLE_LABELS:Readonly<Record<ListedReferenceRole,string>>=Object.freeze({
  'declaration-like':'Declaration-like','qualified-call':'Qualified call-like','call-like':'Call-like',
  'qualified-member':'Qualified member','assignment-like':'Assignment-like',
  'type-position':'After type separator','other-identifier':'Other code identifier',
});
const declarationWords=new Set(['funcra','record','variant','bind','var','as']);
const assignmentOperators=new Set(['=','+=','-=','*=','/=','%=','<<=','>>=']);
const memberOperators=new Set(['.','::','->','?.']);
const asciiAdjacent=(source:string,token:InsightToken)=>
  (token.start>0&&/[^\x00-\x7f]/.test(source[token.start-1]))||
  (token.end<source.length&&/[^\x00-\x7f]/.test(source[token.end]));

export interface ListedReferenceQuery{
  readonly identifier:string;
  readonly caseSensitive:boolean;
}
type Result<T>={readonly ok:true;readonly value:T}|{readonly ok:false;readonly error:string};
const fail=(error:string):Result<never>=>({ok:false,error});
export function validateListedReferenceQuery(query:ListedReferenceQuery):Result<ListedReferenceQuery>{
  if(!query||typeof query.identifier!=='string'||!scarpInsightIdentifier(query.identifier)||
    typeof query.caseSensitive!=='boolean')return fail('Enter one ASCII Scarp code identifier of up to 128 characters.');
  return {ok:true,value:Object.freeze({identifier:query.identifier,caseSensitive:query.caseSensitive})};
}
export interface ListedReferencePlan{
  readonly inspection:ProjectInspectionPlan;
  readonly query:ListedReferenceQuery;
}
export function prepareListedReferences(listed:readonly ProjectSearchSource[],settings:InspectionSettings,
  query:ListedReferenceQuery):Result<ListedReferencePlan>{
  const valid=validateListedReferenceQuery(query);
  if(!valid.ok)return valid;
  const plan=prepareProjectInspection(listed,settings);
  return plan.ok?{ok:true,value:Object.freeze({inspection:plan.value,query:valid.value})}:plan;
}
export function confirmListedReferences(plan:ListedReferencePlan,listed:readonly ProjectSearchSource[],
  settings:InspectionSettings,query:ListedReferenceQuery):Result<ListedReferencePlan>{
  const valid=validateListedReferenceQuery(query);
  if(!valid.ok)return valid;
  if(valid.value.identifier!==plan.query.identifier||valid.value.caseSensitive!==plan.query.caseSensitive)
    return fail('Identifier or matching options changed. Review again.');
  const checked=confirmProjectInspection(plan.inspection,listed,settings);
  return checked.ok?{ok:true,value:Object.freeze({inspection:checked.value,query:valid.value})}:checked;
}

export interface ListedReferenceSite{
  readonly id:string;
  readonly source:string;
  readonly token:string;
  readonly role:ListedReferenceRole;
  readonly line:number;
  readonly column:number;
  readonly offset:number;
  readonly end:number;
}
export const REFERENCE_REASONS=['lexical-limit','lexical-issue','non-ascii-boundary','file-hit-limit','workspace-hit-limit'] as const;
export type ListedReferenceReason=typeof REFERENCE_REASONS[number];
export const REFERENCE_REASON_LABELS:Readonly<Record<ListedReferenceReason,string>>=Object.freeze({
  'lexical-limit':'Lexical scan limit','lexical-issue':'Malformed lexical source',
  'non-ascii-boundary':'Uncertain non-ASCII identifier boundary',
  'file-hit-limit':'Per-file reference limit','workspace-hit-limit':'Workspace reference limit',
});
interface LocalReferenceEvidence{
  readonly hits:readonly ListedReferenceSite[];
  readonly reasons:readonly ListedReferenceReason[];
}
function referenceRole(tokens:readonly InsightToken[],index:number):ListedReferenceRole{
  const before=tokens[index-1],after=tokens[index+1];
  const qualified=before?.kind==='operator'&&memberOperators.has(before.text);
  if(!qualified&&before?.kind==='identifier'&&declarationWords.has(before.text))return 'declaration-like';
  if(functionCallOpenIndex(tokens,index)!==null)return qualified?'qualified-call':'call-like';
  if(qualified)return 'qualified-member';
  // A type annotation can immediately precede an initializer assignment.
  if(before?.kind==='operator'&&before.text===':')return 'type-position';
  if(after?.kind==='operator'&&assignmentOperators.has(after.text))return 'assignment-like';
  return 'other-identifier';
}

/** A bounded lexical classifier, not semantic name resolution. Comments and
 * string contents are excluded. A malformed lexical source yields no
 * trustworthy observations; partial token scans never establish absence.
 */
export function scanListedReferenceFile(sourceLabel:string,content:string,query:ListedReferenceQuery,
  remaining=MAX_LISTED_REFERENCES_PER_FILE):LocalReferenceEvidence{
  const reasons=new Set<ListedReferenceReason>();
  const hits:ListedReferenceSite[]=[];
  const valid=validateListedReferenceQuery(query);
  if(!valid.ok)return {hits:Object.freeze([]),reasons:Object.freeze(['lexical-issue'])};
  const lexical=scanScarpSource(content);
  if(!lexical.complete)reasons.add('lexical-limit');
  if(lexical.issues.some(issue=>issue.kind==='unterminated-string'||issue.kind==='invalid-control')){
    reasons.add('lexical-issue');
    return {hits:Object.freeze([]),reasons:Object.freeze([...reasons])};
  }
  const tokens=lexical.tokens.filter(token=>token.kind!=='comment');
  const wanted=query.caseSensitive?query.identifier:query.identifier.toLowerCase();
  const limit=Math.min(MAX_LISTED_REFERENCES_PER_FILE,Math.max(0,Number.isSafeInteger(remaining)?remaining:0));
  for(let index=0;index<tokens.length;index++){
    const token=tokens[index];
    if(token.kind!=='identifier'||token.previewTruncated||
      (query.caseSensitive?token.text:token.text.toLowerCase())!==wanted)continue;
    if(asciiAdjacent(content,token)){reasons.add('non-ascii-boundary');continue;}
    if(hits.length>=limit){
      reasons.add(limit<MAX_LISTED_REFERENCES_PER_FILE?'workspace-hit-limit':'file-hit-limit');
      break;
    }
    hits.push(Object.freeze({
      id:JSON.stringify([sourceLabel,token.start]),source:sourceLabel,token:token.text,
      role:referenceRole(tokens,index),line:token.line,column:token.column,offset:token.start,end:token.end,
    }));
  }
  return {hits:Object.freeze(hits),reasons:Object.freeze([...reasons])};
}
export const REFERENCE_STATES=['scanned','partial','read-failed','byte-limit','ambiguous-buffer','not-observed'] as const;
export type ListedReferenceState=typeof REFERENCE_STATES[number];
export const REFERENCE_STATE_LABELS:Readonly<Record<ListedReferenceState,string>>=Object.freeze({
  scanned:'Fully searched',partial:'Partial lexical evidence','read-failed':'Read unavailable',
  'byte-limit':'Byte budget','ambiguous-buffer':'Ambiguous working buffer','not-observed':'Not observed',
});
export interface ReferenceFileEvidence{
  readonly name:string;
  readonly state:ListedReferenceState;
  readonly origin:InspectionOrigin;
  readonly bytes:number|null;
  readonly reasons:readonly ListedReferenceReason[];
  readonly counts:Readonly<Record<ListedReferenceRole,number>>;
  readonly hits:number;
}
function emptyCounts():Record<ListedReferenceRole,number>{
  return Object.fromEntries(REFERENCE_ROLES.map(role=>[role,0])) as Record<ListedReferenceRole,number>;
}
function unavailable(name:string,state:ListedReferenceState,origin:InspectionOrigin):ReferenceFileEvidence{
  return Object.freeze({name,state,origin,bytes:null,reasons:Object.freeze([]),counts:Object.freeze(emptyCounts()),hits:0});
}
export interface ListedReferenceReport{
  readonly status:'completed'|'cancelled';
  readonly settings:InspectionSettings;
  readonly query:ListedReferenceQuery;
  readonly listed:number;
  readonly selected:number;
  readonly deferred:number;
  readonly excluded:number;
  readonly withheld:number;
  readonly bytes:number;
  readonly hits:readonly ListedReferenceSite[];
  readonly files:readonly ReferenceFileEvidence[];
  readonly counts:Readonly<Record<ListedReferenceRole,number>>;
  readonly complete:boolean;
}
export type ListedReferenceExecution={readonly kind:'report';readonly report:ListedReferenceReport}|{readonly kind:'invalidated'};

export async function executeListedReferences(plan:ListedReferencePlan,documents:readonly StudioDocument[],
  read:(path:string,maxBytes:number)=>Promise<string>,control:InspectionControl):Promise<ListedReferenceExecution>{
  const inspection=plan.inspection;
  const files:ReferenceFileEvidence[]=[];
  const hits:ListedReferenceSite[]=[];
  const counts=emptyCounts();
  let bytes=0;
  const stopped=()=>!control.isCurrent()||control.isCancelled();
  for(const source of inspection.sources){
    if(stopped())break;
    control.onProgress?.({observed:files.length,total:inspection.selected});
    if(stopped())break;
    if(control.yieldBetweenFiles)await control.yieldBetweenFiles();
    if(stopped())break;
    const snapshot=await readInspectionSnapshot(source,documents,inspection.settings.mode,
      INSPECTION_READ_LIMITS.totalBytes-bytes,read,stopped);
    if(snapshot.kind==='stopped')break;
    if(snapshot.kind==='unavailable'){
      files.push(unavailable(source.name,snapshot.state,snapshot.origin));continue;
    }
    bytes+=snapshot.bytes;
    const evidence=scanListedReferenceFile(source.name,snapshot.content,plan.query,MAX_LISTED_REFERENCE_HITS-hits.length);
    const fileCounts=emptyCounts();
    for(const hit of evidence.hits){counts[hit.role]++;fileCounts[hit.role]++;hits.push(hit);}
    files.push(Object.freeze({name:source.name,state:evidence.reasons.length?'partial':'scanned',
      origin:snapshot.origin,bytes:snapshot.bytes,reasons:evidence.reasons,counts:Object.freeze(fileCounts),hits:evidence.hits.length}));
  }
  if(!control.isCurrent())return {kind:'invalidated'};
  const observed=files.length;
  for(const source of inspection.sources.slice(observed))files.push(unavailable(source.name,'not-observed','none'));
  control.onProgress?.({observed,total:inspection.selected});
  if(!control.isCurrent())return {kind:'invalidated'};
  const status=control.isCancelled()?'cancelled':'completed';
  return {kind:'report',report:Object.freeze({
    status,settings:inspection.settings,query:plan.query,listed:inspection.listed,selected:inspection.selected,
    deferred:inspection.deferred,excluded:inspection.excluded,withheld:inspection.withheld,bytes,
    hits:Object.freeze(hits),files:Object.freeze(files),counts:Object.freeze(counts),
    complete:status==='completed'&&!inspection.settings.listingLimited&&!inspection.deferred&&!inspection.withheld&&
      files.every(file=>file.state==='scanned'),
  })};
}
export interface ListedReferenceFilter{
  readonly role:ListedReferenceRole|'all';
  readonly source:string;
  readonly spelling:string;
  readonly order:'source'|'role'|'spelling';
}
export const DEFAULT_REFERENCE_FILTER:ListedReferenceFilter=Object.freeze({
  role:'all',source:'',spelling:'',order:'source',
});
const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;
export function filterListedReferences(report:ListedReferenceReport,filter:ListedReferenceFilter){
  return report.hits.filter(hit=>(filter.role==='all'||hit.role===filter.role)&&
    (!filter.source||hit.source===filter.source)&&(!filter.spelling||hit.token===filter.spelling))
    .sort((a,b)=>(filter.order==='role'?compare(a.role,b.role):filter.order==='spelling'?compare(a.token,b.token):0)||
      compare(a.source,b.source)||a.offset-b.offset);
}
export function groupReferenceSpellings(report:ListedReferenceReport){
  const groups=new Map<string,{token:string;hits:number;files:Set<string>}>();
  for(const hit of report.hits){
    const group=groups.get(hit.token)??{token:hit.token,hits:0,files:new Set<string>()};
    group.hits++;group.files.add(hit.source);groups.set(hit.token,group);
  }
  return [...groups.values()].map(group=>({token:group.token,hits:group.hits,files:group.files.size}))
    .sort((a,b)=>b.hits-a.hits||compare(a.token,b.token));
}
export function pageListedReferences<T>(rows:readonly T[],requested:number){
  const pages=Math.max(1,Math.ceil(rows.length/LISTED_REFERENCE_PAGE));
  const page=Math.min(pages,Math.max(1,Number.isSafeInteger(requested)?requested:1));
  return {page,pages,rows:rows.slice((page-1)*LISTED_REFERENCE_PAGE,page*LISTED_REFERENCE_PAGE)};
}
export function resolveListedReferencePath(report:ListedReferenceReport,hit:ListedReferenceSite,
  listed:readonly ProjectSearchSource[]):string|null{
  if(!report.hits.includes(hit)||!validRelativeLabel(hit.source))return null;
  const matches=buildProjectScopeInventory(listed).sources.filter(source=>source.name===hit.source);
  return matches.length===1?matches[0].path:null;
}
export function recheckListedReference(hit:ListedReferenceSite,document:StudioDocument,path:string){
  if(!document.path||!sameFilePath(document.path,path))return null;
  const scan=scanListedReferenceFile(hit.source,document.content,{identifier:hit.token,caseSensitive:true});
  // A capped scan is conservative: even a retained site must be re-indexed
  // within a complete lexical observation before navigating.
  if(scan.reasons.length)return null;
  const current=scan.hits.find(candidate=>candidate.offset===hit.offset&&candidate.end===hit.end&&
    candidate.role===hit.role&&candidate.line===hit.line&&candidate.column===hit.column);
  return current?{documentId:document.id,revision:document.revision,source:document.content,
    line:current.line,column:current.column}:null;
}
export function listedReferenceReportText(report:ListedReferenceReport,includeLabels=false,includeIdentifier=false):string{
  const lines=[
    'Scarp Studio — listed code identifier references',
    'Literal lexical code-token observations, not semantic resolution or rename authority.',
    'Status: '+report.status,
    'Snapshot mode: '+report.settings.mode,
    'Selected / listed: '+report.selected+' / '+report.listed,
    'Excluded / deferred / withheld: '+report.excluded+' / '+report.deferred+' / '+report.withheld,
    'Coverage: '+(report.complete?'complete for chosen listed scope':'incomplete'),
    'Retained references: '+report.hits.length,
    'Fully searched files: '+report.files.filter(file=>file.state==='scanned').length,
    ...REFERENCE_ROLES.map(role=>REFERENCE_ROLE_LABELS[role]+': '+report.counts[role]),
    'No source contents, previews or native paths included.',
  ];
  if(includeIdentifier)lines.push('Identifier: '+JSON.stringify(report.query.identifier),
    'Match case: '+report.query.caseSensitive,
    ...groupReferenceSpellings(report).map(group=>'Observed spelling '+JSON.stringify(group.token)+': '+group.hits));
  let units=lines.join('\n').length;
  if(includeLabels){
    for(const file of report.files){
      const line=JSON.stringify(file.name)+' — '+REFERENCE_STATE_LABELS[file.state]+'; retained references: '+file.hits;
      if(units+line.length+1>MAX_SCOPE_REPORT_UNITS-100){lines.push('Additional labels omitted due to report size limit.');break;}
      lines.push(line);units+=line.length+1;
    }
  }
  // Spellings are ASCII and at most 128 units each. Bound even the
  // identifier-only opt-in report when many case variants are present.
  if(lines.join('\n').length>MAX_SCOPE_REPORT_UNITS){
    const bounded:string[]=[];let length=0;
    for(const line of lines){
      if(length+line.length+1>MAX_SCOPE_REPORT_UNITS-100){bounded.push('Additional evidence omitted due to report size limit.');break;}
      bounded.push(line);length+=line.length+1;
    }
    return bounded.join('\n');
  }
  return lines.join('\n');
}
