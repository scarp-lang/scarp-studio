import {isDirty,sameFilePath,type StudioDocument} from './documents';
import {validWorkspaceRoot,MAX_WORKSPACE_RESTORE_BYTES} from './workspaceSessions';
import {assertScarpSourceText} from './sourceLimits';
import {utf8ByteLength} from './utf8Text';
import {buildProjectScopeInventory} from './projectSearchScope';
import {validRelativeLabel} from './projectSearchComparison';
import {safeRelativeScarpSourceName} from './folderListing';
import type {ProjectSearchSource} from './projectSearch';
import type {EditorState} from './editorState';

export const MAX_ANALYSIS_OPEN_FILES=12;
export const MAX_ANALYSIS_OPEN_FILE_BYTES=512*1024;
export const MAX_ANALYSIS_OPEN_TOTAL_BYTES=MAX_WORKSPACE_RESTORE_BYTES;
type Result<T>={readonly ok:true;readonly value:T}|{readonly ok:false;readonly error:string};
const fail=(error:string):Result<never>=>({ok:false,error});

export interface AnalysisSourceCandidate{
  readonly name:string;
  readonly occurrences:number;
}
export interface AnalysisOpenRow{
  readonly name:string;
  readonly path:string;
  readonly kind:'open'|'available';
  readonly documentId:string|null;
  readonly modified:boolean;
}
export interface AnalysisOpenPlan{
  readonly rows:readonly AnalysisOpenRow[];
  readonly activeLabel:string|null;
  readonly activePath:string|null;
  readonly editorRevision:number;
  readonly editorActiveId:string|null;
  readonly newCount:number;
  readonly existingCount:number;
}
export interface AnalysisOpenEditor{
  readonly documents:readonly StudioDocument[];
  readonly activeId:string|null;
  readonly sessionRevision:number;
}
export type CandidateState='available'|'open'|'missing'|'ambiguous';
export interface AnalysisCandidateRow extends AnalysisSourceCandidate{
  readonly state:CandidateState;
  readonly modified:boolean;
}
/** Historical hits contribute labels only. Their paths and old contents are
 * never used. Current unique listing membership controls every read.
 */
export function analysisSourceCandidates(sites:readonly {readonly source:string}[]):readonly AnalysisSourceCandidate[]{
  const counts=new Map<string,number>();
  for(const site of sites){
    if(!validRelativeLabel(site.source)||!safeRelativeScarpSourceName(site.source))continue;
    counts.set(site.source,(counts.get(site.source)??0)+1);
  }
  return Object.freeze([...counts.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0)
    .map(([name,occurrences])=>Object.freeze({name,occurrences})));
}
function resolveCandidate(name:string,listed:readonly ProjectSearchSource[],documents:readonly StudioDocument[]):
  {readonly state:CandidateState;readonly row?:AnalysisOpenRow}{
  const inventory=buildProjectScopeInventory(listed);
  const matches=inventory.sources.filter(source=>source.name===name);
  if(matches.length!==1){
    return {state:listed.some(source=>source.name===name)?'ambiguous':'missing'};
  }
  const source=matches[0];
  if(!validWorkspaceRoot(source.path))return {state:'ambiguous'};
  const open=documents.filter(document=>document.path!==null&&sameFilePath(document.path,source.path));
  if(open.length>1)return {state:'ambiguous'};
  const row:AnalysisOpenRow=Object.freeze({
    name,path:source.path,kind:open.length?'open':'available',
    documentId:open[0]?.id??null,modified:open.length?isDirty(open[0]):false,
  });
  return {state:row.kind,row};
}
export function describeAnalysisCandidates(candidates:readonly AnalysisSourceCandidate[],listed:readonly ProjectSearchSource[],
  documents:readonly StudioDocument[]):readonly AnalysisCandidateRow[]{
  return candidates.map(candidate=>{
    const resolved=resolveCandidate(candidate.name,listed,documents);
    return {...candidate,state:resolved.state,modified:resolved.row?.modified??false};
  });
}
export function prepareAnalysisOpen(candidates:readonly AnalysisSourceCandidate[],selected:readonly string[],
  activeLabel:string|null,listed:readonly ProjectSearchSource[],editor:AnalysisOpenEditor):Result<AnalysisOpenPlan>{
  if(!selected.length||selected.length>MAX_ANALYSIS_OPEN_FILES||new Set(selected).size!==selected.length)
    return fail('Select between one and '+MAX_ANALYSIS_OPEN_FILES+' distinct observed source labels.');
  if(activeLabel!==null&&!selected.includes(activeLabel))return fail('Choose an active source from the selected labels.');
  const rows:AnalysisOpenRow[]=[];
  for(const name of selected){
    if(!validRelativeLabel(name)||!safeRelativeScarpSourceName(name)||!candidates.some(candidate=>candidate.name===name&&candidate.occurrences>0))
      return fail('Only observed source labels can be reviewed.');
    const resolved=resolveCandidate(name,listed,editor.documents);
    if(!resolved.row)return fail('One or more selected sources are missing or ambiguous. Review the current listing.');
    if(rows.some(row=>sameFilePath(row.path,resolved.row!.path)))return fail('Selected sources alias the same path.');
    rows.push(resolved.row);
  }
  return {ok:true,value:Object.freeze({
    rows:Object.freeze(rows),activeLabel,activePath:activeLabel===null?null:rows.find(row=>row.name===activeLabel)!.path,
    editorRevision:editor.sessionRevision,editorActiveId:editor.activeId,
    newCount:rows.filter(row=>row.kind==='available').length,
    existingCount:rows.filter(row=>row.kind==='open').length,
  })};
}
function samePlan(a:AnalysisOpenPlan,b:AnalysisOpenPlan):boolean{
  return a.editorRevision===b.editorRevision&&a.editorActiveId===b.editorActiveId&&
    a.activeLabel===b.activeLabel&&a.activePath===b.activePath&&a.newCount===b.newCount&&a.existingCount===b.existingCount&&
    a.rows.length===b.rows.length&&a.rows.every((row,index)=>{
      const current=b.rows[index];
      return row.name===current.name&&row.path===current.path&&row.kind===current.kind&&
        row.documentId===current.documentId&&row.modified===current.modified;
    });
}
export function confirmAnalysisOpen(review:AnalysisOpenPlan,candidates:readonly AnalysisSourceCandidate[],
  listed:readonly ProjectSearchSource[],editor:AnalysisOpenEditor):Result<AnalysisOpenPlan>{
  const checked=prepareAnalysisOpen(candidates,review.rows.map(row=>row.name),review.activeLabel,listed,editor);
  if(!checked.ok)return checked;
  return samePlan(review,checked.value)?checked:fail('Source listing or editor changed. Review the selected files again.');
}
export interface AnalysisOpenProgress{
  readonly completed:number;
  readonly total:number;
}
export interface AnalysisOpenControl{
  readonly isCurrent:()=>boolean;
  readonly isCancelled:()=>boolean;
  readonly onProgress?:(value:AnalysisOpenProgress)=>void;
  readonly yieldBetweenFiles?:()=>Promise<void>;
}
export interface PreparedAnalysisOpen{
  readonly files:readonly {readonly path:string;readonly content:string}[];
  readonly activePath:string|null;
  readonly bytes:number;
}
export type AnalysisOpenExecution={readonly kind:'prepared';readonly value:PreparedAnalysisOpen}|
  {readonly kind:'cancelled'|'invalidated'}|{readonly kind:'failed';readonly error:string};

