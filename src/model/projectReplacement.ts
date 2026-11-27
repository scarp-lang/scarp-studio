import { isScarpPath, sameFilePath, type StudioDocument } from './documents';
import { safeRelativeScarpSourceName } from './folderListing';
import { searchOpenFiles, type SearchOptions } from './openFileSearch';
import { sameOpenDocumentSnapshots, type EditorState, type BufferReplacement } from './editorState';
import { MAX_PROJECT_SEARCH_READ_BYTES, MAX_PROJECT_SEARCH_TOTAL_BYTES, type ProjectSearchHit,
  type ProjectSearchResult, type ProjectSearchSource } from './projectSearch';
import { MAX_REPLACEMENT_TEXT_UNITS } from './openFileReplace';
import { assertScarpSourceText } from './sourceLimits';
import { assertWellFormedUtf16, utf8ByteLength, unicodeSafePreviewBounds } from './utf8Text';

export const MAX_PROJECT_REPLACEMENT_FILES=12;
export const MAX_PROJECT_REPLACEMENT_HITS=120;
export const PROJECT_REPLACEMENT_PAGE=10;
export interface ReplacementRequest {
  readonly query:string;
  readonly replacement:string;
  readonly options:SearchOptions;
  readonly selected:readonly number[];
}
export interface SelectedProjectOccurrence {
  readonly index:number;
  readonly hit:ProjectSearchHit;
  readonly before:string;
  readonly after:string;
}
export interface StagedSource {
  readonly path:string;
  readonly name:string;
  readonly content:string;
  readonly existing:StudioDocument|null;
  readonly indices:readonly number[];
}
export interface ProjectReplacementInventory {
  readonly result:ProjectSearchResult;
  readonly request:ReplacementRequest;
  readonly sources:readonly StagedSource[];
  readonly occurrences:readonly SelectedProjectOccurrence[];
  readonly sessionRevision:number;
  readonly snapshots:readonly StudioDocument[];
}
export interface ProjectReplacementPlan {
  readonly inventory:ProjectReplacementInventory;
  readonly sessionRevision:number;
  readonly snapshots:readonly StudioDocument[];
  readonly changes:readonly BufferReplacement[];
}
export type ReplacementResult<T>={readonly ok:true;readonly value:T}|{readonly ok:false;readonly error:string};
const fail=(error:string):ReplacementResult<never>=>({ok:false,error});
export function replacementTextError(query:string,replacement:string):string|null{
  if(!query||query.length>120||/[\r\n]/.test(query))return 'Enter a single-line search term of 1–120 characters.';
  if(replacement.length>MAX_REPLACEMENT_TEXT_UNITS||/[\r\n]/.test(replacement))return 'Replacement must be one line and at most 256 characters.';
  try{
    assertWellFormedUtf16(query,'Search term');assertWellFormedUtf16(replacement,'Replacement');
  }catch{return 'Search and replacement must contain well-formed Unicode.';}
  if(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/.test(replacement)){
    return 'Replacement contains invisible controls or directional formatting.';
  }
  return null;
}
export function visibleProjectReplacementText(text:string):string{
  return JSON.stringify(text).replace(/[\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,
    char=>'\\u'+char.charCodeAt(0).toString(16).padStart(4,'0'));
}
function sameHit(a:ProjectSearchHit['match'],b:ProjectSearchHit['match']):boolean{
  return a.offset===b.offset&&a.matchText===b.matchText&&a.line===b.line&&a.column===b.column;
}
function exactListedSource(listed:readonly ProjectSearchSource[],hit:ProjectSearchHit):ProjectSearchSource|null{
  const matches=listed.filter(source=>source.name===hit.name&&sameFilePath(source.path,hit.path));
  if(matches.length!==1||!safeRelativeScarpSourceName(matches[0].name)||!isScarpPath(matches[0].path))return null;
  if(listed.filter(source=>source.name===matches[0].name||sameFilePath(source.path,matches[0].path)).length!==1)return null;
  return matches[0];
}
function context(hit:ProjectSearchHit,replacement:string){
  const {offset,matchText,sourceContent}=hit.match;
  const bounds=unicodeSafePreviewBounds(sourceContent,Math.max(0,offset-35),
    Math.min(sourceContent.length,offset+matchText.length+35));
  const prefix=sourceContent.slice(bounds.start,offset),suffix=sourceContent.slice(offset+matchText.length,bounds.end);
  return {before:visibleProjectReplacementText(prefix+matchText+suffix),
    after:visibleProjectReplacementText(prefix+replacement+suffix)};
}
/** Stage only explicitly selected visible occurrences. A truncated search
 * never means Replace All: absent matches and omitted files are not modified.
 * Selected paths must map uniquely to the current native Explorer listing.
 * Matching coordinates are recomputed from their complete original text. */
export function prepareProjectReplacement(result:ProjectSearchResult,request:ReplacementRequest,
  listed:readonly ProjectSearchSource[],editor:EditorState):ReplacementResult<ProjectReplacementInventory>{
  const error=replacementTextError(request.query,request.replacement);
  if(error)return fail(error);
  if(result.error)return fail('Run a successful workspace search first.');
  if(!request.selected.length||request.selected.length>MAX_PROJECT_REPLACEMENT_HITS||
    new Set(request.selected).size!==request.selected.length)return fail('Select 1–120 distinct displayed occurrences.');
  const sources:{path:string;name:string;content:string;existing:StudioDocument|null;indices:number[]}[]=[];
  const occurrences:SelectedProjectOccurrence[]=[];
  let bytes=0;
  for(const index of [...request.selected].sort((a,b)=>a-b)){
    if(!Number.isSafeInteger(index)||index<0||index>=result.hits.length)return fail('A selected occurrence no longer exists.');
    const hit=result.hits[index],source=exactListedSource(listed,hit);
    if(!source)return fail('A selected source is not uniquely present in the current Explorer listing.');
    if(hit.match.matchText===request.replacement)continue;
    let group=sources.find(item=>sameFilePath(item.path,source.path));
    if(!group){
      if(sources.length>=MAX_PROJECT_REPLACEMENT_FILES)return fail('Select occurrences in at most 12 files.');
      const content=hit.match.sourceContent;
      try{assertScarpSourceText(content);}catch{return fail('Selected source contains unsupported text.');}
      const size=utf8ByteLength(content);bytes+=size;
      if(size>MAX_PROJECT_SEARCH_READ_BYTES||bytes>MAX_PROJECT_SEARCH_TOTAL_BYTES)return fail('Selected source snapshots exceed the staging budget.');
      const open=editor.documents.filter(doc=>doc.path!==null&&sameFilePath(doc.path,source.path));
      if(open.length>1)return fail('A selected path has ambiguous editor identities.');
      const existing=open[0]??null;
      if(hit.fromOpenTab&&(!existing||existing.id!==hit.match.documentId||existing.revision!==hit.match.sourceRevision)){
        return fail('An originally open source changed or closed. Search again.');
      }
      if(existing&&existing.content!==content)return fail('A selected open source changed. Search again.');
      group={path:source.path,name:source.name,content,existing,indices:[]};
      sources.push(group);
    }
    if(group.content!==hit.match.sourceContent)return fail('Selected occurrences refer to different snapshots of one file.');
    if(group.indices.some(i=>result.hits[i].match.offset===hit.match.offset))return fail('The same source occurrence was selected twice.');
    group.indices.push(index);
    occurrences.push(Object.freeze({index,hit,...context(hit,request.replacement)}));
  }
  if(!sources.length)return fail('No selected occurrence would change.');
  for(const source of sources){
    const document:StudioDocument=source.existing??{id:'review',name:source.name,path:source.path,
      content:source.content,savedContent:source.content,revision:0};
    const fresh=searchOpenFiles([document],request.query,request.options);
    // An incomplete per-file search can still prove individual visible
    // matches, but may not prove absent sites. Never apply a missing hit.
    if(fresh.error||source.indices.some(index=>!fresh.hits.some(hit=>sameHit(hit,result.hits[index].match)))){
      return fail('A selected occurrence does not match the original literal search. Search again.');
    }
  }
  return {ok:true,value:Object.freeze({result,request:Object.freeze({...request,options:Object.freeze({...request.options}),
    selected:Object.freeze([...request.selected])}),sources:Object.freeze(sources.map(source=>Object.freeze({...source,
      existing:source.existing?Object.freeze({...source.existing}):null,indices:Object.freeze([...source.indices])}))),
    occurrences:Object.freeze(occurrences),sessionRevision:editor.sessionRevision,
    snapshots:Object.freeze(editor.documents.map(doc=>Object.freeze({...doc})))})};
}
export function projectReplacementInventoryIsCurrent(inventory:ProjectReplacementInventory,editor:EditorState):boolean{
  return inventory.sessionRevision===editor.sessionRevision&&sameOpenDocumentSnapshots(inventory.snapshots,editor.documents);
}
/** Read only selected unopened files. A mismatch or read failure aborts
 * the entire batch before any editor mutation. This is a bounded read
 * review, not an OS-level filesystem transaction. Save will independently
 * check external edits before writing a named source. */
export async function readProjectReplacementSources(inventory:ProjectReplacementInventory,
  read:(path:string,maxBytes:number)=>Promise<string>,isCurrent:()=>boolean):Promise<ReplacementResult<readonly {path:string;content:string}[]>>{
  const opened:{path:string;content:string}[]=[];
  let bytes=0;
  for(const source of inventory.sources){
    if(!isCurrent())return fail('Workspace or editor changed during staging.');
    if(source.existing)continue;
    const limit=Math.min(MAX_PROJECT_SEARCH_READ_BYTES,MAX_PROJECT_SEARCH_TOTAL_BYTES-bytes);
    try{
      const content=await read(source.path,limit);
      if(!isCurrent())return fail('Workspace or editor changed during staging.');
      assertScarpSourceText(content);
      const size=utf8ByteLength(content);bytes+=size;
      if(size>limit||content!==source.content)return fail('A selected file changed on disk or exceeded its read budget. Search again.');
      opened.push({path:source.path,content});
    }catch{return fail('A selected source could not be reread. No buffers were changed.');}
  }
  return isCurrent()?{ok:true,value:Object.freeze(opened)}:fail('Workspace or editor changed during staging.');
}
/** The editor may now include the staged clean files. Recompute every
 * selected span against those actual buffers; never trust a preview
 * replacement string. Unselected buffers and occurrences stay untouched. */
export function planStagedProjectReplacement(inventory:ProjectReplacementInventory,editor:EditorState):ReplacementResult<ProjectReplacementPlan>{
  const changes:BufferReplacement[]=[];
  for(const source of inventory.sources){
    const matches=editor.documents.filter(doc=>doc.path!==null&&sameFilePath(doc.path,source.path));
    if(matches.length!==1)return fail('Staged source is not uniquely open.');
    const document=matches[0];
    if(document.content!==source.content)return fail('Staged source changed before preview.');
    if(source.existing&&!sameOpenDocumentSnapshots([source.existing],[document]))return fail('An existing tab changed before preview.');
    if(!source.existing&&(document.savedContent!==source.content||document.recoveredDraft!==undefined))return fail('A staged file is not a clean disk snapshot.');
    const fresh=searchOpenFiles([document],inventory.request.query,inventory.request.options);
    if(fresh.error)return fail(fresh.error);
    const hits=source.indices.map(index=>inventory.result.hits[index].match).sort((a,b)=>a.offset-b.offset);
    const chunks:string[]=[];let cursor=0;
    for(const hit of hits){
      if(hit.offset<cursor||!fresh.hits.some(match=>sameHit(hit,match)))return fail('Selected source coordinates are stale.');
      chunks.push(document.content.slice(cursor,hit.offset),inventory.request.replacement);
      cursor=hit.offset+hit.matchText.length;
    }
    chunks.push(document.content.slice(cursor));
    const content=chunks.join('');
    try{assertScarpSourceText(content);}catch{return fail('Replacement would exceed editor source bounds.');}
    if(content!==document.content)changes.push(Object.freeze({id:document.id,snapshot:Object.freeze({...document}),content}));
  }
  if(!changes.length)return fail('No selected source would change.');
  return {ok:true,value:Object.freeze({inventory,sessionRevision:editor.sessionRevision,
    snapshots:Object.freeze(editor.documents.map(doc=>Object.freeze({...doc}))),changes:Object.freeze(changes)})};
}
export function stagedProjectReplacementIsCurrent(plan:ProjectReplacementPlan,editor:EditorState):boolean{
  if(plan.sessionRevision!==editor.sessionRevision||!sameOpenDocumentSnapshots(plan.snapshots,editor.documents))return false;
  const fresh=planStagedProjectReplacement(plan.inventory,editor);
  return fresh.ok&&fresh.value.changes.length===plan.changes.length&&fresh.value.changes.every((change,i)=>
    change.id===plan.changes[i].id&&change.content===plan.changes[i].content&&
    sameOpenDocumentSnapshots([change.snapshot],[plan.changes[i].snapshot]));
}
