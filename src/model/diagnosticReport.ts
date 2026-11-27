import type { ScarpProjectAction } from '../services/project';

export const MAX_DIAGNOSTIC_REPORT_UNITS=256*1024;
export const MAX_DIAGNOSTIC_ROWS=64;
export const MAX_DIAGNOSTIC_RELATED=64;
export const MAX_DIAGNOSTIC_TEXT=16*1024;
export const MAX_DIAGNOSTIC_PATH=4096;
export const MAX_DIAGNOSTIC_EXPORT=64*1024;
export const DIAGNOSTIC_PAGE_SIZE=12;
export type DiagnosticAction='source-verify'|Extract<ScarpProjectAction,'verify'|'inspect-symbols'|'inspect-references'>;
export interface DiagnosticPosition {readonly line:number;readonly column:number}
export interface DiagnosticLocation {
  readonly path:string;
  readonly byteStart:number;
  readonly byteEnd:number;
  readonly start:DiagnosticPosition;
  readonly end:DiagnosticPosition;
}
export interface RelatedDiagnostic {
  readonly message:string;
  readonly location:DiagnosticLocation|null;
}
export interface DiagnosticDetail {
  readonly id:number;
  readonly code:string|null;
  readonly message:string;
  readonly primary:DiagnosticLocation|null;
  readonly related:readonly RelatedDiagnostic[];
  readonly help:string|null;
}
export interface DiagnosticReport {
  readonly action:DiagnosticAction;
  readonly diagnostics:readonly DiagnosticDetail[];
}
export type DiagnosticParse={readonly ok:true;readonly report:DiagnosticReport}|{readonly ok:false;readonly reason:string};
function fail(reason:string):DiagnosticParse{return {ok:false,reason};}
function record(value:unknown):Record<string,unknown>|null{
  return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
}
function integer(value:unknown,max:number):value is number{
  return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=max;
}
function validText(value:unknown,max:number):value is string{
  if(typeof value!=='string'||!value.length||value.length>max)return false;
  for(let i=0;i<value.length;i++){
    const unit=value.charCodeAt(i);
    if(unit>=0xd800&&unit<=0xdbff){
      const next=value.charCodeAt(++i);
      if(!(next>=0xdc00&&next<=0xdfff))return false;
    }else if(unit>=0xdc00&&unit<=0xdfff)return false;
  }
  return true;
}
function position(raw:unknown):DiagnosticPosition|null{
  const value=record(raw);
  if(!value||!integer(value.line,10_000_000)||!integer(value.column,10_000_000)||!value.line||!value.column)return null;
  return Object.freeze({line:value.line,column:value.column});
}
function location(raw:unknown):DiagnosticLocation|null{
  const value=record(raw);
  if(!value||!validText(value.path,MAX_DIAGNOSTIC_PATH)||!Array.isArray(value.span)||value.span.length!==2||
    !integer(value.span[0],0xffffffff)||!integer(value.span[1],0xffffffff)||value.span[0]>value.span[1])return null;
  const start=position(value.start),end=position(value.end);
  if(!start||!end||end.line<start.line||(end.line===start.line&&end.column<start.column))return null;
  // A valid zero-width span is an insertion point, not a range. Reject
  // contradictory positions for empty spans, but retain Unicode scalar data.
  if(value.span[0]===value.span[1]&&(start.line!==end.line||start.column!==end.column))return null;
  return Object.freeze({path:value.path,byteStart:value.span[0],byteEnd:value.span[1],start,end});
}
export function isStaticDiagnosticAction(action:unknown):action is DiagnosticAction{
  return action==='source-verify'||action==='verify'||action==='inspect-symbols'||action==='inspect-references';
}
/** The caller must provide the separate native stderr field from a static
 * command. There is no stdout fallback or tolerant line-by-line recovery:
 * any malformed record makes the whole structured report unavailable.
 * The original raw compiler display remains available independently. */
