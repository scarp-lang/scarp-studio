import { isDirty,sameFilePath,type StudioDocument } from './documents';
import { projectOpenSourceDocuments } from './projectSourceState';
import { isUnchangedSnapshot } from './editorState';
import { utf8ByteLength } from './utf8Text';
import { MAX_SCARP_SOURCE_BYTES } from './sourceLimits';
import type { ProjectResultFreshness } from './resultFreshness';

export const MAX_PROJECT_COMMAND_CHECK_FILES=32;
export const MAX_PROJECT_COMMAND_CHECK_BYTES=8*1024*1024;
export interface ProjectCommandDiskPlan{
  readonly folder:string;
  readonly sources:readonly StudioDocument[];
  readonly expectedBytes:number;
}
export type ProjectCommandDiskStatus='matched'|'changed'|'unavailable'|'cancelled';
export interface ProjectCommandDiskRow{
  readonly id:string;
  readonly name:string;
  readonly status:ProjectCommandDiskStatus;
}
export interface ProjectCommandDiskReview{
  readonly status:ProjectCommandDiskStatus;
  readonly checked:number;
  readonly total:number;
  readonly rows:readonly ProjectCommandDiskRow[];
}
export type DiskGuardResult<T>={readonly ok:true;readonly value:T}|{readonly ok:false;readonly error:string};
const fail=(error:string):DiskGuardResult<never>=>({ok:false,error});
/** Take an exact inventory of already-open saved source buffers. Do not walk
 * the directory, read closed imports, infer native paths or retain more text
 * than the editor already owns. An over-budget set is reported before launch. */
export function planProjectCommandDiskCheck(documents:readonly StudioDocument[],folder:string):DiskGuardResult<ProjectCommandDiskPlan>{
  const sources=projectOpenSourceDocuments(documents,folder);
  if(sources.length>MAX_PROJECT_COMMAND_CHECK_FILES)return fail('Open project source count exceeds the disk check budget. Close some clean tabs before running the project command.');
  let expectedBytes=0;
  for(const [index,source] of sources.entries()){
    if(isDirty(source))return fail('Save modified project source files before checking disk.');
    if(sources.slice(0,index).some(previous=>sameFilePath(previous.path!,source.path!)))
      return fail('Duplicate open project source identity. Review the open tabs.');
    const bytes=utf8ByteLength(source.savedContent);
    if(bytes>MAX_SCARP_SOURCE_BYTES)return fail('An open source exceeds the file check budget.');
    expectedBytes+=bytes;
    if(expectedBytes>MAX_PROJECT_COMMAND_CHECK_BYTES)
      return fail('Open project sources exceed the aggregate disk check budget. Close some clean tabs before running.');
  }
  return {ok:true,value:Object.freeze({folder,sources:Object.freeze(sources.map(source=>Object.freeze({...source}))),expectedBytes})};
}
/** An edit, Save As, close, or new in-project tab invalidates this exact
 * plan. Focus changes and unrelated buffers are not part of the disk check. */
export function projectCommandDiskPlanCurrent(plan:ProjectCommandDiskPlan,documents:readonly StudioDocument[]):boolean{
  const current=projectOpenSourceDocuments(documents,plan.folder);
  return current.length===plan.sources.length&&plan.sources.every(source=>{
    const candidate=current.find(document=>document.id===source.id);
    return !!candidate&&isUnchangedSnapshot(candidate,source)&&!isDirty(candidate);
  });
}
/** Compare exact decoded UTF-8 text; no filesystem writes or wider scope.
 * Bound each read to the expected saved bytes plus one (capped at the source
 * limit), so unexpected growth cannot exhaust the check budget. The extra
 * byte per source is included only in read limits, not retained in a report.
 * A read failure is not evidence that the file is unchanged. */
export async function checkProjectCommandDisk(plan:ProjectCommandDiskPlan,
  read:(path:string,maxBytes:number)=>Promise<string>,isCurrent:()=>boolean):Promise<ProjectCommandDiskReview>{
  const rows:ProjectCommandDiskRow[]=[];
  function finish(status:ProjectCommandDiskStatus):ProjectCommandDiskReview{
    return Object.freeze({status,checked:rows.length,total:plan.sources.length,rows:Object.freeze(rows.slice())});
  }
  if(!isCurrent())return finish('cancelled');
  for(const source of plan.sources){
    if(!isCurrent())return finish('cancelled');
    const limit=Math.max(1,Math.min(MAX_SCARP_SOURCE_BYTES,utf8ByteLength(source.savedContent)+1));
    let status:ProjectCommandDiskStatus;
    try{
      const content=await read(source.path!,limit);
      if(!isCurrent())return finish('cancelled');
      status=content===source.savedContent?'matched':'changed';
    }catch{
      if(!isCurrent())return finish('cancelled');
      status='unavailable';
    }
    rows.push(Object.freeze({id:source.id,name:source.name,status}));
    if(status!=='matched')return finish(status);
  }
  return isCurrent()?finish('matched'):finish('cancelled');
}
export function projectDiskCheckMessage(review:ProjectCommandDiskReview,phase:'before'|'after'):string|null{
  if(review.status==='matched')return null;
  const last=review.rows.at(-1);
  const timing=phase==='before'?'Project command was not launched.':'Project output remains historical; structured results are withheld.';
  if(review.status==='cancelled')return 'Project source check was interrupted by an editor, selection or stop change. '+timing;
  if(review.status==='changed')return 'Open project source differs from its saved editor baseline: '+(last?.name??'unknown source')+'. Review external disk changes. '+timing;
  return 'Could not verify an open project source against disk: '+(last?.name??'unknown source')+
    '. It may be missing, unreadable or larger than its reviewed byte budget. '+timing;
}
/** Preserve the native command outcome while disabling fresh structured
 * results when the post-command consistency check cannot be completed. */
export function applyProjectDiskFreshness(freshness:ProjectResultFreshness,review:ProjectCommandDiskReview|null):ProjectResultFreshness{
  if(!review||review.status==='matched')return freshness;
  const warning=projectDiskCheckMessage(review,'after');
  return {stale:true,allowStructuredTests:false,warning:[freshness.warning,warning].filter(Boolean).join('\n')};
}
export interface ProjectDiskCheckEvidence{
  readonly folder:string;
  readonly before:ProjectCommandDiskReview|null;
  readonly after:ProjectCommandDiskReview|null;
}
