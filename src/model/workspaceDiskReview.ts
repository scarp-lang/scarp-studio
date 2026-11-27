import { isDirty, isScarpPath, sameFilePath, type StudioDocument } from './documents';
import { inspectDiskSnapshot, type DiskReview } from './diskReview';
import { hasUnchangedEditorSession, isUnchangedSnapshot, sameOpenDocumentSnapshots,
  type EditorState, type BufferReplacement } from './editorState';
import { assertScarpSourceText, MAX_SCARP_SOURCE_BYTES } from './sourceLimits';
import { utf8ByteLength } from './utf8Text';

export const MAX_DISK_REVIEW_FILES = 24;
export const MAX_DISK_REVIEW_BYTES = 8 * 1024 * 1024;
export type DiskReviewReader = (path:string, maxBytes:number)=>Promise<string>;

export type WorkspaceDiskRow =
  | { kind:'read'; snapshot:StudioDocument; diskContent:string; report:DiskReview }
  | { kind:'unavailable'; snapshot:StudioDocument; error:string }
  | { kind:'skipped'; snapshot:StudioDocument; reason:string };

export interface WorkspaceDiskReview {
  readonly sessionRevision:number;
  readonly activeId:string|null;
  readonly snapshots:readonly StudioDocument[];
  readonly rows:readonly WorkspaceDiskRow[];
  readonly omitted:number;
  readonly bytes:number;
}

export type WorkspaceDiskResult<T> =
  | { ok:true; value:T }
  | { ok:false; error:string };
const failed = (error:string):WorkspaceDiskResult<never>=>({ok:false,error});
const snapshotOf=(document:StudioDocument):StudioDocument=>Object.freeze({...document});

export function workspaceDiskReviewCurrent(review:WorkspaceDiskReview,editor:EditorState):boolean{
  return review.sessionRevision===editor.sessionRevision&&review.activeId===editor.activeId&&
    sameOpenDocumentSnapshots(review.snapshots,editor.documents);
}

export function diskReviewCandidates(documents:readonly StudioDocument[]):StudioDocument[]{
  // Only already-open .srp paths are read; no recursive filesystem discovery.
  return documents.filter(document=>document.path!==null&&isScarpPath(document.path));
}

export function canReloadReviewedDiskRow(row:WorkspaceDiskRow):row is Extract<WorkspaceDiskRow,{kind:'read'}>{
  return row.kind==='read'&&row.snapshot.path!==null&&!isDirty(row.snapshot)&&
    row.report.status==='external-change'&&row.diskContent!==row.snapshot.savedContent;
}

export function summarizeWorkspaceDiskReview(review:WorkspaceDiskReview){
  let unchanged=0,changed=0,conflicts=0,matching=0,unavailable=0,skipped=review.omitted,eligible=0;
  for(const row of review.rows){
    if(row.kind==='unavailable'){unavailable++;continue;}
    if(row.kind==='skipped'){skipped++;continue;}
    switch(row.report.status){
      case 'unchanged':unchanged++;break;
      case 'external-change':changed++;break;
      case 'conflict':conflicts++;break;
      case 'disk-matches-editor':matching++;break;
    }
    if(canReloadReviewedDiskRow(row))eligible++;
  }
  return {unchanged,changed,conflicts,matching,unavailable,skipped,eligible};
}

/** Explicit read-only operation. Retain exact source snapshots so review
 * cannot authorize a subsequent reload of different disk or editor text.
 * Per-file and aggregate budgets apply to actual decoded UTF-8 bytes. */
