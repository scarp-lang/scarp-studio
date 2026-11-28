import {sameFilePath,isDirty,type StudioDocument} from './documents';
import {safeRelativeScarpSourceName} from './folderListing';
import {validWorkspaceRoot} from './workspaceSessions';
import {sameOpenDocumentSnapshots,hasUnchangedEditorSession,type EditorState,type EditorAction} from './editorState';
import {prepareProjectInspection,confirmProjectInspection,readInspectionSnapshot,INSPECTION_READ_LIMITS,
  type ProjectInspectionPlan,type InspectionControl} from './projectInspection';
import {MAX_SCOPE_REPORT_UNITS,type ProjectSearchScope} from './projectSearchScope';
import type {ProjectSearchSource} from './projectSearch';
import {validateMigrationRules,scanMigrationFile,replaceMigrationSites,mappingWarnings,migrationFailure,
  MAX_MIGRATION_SITES,MIGRATION_ROLES,MIGRATION_ROLE_LABELS,MIGRATION_WARNING_LABELS,
  type MigrationRule,type MigrationResult,type MigrationSite,type MigrationWarning,type MigrationRole} from './migrationRules';
import {utf8ByteLength} from './utf8Text';
import type {OpenFileReplaceUndo} from './openFileReplaceUndo';

export const MIGRATION_PAGE_SIZE=16;
export interface ProjectMigrationReview{
  readonly inspection:ProjectInspectionPlan;
  readonly rules:readonly MigrationRule[];
}
export function prepareProjectMigration(listed:readonly ProjectSearchSource[],scope:ProjectSearchScope,
  listingLimited:boolean,rules:readonly MigrationRule[]):MigrationResult<ProjectMigrationReview>{
  const checked=validateMigrationRules(rules);
  if(!checked.ok)return checked;
  const plan=prepareProjectInspection(listed,{scope,mode:'working',listingLimited});
  if(!plan.ok)return plan;
  // A numbered batch is explicitly selected; its remaining batches are not
  // part of this edit. Conventional scope must not silently defer files.
  if(listingLimited||plan.value.withheld||(!scope.batch&&plan.value.deferred))
    return migrationFailure('The listing or chosen scope is incomplete. Refresh or choose a smaller numbered batch.');
  if(plan.value.sources.some(source=>!safeRelativeScarpSourceName(source.name)||!validWorkspaceRoot(source.path)))
    return migrationFailure('A reviewed source has an unsupported listing identity.');
  return {ok:true,value:Object.freeze({inspection:plan.value,rules:checked.value})};
}
export function confirmProjectMigration(review:ProjectMigrationReview,listed:readonly ProjectSearchSource[],
  scope:ProjectSearchScope,listingLimited:boolean,rules:readonly MigrationRule[]):MigrationResult<ProjectMigrationReview>{
  const fresh=prepareProjectMigration(listed,scope,listingLimited,rules);
  if(!fresh.ok)return fresh;
  if(JSON.stringify(review.rules)!==JSON.stringify(fresh.value.rules))
    return migrationFailure('The identifier mappings changed. Review again.');
  const checked=confirmProjectInspection(review.inspection,listed,fresh.value.inspection.settings);
  return checked.ok?fresh:checked;
}
export interface MigrationSnapshot{
  readonly name:string;
  readonly path:string;
  readonly origin:'open-buffer'|'disk';
  readonly document:StudioDocument|null;
  readonly content:string;
  readonly bytes:number;
}
export interface MigrationInventory{
  readonly review:ProjectMigrationReview;
  readonly editor:EditorState;
  readonly snapshots:readonly MigrationSnapshot[];
  readonly sites:readonly MigrationSite[];
  readonly warnings:readonly MigrationWarning[];
  readonly bytes:number;
}
export type MigrationScanExecution={readonly kind:'inventory';readonly value:MigrationInventory}|
  {readonly kind:'invalidated'|'cancelled'}|{readonly kind:'failed';readonly error:string};
const failed=(error:string):MigrationScanExecution=>({kind:'failed',error});
const interrupted=(control:InspectionControl):'invalidated'|'cancelled'|null=>!control.isCurrent()?'invalidated':control.isCancelled()?'cancelled':null;
function editorSnapshot(editor:EditorState):EditorState{
  return Object.freeze({...editor,documents:Object.freeze(editor.documents.map(doc=>Object.freeze({...doc}))) as unknown as StudioDocument[]});
}
export function migrationInventoryIsCurrent(inventory:MigrationInventory,editor:EditorState):boolean{
  return hasUnchangedEditorSession(inventory.editor,editor)&&sameOpenDocumentSnapshots(inventory.editor.documents,editor.documents);
}
/** Retain bounded private source snapshots only for the explicit edit
 * review. A single unread, malformed or capped selected file invalidates
 * the inventory. No editable partial result survives cancellation. */
