import {isDirty,sameFilePath,type StudioDocument} from './documents';
import {safeRelativeScarpSourceName} from './folderListing';
import {validWorkspaceRoot,MAX_WORKSPACE_RESTORE_BYTES} from './workspaceSessions';
import {sameOpenDocumentSnapshots,hasUnchangedEditorSession,type EditorState,type EditorAction} from './editorState';
import {prepareProjectInspection,confirmProjectInspection,readInspectionSnapshot,INSPECTION_READ_LIMITS,
  type ProjectInspectionPlan,type InspectionControl} from './projectInspection';
import type {ProjectSearchScope} from './projectSearchScope';
import type {ProjectSearchSource} from './projectSearch';
import type {OpenFileReplaceUndo} from './openFileReplaceUndo';
import {assertScarpSourceText} from './sourceLimits';
import {utf8ByteLength} from './utf8Text';

export type ReviewedResult<T>={readonly ok:true;readonly value:T}|{readonly ok:false;readonly error:string};
export const reviewedFailure=(error:string):ReviewedResult<never>=>({ok:false,error});
export type ReviewedStop='cancelled'|'invalidated';
export type ReviewedExecution<T>={readonly kind:'ready';readonly value:T}|
  {readonly kind:ReviewedStop}|{readonly kind:'failed';readonly error:string};
function failed(error:string):ReviewedExecution<never>{return {kind:'failed',error};}
export function reviewedStop(control:InspectionControl):ReviewedStop|null{
  return !control.isCurrent()?'invalidated':control.isCancelled()?'cancelled':null;
}
export interface ReviewedSourceSnapshot{
  readonly name:string;
  readonly path:string;
  readonly origin:'open-buffer'|'disk';
  readonly document:StudioDocument|null;
  readonly content:string;
  readonly bytes:number;
}
export interface ReviewedSourceSet{
  readonly plan:ProjectInspectionPlan;
  readonly editor:EditorState;
  readonly files:readonly ReviewedSourceSnapshot[];
  readonly bytes:number;
}
/** Never silently stage a transformation over a partial conventional
 * selection. An explicit numbered batch is a separate bounded scope. */
export function prepareReviewedSourceSet(listed:readonly ProjectSearchSource[],scope:ProjectSearchScope,
  listingLimited:boolean):ReviewedResult<ProjectInspectionPlan>{
  const result=prepareProjectInspection(listed,{scope,mode:'working',listingLimited});
  if(!result.ok)return result;
  if(listingLimited||result.value.withheld||(!scope.batch&&result.value.deferred))
    return reviewedFailure('The chosen listing or scope is incomplete. Refresh or select a smaller numbered batch.');
  if(result.value.sources.some(source=>!safeRelativeScarpSourceName(source.name)||!validWorkspaceRoot(source.path)))
    return reviewedFailure('A selected source has an unsupported listing identity.');
  return result;
}
export function confirmReviewedSourceSet(plan:ProjectInspectionPlan,listed:readonly ProjectSearchSource[],
  scope:ProjectSearchScope,listingLimited:boolean):ReviewedResult<ProjectInspectionPlan>{
  const fresh=prepareReviewedSourceSet(listed,scope,listingLimited);
  if(!fresh.ok)return fresh;
  return confirmProjectInspection(plan,listed,fresh.value.settings);
}
function snapshotEditor(editor:EditorState):EditorState{
  const documents=editor.documents.map(document=>Object.freeze({...document}));
  Object.freeze(documents);
  return Object.freeze({...editor,documents});
}
export function reviewedEditorIsCurrent(set:ReviewedSourceSet,editor:EditorState):boolean{
  return hasUnchangedEditorSession(set.editor,editor)&&sameOpenDocumentSnapshots(set.editor.documents,editor.documents);
}
/** Bounded private snapshots are for one explicit staged-edit review only.
 * Closed disk reads are not persisted. No partial result survives failure. */
