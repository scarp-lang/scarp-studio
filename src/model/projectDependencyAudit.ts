import { isScarpPath,sameFilePath,isDirty,type StudioDocument } from './documents';
import { safeRelativeScarpDirectory,safeRelativeScarpSourceName } from './folderListing';
import { collectScarpRawImports,type SourceImportGraph,type SourceImportNode,type ScarpSourceImport,type ImportStatus } from './sourceImports';
import { selectProjectSearchSources,MAX_PROJECT_SEARCH_FILES,MAX_PROJECT_SEARCH_READ_BYTES,MAX_PROJECT_SEARCH_TOTAL_BYTES,type ProjectSearchSource } from './projectSearch';
import { reviewImportDependencies,type DependencyGraphReview } from './importDependencyReview';
import { assertScarpSourceText } from './sourceLimits';
import { utf8ByteLength,assertWellFormedUtf16 } from './utf8Text';
import type { TestSourceListing } from './projectTestNavigation';

export const MAX_AUDIT_FILES=MAX_PROJECT_SEARCH_FILES;
export const MAX_AUDIT_FILE_BYTES=MAX_PROJECT_SEARCH_READ_BYTES;
export const MAX_AUDIT_TOTAL_BYTES=MAX_PROJECT_SEARCH_TOTAL_BYTES;
export const MAX_AUDIT_EDGES=768;
export const AUDIT_PAGE=12;
export type AuditMode='working'|'saved';
export type AuditFileState='scanned'|'partial'|'unavailable'|'not-scanned';
export type AuditOrigin='open-buffer'|'disk'|'none';
export type AuditEdgeStatus='observed'|'frontier'|'missing'|'outside'|'unrecognized'|'ambiguous'|'self';
export const AUDIT_EDGE_STATUSES:readonly AuditEdgeStatus[]=['observed','frontier','missing','outside','unrecognized','ambiguous','self'];
export const AUDIT_EDGE_LABELS:Readonly<Record<AuditEdgeStatus,string>>=Object.freeze({
  observed:'Target scanned',frontier:'Target listed but not scanned',missing:'Not in bounded listing',
  outside:'Unsupported or outside project',unrecognized:'Unrecognized import header',ambiguous:'Ambiguous listing identity',self:'Self import',
});
export interface AuditFile{
  readonly id:string;
  readonly name:string;
  readonly workspaceName:string;
  readonly path:string;
  readonly state:AuditFileState;
  readonly origin:AuditOrigin;
  readonly dirty:boolean;
  readonly bytes:number|null;
  readonly error:string|null;
}
export interface AuditEdge{
  readonly id:string;
  readonly from:string;
  readonly target:string|null;
  readonly targetLabel:string|null;
  readonly specifier:string|null;
  readonly alias:string|null;
  readonly line:number;
  readonly column:number;
  readonly status:AuditEdgeStatus;
}
export interface ProjectDependencyAudit{
  readonly folder:string;
  readonly listing:TestSourceListing;
  readonly mode:AuditMode;
  readonly files:readonly AuditFile[];
  readonly edges:readonly AuditEdge[];
  readonly dependency:DependencyGraphReview;
  readonly listingLimited:boolean;
  readonly edgeLimited:boolean;
  readonly bytes:number;
  readonly omitted:number;
  readonly counts:Readonly<Record<AuditEdgeStatus,number>>;
}
export type AuditResult={readonly ok:true;readonly audit:ProjectDependencyAudit}|{readonly ok:false;readonly error:string};
interface Candidate extends ProjectSearchSource{
  readonly workspaceName:string;
  readonly id:string;
  readonly ambiguous:boolean;
}
function relativeName(name:string,prefix:string):string|null{
  const value=prefix?name.startsWith(prefix+'/')?name.slice(prefix.length+1):null:name;
  return value!==null&&safeRelativeScarpSourceName(value)?value:null;
}
/** Normalize only a project-relative display label. A literal ../ import
 * inside a manifest root is valid to review, including tests importing src.
 * Never construct or read a native path from the normalized label. */
