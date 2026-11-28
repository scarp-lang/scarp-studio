import {sameProjectScope,MAX_SCOPE_REPORT_UNITS,type ProjectSearchScope} from './projectSearchScope';
import type {InspectionMode,InspectionOrigin} from './projectInspection';
import type {ListedFunctionInterface,ListedSymbolReport} from './listedSymbolIndex';
import {sameInterfaceShape,displayInterfaceShape,type ScarpInterfaceShape,type InterfaceIssue} from '../language/scarpFunctionInterfaces';
import {validRelativeLabel} from './projectSearchComparison';

export const MAX_INTERFACE_BASELINES=6;
export const INTERFACE_PAGE_SIZE=16;
export interface InterfaceRecord{
  readonly source:string;
  readonly name:string;
  readonly public:boolean;
  readonly pure:boolean;
  readonly shape:ScarpInterfaceShape|null;
  readonly issue:InterfaceIssue|null;
}
export interface InterfaceFileEvidence{
  readonly name:string;
  readonly complete:boolean;
  readonly origin:InspectionOrigin;
  readonly records:readonly InterfaceRecord[];
}
export interface InterfaceBaseline{
  readonly scope:ProjectSearchScope;
  readonly mode:InspectionMode;
  readonly complete:boolean;
  readonly files:readonly InterfaceFileEvidence[];
}
type Result<T>={readonly ok:true;readonly value:T}|{readonly ok:false;readonly error:string};
const fail=(error:string):Result<never>=>({ok:false,error});
const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;

function copyShape(shape:ScarpInterfaceShape):ScarpInterfaceShape{
  return Object.freeze({name:shape.name,visibility:shape.visibility,pure:shape.pure,
    generic:Object.freeze([...shape.generic]),
    parameters:Object.freeze(shape.parameters.map(part=>Object.freeze([...part]))),
    returnType:shape.returnType===null?null:Object.freeze([...shape.returnType]),nextContract:shape.nextContract});
}
function record(item:ListedFunctionInterface):InterfaceRecord{
  return Object.freeze({
    source:item.site.source,name:item.site.name,public:item.site.visibility==='public',pure:item.site.pure,
    shape:item.evidence.ok?copyShape(item.evidence.shape):null,
    issue:item.evidence.ok?null:item.evidence.issue,
  });
}
/** Baselines contain explicitly requested interface token shapes, not
 * declaration coordinates, full source, native paths or contract expressions.
 * A partial file cannot establish removal or addition of a declaration.
 */
export function captureInterfaceBaseline(report:ListedSymbolReport):Result<InterfaceBaseline>{
  if(report.interfaces===null)return fail('Run a symbol index with interface capture enabled.');
  const declarations=report.declarations.filter(site=>site.kind==='function'&&site.scope==='top-level');
  const seen=new Set<string>();
  if(report.interfaces.length!==declarations.length||
    report.interfaces.some(item=>{
      if(!declarations.includes(item.site)||seen.has(item.site.id)||!validRelativeLabel(item.site.source))return true;
      seen.add(item.site.id);
      return item.evidence.ok&&(item.evidence.shape.name!==item.site.name||
        item.evidence.shape.visibility!==item.site.visibility||item.evidence.shape.pure!==item.site.pure);
    }))return fail('Interface observations do not match the retained declarations.');
  if(new Set(report.files.map(file=>file.name)).size!==report.files.length||
    report.files.some(file=>!validRelativeLabel(file.name))||
    report.interfaces.some(item=>!report.files.some(file=>file.name===item.site.source)))
    return fail('Interface file membership is inconsistent.');
  const files=report.files.map(file=>{
    const records=report.interfaces!.filter(item=>item.site.source===file.name).map(record);
    return Object.freeze({name:file.name,origin:file.origin,
      complete:file.state==='scanned'&&records.every(item=>item.shape!==null),
      records:Object.freeze(records)});
  });
  return {ok:true,value:Object.freeze({
    scope:Object.freeze({...report.settings.scope}),mode:report.settings.mode,
    complete:report.complete&&files.every(file=>file.complete),files:Object.freeze(files),
  })};
}
export type InterfaceChange='unchanged'|'shape-changed'|'visibility-changed'|'observed-added'|
  'observed-removed'|'ambiguous'|'incomplete'|'origin-changed'|'earlier-only-file'|'current-only-file';
export const INTERFACE_CHANGES=['unchanged','shape-changed','visibility-changed','observed-added',
  'observed-removed','ambiguous','incomplete','origin-changed','earlier-only-file','current-only-file'] as const;
