import { isDirty,isScarpPath,type StudioDocument } from './documents';
import { sameOpenDocumentSnapshots,isUnchangedSnapshot,type EditorState } from './editorState';
import { exactSnapshotEditBlocks,MAX_DIFF_SOURCE_UNITS,type SnapshotEditBlock } from './sourceDiff';
import { assertScarpSourceText } from './sourceLimits';
import { assertWellFormedUtf16,utf8ByteLength } from './utf8Text';

export const MAX_RECONCILIATION_GROUPS=64;
export const MAX_RECONCILIATION_GROUP_UNITS=8192;
export const MAX_RECONCILIATION_PREVIEW_UNITS=96*1024;
export const MAX_RECONCILIATION_READ_BYTES=2*1024*1024;
export type ReconciliationKind='local-only'|'disk-only'|'identical'|'conflict';
export type ResolutionKind='local'|'disk'|'base'|'manual';
export interface ReconciliationResolution{
  readonly id:number;
  readonly choice:ResolutionKind;
  readonly manual?:string;
}
export interface ReconciliationGroup{
  readonly id:number;
  readonly start:number;
  readonly end:number;
  readonly baseLine:number;
  readonly base:string;
  readonly local:string;
  readonly disk:string;
  readonly kind:ReconciliationKind;
}
export interface DiskReconciliationReview{
  readonly snapshot:StudioDocument;
  readonly diskContent:string;
  readonly sessionRevision:number;
  readonly snapshots:readonly StudioDocument[];
  readonly groups:readonly ReconciliationGroup[];
}
export interface DiskReconciliationPlan{
  readonly review:DiskReconciliationReview;
  readonly resolutions:readonly ReconciliationResolution[];
  readonly content:string;
  readonly diskContent:string;
}
export type ReconciliationResult<T>={readonly ok:true;readonly value:T}|{readonly ok:false;readonly error:string};
const fail=(error:string):ReconciliationResult<never>=>({ok:false,error});
interface Edit{
  readonly side:'local'|'disk';
  readonly block:SnapshotEditBlock;
  readonly replacement:string;
}
function edits(base:string,other:string,side:Edit['side']):ReconciliationResult<Edit[]>{
  const exact=exactSnapshotEditBlocks(base,other);
  if(!exact.ok)return exact;
  const result=exact.blocks.map(block=>({side,block,replacement:other.slice(block.afterStart,block.afterEnd)}));
  // Verify the complete edit sequence reconstructs the original snapshot,
  // not a lossy display preview or partial LCS output.
  const reconstructed=applyEdits(base,0,base.length,result);
  if(reconstructed===null||reconstructed!==other)return fail('Exact source changes could not be reconstructed.');
  return {ok:true,value:result};
}
function applyEdits(base:string,start:number,end:number,changes:readonly Edit[]):string|null{
  let cursor=start;
  const chunks:string[]=[];
  for(const change of changes){
    const {beforeStart,beforeEnd}=change.block;
    if(beforeStart<cursor||beforeEnd<beforeStart||beforeEnd>end)return null;
    chunks.push(base.slice(cursor,beforeStart),change.replacement);
    cursor=beforeEnd;
  }
  chunks.push(base.slice(cursor,end));
  return chunks.join('');
}
/** A line-based, exact three-way review. Changes are grouped by touching
 * base spans, including insertions at the same boundary and adjacent edits.
 * Treat adjacency conservatively as one decision rather than assume that
 * mixed line endings or interacting deletions can be merged independently.
 * This is not a Scarp semantic merge and does not write conflict markers. */
