import type {EditorState,EditorAction} from './editorState';
import type {ProjectSearchSource} from './projectSearch';
import {MAX_SCOPE_REPORT_UNITS,type ProjectSearchScope} from './projectSearchScope';
import type {InspectionControl,ProjectInspectionPlan} from './projectInspection';
import {MAX_SEARCH_CANDIDATES} from './openFileSearch';
import {prepareReviewedSourceSet,confirmReviewedSourceSet,readReviewedSourceSet,validateReviewedSourceSet,
  reviewedEditorIsCurrent,prepareReviewedStage,revalidateReviewedStage,reviewedStop,reviewedFailure,
  type ReviewedSourceSet,type ReviewedStagePlan,type ReviewedResult,type ReviewedExecution} from './reviewedSourceStage';
import {validateLiteralReplaceSettings,scanLiteralReplacementFile,applyLiteralReplacementSites,
  MAX_LITERAL_REPLACEMENT_SITES,LITERAL_REGION_LABELS,LITERAL_DOMAIN_LABELS,
  type LiteralReplaceSettings,type LiteralReplaceSite,type LiteralRegion} from './literalSourceReplacement';

export interface ProjectLiteralReview{
  readonly sources:ProjectInspectionPlan;
  readonly settings:LiteralReplaceSettings;
}
export function prepareProjectLiteralReplacement(listed:readonly ProjectSearchSource[],scope:ProjectSearchScope,
  listingLimited:boolean,settings:LiteralReplaceSettings):ReviewedResult<ProjectLiteralReview>{
  const checked=validateLiteralReplaceSettings(settings);
  if(!checked.ok)return checked;
  const sources=prepareReviewedSourceSet(listed,scope,listingLimited);
  return sources.ok?{ok:true,value:Object.freeze({sources:sources.value,settings:checked.value})}:sources;
}
export function confirmProjectLiteralReplacement(review:ProjectLiteralReview,listed:readonly ProjectSearchSource[],
  scope:ProjectSearchScope,listingLimited:boolean,settings:LiteralReplaceSettings):ReviewedResult<ProjectLiteralReview>{
  const fresh=prepareProjectLiteralReplacement(listed,scope,listingLimited,settings);
  if(!fresh.ok)return fresh;
  if(JSON.stringify(fresh.value.settings)!==JSON.stringify(review.settings))
    return reviewedFailure('Literal replacement options changed. Review again.');
  const confirmed=confirmReviewedSourceSet(review.sources,listed,scope,listingLimited);
  return confirmed.ok?fresh:confirmed;
}
export interface LiteralSourceObservation{
  readonly source:string;
  readonly origin:'open-buffer'|'disk';
  readonly sites:number;
  readonly excluded:number;
  readonly unchanged:number;
  readonly candidates:number;
}
export interface ProjectLiteralInventory{
  readonly review:ProjectLiteralReview;
  readonly set:ReviewedSourceSet;
  readonly sites:readonly LiteralReplaceSite[];
  readonly observations:readonly LiteralSourceObservation[];
  readonly candidates:number;
}
export type LiteralScanExecution=ReviewedExecution<ProjectLiteralInventory>;
function scanSet(set:ReviewedSourceSet,review:ProjectLiteralReview):ReviewedResult<{
  sites:readonly LiteralReplaceSite[];observations:readonly LiteralSourceObservation[];candidates:number;
}>{
  const sites:LiteralReplaceSite[]=[],observations:LiteralSourceObservation[]=[];
  let candidates=0;
  for(const file of set.files){
    const scanned=scanLiteralReplacementFile(file.name,file.content,review.settings,
      MAX_LITERAL_REPLACEMENT_SITES-sites.length,MAX_SEARCH_CANDIDATES-candidates);
    if(!scanned.ok)return scanned;
    const result=scanned.value;
    sites.push(...result.sites);candidates+=result.candidates;
    observations.push(Object.freeze({source:file.name,origin:file.origin,sites:result.sites.length,
      excluded:result.excluded,unchanged:result.unchanged,candidates:result.candidates}));
  }
  return {ok:true,value:{sites:Object.freeze(sites),observations:Object.freeze(observations),candidates}};
}
export async function scanProjectLiteralReplacement(review:ProjectLiteralReview,editor:EditorState,
  read:(path:string,maxBytes:number)=>Promise<string>,control:InspectionControl):Promise<LiteralScanExecution>{
  const set=await readReviewedSourceSet(review.sources,editor,read,control);
  if(set.kind!=='ready')return set;
  const sites:LiteralReplaceSite[]=[],observations:LiteralSourceObservation[]=[];
  let candidates=0;
  for(const file of set.value.files){
    let stop=reviewedStop(control);if(stop)return {kind:stop};
    if(control.yieldBetweenFiles)await control.yieldBetweenFiles();
    stop=reviewedStop(control);if(stop)return {kind:stop};
    const scanned=scanLiteralReplacementFile(file.name,file.content,review.settings,
      MAX_LITERAL_REPLACEMENT_SITES-sites.length,MAX_SEARCH_CANDIDATES-candidates);
    if(!scanned.ok)return {kind:'failed',error:scanned.error};
    sites.push(...scanned.value.sites);candidates+=scanned.value.candidates;
    observations.push(Object.freeze({source:file.name,origin:file.origin,sites:scanned.value.sites.length,
      excluded:scanned.value.excluded,unchanged:scanned.value.unchanged,candidates:scanned.value.candidates}));
  }
  const stop=reviewedStop(control);if(stop)return {kind:stop};
  return {kind:'ready',value:Object.freeze({review,set:set.value,sites:Object.freeze(sites),
    observations:Object.freeze(observations),candidates})};
}
export function literalInventoryIsCurrent(inventory:ProjectLiteralInventory,editor:EditorState):boolean{
  return reviewedEditorIsCurrent(inventory.set,editor);
}
function verifyInventory(inventory:ProjectLiteralInventory):boolean{
  if(inventory.review.sources!==inventory.set.plan||!validateReviewedSourceSet(inventory.set))return false;
  const fresh=scanSet(inventory.set,inventory.review);
  return fresh.ok&&fresh.value.candidates===inventory.candidates&&
    JSON.stringify(fresh.value.sites)===JSON.stringify(inventory.sites)&&
    JSON.stringify(fresh.value.observations)===JSON.stringify(inventory.observations);
}
export interface ProjectLiteralPlan{
  readonly inventory:ProjectLiteralInventory;
  readonly selected:readonly string[];
  readonly staged:ReviewedStagePlan;
  readonly replacements:number;
  readonly acknowledged:boolean;
}
export function planProjectLiteralReplacement(inventory:ProjectLiteralInventory,selected:readonly string[],
  editor:EditorState,acknowledged:boolean):ReviewedResult<ProjectLiteralPlan>{
  if(!literalInventoryIsCurrent(inventory,editor))return reviewedFailure('Editor changed. Scan again.');
  if(!verifyInventory(inventory))return reviewedFailure('Literal replacement review evidence changed.');
  const ids=new Set(selected);
  if(!ids.size||ids.size!==selected.length)return reviewedFailure('Select distinct reviewed replacement sites.');
  const chosen=inventory.sites.filter(site=>ids.has(site.id));
  if(chosen.length!==selected.length)return reviewedFailure('Selected site is outside the reviewed inventory.');
  if(inventory.review.settings.domain==='all'&&!acknowledged)
    return reviewedFailure('Acknowledge that all-text replacement may change comments, string delimiters and code.');
  const outputs:{source:string;content:string}[]=[];
  for(const file of inventory.set.files){
    const matches=chosen.filter(site=>site.source===file.name);
    if(!matches.length)continue;
    const result=applyLiteralReplacementSites(file.name,file.content,inventory.review.settings,matches);
    if(!result.ok)return result;
    outputs.push({source:file.name,content:result.value});
  }
  const staged=prepareReviewedStage(inventory.set,outputs,editor);
  if(!staged.ok)return staged;
  return {ok:true,value:Object.freeze({inventory,selected:Object.freeze([...selected]),staged:staged.value,
    replacements:chosen.length,acknowledged})};
}
export async function prepareLiteralReplacementApply(plan:ProjectLiteralPlan,listed:readonly ProjectSearchSource[],
  listingLimited:boolean,editor:EditorState,read:(path:string,maxBytes:number)=>Promise<string>,
  control:InspectionControl):Promise<ReviewedExecution<{action:EditorAction;staged:ReviewedStagePlan;replacements:number}>>{
  const fresh=planProjectLiteralReplacement(plan.inventory,plan.selected,editor,plan.acknowledged);
  if(!fresh.ok)return {kind:'failed',error:fresh.error};
  if(fresh.value.replacements!==plan.replacements||JSON.stringify(fresh.value.staged.changes)!==JSON.stringify(plan.staged.changes))
    return {kind:'failed',error:'Reviewed literal output changed.'};
  const staged=await revalidateReviewedStage(fresh.value.staged,listed,listingLimited,editor,read,control);
  if(staged.kind!=='ready')return staged;
  return {kind:'ready',value:{action:staged.value,staged:fresh.value.staged,replacements:fresh.value.replacements}};
}
export interface LiteralSelectionFilter{
  readonly source:string;
  readonly region:'all'|LiteralRegion;
  readonly selectedOnly:boolean;
}
export const DEFAULT_LITERAL_SELECTION_FILTER:LiteralSelectionFilter=Object.freeze({source:'',region:'all',selectedOnly:false});
export function filterLiteralSites(inventory:ProjectLiteralInventory,filter:LiteralSelectionFilter,selected:readonly string[]):readonly LiteralReplaceSite[]{
  const ids=new Set(selected);
  return inventory.sites.filter(site=>(!filter.source||site.source===filter.source)&&
    (filter.region==='all'||site.region===filter.region)&&(!filter.selectedOnly||ids.has(site.id)));
}
export const LITERAL_SITE_PAGE_SIZE=20;
export function pageLiteralSites<T>(rows:readonly T[],requested:number){
  const pages=Math.max(1,Math.ceil(rows.length/LITERAL_SITE_PAGE_SIZE));
  const page=Math.max(1,Math.min(pages,Number.isSafeInteger(requested)?requested:1));
  return {page,pages,rows:rows.slice((page-1)*LITERAL_SITE_PAGE_SIZE,page*LITERAL_SITE_PAGE_SIZE)};
}
export function summarizeLiteralInventory(inventory:ProjectLiteralInventory,selected:readonly string[]){
  const ids=new Set(selected);
  const chosen=inventory.sites.filter(site=>ids.has(site.id));
  const counts:Record<LiteralRegion,number>={code:0,comment:0,string:0,boundary:0};
  for(const site of inventory.sites)counts[site.region]++;
  return {sources:inventory.observations.length,sites:inventory.sites.length,candidates:inventory.candidates,
    excluded:inventory.observations.reduce((sum,file)=>sum+file.excluded,0),
    unchanged:inventory.observations.reduce((sum,file)=>sum+file.unchanged,0),
    selected:chosen.length,selectedSources:new Set(chosen.map(site=>site.source)).size,counts};
}
export function literalInventoryReport(inventory:ProjectLiteralInventory,selected:readonly string[],labels=false,values=false):string{
  const summary=summarizeLiteralInventory(inventory,selected);
  const lines=['Scarp Studio — reviewed project literal replacement inventory',
    'Complete selected source review; no compiler correctness claim.',
    'Region: '+LITERAL_DOMAIN_LABELS[inventory.review.settings.domain],
    'Case sensitive: '+(inventory.review.settings.caseSensitive?'yes':'no'),
    'Whole word: '+(inventory.review.settings.wholeWord?'yes':'no'),
    'Scanned sources: '+summary.sources,'Candidates: '+summary.candidates,'Retained sites: '+summary.sites,
    'Excluded by matching constraints: '+summary.excluded,'Already equal to replacement: '+summary.unchanged,
    'Selected sites: '+summary.selected,'Selected sources: '+summary.selectedSources,
    ...Object.entries(summary.counts).map(([region,count])=>LITERAL_REGION_LABELS[region as LiteralRegion]+': '+count),
    'No source previews or native paths are exported.'];
  if(values)lines.push('Query: '+JSON.stringify(inventory.review.settings.query),
    'Replacement: '+JSON.stringify(inventory.review.settings.replacement));
  let units=lines.join('\n').length;
  if(labels)for(const row of inventory.observations){
    const line=JSON.stringify(row.source)+'; '+row.origin+'; retained: '+row.sites+'; excluded: '+row.excluded+'; unchanged: '+row.unchanged;
    if(units+line.length+1>MAX_SCOPE_REPORT_UNITS-100){lines.push('Additional source rows omitted.');break;}
    lines.push(line);units+=line.length+1;
  }
  return lines.join('\n');
}
export type LiteralReplaceOutcome={ok:true;replacements:number;files:number;newTabs:number}|{ok:false;error:string};
