import { sameFilePath } from './documents';
import { REFERENCE_KINDS, type CompilerSymbolKind,type CompilerReferenceKind,type CompilerNavigationReport,
  type CompilerSymbol,type CompilerLocation } from './compilerNavigation';

export const COMPARISON_PAGE_SIZE=20;
export const MAX_COMPARISON_EXPORT=64*1024;
export const MAX_COMPARISON_QUERY=120;
export type ChangeKind='only-current'|'only-baseline'|'metadata'|'references'|'positions'|'unchanged'|'ambiguous';
export const CHANGE_KINDS:readonly ChangeKind[]=['only-current','only-baseline','metadata','references','positions','unchanged','ambiguous'];
export const CHANGE_LABELS:Readonly<Record<ChangeKind,string>>=Object.freeze({
  'only-current':'Only in current report','only-baseline':'Only in baseline report',
  metadata:'Reported metadata changed',references:'Reference inventory counts changed',
  positions:'Definition coordinates changed',unchanged:'Compared reported fields match',
  ambiguous:'Ambiguous structural label group',
});
export interface NavigationSnapshot{
  readonly folder:string;
  readonly report:CompilerNavigationReport;
}
export interface NavigationBaseline extends NavigationSnapshot {
  readonly capturedAt:number;
}
export interface BaselineReview{
  readonly snapshot:NavigationSnapshot;
  readonly previous:NavigationBaseline|null;
}
export function captureNavigationBaseline(review:BaselineReview,current:NavigationSnapshot,
  previous:NavigationBaseline|null,timestamp:number):NavigationBaseline|null{
  if(review.snapshot!==current||review.previous!==previous||!Number.isSafeInteger(timestamp)||timestamp<0||timestamp>8640000000000000)return null;
  return Object.freeze({...current,capturedAt:timestamp});
}
type RefCounts=Readonly<Record<CompilerReferenceKind,number>>;
export interface ComparisonReferenceCounts{
  readonly total:number;
  readonly byKind:RefCounts;
  readonly files:readonly {readonly label:string;readonly count:number}[];
}
export interface SymbolProjection{
  /** Snapshot-local ID, for display in its own column only. */
  readonly id:number;
  readonly public:boolean;
  readonly mutable:boolean;
  readonly moduleLabel:string|null;
  readonly site:Omit<CompilerLocation,'source'>|null;
  readonly references:ComparisonReferenceCounts|null;
}
export interface StructuralGroup{
  /** Comparison-local ID assigned by shared structural interning. */
  readonly id:number;
  readonly name:string;
  readonly kind:CompilerSymbolKind;
  readonly fileLabel:string|null;
  readonly owner:number|null;
}
export interface ComparisonRow{
  readonly group:StructuralGroup;
  readonly before:readonly SymbolProjection[];
  readonly after:readonly SymbolProjection[];
  readonly change:ChangeKind;
  readonly metadataChanged:boolean;
  readonly referencesChanged:boolean;
  readonly positionChanged:boolean;
  readonly ambiguousAncestor:boolean;
}
export interface FileComparison{
  readonly label:string;
  readonly before:number|null;
  readonly after:number|null;
  readonly referencesBefore:number|null;
  readonly referencesAfter:number|null;
}
export interface NavigationComparison{
  readonly rows:readonly ComparisonRow[];
  readonly counts:Readonly<Record<ChangeKind,number>>;
  readonly files:readonly FileComparison[];
  readonly groups:readonly StructuralGroup[];
  readonly baselineSymbols:number;
  readonly currentSymbols:number;
  readonly includesReferences:boolean;
}
export type ComparisonResult={readonly ok:true;readonly value:NavigationComparison}|{readonly ok:false;readonly error:string};
const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;
function referenceCounts(report:CompilerNavigationReport):readonly (ComparisonReferenceCounts|null)[]{
  if(report.kind==='symbols')return report.symbols.map(()=>null);
  const counts=report.symbols.map(()=>({total:0,
    byKind:Object.fromEntries(REFERENCE_KINDS.map(key=>[key,0])) as Record<CompilerReferenceKind,number>,
    files:new Map<string,number>()}));
  for(const ref of report.references){
    const row=counts[ref.target],file=report.files[ref.location.source].path;
    row.total++;row.byKind[ref.kind]++;row.files.set(file,(row.files.get(file)??0)+1);
  }
  return counts.map(row=>Object.freeze({total:row.total,byKind:Object.freeze(row.byKind),
    files:Object.freeze([...row.files.entries()].sort(([a],[b])=>compare(a,b)).map(([label,count])=>Object.freeze({label,count})))}));
}
function projection(report:CompilerNavigationReport,symbol:CompilerSymbol,refs:readonly (ComparisonReferenceCounts|null)[]):SymbolProjection{
  const location=symbol.location;
  return Object.freeze({id:symbol.id,public:symbol.public,mutable:symbol.mutable,
    moduleLabel:symbol.targetModule===null?null:report.files[symbol.targetModule].path,
    site:location===null?null:Object.freeze({byteStart:location.byteStart,byteEnd:location.byteEnd,
      line:location.line,column:location.column,endLine:location.endLine,endColumn:location.endColumn}),
    references:refs[symbol.id]});
}
function equalReferences(a:ComparisonReferenceCounts|null,b:ComparisonReferenceCounts|null):boolean{
  if(a===null||b===null)return a===b;
  return a.total===b.total&&REFERENCE_KINDS.every(kind=>a.byKind[kind]===b.byKind[kind])&&
    a.files.length===b.files.length&&a.files.every((file,i)=>file.label===b.files[i].label&&file.count===b.files[i].count);
}
function equalPositions(a:SymbolProjection['site'],b:SymbolProjection['site']):boolean{
  return a===null||b===null?a===b:
    a.byteStart===b.byteStart&&a.byteEnd===b.byteEnd&&a.line===b.line&&a.column===b.column&&
    a.endLine===b.endLine&&a.endColumn===b.endColumn;
}
function fileCounts(report:CompilerNavigationReport){
  const files=new Map(report.files.map(file=>[file.path,{definitions:0,references:report.kind==='references'?0:null as number|null}]));
  for(const symbol of report.symbols)if(symbol.location)files.get(report.files[symbol.location.source].path)!.definitions++;
  if(report.kind==='references')for(const ref of report.references){
    const item=files.get(report.files[ref.location.source].path)!;item.references=item.references!+1;
  }
  return files;
}
/** Shared structural interning avoids storing a quadratic chain of owner
 * names for deep hierarchies. The key is an exact tuple of group-local
 * owner identity, kind, name, and opaque definition file label.
 * IDs from separate compiler reports are never compared or aligned.
 *
 * Repeated structural labels (e.g. shadowed bindings) are groups, not
 * unique identities. Descendants of ambiguous groups cannot be paired.
 * Reported count changes are not proof of source changes or semantics. */