export async function scanProjectMigration(review:ProjectMigrationReview,editor:EditorState,
  read:(path:string,maxBytes:number)=>Promise<string>,control:InspectionControl):Promise<MigrationScanExecution>{
  const snapshots:MigrationSnapshot[]=[];
  const sites:MigrationSite[]=[];
  const warnings=[...mappingWarnings(review.rules)];
  let bytes=0;
  for(const source of review.inspection.sources){
    let stop=interrupted(control);if(stop)return {kind:stop};
    control.onProgress?.({observed:snapshots.length,total:review.inspection.selected});
    if(control.yieldBetweenFiles)await control.yieldBetweenFiles();
    stop=interrupted(control);if(stop)return {kind:stop};
    const snapshot=await readInspectionSnapshot(source,editor.documents,'working',
      INSPECTION_READ_LIMITS.totalBytes-bytes,read,()=>interrupted(control)!==null);
    stop=interrupted(control);if(stop)return {kind:stop};
    if(snapshot.kind!=='available')return failed('A reviewed source could not be read completely. No edit review was created.');
    const matching=editor.documents.filter(doc=>doc.path!==null&&sameFilePath(doc.path,source.path));
    if(matching.length>1)return failed('A reviewed source has ambiguous open buffers.');
    const result=scanMigrationFile(source.name,snapshot.content,review.rules,MAX_MIGRATION_SITES-sites.length);
    if(!result.ok)return failed(result.error+' No edit review was created.');
    const document=matching[0]?Object.freeze({...matching[0]}):null;
    snapshots.push(Object.freeze({name:source.name,path:source.path,
      origin:document?'open-buffer':'disk',document,content:snapshot.content,bytes:snapshot.bytes}));
    sites.push(...result.value.sites);warnings.push(...result.value.warnings);bytes+=snapshot.bytes;
  }
  control.onProgress?.({observed:snapshots.length,total:review.inspection.selected});
  const stop=interrupted(control);if(stop)return {kind:stop};
  return {kind:'inventory',value:Object.freeze({review,editor:editorSnapshot(editor),
    snapshots:Object.freeze(snapshots),sites:Object.freeze(sites),warnings:Object.freeze(warnings),bytes})};
}

export interface MigrationChange{
  readonly source:string;
  readonly path:string;
  readonly document:StudioDocument|null;
  readonly before:string;
  readonly after:string;
  readonly sites:readonly MigrationSite[];
}
export interface ProjectMigrationPlan{
  readonly inventory:MigrationInventory;
  readonly selectedIds:readonly string[];
  readonly acknowledged:boolean;
  readonly changes:readonly MigrationChange[];
  readonly replacements:number;
  readonly newTabs:number;
  readonly dirtyTabs:number;
}
function sameEvidence(inventory:MigrationInventory):boolean{
  if(inventory.snapshots.length!==inventory.review.inspection.sources.length)return false;
  const sites:MigrationSite[]=[],warnings=[...mappingWarnings(inventory.review.rules)];
  let bytes=0;
  for(const [index,snapshot] of inventory.snapshots.entries()){
    const source=inventory.review.inspection.sources[index];
    if(snapshot.name!==source.name||snapshot.path!==source.path||snapshot.bytes!==utf8ByteLength(snapshot.content)||
      snapshot.bytes>INSPECTION_READ_LIMITS.fileBytes||(snapshot.origin!=='open-buffer'&&snapshot.origin!=='disk'))return false;
    const matches=inventory.editor.documents.filter(doc=>doc.path!==null&&sameFilePath(doc.path,snapshot.path));
    if(matches.length>1||(snapshot.origin==='open-buffer')!==(matches.length===1)||
      (snapshot.document===null)!==(matches.length===0))return false;
    if(snapshot.document&&(!sameOpenDocumentSnapshots([snapshot.document],matches)||snapshot.content!==snapshot.document.content))return false;
    const result=scanMigrationFile(snapshot.name,snapshot.content,inventory.review.rules,MAX_MIGRATION_SITES-sites.length);
    if(!result.ok)return false;
    sites.push(...result.value.sites);warnings.push(...result.value.warnings);bytes+=snapshot.bytes;
  }
  return bytes===inventory.bytes&&bytes<=INSPECTION_READ_LIMITS.totalBytes&&
    JSON.stringify(sites)===JSON.stringify(inventory.sites)&&JSON.stringify(warnings)===JSON.stringify(inventory.warnings);
}
/** Independent canonical re-derivation prevents a selected offset or
 * preview from becoming authority. Changes are pinned to original text. */
