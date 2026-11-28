import {buildProjectScopeInventory,planScopedProjectSearch,sameProjectScope,PROJECT_SEARCH_BATCH_SIZE,MAX_SCOPE_REPORT_UNITS,type ProjectSearchScope} from './projectSearchScope';
import {prepareProjectInspection,type InspectionMode,type ProjectInspectionPlan} from './projectInspection';
import type {ProjectSearchSource} from './projectSearch';
import {captureManifestBaseline} from './sourceManifestComparison';
import {MANIFEST_STATE_LABELS,MANIFEST_STATES,type ManifestFile,type ProjectSourceManifest} from './projectSourceManifest';

export const MAX_MANIFEST_LEDGER_BATCHES=64;
export interface ManifestLedgerBatch{
  readonly index:number;
  readonly labels:readonly string[];
}
export interface ManifestLedgerPlan{
  readonly scope:ProjectSearchScope;
  readonly mode:InspectionMode;
  readonly listingLimited:boolean;
  readonly listed:number;
  readonly excluded:number;
  readonly withheld:number;
  /** Private in-memory reviewed membership. Never included in reports. */
  readonly sources:readonly ProjectSearchSource[];
  readonly batches:readonly ManifestLedgerBatch[];
}
export interface ManifestLedgerReceipt{
  readonly batch:number;
  readonly sequence:number;
  readonly status:'completed'|'cancelled';
  readonly files:readonly ManifestFile[];
  readonly bytes:number;
}
export interface ManifestLedger{
  readonly plan:ManifestLedgerPlan;
  readonly receipts:readonly ManifestLedgerReceipt[];
  readonly nextSequence:number;
}
// Track actual immutable revision identity, not just receipt sequence numbers.
// Nodes retain only ancestry metadata; no old source rows or paths are kept alive.
interface LedgerRevision {
  readonly depth:number;
  readonly parent:LedgerRevision|null;
}
const revisions=new WeakMap<ManifestLedger,LedgerRevision>();

export function isKnownManifestLedger(ledger:ManifestLedger):boolean {
  return revisions.has(ledger);
}

/** Includes the same revision. Rejects copies, unrelated sessions and
 * forks, even when their latest receipt numbers and batch labels match. */
export function descendsFromManifestLedger(current:ManifestLedger,baseline:ManifestLedger):boolean {
  const ancestor=revisions.get(baseline);
  let revision=revisions.get(current);
  if(!ancestor||!revision||revision.depth<ancestor.depth)return false;
  while(revision&&revision.depth>ancestor.depth)revision=revision.parent??undefined;
  return revision===ancestor;
}

type Result<T>={readonly ok:true;readonly value:T}|{readonly ok:false;readonly error:string};
const fail=(error:string):Result<never>=>({ok:false,error});
const cmp=(a:string,b:string)=>a<b?-1:a>b?1:0;
function sameLabels(a:readonly string[],b:readonly string[]):boolean{
  if(a.length!==b.length)return false;
  const x=[...a].sort(cmp),y=[...b].sort(cmp);
  return x.every((label,index)=>label===y[index]);
}

/** Preview membership without reading. The numbered windows are exactly
 * the same windows as the ordinary scope planner; selection order within
 * a window is irrelevant to ledger membership.
 */