/** Stage all selected closed files before publishing any editor action.
 * Existing tabs are not read or overwritten. Failure/cancellation discards
 * all staged text; no partially opened set is returned.
 */
export async function readAnalysisOpenSources(plan:AnalysisOpenPlan,
  read:(path:string,maxBytes:number)=>Promise<string>,control:AnalysisOpenControl):Promise<AnalysisOpenExecution>{
  const files:{path:string;content:string}[]=[];
  let bytes=0;
  const stop=():AnalysisOpenExecution|null=>!control.isCurrent()?{kind:'invalidated'}:
    control.isCancelled()?{kind:'cancelled'}:null;
  for(const row of plan.rows){
    if(row.kind==='open')continue;
    const stopped=stop();if(stopped)return stopped;
    control.onProgress?.({completed:files.length,total:plan.newCount});
    if(control.yieldBetweenFiles)await control.yieldBetweenFiles();
    const interrupted=stop();if(interrupted)return interrupted;
    const limit=Math.min(MAX_ANALYSIS_OPEN_FILE_BYTES,MAX_ANALYSIS_OPEN_TOTAL_BYTES-bytes);
    if(limit<=0)return {kind:'failed',error:'The reviewed open operation exceeded its read budget. Select fewer files.'};
    try{
      const content=await read(row.path,limit);
      const late=stop();if(late)return late;
      if(typeof content!=='string'||content.length>limit)return {kind:'failed',error:'A selected source exceeded its bounded read budget.'};
      assertScarpSourceText(content);
      const size=utf8ByteLength(content);
      if(size>limit)return {kind:'failed',error:'A selected source exceeded its bounded read budget.'};
      bytes+=size;files.push(Object.freeze({path:row.path,content}));
    }catch{
      const late=stop();if(late)return late;
      return {kind:'failed',error:'A selected source could not be read safely. No files were opened.'};
    }
  }
  const stopped=stop();if(stopped)return stopped;
  control.onProgress?.({completed:files.length,total:plan.newCount});
  const late=stop();if(late)return late;
  return {kind:'prepared',value:Object.freeze({files:Object.freeze(files),activePath:plan.activePath,bytes})};
}

/** Called before dispatch and after dispatch to detect a reducer rejection.
 * The reducer is responsible for the atomic editor transition.
 */
export function analysisOpenSatisfied(plan:AnalysisOpenPlan,state:EditorState):boolean{
  return plan.rows.every(row=>{
    const matches=state.documents.filter(doc=>doc.path!==null&&sameFilePath(doc.path,row.path));
    return matches.length===1&&(row.kind!=='open'||matches[0].id===row.documentId);
  })&&(plan.activePath===null||state.documents.some(doc=>doc.id===state.activeId&&
    doc.path!==null&&sameFilePath(doc.path,plan.activePath!)));
}
export type AnalysisOpenOutcome={readonly ok:true;readonly opened:number;readonly reused:number}|
  {readonly ok:false;readonly error:string};