export function normalizeProjectImportLabel(source:string,specifier:string):string|null{
  if(!safeRelativeScarpSourceName(source)||!specifier||specifier.length>256||
    specifier.startsWith('/')||/[\\:\x00-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/.test(specifier))return null;
  try{assertWellFormedUtf16(specifier,'Import label');}catch{return null;}
  const parts=source.split('/');parts.pop();
  const incoming=specifier.split('/');
  if(incoming.length>16||incoming.some(part=>!part))return null;
  for(const part of incoming){
    if(part==='.')continue;
    if(part==='..'){
      if(!parts.length)return null;
      parts.pop();continue;
    }
    // A label is not a grant. Reject unsupported hidden or reserved path
    // labels through the same Explorer validation as ordinary listings.
    if(part.includes(':')||part.includes('\\'))return null;
    parts.push(part);
  }
  const target=parts.join('/');
  return safeRelativeScarpSourceName(target)?target:null;
}
function candidatesFor(listing:TestSourceListing,folder:string):Candidate[]|null{
  const roots=(listing.projectRoots??[]).filter(root=>sameFilePath(root.path,folder));
  if(roots.length!==1)return null;
  const prefix=roots[0].directory;
  if(prefix&&!safeRelativeScarpDirectory(prefix))return null;
  const candidates:Candidate[]=[];
  for(const [index,file] of listing.files.slice(0,200).entries()){
    const name=relativeName(file.name,prefix);
    if(!name||!isScarpPath(file.path))continue;
    const ambiguous=listing.files.filter(other=>other.name===file.name||sameFilePath(other.path,file.path)).length!==1;
    candidates.push({id:'audit:'+index,name,path:file.path,workspaceName:file.name,ambiguous});
  }
  return candidates;
}
function failed(error:string):AuditResult{return {ok:false,error};}
const edgeStatus:Readonly<Record<AuditEdgeStatus,ImportStatus>>={
  observed:'open',frontier:'listed',missing:'missing',outside:'unsafe',
  unrecognized:'unrecognized',ambiguous:'ambiguous',self:'self',
};
/** Explicit bounded read, either working buffers or disk. Retains only
 * labels, coordinates and graph metadata; no full source text is retained.
 * The existing dependency algorithms operate on observed read snapshots,
 * and the adapter's "open" edges mean scanned nodes in this context.
 */
export async function auditListedProjectDependencies(listing:TestSourceListing,folder:string,mode:AuditMode,
  documents:readonly StudioDocument[],listingLimited:boolean,
  read:(path:string,maxBytes:number)=>Promise<string>,isCurrent:()=>boolean):Promise<AuditResult>{
  const candidates=candidatesFor(listing,folder);
  if(!candidates)return failed('Select a unique discovered manifest root.');
  if(mode!=='working'&&mode!=='saved')return failed('Select a supported source snapshot mode.');
  if(!isCurrent())return failed('Workspace or editor changed before audit.');
  const preferred=mode==='working'?documents.filter(doc=>doc.path!==null&&isDirty(doc)).map(doc=>doc.path!):[];
  const chosen=selectProjectSearchSources(candidates.filter(file=>!file.ambiguous),preferred);
  const selected=new Set(chosen.map(file=>file.path));
  const states=new Map<string,AuditFile>();
  const rawRows:{file:Candidate;raw:ReturnType<typeof collectScarpRawImports>['references']}[]=[];
  let bytes=0;
  function row(file:Candidate,state:AuditFileState,origin:AuditOrigin,dirty:boolean,size:number|null,error:string|null){
    states.set(file.id,Object.freeze({id:file.id,name:file.name,workspaceName:file.workspaceName,path:file.path,state,origin,dirty,bytes:size,error}));
  }
  for(const file of candidates){
    if(file.ambiguous)row(file,'not-scanned','none',false,null,'Ambiguous Explorer label or native path.');
    else if(!selected.has(file.path))row(file,'not-scanned','none',false,null,'Source count budget reached.');
  }
  // Use the fair source selection order for aggregate budget allocation.
  for(const chosenFile of chosen){
    if(!isCurrent())return failed('Workspace or editor changed during audit.');
    const file=candidates.find(candidate=>candidate.path===chosenFile.path)!;
    const open=documents.filter(doc=>doc.path!==null&&sameFilePath(doc.path,file.path));
    const dirty=open.some(isDirty);
    if(open.length>1){row(file,'not-scanned','none',dirty,null,'Ambiguous open buffer identity.');continue;}
    const origin:AuditOrigin=mode==='working'&&open.length===1?'open-buffer':'disk';
    const budget=Math.min(MAX_AUDIT_FILE_BYTES,MAX_AUDIT_TOTAL_BYTES-bytes);
    if(budget<1){row(file,'not-scanned','none',dirty,null,'Aggregate byte budget reached.');continue;}
    try{
      const content=origin==='open-buffer'?open[0].content:await read(file.path,budget);
      if(!isCurrent())return failed('Workspace or editor changed during audit.');
      assertScarpSourceText(content);
      const size=utf8ByteLength(content);
      if(size>budget)throw Error('Source exceeds the remaining audit byte budget.');
      bytes+=size;
      const parsed=collectScarpRawImports(content);
      row(file,parsed.incomplete?'partial':'scanned',origin,dirty,size,
        parsed.incomplete?'Lexical source or import inventory is incomplete.':null);
      rawRows.push({file,raw:parsed.references});
    }catch(error){
      if(!isCurrent())return failed('Workspace or editor changed during audit.');
      row(file,'unavailable',origin,dirty,null,error instanceof Error?error.message:String(error));
    }
  }
  if(!isCurrent())return failed('Workspace or editor changed during audit.');
  const edges:AuditEdge[]=[];
  let edgeLimited=false;
  for(const {file,raw} of rawRows){
    for(const item of raw){
      if(edges.length>=MAX_AUDIT_EDGES){edgeLimited=true;break;}
      const label=item.recognized&&item.specifier!==null?normalizeProjectImportLabel(file.name,item.specifier):null;
      let status:AuditEdgeStatus='unrecognized',target:string|null=null;
      if(item.recognized){
        if(label===null)status='outside';
        else{
          const matching=candidates.filter(candidate=>candidate.name===label);
          if(matching.length>1||matching.some(candidate=>candidate.ambiguous))status='ambiguous';
          else if(matching.length===0)status='missing';
          else{
            target=matching[0].id;
            const state=states.get(target)?.state;
            status=target===file.id?'self':state==='scanned'||state==='partial'?'observed':'frontier';
          }
        }
      }
      edges.push(Object.freeze({id:file.id+':'+item.offset,from:file.id,target,targetLabel:label,
        specifier:item.specifier,alias:item.alias,line:item.line,column:item.column,status}));
    }
  }
  const files=candidates.map(file=>states.get(file.id)!);
  const byId=new Map(files.map(file=>[file.id,file]));
  const counts=Object.fromEntries(AUDIT_EDGE_STATUSES.map(status=>[status,0])) as Record<AuditEdgeStatus,number>;
  const summary:Record<ImportStatus,number>={open:0,listed:0,missing:0,unsafe:0,unrecognized:0,self:0,ambiguous:0};
  const adapted:ScarpSourceImport[]=edges.map(edge=>{
    counts[edge.status]++;summary[edgeStatus[edge.status]]++;
    const from=byId.get(edge.from)!,target=edge.target===null?null:byId.get(edge.target)??null;
    return {id:edge.id,documentId:from.id,documentRevision:0,sourcePath:from.path,sourceName:from.name,
      specifier:edge.specifier??'(unrecognized)',alias:edge.alias,line:edge.line,column:edge.column,offset:0,
      targetRelativeName:edge.targetLabel,targetPath:target?.path??null,targetDocumentId:target?.id??null,
      status:edgeStatus[edge.status],note:null};
  });
  const nodes:SourceImportNode[]=files.filter(file=>file.state==='scanned'||file.state==='partial').map(file=>({
    documentId:file.id,sourceName:file.name,path:file.path,imports:adapted.filter(edge=>edge.documentId===file.id),incomplete:file.state==='partial',
  }));
  const omitted=Math.max(0,listing.files.length-200);
  const graph:SourceImportGraph={nodes,edges:adapted,cycles:[],summary,
    limited:listingLimited||omitted>0||edgeLimited||files.some(file=>file.state!=='scanned')};
  return {ok:true,audit:Object.freeze({folder,listing,mode,files:Object.freeze(files),edges:Object.freeze(edges),
    dependency:reviewImportDependencies(graph),listingLimited,edgeLimited,bytes,omitted,counts:Object.freeze(counts)})};
}
/** Opening a reviewed file goes through original current listing identity.
 * The audit does not authorize old coordinates or disk snapshot edits. */
export function resolveAuditFile(audit:ProjectDependencyAudit,id:string,listing:TestSourceListing|null,folder:string|null):string|null{
  if(!listing||listing!==audit.listing||!folder||!sameFilePath(folder,audit.folder))return null;
  const file=audit.files.find(item=>item.id===id);
  if(!file)return null;
  const matches=listing.files.filter(item=>item.name===file.workspaceName||sameFilePath(item.path,file.path));
  return matches.length===1&&matches[0].name===file.workspaceName&&sameFilePath(matches[0].path,file.path)?matches[0].path:null;
}
export interface AuditFilter{readonly query:string;readonly status:AuditEdgeStatus|'all';readonly file:string|'all'}
export function filterAuditEdges(audit:ProjectDependencyAudit,filter:AuditFilter):AuditEdge[]{
  const names=new Map(audit.files.map(file=>[file.id,file.name]));
  const terms=filter.query.slice(0,120).trim().toLowerCase().split(/\s+/).filter(Boolean);
  return audit.edges.filter(edge=>(filter.status==='all'||edge.status===filter.status)&&
    (filter.file==='all'||edge.from===filter.file)&&terms.every(term=>
      [names.get(edge.from),edge.specifier,edge.alias,edge.targetLabel].some(value=>value?.toLowerCase().includes(term))));
}
export function auditSummary(audit:ProjectDependencyAudit,includeLabels=false){
  const lines=['Scarp Studio — bounded listed project dependency audit',
    'Source mode: '+audit.mode+'; lexical hints, not compiler resolution or build order.',
    'Listed sources: '+audit.files.length+'; bytes scanned: '+audit.bytes,
    'Coverage: '+(audit.dependency.incomplete?'incomplete or unresolved frontier':'observed listed sources scanned'),
    'Cyclic groups: '+audit.dependency.components.filter(component=>component.cyclic).length];
  for(const status of AUDIT_EDGE_STATUSES)lines.push(AUDIT_EDGE_LABELS[status]+': '+audit.counts[status]);
  for(const state of ['scanned','partial','unavailable','not-scanned'] as const)
    lines.push(state+': '+audit.files.filter(file=>file.state===state).length);
  if(includeLabels)for(const file of audit.files)lines.push(JSON.stringify(file.name)+' | '+file.state+' | '+file.origin);
  return lines.join('\n').slice(0,64*1024);
}