export function prepareManifestLedger(listed:readonly ProjectSearchSource[],scope:ProjectSearchScope,mode:InspectionMode,
  listingLimited:boolean):Result<ManifestLedgerPlan>{
  if(mode!=='working'&&mode!=='saved')return fail('Choose a supported snapshot mode.');
  if(typeof listingLimited!=='boolean')return fail('Invalid listing coverage.');
  const base={directory:scope.directory,descendants:scope.descendants,filename:scope.filename};
  const inventory=buildProjectScopeInventory(listed);
  const checked=planScopedProjectSearch(inventory,base);
  if(!checked.ok)return checked;
  const selection=checked.value;
  if(!selection.sources.length)return fail('No eligible listed sources match this ledger scope.');
  const ordered=[...selection.sources].sort((a,b)=>cmp(a.name,b.name));
  const total=Math.ceil(ordered.length/PROJECT_SEARCH_BATCH_SIZE);
  if(total>MAX_MANIFEST_LEDGER_BATCHES)return fail('Choose a narrower scope: a manifest ledger is limited to '+MAX_MANIFEST_LEDGER_BATCHES+' batches.');
  const batches:ManifestLedgerBatch[]=[];
  for(let index=0;index<total;index++){
    const labels=ordered.slice(index*PROJECT_SEARCH_BATCH_SIZE,(index+1)*PROJECT_SEARCH_BATCH_SIZE).map(source=>source.name);
    batches.push(Object.freeze({index:index+1,labels:Object.freeze(labels)}));
  }
  return {ok:true,value:Object.freeze({
    scope:Object.freeze(base),mode,listingLimited,listed:selection.listed,excluded:selection.excluded,
    withheld:selection.invalid+selection.ambiguous+selection.uninspected,
    sources:Object.freeze(ordered.map(source=>Object.freeze({name:source.name,path:source.path}))),
    batches:Object.freeze(batches),
  })};
}
export function sameManifestLedgerPlan(a:ManifestLedgerPlan,b:ManifestLedgerPlan):boolean{
  return sameProjectScope(a.scope,b.scope)&&a.mode===b.mode&&a.listingLimited===b.listingLimited&&a.listed===b.listed&&
    a.excluded===b.excluded&&a.withheld===b.withheld&&a.sources.length===b.sources.length&&
    a.sources.every((source,index)=>source.name===b.sources[index]?.name&&source.path===b.sources[index]?.path)&&
    a.batches.length===b.batches.length&&a.batches.every((batch,index)=>batch.index===b.batches[index]?.index&&
      sameLabels(batch.labels,b.batches[index].labels));
}
export function confirmManifestLedger(plan:ManifestLedgerPlan,listed:readonly ProjectSearchSource[],scope:ProjectSearchScope,
  mode:InspectionMode,listingLimited:boolean):Result<ManifestLedgerPlan>{
  const next=prepareManifestLedger(listed,scope,mode,listingLimited);
  if(!next.ok)return next;
  return sameManifestLedgerPlan(plan,next.value)?next:fail('Ledger scope or listing membership changed. Review a new ledger.');
}
export function startManifestLedger(plan:ManifestLedgerPlan):ManifestLedger{
  const ledger:ManifestLedger=Object.freeze({plan,receipts:Object.freeze([]),nextSequence:1});
  revisions.set(ledger,{depth:0,parent:null});
  return ledger;
}
export function prepareLedgerBatch(ledger:ManifestLedger,index:number,listed:readonly ProjectSearchSource[],
  scope:ProjectSearchScope,mode:InspectionMode,listingLimited:boolean):Result<ProjectInspectionPlan>{
  const checked=confirmManifestLedger(ledger.plan,listed,scope,mode,listingLimited);
  if(!checked.ok)return checked;
  if(!Number.isSafeInteger(index)||index<1||index>ledger.plan.batches.length)return fail('Choose a reviewed batch.');
  const result=prepareProjectInspection(listed,{scope:{...ledger.plan.scope,batch:index},mode,listingLimited});
  if(!result.ok)return result;
  if(!sameLabels(result.value.sources.map(source=>source.name),ledger.plan.batches[index-1].labels))
    return fail('Batch membership changed. Review a new ledger.');
  return result;
}
/** Receipts accept only local results of a reviewed batch, with exact
 * scope, count and membership consistency. A rerun replaces one receipt,
 * not the other windows. Reports never receive the private source paths.
 */