export function compareNavigationSnapshots(baseline:NavigationBaseline|null,current:NavigationSnapshot):ComparisonResult{
  if(!baseline)return {ok:false,error:'Capture a compiler inventory as a session baseline first.'};
  if(!sameFilePath(baseline.folder,current.folder))return {ok:false,error:'The baseline belongs to another selected project.'};
  if(baseline.report.kind!==current.report.kind)return {ok:false,error:'Compare the same inspection mode. A symbols-only report has no reference inventory.'};
  const groups:StructuralGroup[]=[];
  const byKey=new Map<string,number>();
  const before:SymbolProjection[][]=[],after:SymbolProjection[][]=[];
  function index(report:CompilerNavigationReport,side:SymbolProjection[][]){
    const refs=referenceCounts(report);
    const identities=new Map<number,number>();
    for(const symbol of report.symbols){
      if(identities.has(symbol.id))continue;
      const trail:number[]=[];
      let id:number|null=symbol.id;
      // The strict report parser guarantees acyclic owners; retain a
      // defensive bound for callers constructing fixtures directly.
      const visited=new Set<number>();
      while(id!==null&&!identities.has(id)){
        if(visited.has(id)||!report.symbols[id])throw Error('Invalid owner inventory.');
        visited.add(id);trail.push(id);id=report.symbols[id].owner;
      }
      while(trail.length){
        const item=report.symbols[trail.pop()!];
        const owner=item.owner===null?null:identities.get(item.owner)!;
        const label=item.location===null?null:report.files[item.location.source].path;
        const key=JSON.stringify([owner,item.kind,item.name,label]);
        let group=byKey.get(key);
        if(group===undefined){
          group=groups.length;byKey.set(key,group);
          groups.push(Object.freeze({id:group,name:item.name,kind:item.kind,fileLabel:label,owner}));
          before.push([]);after.push([]);
        }
        identities.set(item.id,group);
        side[group].push(projection(report,item,refs));
      }
    }
  }
  try{index(baseline.report,before);index(current.report,after);}
  catch{return {ok:false,error:'The report owner or file inventory is invalid.'};}
  const counts=Object.fromEntries(CHANGE_KINDS.map(key=>[key,0])) as Record<ChangeKind,number>;
  const ambiguity:boolean[]=[];
  const rows=groups.map(group=>{
    const old=before[group.id],next=after[group.id];
    const ambiguousAncestor=group.owner!==null&&ambiguity[group.owner];
    const ambiguous=ambiguousAncestor||old.length>1||next.length>1;
    ambiguity.push(ambiguous);
    let metadataChanged=false,referencesChanged=false,positionChanged=false;
    let change:ChangeKind;
    if(ambiguous)change='ambiguous';
    else if(!old.length)change='only-current';
    else if(!next.length)change='only-baseline';
    else{
      metadataChanged=old[0].public!==next[0].public||old[0].mutable!==next[0].mutable||old[0].moduleLabel!==next[0].moduleLabel;
      referencesChanged=!equalReferences(old[0].references,next[0].references);
      positionChanged=!equalPositions(old[0].site,next[0].site);
      change=metadataChanged?'metadata':referencesChanged?'references':positionChanged?'positions':'unchanged';
    }
    counts[change]++;
    return Object.freeze({group,before:Object.freeze(old),after:Object.freeze(next),change,
      metadataChanged,referencesChanged,positionChanged,ambiguousAncestor});
  });
  const oldFiles=fileCounts(baseline.report),newFiles=fileCounts(current.report);
  const labels=[...new Set([...oldFiles.keys(),...newFiles.keys()])].sort(compare);
  const files=labels.map(label=>Object.freeze({label,before:oldFiles.get(label)?.definitions??null,
    after:newFiles.get(label)?.definitions??null,referencesBefore:oldFiles.get(label)?.references??null,
    referencesAfter:newFiles.get(label)?.references??null}));
  return {ok:true,value:Object.freeze({rows:Object.freeze(rows),counts:Object.freeze(counts),
    files:Object.freeze(files),groups:Object.freeze(groups),baselineSymbols:baseline.report.symbols.length,
    currentSymbols:current.report.symbols.length,includesReferences:current.report.kind==='references'})};
}
export function comparisonOwnerLabel(comparison:NavigationComparison,group:StructuralGroup):string{
  const names:string[]=[];let owner=group.owner;
  while(owner!==null&&names.length<8){
    const parent=comparison.groups[owner];names.unshift(parent.name);owner=parent.owner;
  }
  return (owner===null?'':'… / ')+names.join(' / ');
}
export interface ComparisonFilter{
  readonly query:string;
  readonly change:ChangeKind|'all'|'changed';
  readonly kind:CompilerSymbolKind|'all';
}
export const DEFAULT_COMPARISON_FILTER:ComparisonFilter=Object.freeze({query:'',change:'changed',kind:'all'});
export function filterComparison(comparison:NavigationComparison,filter:ComparisonFilter):ComparisonRow[]{
  const terms=filter.query.slice(0,MAX_COMPARISON_QUERY).trim().toLowerCase().split(/\s+/).filter(Boolean);
  return comparison.rows.filter(row=>{
    if(filter.kind!=='all'&&row.group.kind!==filter.kind)return false;
    if(filter.change==='changed'&&row.change==='unchanged')return false;
    if(filter.change!=='all'&&filter.change!=='changed'&&row.change!==filter.change)return false;
    if(!terms.length)return true;
    const text=[row.group.name,row.group.kind,row.group.fileLabel??'implicit',comparisonOwnerLabel(comparison,row.group)].join(' ').toLowerCase();
    return terms.every(term=>text.includes(term));
  });
}
export function comparisonPage<T>(rows:readonly T[],requested:number){
  const pages=Math.max(1,Math.ceil(rows.length/COMPARISON_PAGE_SIZE));
  const page=Number.isSafeInteger(requested)?Math.max(1,Math.min(pages,requested)):1;
  return {page,pages,items:rows.slice((page-1)*COMPARISON_PAGE_SIZE,page*COMPARISON_PAGE_SIZE)};
}
export function comparisonExport(comparison:NavigationComparison,rows:readonly ComparisonRow[],includeLabels=false){
  const lines=[
    'Scarp Studio — compiler inventory comparison',
    'Structural label groups only; not stable symbol identity or proof of source or semantic changes.',
    'Symbols: '+comparison.baselineSymbols+' → '+comparison.currentSymbols,
    'Reference inventory: '+(comparison.includesReferences?'compared counts':'not requested'),
    'Selected groups: '+rows.length+' of '+comparison.rows.length,
    includeLabels?'Opaque file and symbol labels included; review for private data.':'Names and paths omitted.',
  ];
  for(const kind of CHANGE_KINDS)lines.push(CHANGE_LABELS[kind]+': '+comparison.counts[kind]);
  let size=lines.join('\n').length,included=0;
  for(const row of rows){
    const line='Group #'+row.group.id+' | '+row.group.kind+' | '+CHANGE_LABELS[row.change]+
      ' | definitions '+row.before.length+' → '+row.after.length+
      (includeLabels?' | '+JSON.stringify(row.group.name)+' | '+JSON.stringify(row.group.fileLabel):'');
    if(size+line.length+1>MAX_COMPARISON_EXPORT-100)break;
    lines.push(line);size+=line.length+1;included++;
  }
  const omitted=rows.length-included;
  if(omitted)lines.push(omitted+' complete group row(s) omitted by size limit.');
  return {text:lines.join('\n'),included,omitted};
}