export function planProjectMigration(inventory:MigrationInventory,selectedIds:readonly string[],
  acknowledged:boolean,editor:EditorState):MigrationResult<ProjectMigrationPlan>{
  if(!migrationInventoryIsCurrent(inventory,editor))return migrationFailure('Editor changed. Scan again.');
  if(!sameEvidence(inventory))return migrationFailure('Migration evidence changed. Scan again.');
  const ids=new Set(selectedIds);
  if(!ids.size||ids.size!==selectedIds.length||selectedIds.some(id=>!inventory.sites.some(site=>site.id===id)))
    return migrationFailure('Select distinct reviewed identifier sites.');
  if(inventory.warnings.length&&!acknowledged)
    return migrationFailure('Review and acknowledge the observed spelling warnings first.');
  const changes:MigrationChange[]=[];
  let totalBytes=0;
  for(const snapshot of inventory.snapshots){
    const sites=inventory.sites.filter(site=>site.source===snapshot.name&&ids.has(site.id));
    if(!sites.length)continue;
    const after=replaceMigrationSites(snapshot.content,inventory.review.rules,sites);
    if(!after.ok)return after;
    totalBytes+=utf8ByteLength(after.value);
    if(totalBytes>INSPECTION_READ_LIMITS.totalBytes*2)return migrationFailure('Replacements exceed the reviewed output budget.');
    changes.push(Object.freeze({source:snapshot.name,path:snapshot.path,document:snapshot.document,
      before:snapshot.content,after:after.value,sites:Object.freeze(sites)}));
  }
  return {ok:true,value:Object.freeze({inventory,selectedIds:Object.freeze([...selectedIds]),acknowledged,
    changes:Object.freeze(changes),replacements:ids.size,newTabs:changes.filter(change=>!change.document).length,
    dirtyTabs:changes.filter(change=>change.document&&isDirty(change.document)).length})};
}
export type MigrationApplyExecution={readonly kind:'prepared';readonly action:EditorAction;readonly changes:readonly MigrationChange[]}|
  {readonly kind:'invalidated'|'cancelled'}|{readonly kind:'failed';readonly error:string};
function sameChanges(a:readonly MigrationChange[],b:readonly MigrationChange[]):boolean{
  return a.length===b.length&&a.every((change,index)=>change.source===b[index].source&&change.path===b[index].path&&
    change.before===b[index].before&&change.after===b[index].after&&
    JSON.stringify(change.sites)===JSON.stringify(b[index].sites)&&
    (change.document===null?b[index].document===null:
      b[index].document!==null&&sameOpenDocumentSnapshots([change.document],[b[index].document!])));
}
/** Re-read EVERY disk-origin source in the reviewed scan, including files
 * with no selected edits, so the reviewed collision/membership evidence
 * cannot silently change. The returned action is still in-memory only. */
export async function prepareMigrationApply(plan:ProjectMigrationPlan,listed:readonly ProjectSearchSource[],
  listingLimited:boolean,editor:EditorState,read:(path:string,maxBytes:number)=>Promise<string>,
  control:InspectionControl):Promise<MigrationApplyExecution>{
  const checked=confirmProjectMigration(plan.inventory.review,listed,plan.inventory.review.inspection.settings.scope,
    listingLimited,plan.inventory.review.rules);
  if(!checked.ok)return {kind:'failed',error:checked.error};
  const fresh=planProjectMigration(plan.inventory,plan.selectedIds,plan.acknowledged,editor);
  if(!fresh.ok)return {kind:'failed',error:fresh.error};
  if(!sameChanges(plan.changes,fresh.value.changes))return {kind:'failed',error:'Reviewed changes no longer match.'};
  const disk=plan.inventory.snapshots.filter(snapshot=>snapshot.origin==='disk');
  let bytes=0,observed=0;
  for(const snapshot of disk){
    let stop=interrupted(control);if(stop)return {kind:stop};
    control.onProgress?.({observed,total:disk.length});
    if(control.yieldBetweenFiles)await control.yieldBetweenFiles();
    stop=interrupted(control);if(stop)return {kind:stop};
    const source=await readInspectionSnapshot(snapshot,editor.documents,'saved',
      INSPECTION_READ_LIMITS.totalBytes-bytes,read,()=>interrupted(control)!==null);
    stop=interrupted(control);if(stop)return {kind:stop};
    if(source.kind!=='available'||source.content!==snapshot.content)
      return {kind:'failed',error:'A disk snapshot changed or became unavailable. Scan again; nothing was edited.'};
    bytes+=source.bytes;observed++;
  }
  control.onProgress?.({observed,total:disk.length});
  const stop=interrupted(control);if(stop)return {kind:stop};
  const action:EditorAction={type:'stage-source-replacements',sessionRevision:editor.sessionRevision,
    activeId:editor.activeId,allSnapshots:editor.documents,
    changes:fresh.value.changes.map(change=>({path:change.path,document:change.document,
      before:change.before,after:change.after}))};
  return {kind:'prepared',action,changes:fresh.value.changes};
}