export async function readReviewedSourceSet(plan:ProjectInspectionPlan,editor:EditorState,
  read:(path:string,maxBytes:number)=>Promise<string>,control:InspectionControl):Promise<ReviewedExecution<ReviewedSourceSet>>{
  const files:ReviewedSourceSnapshot[]=[];
  let bytes=0;
  for(const source of plan.sources){
    let stop=reviewedStop(control);if(stop)return {kind:stop};
    control.onProgress?.({observed:files.length,total:plan.selected});
    if(control.yieldBetweenFiles)await control.yieldBetweenFiles();
    stop=reviewedStop(control);if(stop)return {kind:stop};
    const snapshot=await readInspectionSnapshot(source,editor.documents,'working',
      INSPECTION_READ_LIMITS.totalBytes-bytes,read,()=>reviewedStop(control)!==null);
    stop=reviewedStop(control);if(stop)return {kind:stop};
    if(snapshot.kind!=='available')return failed('A selected source could not be read completely. No edit review was created.');
    const matches=editor.documents.filter(document=>document.path!==null&&sameFilePath(document.path,source.path));
    if(matches.length>1)return failed('A selected source has ambiguous open buffers.');
    files.push(Object.freeze({name:source.name,path:source.path,origin:matches.length?'open-buffer':'disk',
      document:matches[0]?Object.freeze({...matches[0]}):null,content:snapshot.content,bytes:snapshot.bytes}));
    bytes+=snapshot.bytes;
  }
  control.onProgress?.({observed:files.length,total:plan.selected});
  const stop=reviewedStop(control);if(stop)return {kind:stop};
  return {kind:'ready',value:Object.freeze({plan,editor:snapshotEditor(editor),files:Object.freeze(files),bytes})};
}
/** Validate exact private snapshot membership before deriving or staging
 * any edit. Historical metadata does not grant path authority. */
export function validateReviewedSourceSet(set:ReviewedSourceSet):boolean{
  if(set.files.length!==set.plan.sources.length||set.files.length!==set.plan.selected||
    set.files.length>INSPECTION_READ_LIMITS.files)return false;
  let bytes=0;
  const paths:string[]=[];
  for(const [index,file] of set.files.entries()){
    const source=set.plan.sources[index];
    if(file.name!==source.name||file.path!==source.path||!safeRelativeScarpSourceName(file.name)||
      !validWorkspaceRoot(file.path)||paths.some(path=>sameFilePath(path,file.path))||
      (file.origin!=='disk'&&file.origin!=='open-buffer')||file.bytes>INSPECTION_READ_LIMITS.fileBytes)
      return false;
    paths.push(file.path);
    try{assertScarpSourceText(file.content);}catch{return false;}
    if(file.bytes!==utf8ByteLength(file.content))return false;
    const matches=set.editor.documents.filter(document=>document.path!==null&&sameFilePath(document.path,file.path));
    if(matches.length>1||(file.origin==='disk')!==(matches.length===0)||
      (file.document===null)!==(matches.length===0))return false;
    if(file.document&&(!sameOpenDocumentSnapshots([file.document],matches)||file.content!==file.document.content))return false;
    bytes+=file.bytes;
  }
  return bytes===set.bytes&&bytes<=INSPECTION_READ_LIMITS.totalBytes;
}
export interface ReviewedSourceChange{
  readonly source:string;
  readonly path:string;
  readonly document:StudioDocument|null;
  readonly before:string;
  readonly after:string;
}
export interface ReviewedStagePlan{
  readonly set:ReviewedSourceSet;
  readonly changes:readonly ReviewedSourceChange[];
  readonly newTabs:number;
  readonly dirtyTabs:number;
}
/** Only exact known labels are accepted; arbitrary paths or original text
 * never originate from the transformation-specific UI. */
