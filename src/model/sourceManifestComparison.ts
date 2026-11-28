import {safeRelativeScarpSourceName,safeRelativeScarpDirectory} from './folderListing';
import {sameProjectScope,MAX_SCOPE_REPORT_UNITS,MAX_SCOPE_NAME_QUERY,type ProjectSearchScope} from './projectSearchScope';
import {INSPECTION_READ_LIMITS,type InspectionMode} from './projectInspection';
import {MANIFEST_STATES,validSourceDigest,MANIFEST_STATE_LABELS,type ManifestFile,
  type ProjectSourceManifest,type SourceTextMetrics,type ManifestState} from './projectSourceManifest';
import {assertWellFormedUtf16} from './utf8Text';

export const MAX_MANIFEST_BASELINES=8;
export const MAX_MANIFEST_BACKUP_UNITS=64*1024;
export const MANIFEST_BACKUP_FORMAT='scarp-studio.source-manifest';
export interface SourceManifestBaseline{
  readonly scope:ProjectSearchScope;
  readonly mode:InspectionMode;
  readonly complete:boolean;
  readonly files:readonly ManifestFile[];
}
type Result<T>={readonly ok:true;readonly value:T}|{readonly ok:false;readonly error:string};
const fail=(error:string):Result<never>=>({ok:false,error});
function object(value:unknown):value is Record<string,unknown>{
  return value!==null&&typeof value==='object'&&!Array.isArray(value);
}
function exact(value:Record<string,unknown>,keys:readonly string[]){
  return Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
}
function integer(value:unknown,max:number):value is number{
  return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=max;
}
function validScope(raw:unknown):raw is ProjectSearchScope{
  if(!object(raw)||!exact(raw,Object.hasOwn(raw,'batch')?['directory','descendants','filename','batch']:['directory','descendants','filename'])||
    typeof raw.directory!=='string'||typeof raw.descendants!=='boolean'||typeof raw.filename!=='string'||
    raw.filename.length>MAX_SCOPE_NAME_QUERY||
    (raw.directory!==''&&!safeRelativeScarpDirectory(raw.directory))||
    /[/\\\x00-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/.test(raw.filename)||
    (raw.batch!==undefined&&(!integer(raw.batch,10000)||raw.batch===0)))return false;
  try{assertWellFormedUtf16(raw.filename,'Manifest filename filter');return true;}catch{return false;}
}
function validateMetrics(raw:unknown):raw is SourceTextMetrics{
  if(!object(raw)||!exact(raw,['units','lines','blankLines','lf','crlf','cr','finalNewline','eol'])||
    !integer(raw.units,INSPECTION_READ_LIMITS.fileBytes)||!integer(raw.lines,INSPECTION_READ_LIMITS.fileBytes+1)||
    !integer(raw.blankLines,INSPECTION_READ_LIMITS.fileBytes+1)||!integer(raw.lf,INSPECTION_READ_LIMITS.fileBytes)||
    !integer(raw.crlf,INSPECTION_READ_LIMITS.fileBytes)||!integer(raw.cr,INSPECTION_READ_LIMITS.fileBytes)||
    typeof raw.finalNewline!=='boolean')return false;
  const endings=raw.lf+raw.crlf+raw.cr;
  const kinds=[raw.lf>0,raw.crlf>0,raw.cr>0].filter(Boolean).length;
  const expected=kinds===0?'none':kinds>1?'mixed':raw.lf?'lf':raw.crlf?'crlf':'cr';
  return raw.lines===endings+1&&raw.blankLines<=raw.lines&&raw.lf+raw.cr+raw.crlf*2<=raw.units&&
    raw.eol===expected&&(!raw.finalNewline||endings>0)&&
    (raw.units!==0||raw.blankLines===1&&!raw.finalNewline);
}
function validateFile(raw:unknown):raw is ManifestFile{
  if(!object(raw)||!exact(raw,['name','state','origin','bytes','digest','metrics','dirty'])||
    typeof raw.name!=='string'||!safeRelativeScarpSourceName(raw.name)||
    !MANIFEST_STATES.includes(raw.state as ManifestState)||
    !['open-buffer','disk','none'].includes(String(raw.origin))||typeof raw.dirty!=='boolean')return false;
  if(raw.state==='hashed'||raw.state==='hash-failed'){
    if(!integer(raw.bytes,INSPECTION_READ_LIMITS.fileBytes)||!validateMetrics(raw.metrics)||
      raw.origin==='none'||raw.metrics.units>raw.bytes||raw.bytes>raw.metrics.units*3)return false;
    return raw.state==='hashed'?validSourceDigest(raw.digest):raw.digest===null;
  }
  if(raw.digest!==null||raw.bytes!==null||raw.metrics!==null)return false;
  if(raw.state==='not-observed'||raw.state==='ambiguous-buffer')return raw.origin==='none';
  return true;
}
function validateBaseline(raw:unknown):Result<SourceManifestBaseline>{
  if(!object(raw)||!exact(raw,['scope','mode','complete','files'])||!validScope(raw.scope)||
    (raw.mode!=='working'&&raw.mode!=='saved')||typeof raw.complete!=='boolean'||
    !Array.isArray(raw.files)||!raw.files.length||raw.files.length>INSPECTION_READ_LIMITS.files)
    return fail('Unsupported source manifest baseline.');
  const files:ManifestFile[]=[];
  const seen=new Set<string>();
  let totalBytes=0;
  for(const item of raw.files){
    if(!validateFile(item)||seen.has(item.name)||(raw.mode==='saved'&&item.origin==='open-buffer'))
      return fail('Manifest source evidence is inconsistent.');
    if(raw.complete&&item.state!=='hashed')return fail('Complete baseline contains unavailable observations.');
    seen.add(item.name);totalBytes+=item.bytes??0;
    if(totalBytes>INSPECTION_READ_LIMITS.totalBytes)return fail('Manifest source evidence exceeds its budget.');
    files.push(Object.freeze({...item,metrics:item.metrics?Object.freeze({...item.metrics}):null}));
  }
  return {ok:true,value:Object.freeze({scope:Object.freeze({...raw.scope}),mode:raw.mode,complete:raw.complete,files:Object.freeze(files)})};
}
export function captureManifestBaseline(report:ProjectSourceManifest):Result<SourceManifestBaseline>{
  if(report.selected!==report.files.length||report.status==='cancelled'&&report.complete||
    report.complete&&(report.settings.listingLimited||report.deferred>0||report.withheld>0))
    return fail('Source manifest coverage is inconsistent.');
  return validateBaseline({scope:report.settings.scope,mode:report.settings.mode,complete:report.complete,files:report.files});
}
/** Portable manifest exports contain private labels and hashes. They are
 * metadata only, explicitly revealed, and cannot authorize file reads.
 * Imported digests are supplied evidence, not authenticated signatures. */
export function exportManifestBaseline(baseline:SourceManifestBaseline):Result<string>{
  const checked=validateBaseline(baseline);
  if(!checked.ok)return checked;
  const raw=JSON.stringify({format:MANIFEST_BACKUP_FORMAT,version:1,baseline:checked.value},null,2);
  if(raw.length>MAX_MANIFEST_BACKUP_UNITS)return fail('Manifest backup exceeds its size budget.');
  return {ok:true,value:raw};
}
export function parseManifestBackup(raw:string):Result<SourceManifestBaseline>{
  if(typeof raw!=='string'||!raw.length||raw.length>MAX_MANIFEST_BACKUP_UNITS)
    return fail('Manifest backup is empty or exceeds its size budget.');
  let value:unknown;
  try{value=JSON.parse(raw);}catch{return fail('Manifest backup is not valid JSON.');}
  if(!object(value)||!exact(value,['format','version','baseline'])||
    value.format!==MANIFEST_BACKUP_FORMAT||value.version!==1)return fail('Unsupported manifest backup format.');
  return validateBaseline(value.baseline);
}

export const MANIFEST_CHANGES=['same-digest','changed-digest','origin-changed','incomplete','inconsistent',
  'earlier-only','current-only'] as const;
export type ManifestChange=typeof MANIFEST_CHANGES[number];
export const MANIFEST_CHANGE_LABELS:Readonly<Record<ManifestChange,string>>=Object.freeze({
  'same-digest':'Same observed digest and byte count','changed-digest':'Observed digest changed',
  'origin-changed':'Snapshot origin changed',incomplete:'Digest coverage incomplete',
  inconsistent:'Digest and byte/metric evidence disagree','earlier-only':'Earlier selected label only',
  'current-only':'Current selected label only',
});
export interface ManifestComparisonRow{
  readonly source:string;
  readonly change:ManifestChange;
  readonly earlier:ManifestFile|null;
  readonly current:ManifestFile|null;
  readonly byteDelta:number|null;
  readonly lineDelta:number|null;
}
export interface ManifestComparison{
  readonly earlierComplete:boolean;
  readonly currentComplete:boolean;
  readonly rows:readonly ManifestComparisonRow[];
  readonly counts:Readonly<Record<ManifestChange,number>>;
  readonly comparable:number;
  readonly byteDelta:number;
  readonly lineDelta:number;
}
function state(a:ManifestFile|null,b:ManifestFile|null):ManifestChange{
  if(!a)return 'current-only';
  if(!b)return 'earlier-only';
  if(a.state!=='hashed'||b.state!=='hashed')return 'incomplete';
  if(a.origin!==b.origin)return 'origin-changed';
  if(a.digest!==b.digest)return 'changed-digest';
  return a.bytes===b.bytes&&JSON.stringify(a.metrics)===JSON.stringify(b.metrics)?'same-digest':'inconsistent';
}
export function compareManifestBaselines(earlier:SourceManifestBaseline,current:SourceManifestBaseline):Result<ManifestComparison>{
  if(earlier.mode!==current.mode)return fail('Compare the same working-buffer or saved-disk snapshot mode.');
  if(!sameProjectScope(earlier.scope,current.scope))return fail('Compare the same reviewed directory, filename and batch scope.');
  const a=validateBaseline(earlier),b=validateBaseline(current);
  if(!a.ok)return a;if(!b.ok)return b;
  const before=new Map(a.value.files.map(file=>[file.name,file]));
  const after=new Map(b.value.files.map(file=>[file.name,file]));
  const labels=[...new Set([...before.keys(),...after.keys()])].sort();
  const counts=Object.fromEntries(MANIFEST_CHANGES.map(change=>[change,0])) as Record<ManifestChange,number>;
  let comparable=0,byteDelta=0,lineDelta=0;
  const rows=labels.map(source=>{
    const previous=before.get(source)??null,next=after.get(source)??null;
    const change=state(previous,next);counts[change]++;
    const match=change==='same-digest'||change==='changed-digest';
    const bytes=match?next!.bytes!-previous!.bytes!:null;
    const lines=match?next!.metrics!.lines-previous!.metrics!.lines:null;
    if(match){comparable++;byteDelta+=bytes!;lineDelta+=lines!;}
    return Object.freeze({source,change,earlier:previous,current:next,byteDelta:bytes,lineDelta:lines});
  });
  return {ok:true,value:Object.freeze({earlierComplete:a.value.complete,currentComplete:b.value.complete,
    rows:Object.freeze(rows),counts:Object.freeze(counts),comparable,byteDelta,lineDelta})};
}
export interface ManifestComparisonFilter{
  readonly query:string;
  readonly change:ManifestChange|'all';
  readonly changedOnly:boolean;
}
export const DEFAULT_MANIFEST_COMPARISON_FILTER:ManifestComparisonFilter=Object.freeze({query:'',change:'all',changedOnly:false});
export function filterManifestComparison(comparison:ManifestComparison,filter:ManifestComparisonFilter){
  if(filter.query.length>120||/[\x00-\x1f\x7f]/.test(filter.query))return [];
  const query=filter.query.trim().toLowerCase();
  return comparison.rows.filter(row=>(!query||row.source.toLowerCase().includes(query))&&
    (filter.change==='all'||row.change===filter.change)&&(!filter.changedOnly||row.change!=='same-digest'));
}
export function manifestComparisonReport(comparison:ManifestComparison,labels=false,digests=false):string{
  const lines=['Scarp Studio — source snapshot manifest comparison',
    'Same-label, same-origin digest observations only; not a Git diff, signature or proof of file deletion.',
    'Earlier / current coverage: '+(comparison.earlierComplete?'complete':'incomplete')+' / '+(comparison.currentComplete?'complete':'incomplete'),
    ...MANIFEST_CHANGES.map(change=>MANIFEST_CHANGE_LABELS[change]+': '+comparison.counts[change]),
    'Comparable labels: '+comparison.comparable,'Comparable byte delta: '+comparison.byteDelta,
    'Comparable editor-line delta: '+comparison.lineDelta,
    'No source text or native paths included.'];
  let units=lines.join('\n').length;
  if(labels||digests)for(const [index,row] of comparison.rows.entries()){
    const line='Source '+(index+1)+(labels?' '+JSON.stringify(row.source):'')+'; '+MANIFEST_CHANGE_LABELS[row.change]+
      '; earlier: '+(row.earlier?MANIFEST_STATE_LABELS[row.earlier.state]:'not selected')+
      '; current: '+(row.current?MANIFEST_STATE_LABELS[row.current.state]:'not selected')+
      (row.byteDelta!==null?'; byte delta: '+row.byteDelta:'')+
      (digests?'; earlier digest: '+(row.earlier?.digest??'unavailable')+'; current digest: '+(row.current?.digest??'unavailable'):'');
    if(units+line.length+1>MAX_SCOPE_REPORT_UNITS-100){lines.push('Additional comparison evidence omitted.');break;}
    lines.push(line);units+=line.length+1;
  }
  return lines.join('\n');
}