export interface MigrationFilter{
  readonly source:string;
  readonly rule:number|null;
  readonly role:MigrationRole|'all';
  readonly selectedOnly:boolean;
}
export const DEFAULT_MIGRATION_FILTER:MigrationFilter=Object.freeze({source:'',rule:null,role:'all',selectedOnly:false});
export function filterMigrationSites(inventory:MigrationInventory,filter:MigrationFilter,selected:readonly string[]){
  const ids=new Set(selected);
  return inventory.sites.filter(site=>(!filter.source||site.source===filter.source)&&
    (filter.rule===null||site.rule===filter.rule)&&(filter.role==='all'||site.role===filter.role)&&
    (!filter.selectedOnly||ids.has(site.id)));
}
export function pageMigrationSites<T>(rows:readonly T[],requested:number){
  const pages=Math.max(1,Math.ceil(rows.length/MIGRATION_PAGE_SIZE));
  const page=Math.min(pages,Math.max(1,Number.isSafeInteger(requested)?requested:1));
  return {page,pages,rows:rows.slice((page-1)*MIGRATION_PAGE_SIZE,page*MIGRATION_PAGE_SIZE)};
}
/** Count-only default report. Never export source snippets, paths or text. */
export function migrationInventoryReport(inventory:MigrationInventory,selected:readonly string[],
  includeLabels=false,includeRules=false):string{
  const ids=new Set(selected);
  const lines=['Scarp Studio — reviewed literal identifier migration',
    'Lexical substitutions only; not semantic rename or compiler validation.',
    'Selected sources: '+inventory.snapshots.length,'Retained sites: '+inventory.sites.length,
    'Selected sites: '+inventory.sites.filter(site=>ids.has(site.id)).length,
    'Observed spelling warnings: '+inventory.warnings.length,
    'Source bytes scanned: '+inventory.bytes,
    ...MIGRATION_ROLES.map(role=>MIGRATION_ROLE_LABELS[role]+': '+inventory.sites.filter(site=>site.role===role).length),
    'No source contents, excerpts, native paths or editor identifiers are exported.'];
  let units=lines.join('\n').length;
  const append=(line:string)=>{
    if(units+line.length+1>MAX_SCOPE_REPORT_UNITS-100)return false;
    lines.push(line);units+=line.length+1;return true;
  };
  if(includeRules)for(const [index,rule] of inventory.review.rules.entries()){
    if(!append('Mapping '+(index+1)+': '+JSON.stringify(rule.from)+' → '+JSON.stringify(rule.to))){
      lines.push('Additional report evidence omitted.');return lines.join('\n');
    }
  }
  if(includeLabels)for(const snapshot of inventory.snapshots){
    const sites=inventory.sites.filter(site=>site.source===snapshot.name);
    if(!append(JSON.stringify(snapshot.name)+'; '+snapshot.origin+'; '+sites.length+' sites; '+
      sites.filter(site=>ids.has(site.id)).length+' selected')){
      lines.push('Additional report evidence omitted.');return lines.join('\n');
    }
  }
  for(const warning of inventory.warnings){
    if(!append('Mapping '+(warning.rule+1)+': '+MIGRATION_WARNING_LABELS[warning.kind]+' ('+warning.count+')'+
      (includeLabels&&warning.source?' in '+JSON.stringify(warning.source):''))){
      lines.push('Additional report evidence omitted.');break;
    }
  }
  return lines.join('\n');
}

/** Undo restores original contents, but leaves newly opened tabs present
 * and clean. It is valid only against the exact committed editor snapshots.
 */
export function createMigrationUndo(changes:readonly MigrationChange[],after:EditorState):OpenFileReplaceUndo|null{
  if(!changes.length)return null;
  const replacements:OpenFileReplaceUndo['changes'][number][]=[];
  for(const change of changes){
    const matching=after.documents.filter(doc=>doc.path!==null&&sameFilePath(doc.path,change.path));
    if(matching.length!==1)return null;
    const current=matching[0];
    if(current.content!==change.after||current.savedContent!==(change.document?.savedContent??change.before)||
      (change.document&&current.id!==change.document.id))return null;
    replacements.push({id:current.id,snapshot:Object.freeze({...current}),content:change.before});
  }
  return {after:after.documents.map(doc=>Object.freeze({...doc})),changes:replacements};
}
export type MigrationOutcome={readonly ok:true;readonly replacements:number;readonly files:number;readonly newTabs:number}|
  {readonly ok:false;readonly error:string};