export function buildReconciliationGroups(base:string,local:string,disk:string):ReconciliationResult<readonly ReconciliationGroup[]>{
  for(const text of [base,local,disk]){
    if(text.length>MAX_DIFF_SOURCE_UNITS)return fail('Three-way review is limited to 512 Ki UTF-16 units per snapshot.');
    try{assertScarpSourceText(text);}catch{return fail('Source contains invalid or oversized text.');}
  }
  const left=edits(base,local,'local'),right=edits(base,disk,'disk');
  if(!left.ok)return left;if(!right.ok)return right;
  const changes=[...left.value,...right.value].sort((a,b)=>a.block.beforeStart-b.block.beforeStart||
    a.block.beforeEnd-b.block.beforeEnd||(a.side==='local'?-1:1));
  const regions:{start:number;end:number;line:number;changes:Edit[]}[]=[];
  for(const change of changes){
    const {beforeStart:start,beforeEnd:end,beforeLine:line}=change.block;
    const last=regions.at(-1);
    if(last&&start<=last.end){
      last.end=Math.max(last.end,end);last.changes.push(change);
    }else regions.push({start,end,line,changes:[change]});
  }
  if(regions.length>MAX_RECONCILIATION_GROUPS)return fail('Too many changed regions for a complete three-way review.');
  let units=0;
  const groups:ReconciliationGroup[]=[];
  for(const region of regions){
    const original=base.slice(region.start,region.end);
    const localEdits=region.changes.filter(change=>change.side==='local');
    const diskEdits=region.changes.filter(change=>change.side==='disk');
    const localText=applyEdits(base,region.start,region.end,localEdits);
    const diskText=applyEdits(base,region.start,region.end,diskEdits);
    if(localText===null||diskText===null)return fail('Overlapping changes on one side could not be reviewed.');
    units+=original.length+localText.length+diskText.length;
    if([original,localText,diskText].some(text=>text.length>MAX_RECONCILIATION_GROUP_UNITS)||
      units>MAX_RECONCILIATION_PREVIEW_UNITS)return fail('Changed text exceeds the complete three-way preview budget.');
    const kind:ReconciliationKind=localText===diskText?'identical':
      localText===original?'disk-only':diskText===original?'local-only':'conflict';
    groups.push(Object.freeze({id:groups.length+1,start:region.start,end:region.end,baseLine:region.line,
      base:original,local:localText,disk:diskText,kind}));
  }
  return {ok:true,value:Object.freeze(groups)};
}
export function createDiskReconciliationReview(editor:EditorState,snapshot:StudioDocument,diskContent:string):ReconciliationResult<DiskReconciliationReview>{
  const actual=editor.documents.find(doc=>doc.id===snapshot.id);
  if(!actual||editor.activeId!==snapshot.id||!isUnchangedSnapshot(actual,snapshot)||
    !snapshot.path||!isScarpPath(snapshot.path)||!isDirty(snapshot))return fail('Choose the same dirty, file-backed active source.');
  if(diskContent===snapshot.savedContent)return fail('The saved disk baseline is unchanged. No external reconciliation is needed.');
  const groups=buildReconciliationGroups(snapshot.savedContent,snapshot.content,diskContent);
  if(!groups.ok)return groups;
  return {ok:true,value:Object.freeze({snapshot:Object.freeze({...snapshot}),diskContent,
    sessionRevision:editor.sessionRevision,snapshots:Object.freeze(editor.documents.map(doc=>Object.freeze({...doc}))),
    groups:groups.value})};
}
export function diskReconciliationReviewCurrent(review:DiskReconciliationReview,editor:EditorState):boolean{
  return review.sessionRevision===editor.sessionRevision&&editor.activeId===review.snapshot.id&&
    sameOpenDocumentSnapshots(review.snapshots,editor.documents);
}
export function recommendedResolution(group:ReconciliationGroup):ReconciliationResolution|null{
  if(group.kind==='conflict')return null;
  return {id:group.id,choice:group.kind==='disk-only'?'disk':'local'};
}
export function initialReconciliationResolutions(groups:readonly ReconciliationGroup[]):ReconciliationResolution[]{
  return groups.flatMap(group=>{const value=recommendedResolution(group);return value?[value]:[];});
}
export function reconciliationText(group:ReconciliationGroup,resolution:ReconciliationResolution):string|null{
  switch(resolution.choice){
    case 'base':return group.base;
    case 'local':return group.local;
    case 'disk':return group.disk;
    case 'manual':{
      const value=resolution.manual;
      if(typeof value!=='string'||value.length>MAX_RECONCILIATION_GROUP_UNITS)return null;
      try{assertWellFormedUtf16(value,'Manual resolution');return value;}catch{return null;}
    }
    default:return null;
  }
}
export function planDiskReconciliation(review:DiskReconciliationReview,resolutions:readonly ReconciliationResolution[],
  editor:EditorState):ReconciliationResult<DiskReconciliationPlan>{
  if(!diskReconciliationReviewCurrent(review,editor))return fail('Editor changed. Start a new three-way review.');
  const fresh=createDiskReconciliationReview(editor,review.snapshot,review.diskContent);
  if(!fresh.ok||JSON.stringify(fresh.value.groups)!==JSON.stringify(review.groups))return fail('Reconciliation group inventory changed.');
  const groups=fresh.value.groups;
  if(resolutions.length!==groups.length||new Set(resolutions.map(item=>item.id)).size!==groups.length)
    return fail('Resolve every changed group explicitly.');
  const base=review.snapshot.savedContent;
  const chunks:string[]=[];
  const normalized:ReconciliationResolution[]=[];
  let cursor=0,manualUnits=0;
  for(const group of groups){
    const resolution=resolutions.find(item=>item.id===group.id);
    if(!resolution)return fail('A changed group has no resolution.');
    const text=reconciliationText(group,resolution);
    if(text===null)return fail('A group resolution is invalid or exceeds its text budget.');
    if(resolution.choice==='manual'){
      manualUnits+=text.length;
      if(manualUnits>MAX_RECONCILIATION_PREVIEW_UNITS)return fail('Manual resolutions exceed the total review budget.');
    }
    if(group.start<cursor||base.slice(group.start,group.end)!==group.base)return fail('Reviewed base ranges no longer match.');
    chunks.push(base.slice(cursor,group.start),text);cursor=group.end;
    normalized.push(Object.freeze({id:group.id,choice:resolution.choice,...(resolution.choice==='manual'?{manual:text}:{})}));
  }
  chunks.push(base.slice(cursor));
  const content=chunks.join('');
  // Whole-side reconstructions are already exact. For mixed resolutions,
  // reject newly adjacent CR/LF joins rather than silently fuse separators.
  if(content!==base&&content!==review.snapshot.content&&content!==review.diskContent){
    const nonempty=chunks.filter(Boolean);
    if(nonempty.some((text,index)=>index>0&&nonempty[index-1].endsWith('\r')&&text.startsWith('\n')))
      return fail('Selected resolutions would join adjacent CR and LF separators. Resolve the region manually.');
  }
  try{assertScarpSourceText(content);}catch{return fail('Merged editor text is invalid or exceeds source limits.');}
  return {ok:true,value:Object.freeze({review:fresh.value,resolutions:Object.freeze(normalized),content,diskContent:review.diskContent})};
}
export function diskReconciliationPlanCurrent(plan:DiskReconciliationPlan,editor:EditorState):boolean{
  const fresh=planDiskReconciliation(plan.review,plan.resolutions,editor);
  return fresh.ok&&fresh.value.content===plan.content&&fresh.value.diskContent===plan.diskContent;
}
/** The independently reread disk text is the new saved baseline. A
 * reconciled working buffer remains dirty unless it exactly equals disk.
 * No write authorization is granted by this recheck or review. */
export async function recheckDiskReconciliation(plan:DiskReconciliationPlan,editor:EditorState,
  read:(path:string,maxBytes:number)=>Promise<string>,isCurrent:()=>boolean):Promise<ReconciliationResult<DiskReconciliationPlan>>{
  if(!isCurrent()||!diskReconciliationPlanCurrent(plan,editor))return fail('Reconciliation preview is stale.');
  const path=plan.review.snapshot.path;
  if(!path)return fail('The reviewed source has no saved path.');
  try{
    const disk=await read(path,MAX_RECONCILIATION_READ_BYTES);
    if(!isCurrent())return fail('Editor changed during the disk recheck.');
    if(utf8ByteLength(disk)>MAX_RECONCILIATION_READ_BYTES||disk!==plan.diskContent)return fail('Disk changed again. No editor or baseline was modified.');
    return {ok:true,value:plan};
  }catch(error){return fail('Could not recheck the saved file: '+(error instanceof Error?error.message:String(error)));}
}
export function visibleReconciliationText(value:string):string{
  return JSON.stringify(value).replace(/[\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,
    char=>'\\u'+char.charCodeAt(0).toString(16).padStart(4,'0'));
}