export async function inspectWorkspaceDisk(
  editor:EditorState,read:DiskReviewReader,isCurrent:()=>boolean,
):Promise<WorkspaceDiskResult<WorkspaceDiskReview>>{
  if(!isCurrent())return failed('Editor changed before disk review.');
  const snapshots=Object.freeze(editor.documents.map(snapshotOf));
  const candidates=diskReviewCandidates(snapshots);
  const rows:WorkspaceDiskRow[]=[];
  let bytes=0;
  for(const snapshot of candidates.slice(0,MAX_DISK_REVIEW_FILES)){
    if(!isCurrent())return failed('Editor changed during disk review. Scan again.');
    // Two aliased paths would make selection ambiguous; report both instead.
    if(candidates.some(other=>other.id!==snapshot.id&&sameFilePath(other.path!,snapshot.path!))){
      rows.push(Object.freeze({kind:'skipped',snapshot,reason:'Another open tab has the same file path.'}));
      continue;
    }
    const remaining=Math.min(MAX_SCARP_SOURCE_BYTES,MAX_DISK_REVIEW_BYTES-bytes);
    if(remaining<1){
      rows.push(Object.freeze({kind:'skipped',snapshot,reason:'Disk review byte budget reached.'}));
      continue;
    }
    try{
      const diskContent=await read(snapshot.path!,remaining);
      if(!isCurrent())return failed('Editor changed during disk review. Scan again.');
      assertScarpSourceText(diskContent);
      const size=utf8ByteLength(diskContent);
      if(size>remaining)throw Error('Disk source exceeds remaining review budget.');
      bytes+=size;
      rows.push(Object.freeze({kind:'read',snapshot,diskContent,report:Object.freeze(inspectDiskSnapshot(snapshot,diskContent))}));
    }catch(error){
      if(!isCurrent())return failed('Editor changed during disk review. Scan again.');
      rows.push(Object.freeze({kind:'unavailable',snapshot,error:error instanceof Error?error.message:String(error)}));
    }
  }
  if(!isCurrent())return failed('Editor changed during disk review. Scan again.');
  return {ok:true,value:Object.freeze({sessionRevision:editor.sessionRevision,activeId:editor.activeId,
    snapshots,rows:Object.freeze(rows),omitted:Math.max(0,candidates.length-MAX_DISK_REVIEW_FILES),bytes})};
}

/** The first scan is never sufficient to reload: every selected disk
 * snapshot must be independently reread and match the exact reviewed
 * bytes. Abort the entire batch for one changed or unavailable source. */
export async function prepareWorkspaceDiskReload(
  review:WorkspaceDiskReview,selectedIds:readonly string[],editor:EditorState,
  read:DiskReviewReader,isCurrent:()=>boolean,
):Promise<WorkspaceDiskResult<readonly BufferReplacement[]>>{
  if(!workspaceDiskReviewCurrent(review,editor)||!isCurrent())return failed('Disk review is stale. Scan again.');
  if(!selectedIds.length||selectedIds.length>MAX_DISK_REVIEW_FILES||
      new Set(selectedIds).size!==selectedIds.length)return failed('Select unique clean changed files.');
  const selected:Extract<WorkspaceDiskRow,{kind:'read'}>[]=[];
  let bytes=0;
  for(const id of selectedIds){
    const row=review.rows.find(candidate=>candidate.snapshot.id===id);
    const actual=editor.documents.find(document=>document.id===id);
    if(!row||!actual||!isUnchangedSnapshot(actual,row.snapshot)||!canReloadReviewedDiskRow(row)){
      return failed('Only unchanged clean editor tabs with reviewed external changes can reload.');
    }
    try{
      assertScarpSourceText(row.diskContent);
      bytes+=utf8ByteLength(row.diskContent);
      if(bytes>MAX_DISK_REVIEW_BYTES)throw Error('Reload exceeds review byte budget.');
    }catch(error){return failed(error instanceof Error?error.message:String(error));}
    selected.push(row);
  }
  const changes:BufferReplacement[]=[];
  let readBytes=0;
  for(const row of selected){
    if(!isCurrent())return failed('Editor changed during reload verification.');
    try{
      const content=await read(row.snapshot.path!,Math.min(MAX_SCARP_SOURCE_BYTES,MAX_DISK_REVIEW_BYTES-readBytes));
      if(!isCurrent())return failed('Editor changed during reload verification.');
      if(content!==row.diskContent)return failed(row.snapshot.name+' changed again on disk. Scan again; nothing was reloaded.');
      assertScarpSourceText(content);
      readBytes+=utf8ByteLength(content);
      if(readBytes>MAX_DISK_REVIEW_BYTES)throw Error('Reload exceeds review byte budget.');
      changes.push({id:row.snapshot.id,snapshot:row.snapshot,content});
    }catch(error){
      return failed('Could not recheck '+row.snapshot.name+': '+(error instanceof Error?error.message:String(error)));
    }
  }
  if(!isCurrent())return failed('Editor changed during reload verification.');
  return {ok:true,value:Object.freeze(changes)};
}

/** Keep native reads tied to the exact immutable editor session. */
export function diskOperationCurrent(start:EditorState,current:EditorState):boolean{
  return hasUnchangedEditorSession(start,current)&&sameOpenDocumentSnapshots(start.documents,current.documents);
}