export function prepareReviewedStage(set:ReviewedSourceSet,outputs:readonly {readonly source:string;readonly content:string}[],
  editor:EditorState):ReviewedResult<ReviewedStagePlan>{
  if(!reviewedEditorIsCurrent(set,editor))return reviewedFailure('Editor changed. Scan again.');
  if(!validateReviewedSourceSet(set))return reviewedFailure('Reviewed source evidence changed.');
  if(!outputs.length||outputs.length>set.files.length||new Set(outputs.map(output=>output.source)).size!==outputs.length)
    return reviewedFailure('Select distinct changed source labels.');
  const changes:ReviewedSourceChange[]=[];
  let beforeBytes=0,afterBytes=0;
  for(const output of outputs){
    const file=set.files.find(item=>item.name===output.source);
    if(!file||file.content===output.content)return reviewedFailure('Selected source output is unchanged or outside the review.');
    try{assertScarpSourceText(output.content);}catch{return reviewedFailure('Staged output exceeds the source text limit.');}
    beforeBytes+=file.bytes;afterBytes+=utf8ByteLength(output.content);
    if(beforeBytes>MAX_WORKSPACE_RESTORE_BYTES||afterBytes>MAX_WORKSPACE_RESTORE_BYTES)
      return reviewedFailure('Staged output exceeds its aggregate budget.');
    changes.push(Object.freeze({source:file.name,path:file.path,document:file.document,before:file.content,after:output.content}));
  }
  return {ok:true,value:Object.freeze({set,changes:Object.freeze(changes),
    newTabs:changes.filter(change=>change.document===null).length,
    dirtyTabs:changes.filter(change=>change.document&&isDirty(change.document)).length})};
}
function sameChanges(a:readonly ReviewedSourceChange[],b:readonly ReviewedSourceChange[]):boolean{
  return a.length===b.length&&a.every((change,index)=>{
    const current=b[index];
    return change.source===current.source&&change.path===current.path&&change.before===current.before&&change.after===current.after&&
      (change.document===null?current.document===null:
        current.document!==null&&sameOpenDocumentSnapshots([change.document],[current.document]));
  });
}
/** Revalidate all selected disk snapshots, even unchanged files. The action
 * becomes obsolete if any reviewed source changes, cannot be read, or the
 * editor/session is invalidated. The caller still validates the domain
 * transformation and commits through one synchronous reducer action. */
export async function revalidateReviewedStage(plan:ReviewedStagePlan,listed:readonly ProjectSearchSource[],
  listingLimited:boolean,editor:EditorState,read:(path:string,maxBytes:number)=>Promise<string>,
  control:InspectionControl):Promise<ReviewedExecution<EditorAction>>{
  const checked=confirmReviewedSourceSet(plan.set.plan,listed,plan.set.plan.settings.scope,listingLimited);
  if(!checked.ok)return failed(checked.error);
  const fresh=prepareReviewedStage(plan.set,plan.changes.map(change=>({source:change.source,content:change.after})),editor);
  if(!fresh.ok)return failed(fresh.error);
  if(!sameChanges(fresh.value.changes,plan.changes))return failed('Staged source review changed.');
  const files=plan.set.files.filter(file=>file.origin==='disk');
  let bytes=0,observed=0;
  for(const file of files){
    let stop=reviewedStop(control);if(stop)return {kind:stop};
    control.onProgress?.({observed,total:files.length});
    if(control.yieldBetweenFiles)await control.yieldBetweenFiles();
    stop=reviewedStop(control);if(stop)return {kind:stop};
    const snapshot=await readInspectionSnapshot(file,editor.documents,'saved',
      INSPECTION_READ_LIMITS.totalBytes-bytes,read,()=>reviewedStop(control)!==null);
    stop=reviewedStop(control);if(stop)return {kind:stop};
    if(snapshot.kind!=='available'||snapshot.content!==file.content)
      return failed('A reviewed disk source changed or became unavailable. Scan again; nothing changed.');
    bytes+=snapshot.bytes;observed++;
  }
  control.onProgress?.({observed,total:files.length});
  const stop=reviewedStop(control);if(stop)return {kind:stop};
  return {kind:'ready',value:{type:'stage-source-replacements',sessionRevision:editor.sessionRevision,
    activeId:editor.activeId,allSnapshots:editor.documents,changes:fresh.value.changes}};
}
export function createReviewedStageUndo(changes:readonly ReviewedSourceChange[],after:EditorState):OpenFileReplaceUndo|null{
  if(!changes.length)return null;
  const replacements:OpenFileReplaceUndo['changes'][number][]=[];
  for(const change of changes){
    const matches=after.documents.filter(document=>document.path!==null&&sameFilePath(document.path,change.path));
    if(matches.length!==1)return null;
    const current=matches[0];
    if(current.content!==change.after||current.savedContent!==(change.document?.savedContent??change.before)||
      (change.document&&current.id!==change.document.id))return null;
    replacements.push({id:current.id,snapshot:Object.freeze({...current}),content:change.before});
  }
  return {after:after.documents.map(document=>Object.freeze({...document})),changes:replacements};
}