export function recordManifestLedgerBatch(ledger:ManifestLedger,report:ProjectSourceManifest,replace:boolean):Result<ManifestLedger>{
  const parent=revisions.get(ledger);
  if(!parent)return fail('The ledger is not an active session revision.');
  if(!Number.isSafeInteger(ledger.nextSequence+1))return fail('Ledger receipt sequence exhausted. Start a new ledger.');
  const index=report.settings.scope.batch;
  if(!Number.isSafeInteger(index)||index===undefined||index<1||index>ledger.plan.batches.length)
    return fail('Result is not a numbered ledger batch.');
  const batch=ledger.plan.batches[index-1];
  if(!sameProjectScope(report.settings.scope,{...ledger.plan.scope,batch:index})||
    report.settings.mode!==ledger.plan.mode||report.settings.listingLimited!==ledger.plan.listingLimited||
    report.listed!==ledger.plan.listed||report.excluded!==ledger.plan.excluded||report.withheld!==ledger.plan.withheld||
    report.selected!==batch.labels.length||report.deferred!==ledger.plan.sources.length-batch.labels.length||
    !sameLabels(report.files.map(file=>file.name),batch.labels))return fail('Manifest result does not match the reviewed ledger batch.');
  if(report.status!=='completed'&&report.status!=='cancelled')return fail('Unsupported manifest result state.');
  if(ledger.receipts.some(receipt=>receipt.batch===index)&&!replace)
    return fail('Review replacement of the existing batch receipt first.');
  const baseline=captureManifestBaseline(report);
  if(!baseline.ok)return baseline;
  const bytes=baseline.value.files.reduce((sum,file)=>sum+(file.bytes??0),0);
  if(bytes>report.bytes||report.status==='completed'&&bytes!==report.bytes)return fail('Observed byte counts are inconsistent.');
  const receipt:ManifestLedgerReceipt=Object.freeze({
    batch:index,sequence:ledger.nextSequence,status:report.status,files:baseline.value.files,bytes,
  });
  const next:ManifestLedger=Object.freeze({plan:ledger.plan,
    receipts:Object.freeze([...ledger.receipts.filter(item=>item.batch!==index),receipt].sort((a,b)=>a.batch-b.batch)),
    nextSequence:ledger.nextSequence+1,
  });
  revisions.set(next,{depth:parent.depth+1,parent});
  return {ok:true,value:next};
}
export interface ManifestLedgerRow{
  readonly label:string;
  readonly batch:number;
  readonly sequence:number|null;
  readonly file:ManifestFile|null;
}
export interface ManifestLedgerSummary{
  readonly batches:number;
  readonly recorded:number;
  readonly finished:number;
  readonly selected:number;
  readonly hashed:number;
  readonly pending:number;
  readonly unavailable:number;
  readonly bytes:number;
  readonly allSelectedHashed:boolean;
  readonly fullListedCoverage:boolean;
  readonly rows:readonly ManifestLedgerRow[];
}
export function summarizeManifestLedger(ledger:ManifestLedger):ManifestLedgerSummary{
  const byBatch=new Map(ledger.receipts.map(receipt=>[receipt.batch,receipt]));
  const rows:ManifestLedgerRow[]=[];
  for(const batch of ledger.plan.batches){
    const receipt=byBatch.get(batch.index);
    const files=new Map(receipt?.files.map(file=>[file.name,file])??[]);
    for(const label of batch.labels)rows.push(Object.freeze({label,batch:batch.index,
      sequence:receipt?.sequence??null,file:files.get(label)??null}));
  }
  const hashed=rows.filter(row=>row.file?.state==='hashed').length;
  const pending=rows.filter(row=>row.file===null||row.file.state==='not-observed').length;
  const unavailable=rows.length-hashed-pending;
  const finished=ledger.receipts.filter(receipt=>receipt.status==='completed'&&receipt.files.every(file=>file.state==='hashed')).length;
  const allSelectedHashed=hashed===rows.length&&finished===ledger.plan.batches.length;
  return Object.freeze({batches:ledger.plan.batches.length,recorded:ledger.receipts.length,finished,
    selected:rows.length,hashed,pending,unavailable,bytes:rows.reduce((sum,row)=>sum+(row.file?.bytes??0),0),
    allSelectedHashed,fullListedCoverage:allSelectedHashed&&!ledger.plan.listingLimited&&!ledger.plan.withheld&&!ledger.plan.excluded,
    rows:Object.freeze(rows)});
}
export interface LedgerDigestGroup{
  readonly digest:string;
  readonly bytes:number;
  readonly rows:readonly ManifestLedgerRow[];
  readonly batches:number;
}
export function ledgerDigestGroups(summary:ManifestLedgerSummary):readonly LedgerDigestGroup[]{
  const groups=new Map<string,ManifestLedgerRow[]>();
  for(const row of summary.rows){
    if(row.file?.state!=='hashed'||!row.file.digest||row.file.bytes===null)continue;
    const key=JSON.stringify([row.file.digest,row.file.bytes]);
    const group=groups.get(key)??[];group.push(row);groups.set(key,group);
  }
  return Object.freeze([...groups.values()].filter(rows=>rows.length>1).map(rows=>Object.freeze({
    digest:rows[0].file!.digest!,bytes:rows[0].file!.bytes!,rows:Object.freeze(rows),
    batches:new Set(rows.map(row=>row.batch)).size,
  })).sort((a,b)=>b.batches-a.batches||b.rows.length-a.rows.length||cmp(a.rows[0].label,b.rows[0].label)));
}
export type LedgerRowState='all'|'pending'|ManifestFile['state'];
export interface LedgerFilter{
  readonly query:string;
  readonly state:LedgerRowState;
  readonly batch:number|null;
  readonly duplicatesOnly:boolean;
}
export const DEFAULT_LEDGER_FILTER:LedgerFilter=Object.freeze({query:'',state:'all',batch:null,duplicatesOnly:false});
export function filterLedgerRows(summary:ManifestLedgerSummary,filter:LedgerFilter):readonly ManifestLedgerRow[]{
  if(filter.query.length>120||/[\x00-\x1f\x7f]/.test(filter.query))return [];
  const query=filter.query.trim().toLowerCase();
  const duplicates=new Set(filter.duplicatesOnly?ledgerDigestGroups(summary).flatMap(group=>group.rows.map(row=>row.label)):[]);
  return summary.rows.filter(row=>(!query||row.label.toLowerCase().includes(query))&&
    (filter.state==='all'||(filter.state==='pending'?!row.file||row.file.state==='not-observed':row.file?.state===filter.state))&&
    (filter.batch===null||filter.batch===row.batch)&&(!filter.duplicatesOnly||duplicates.has(row.label)));
}
export const LEDGER_ROW_STATES:readonly LedgerRowState[]=Object.freeze(['all','pending',...MANIFEST_STATES]);
export function ledgerRowStateLabel(state:LedgerRowState):string{
  return state==='all'?'All observations':state==='pending'?'Not yet observed':MANIFEST_STATE_LABELS[state];
}
export function manifestLedgerText(ledger:ManifestLedger,includeLabels=false,includeDigests=false):string{
  const summary=summarizeManifestLedger(ledger);
  const lines=['Scarp Studio — sequential source manifest ledger',
    'Batch observations were made at different times. This is NOT an atomic project snapshot.',
    'Mode: '+ledger.plan.mode,'Batches recorded: '+summary.recorded+' / '+summary.batches,
    'Fully hashed completed batches: '+summary.finished,
    'Selected source labels: '+summary.selected,'Hashed: '+summary.hashed,'Pending: '+summary.pending,
    'Unavailable: '+summary.unavailable,'Observed bytes: '+summary.bytes,
    'Excluded listed labels: '+ledger.plan.excluded,'Withheld listing entries: '+ledger.plan.withheld,
    'Listing limited: '+(ledger.plan.listingLimited?'yes':'no'),
    'All selected labels hashed across completed batches: '+(summary.allSelectedHashed?'yes':'no'),
    'Full listed coverage across completed batches: '+(summary.fullListedCoverage?'yes':'no'),
    'Equal digest groups: '+ledgerDigestGroups(summary).length,
    'No source contents, native paths, or filesystem authority are included.'];
  let units=lines.join('\n').length;
  if(includeLabels||includeDigests)for(const [index,row] of summary.rows.entries()){
    const line='Source '+(index+1)+(includeLabels?' '+JSON.stringify(row.label):'')+
      '; batch '+row.batch+'; receipt '+(row.sequence??'none')+'; '+(row.file?MANIFEST_STATE_LABELS[row.file.state]:'Not yet observed')+
      (includeDigests&&row.file?.digest?'; SHA-256 '+row.file.digest:'');
    if(units+line.length+1>MAX_SCOPE_REPORT_UNITS-100){lines.push('Additional ledger rows omitted.');break;}
    lines.push(line);units+=line.length+1;
  }
  return lines.join('\n');
}
