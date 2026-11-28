import type {EditorState,EditorAction} from './editorState';
import type {ProjectSearchSource} from './projectSearch';
import type {ProjectSearchScope} from './projectSearchScope';
import {MAX_SCOPE_REPORT_UNITS} from './projectSearchScope';
import type {InspectionControl,ProjectInspectionPlan} from './projectInspection';
import {prepareReviewedSourceSet,confirmReviewedSourceSet,readReviewedSourceSet,validateReviewedSourceSet,
  reviewedEditorIsCurrent,prepareReviewedStage,revalidateReviewedStage,reviewedStop,reviewedFailure,
  type ReviewedSourceSet,type ReviewedStagePlan,type ReviewedResult,type ReviewedExecution} from './reviewedSourceStage';
import {analyzeWhitespaceFile,validateWhitespaceOptions,MAX_WHITESPACE_EDITS,WHITESPACE_KINDS,WHITESPACE_LABELS,
  type WhitespaceOptions,type WhitespaceFileResult,type WhitespaceKind} from './sourceWhitespace';

export const PROJECT_WHITESPACE_PAGE_SIZE=16;
export interface ProjectWhitespaceReview{
  readonly sources:ProjectInspectionPlan;
  readonly options:WhitespaceOptions;
}
export function prepareProjectWhitespace(listed:readonly ProjectSearchSource[],scope:ProjectSearchScope,
  listingLimited:boolean,options:WhitespaceOptions):ReviewedResult<ProjectWhitespaceReview>{
  const checked=validateWhitespaceOptions(options);
  if(!checked.ok)return checked;
  const sources=prepareReviewedSourceSet(listed,scope,listingLimited);
  return sources.ok?{ok:true,value:Object.freeze({sources:sources.value,options:checked.value})}:sources;
}
export function confirmProjectWhitespace(review:ProjectWhitespaceReview,listed:readonly ProjectSearchSource[],
  scope:ProjectSearchScope,listingLimited:boolean,options:WhitespaceOptions):ReviewedResult<ProjectWhitespaceReview>{
  const fresh=prepareProjectWhitespace(listed,scope,listingLimited,options);
  if(!fresh.ok)return fresh;
  if(JSON.stringify(fresh.value.options)!==JSON.stringify(review.options))
    return reviewedFailure('Whitespace options changed. Review again.');
  const checked=confirmReviewedSourceSet(review.sources,listed,scope,listingLimited);
  return checked.ok?fresh:checked;
}
export interface WhitespaceObservation{
  readonly source:string;
  readonly origin:'open-buffer'|'disk';
  readonly result:WhitespaceFileResult;
}
export interface ProjectWhitespaceInventory{
  readonly review:ProjectWhitespaceReview;
  readonly set:ReviewedSourceSet;
  readonly files:readonly WhitespaceObservation[];
  readonly edits:number;
}
export type WhitespaceScanExecution=ReviewedExecution<ProjectWhitespaceInventory>;
export async function scanProjectWhitespace(review:ProjectWhitespaceReview,editor:EditorState,
  read:(path:string,maxBytes:number)=>Promise<string>,control:InspectionControl):Promise<WhitespaceScanExecution>{
  const set=await readReviewedSourceSet(review.sources,editor,read,control);
  if(set.kind!=='ready')return set;
  const files:WhitespaceObservation[]=[];
  let edits=0;
  for(const file of set.value.files){
    let stop=reviewedStop(control);if(stop)return {kind:stop};
    if(control.yieldBetweenFiles)await control.yieldBetweenFiles();
    stop=reviewedStop(control);if(stop)return {kind:stop};
    const result=analyzeWhitespaceFile(file.content,review.options,MAX_WHITESPACE_EDITS-edits);
    if(!result.ok)return {kind:'failed',error:result.error+' No cleanup review created.'};
    files.push(Object.freeze({source:file.name,origin:file.origin,result:result.value}));
    edits+=result.value.edits.length;
  }
  const stop=reviewedStop(control);if(stop)return {kind:stop};
  return {kind:'ready',value:Object.freeze({review,set:set.value,files:Object.freeze(files),edits})};
}
export function whitespaceInventoryIsCurrent(inventory:ProjectWhitespaceInventory,editor:EditorState):boolean{
  return reviewedEditorIsCurrent(inventory.set,editor);
}
function verifyInventory(inventory:ProjectWhitespaceInventory):boolean{
  if(inventory.review.sources!==inventory.set.plan||!validateReviewedSourceSet(inventory.set)||
    inventory.files.length!==inventory.set.files.length)return false;
  let edits=0;
  for(const [index,file] of inventory.set.files.entries()){
    const observation=inventory.files[index];
    if(observation.source!==file.name||observation.origin!==file.origin)return false;
    const fresh=analyzeWhitespaceFile(file.content,inventory.review.options,MAX_WHITESPACE_EDITS-edits);
    if(!fresh.ok||JSON.stringify(fresh.value)!==JSON.stringify(observation.result))return false;
    edits+=fresh.value.edits.length;
  }
  return edits===inventory.edits;
}
export interface ProjectWhitespacePlan{
  readonly inventory:ProjectWhitespaceInventory;
  readonly selected:readonly string[];
  readonly staged:ReviewedStagePlan;
  readonly edits:number;
}
export function planProjectWhitespace(inventory:ProjectWhitespaceInventory,selected:readonly string[],
  editor:EditorState):ReviewedResult<ProjectWhitespacePlan>{
  if(!whitespaceInventoryIsCurrent(inventory,editor))return reviewedFailure('Editor changed. Scan again.');
  if(!verifyInventory(inventory))return reviewedFailure('Whitespace review evidence changed.');
  const labels=new Set(selected);
  if(!labels.size||labels.size!==selected.length)return reviewedFailure('Select distinct changed source labels.');
  const chosen=inventory.files.filter(file=>labels.has(file.source));
  if(chosen.length!==selected.length||chosen.some(file=>!file.result.edits.length))
    return reviewedFailure('Selected source is unchanged or outside the review.');
  const staged=prepareReviewedStage(inventory.set,chosen.map(file=>({source:file.source,content:file.result.content})),editor);
  if(!staged.ok)return staged;
  return {ok:true,value:Object.freeze({inventory,selected:Object.freeze([...selected]),staged:staged.value,
    edits:chosen.reduce((sum,file)=>sum+file.result.edits.length,0)})};
}
export async function prepareWhitespaceApply(plan:ProjectWhitespacePlan,listed:readonly ProjectSearchSource[],
  listingLimited:boolean,editor:EditorState,read:(path:string,maxBytes:number)=>Promise<string>,
  control:InspectionControl):Promise<ReviewedExecution<{action:EditorAction;staged:ReviewedStagePlan;edits:number}>>{
  const fresh=planProjectWhitespace(plan.inventory,plan.selected,editor);
  if(!fresh.ok)return {kind:'failed',error:fresh.error};
  if(fresh.value.edits!==plan.edits||JSON.stringify(fresh.value.staged.changes)!==JSON.stringify(plan.staged.changes))
    return {kind:'failed',error:'Reviewed whitespace output changed.'};
  const result=await revalidateReviewedStage(fresh.value.staged,listed,listingLimited,editor,read,control);
  if(result.kind!=='ready')return result;
  return {kind:'ready',value:{action:result.value,staged:fresh.value.staged,edits:fresh.value.edits}};
}
export interface WhitespaceSummary{
  readonly sources:number;
  readonly changed:number;
  readonly selected:number;
  readonly edits:number;
  readonly selectedEdits:number;
  readonly counts:Readonly<Record<WhitespaceKind,number>>;
  readonly protectedTrailing:number;
  readonly protectedIndentation:number;
  readonly protectedEndings:number;
  readonly mixedFinalNewlines:number;
}
export function summarizeProjectWhitespace(inventory:ProjectWhitespaceInventory,selected:readonly string[]):WhitespaceSummary{
  const chosen=new Set(selected);
  const counts:Record<WhitespaceKind,number>={trailing:0,indentation:0,'line-ending':0,'final-newline':0};
  let changed=0,selectedCount=0,selectedEdits=0,protectedTrailing=0,protectedIndentation=0,protectedEndings=0,mixedFinalNewlines=0;
  for(const file of inventory.files){
    const result=file.result;
    if(result.edits.length)changed++;
    if(result.edits.length&&chosen.has(file.source)){selectedCount++;selectedEdits+=result.edits.length;}
    for(const kind of WHITESPACE_KINDS)counts[kind]+=result.counts[kind];
    protectedTrailing+=result.protected.literalTrailing;
    protectedIndentation+=result.protected.literalIndentation;
    protectedEndings+=result.protected.literalEndings;
    if(result.protected.mixedFinalNewline)mixedFinalNewlines++;
  }
  return {sources:inventory.files.length,changed,selected:selectedCount,edits:inventory.edits,selectedEdits,counts,
    protectedTrailing,protectedIndentation,protectedEndings,mixedFinalNewlines};
}
export interface WhitespaceFilter{
  readonly query:string;
  readonly state:'all'|'changed'|'unchanged'|'protected';
  readonly selectedOnly:boolean;
}
export const DEFAULT_WHITESPACE_FILTER:WhitespaceFilter=Object.freeze({query:'',state:'all',selectedOnly:false});
export function filterWhitespaceFiles(inventory:ProjectWhitespaceInventory,filter:WhitespaceFilter,selected:readonly string[]){
  const chosen=new Set(selected);
  if(filter.query.length>120||/[\x00-\x1f\x7f]/.test(filter.query))return [];
  const query=filter.query.toLowerCase().trim();
  return inventory.files.filter(file=>{
    const result=file.result;
    return (!query||file.source.toLowerCase().includes(query))&&(!filter.selectedOnly||chosen.has(file.source))&&
      (filter.state==='all'||filter.state==='changed'&&result.edits.length>0||
        filter.state==='unchanged'&&!result.edits.length||filter.state==='protected'&&
        (result.protected.literalTrailing>0||result.protected.literalIndentation>0||result.protected.literalEndings>0||result.protected.mixedFinalNewline));
  });
}
export function pageWhitespace<T>(rows:readonly T[],requested:number){
  const pages=Math.max(1,Math.ceil(rows.length/PROJECT_WHITESPACE_PAGE_SIZE));
  const page=Math.min(pages,Math.max(1,Number.isSafeInteger(requested)?requested:1));
  return {page,pages,rows:rows.slice((page-1)*PROJECT_WHITESPACE_PAGE_SIZE,page*PROJECT_WHITESPACE_PAGE_SIZE)};
}
export function projectWhitespaceReport(inventory:ProjectWhitespaceInventory,selected:readonly string[],includeLabels=false):string{
  const summary=summarizeProjectWhitespace(inventory,selected);
  const lines=['Scarp Studio — reviewed project whitespace cleanup',
    'Editor lexical token checks only; not compiler validation or formatting semantics.',
    'Reviewed sources: '+summary.sources,'Changed sources: '+summary.changed,'Selected sources: '+summary.selected,
    'Proposed whitespace edits: '+summary.edits,'Selected edits: '+summary.selectedEdits,
    ...WHITESPACE_KINDS.map(kind=>WHITESPACE_LABELS[kind]+': '+summary.counts[kind]),
    'Protected literal trailing ranges: '+summary.protectedTrailing,
    'Protected literal indentation ranges: '+summary.protectedIndentation,
    'Protected literal line endings: '+summary.protectedEndings,
    'Mixed EOL final newline withheld: '+summary.mixedFinalNewlines,
    'No source text, native paths or editor identifiers are exported.'];
  let units=lines.join('\n').length;
  if(includeLabels)for(const file of inventory.files){
    const line=JSON.stringify(file.source)+'; '+file.origin+'; '+file.result.edits.length+' edits; '+(selected.includes(file.source)?'selected':'not selected');
    if(units+line.length+1>MAX_SCOPE_REPORT_UNITS-100){lines.push('Additional labels omitted.');break;}
    lines.push(line);units+=line.length+1;
  }
  return lines.join('\n');
}
export type WhitespaceApplyOutcome={readonly ok:true;readonly files:number;readonly edits:number;readonly newTabs:number}|
  {readonly ok:false;readonly error:string};