export function parseDiagnosticReport(stderr:string|null,action:DiagnosticAction):DiagnosticParse{
  if(!isStaticDiagnosticAction(action))return fail('Only non-executing compiler diagnostic channels are supported.');
  if(typeof stderr!=='string'||!stderr.trim()||stderr.length>MAX_DIAGNOSTIC_REPORT_UNITS)return fail('Diagnostic report is empty or exceeds the response budget.');
  const lines=stderr.trim().split(/\r?\n/);
  if(lines.length>MAX_DIAGNOSTIC_ROWS)return fail('Diagnostic record count exceeds the complete review budget.');
  const diagnostics:DiagnosticDetail[]=[];
  for(const line of lines){
    let raw:unknown;try{raw=JSON.parse(line);}catch{return fail('Diagnostic stderr contains a non-JSON record.');}
    const value=record(raw);
    if(!value||value.schema_version!==1||value.severity!=='error'||value.span_encoding!=='utf-8-bytes'||
      value.column_encoding!=='unicode-scalar'||value.position_base!==1||
      (value.code!==null&&(typeof value.code!=='string'||!/^E\d{4}$/.test(value.code)))||
      !validText(value.message,MAX_DIAGNOSTIC_TEXT)||
      (value.help!==null&&!validText(value.help,MAX_DIAGNOSTIC_TEXT))||
      !Array.isArray(value.related)||value.related.length>MAX_DIAGNOSTIC_RELATED){
      return fail('Unsupported or oversized diagnostic record.');
    }
    const primary=value.primary===null?null:location(value.primary);
    if(value.primary!==null&&!primary)return fail('Invalid primary diagnostic location.');
    const related:RelatedDiagnostic[]=[];
    for(const rawNote of value.related){
      const note=record(rawNote);
      if(!note||!validText(note.message,MAX_DIAGNOSTIC_TEXT))return fail('Invalid related diagnostic message.');
      const site=note.location===null?null:location(note.location);
      if(note.location!==null&&!site)return fail('Invalid related diagnostic location.');
      related.push(Object.freeze({message:note.message,location:site}));
    }
    diagnostics.push(Object.freeze({
      id:diagnostics.length,code:value.code as string|null,message:value.message,primary,
      related:Object.freeze(related),help:value.help as string|null,
    }));
  }
  return {ok:true,report:Object.freeze({action,diagnostics:Object.freeze(diagnostics)})};
}
export function visibleDiagnosticText(value:string):string{
  return value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,
    char=>'[U+'+char.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0')+']');
}
export function diagnosticLocationLabel(site:DiagnosticLocation|null):string{
  if(!site)return 'No source location reported';
  return visibleDiagnosticText(site.path)+':'+site.start.line+':'+site.start.column+
    ' → '+site.end.line+':'+site.end.column+' · UTF-8 bytes '+site.byteStart+'–'+site.byteEnd+
    (site.byteStart===site.byteEnd?' (insertion point)':'');
}
export interface DiagnosticSummary {
  readonly count:number;
  readonly located:number;
  readonly unlocated:number;
  readonly related:number;
  readonly distinctPaths:number;
  readonly byCode:readonly {code:string|null;count:number}[];
}
export function summarizeDiagnostics(report:DiagnosticReport):DiagnosticSummary{
  const paths=new Set<string>(),codes=new Map<string|null,number>();
  let located=0,related=0;
  for(const row of report.diagnostics){
    codes.set(row.code,(codes.get(row.code)??0)+1);
    if(row.primary){located++;paths.add(row.primary.path);}
    related+=row.related.length;
    for(const note of row.related)if(note.location)paths.add(note.location.path);
  }
  return Object.freeze({count:report.diagnostics.length,located,unlocated:report.diagnostics.length-located,related,
    distinctPaths:paths.size,byCode:Object.freeze([...codes.entries()].map(([code,count])=>Object.freeze({code,count})))});
}
export interface DiagnosticFilter {
  readonly query:string;
  readonly code:string|null|'all';
  readonly location:'all'|'located'|'unlocated';
  readonly relatedOnly:boolean;
}
export const DEFAULT_DIAGNOSTIC_FILTER:DiagnosticFilter=Object.freeze({query:'',code:'all',location:'all',relatedOnly:false});
export function filterDiagnosticDetails(report:DiagnosticReport,filter:DiagnosticFilter):DiagnosticDetail[]{
  const terms=filter.query.slice(0,120).trim().toLowerCase().split(/\s+/).filter(Boolean);
  return report.diagnostics.filter(row=>{
    if(filter.code!=='all'&&row.code!==filter.code)return false;
    if(filter.location!=='all'&&(row.primary!==null)!==(filter.location==='located'))return false;
    if(filter.relatedOnly&&!row.related.length)return false;
    if(!terms.length)return true;
    const fields=[row.code,row.message,row.help,row.primary?.path,...row.related.flatMap(note=>[note.message,note.location?.path])];
    const haystack=fields.filter((value):value is string=>typeof value==='string').join(' ').toLowerCase();
    return terms.every(term=>haystack.includes(term));
  });
}
export function diagnosticPage<T>(items:readonly T[],requested:number,pageSize=DIAGNOSTIC_PAGE_SIZE){
  const size=Number.isSafeInteger(pageSize)?Math.max(1,Math.min(64,pageSize)):DIAGNOSTIC_PAGE_SIZE;
  const pages=Math.max(1,Math.ceil(items.length/size));
  const page=Number.isSafeInteger(requested)?Math.max(1,Math.min(pages,requested)):1;
  return {page,pages,items:items.slice((page-1)*size,page*size)};
}
export interface DiagnosticExportOptions {
  readonly messages:boolean;
  readonly locations:boolean;
  readonly help:boolean;
  readonly related:boolean;
}
export const DEFAULT_DIAGNOSTIC_EXPORT:DiagnosticExportOptions=Object.freeze({messages:false,locations:false,help:false,related:false});
export function buildDiagnosticReport(report:DiagnosticReport,rows:readonly DiagnosticDetail[],options:DiagnosticExportOptions){
  const lines=[
    'Scarp Studio — static compiler diagnostic review',
    'Command: '+report.action,
    'Selected rows: '+rows.length+' of '+report.diagnostics.length,
    'Historical compiler coordinates; no executable path or navigation authority.',
    'Messages, help and locations may contain private text. Optional detail fields are excluded by default.',
  ];
  let units=lines.join('\n').length,included=0;
  for(const row of rows){
    const part=['','Diagnostic #'+row.id+' · '+(row.code??'No code reported'),'Related notes: '+row.related.length];
    if(options.messages)part.push('Message: '+JSON.stringify(visibleDiagnosticText(row.message)));
    if(options.locations)part.push('Primary: '+JSON.stringify(diagnosticLocationLabel(row.primary)));
    if(options.help&&row.help!==null)part.push('Help: '+JSON.stringify(visibleDiagnosticText(row.help)));
    if(options.related)for(const [i,note] of row.related.entries()){
      part.push('Related #'+(i+1)+(options.messages?': '+JSON.stringify(visibleDiagnosticText(note.message)):''));
      if(options.locations)part.push('Location: '+JSON.stringify(diagnosticLocationLabel(note.location)));
    }
    const text=part.join('\n');
    if(units+text.length+1>MAX_DIAGNOSTIC_EXPORT-100)break;
    lines.push(text);units+=text.length+1;included++;
  }
  const omitted=rows.length-included;
  if(omitted)lines.push(omitted+' whole diagnostic row(s) omitted by size limit.');
  return {text:lines.join('\n'),included,omitted};
}