export const INTERFACE_CHANGE_LABELS:Readonly<Record<InterfaceChange,string>>=Object.freeze({
  unchanged:'Same captured shape','shape-changed':'Captured shape changed','visibility-changed':'Visibility modifier changed',
  'observed-added':'New observed name','observed-removed':'Previously observed name absent',
  ambiguous:'Repeated name; cannot pair','incomplete':'Incomplete shape or file evidence',
  'origin-changed':'Snapshot origin changed','earlier-only-file':'Earlier selected file only',
  'current-only-file':'Current selected file only',
});
export interface InterfaceComparisonRow{
  readonly id:string;
  readonly source:string;
  readonly name:string;
  readonly change:InterfaceChange;
  readonly before:readonly InterfaceRecord[];
  readonly after:readonly InterfaceRecord[];
}
export interface InterfaceComparison{
  readonly earlierComplete:boolean;
  readonly currentComplete:boolean;
  readonly rows:readonly InterfaceComparisonRow[];
  readonly counts:Readonly<Record<InterfaceChange,number>>;
}
function groupByName(records:readonly InterfaceRecord[]){
  const grouped=new Map<string,InterfaceRecord[]>();
  for(const item of records){
    const list=grouped.get(item.name)??[];list.push(item);grouped.set(item.name,list);
  }
  return grouped;
}
function compareRecord(a:InterfaceFileEvidence|null,b:InterfaceFileEvidence|null,
  before:readonly InterfaceRecord[],after:readonly InterfaceRecord[]):InterfaceChange{
  if(!a)return 'current-only-file';
  if(!b)return 'earlier-only-file';
  if(a.origin!==b.origin)return 'origin-changed';
  if(before.length>1||after.length>1)return 'ambiguous';
  if(!a.complete||!b.complete||before.some(item=>!item.shape)||after.some(item=>!item.shape))return 'incomplete';
  if(!before.length)return 'observed-added';
  if(!after.length)return 'observed-removed';
  if(before[0].public!==after[0].public)return 'visibility-changed';
  return sameInterfaceShape(before[0].shape!,after[0].shape!)?'unchanged':'shape-changed';
}
export function compareInterfaceBaselines(earlier:InterfaceBaseline,current:InterfaceBaseline):Result<InterfaceComparison>{
  if(earlier.mode!==current.mode)return fail('Use the same working-buffer or saved-disk mode.');
  if(!sameProjectScope(earlier.scope,current.scope))return fail('Use the same directory, filename and batch scope.');
  const before=new Map(earlier.files.map(file=>[file.name,file]));
  const after=new Map(current.files.map(file=>[file.name,file]));
  const sources=[...new Set([...before.keys(),...after.keys()])].sort(compare);
  const rows:InterfaceComparisonRow[]=[];
  const counts=Object.fromEntries(INTERFACE_CHANGES.map(change=>[change,0])) as Record<InterfaceChange,number>;
  for(const source of sources){
    const a=before.get(source)??null,b=after.get(source)??null;
    const left=groupByName(a?.records??[]),right=groupByName(b?.records??[]);
    const names=[...new Set([...left.keys(),...right.keys()])].sort(compare);
    for(const name of names){
      const old=Object.freeze(left.get(name)??[]),next=Object.freeze(right.get(name)??[]);
      const change=compareRecord(a,b,old,next);
      counts[change]++;
      rows.push(Object.freeze({id:JSON.stringify([source,name]),source,name,change,before:old,after:next}));
    }
  }
  return {ok:true,value:Object.freeze({earlierComplete:earlier.complete,currentComplete:current.complete,
    rows:Object.freeze(rows),counts:Object.freeze(counts)})};
}
export interface InterfaceFilter{
  readonly query:string;
  readonly source:string;
  readonly publicOnly:boolean;
  readonly change:InterfaceChange|'all';
  readonly changedOnly:boolean;
}
export const DEFAULT_INTERFACE_FILTER:InterfaceFilter=Object.freeze({
  query:'',source:'',publicOnly:true,change:'all',changedOnly:false,
});
function queryMatches(query:string,...values:string[]):boolean{
  return query.length<=120&&!/[\x00-\x1f\x7f]/.test(query)&&
    (!query.trim()||values.join(' ').toLowerCase().includes(query.trim().toLowerCase()));
}
export function filterInterfaces(report:ListedSymbolReport,filter:InterfaceFilter):readonly ListedFunctionInterface[]{
  return (report.interfaces??[]).filter(item=>
    (!filter.publicOnly||item.site.visibility==='public')&&(!filter.source||item.site.source===filter.source)&&
    queryMatches(filter.query,item.site.name,item.site.source));
}
export function filterInterfaceComparison(data:InterfaceComparison,filter:InterfaceFilter){
  return data.rows.filter(row=>(!filter.publicOnly||[...row.before,...row.after].some(item=>item.public))&&
    (!filter.source||row.source===filter.source)&&(filter.change==='all'||row.change===filter.change)&&
    (!filter.changedOnly||row.change!=='unchanged')&&queryMatches(filter.query,row.source,row.name));
}
export function pageInterfaces<T>(rows:readonly T[],requested:number){
  const pages=Math.max(1,Math.ceil(rows.length/INTERFACE_PAGE_SIZE));
  const page=Math.min(pages,Math.max(1,Number.isSafeInteger(requested)?requested:1));
  return {page,pages,rows:rows.slice((page-1)*INTERFACE_PAGE_SIZE,page*INTERFACE_PAGE_SIZE)};
}
export interface InterfaceExportOptions{
  readonly includeLabels:boolean;
  readonly includeNames:boolean;
  readonly includeShapes:boolean;
}
const defaults:InterfaceExportOptions={includeLabels:false,includeNames:false,includeShapes:false};
function boundedReport(lines:string[]){
  let units=lines.join('\n').length;
  return {append:(line:string)=>{
    if(units+line.length+1>MAX_SCOPE_REPORT_UNITS-100)return false;
    lines.push(line);units+=line.length+1;return true;
  },finish:()=>lines.join('\n'),truncated:()=>{lines.push('Additional interface evidence omitted due to report size limit.');return lines.join('\n');}};
}
export function interfaceInventoryReport(report:ListedSymbolReport,options=defaults):string{
  const items=report.interfaces??[];
  const lines=[
    'Scarp Studio — captured lexical function interfaces',
    'Interface capture: '+(report.interfaces===null?'not requested':'requested'),
    'Lexical shapes only; compiler compatibility, binding identity and contract behavior are not checked.',
    'Top-level functions retained: '+items.length,
    'Public modifiers observed: '+items.filter(item=>item.site.visibility==='public').length,
    'Captured shapes: '+items.filter(item=>item.evidence.ok).length,
    'Unavailable shapes: '+items.filter(item=>!item.evidence.ok).length,
    'Listed source coverage: '+(report.complete?'complete':'incomplete'),
    'No function bodies, contract expressions or native paths included.',
  ];
  const output=boundedReport(lines);
  if(options.includeLabels||options.includeNames||options.includeShapes){
    for(const [index,item] of items.entries()){
      if(!output.append('Function '+(index+1)+(options.includeLabels?' in '+JSON.stringify(item.site.source):'')+
        (options.includeNames?' '+JSON.stringify(item.site.name):'')+
        '; '+(item.evidence.ok?'shape captured':'shape unavailable: '+item.evidence.issue)))return output.truncated();
      if(options.includeShapes&&item.evidence.ok&&!output.append('  '+displayInterfaceShape(item.evidence.shape)))return output.truncated();
    }
  }
  return output.finish();
}
export function interfaceComparisonReport(data:InterfaceComparison,options=defaults):string{
  const lines=[
    'Scarp Studio — lexical function interface comparison',
    'Exact relative label and function spelling are paired only when unambiguous.',
    'Earlier / current interface coverage: '+(data.earlierComplete?'complete':'incomplete')+' / '+(data.currentComplete?'complete':'incomplete'),
    ...INTERFACE_CHANGES.map(change=>INTERFACE_CHANGE_LABELS[change]+': '+data.counts[change]),
    'Observed absence is not proof of deletion or a breaking API change. Contract expressions are not compared.',
  ];
  const output=boundedReport(lines);
  if(options.includeLabels||options.includeNames||options.includeShapes){
    for(const [index,row] of data.rows.entries()){
      if(!output.append('Name group '+(index+1)+(options.includeLabels?' in '+JSON.stringify(row.source):'')+
        (options.includeNames?' '+JSON.stringify(row.name):'')+'; '+INTERFACE_CHANGE_LABELS[row.change]))return output.truncated();
      if(options.includeShapes){
        for(const [label,records] of [['Earlier',row.before],['Current',row.after]] as const){
          for(const item of records){
            if(!output.append('  '+label+': '+(item.shape?displayInterfaceShape(item.shape):'Shape unavailable')))return output.truncated();
          }
        }
      }
    }
  }
  return output.finish();
}
