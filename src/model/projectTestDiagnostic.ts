import { parseDiagnosticEnvelope,diagnosticLocationLabel,visibleDiagnosticText,type DiagnosticDetail,
  type DiagnosticLocation } from './diagnosticReport';
import type { ScarpTestCase,ScarpTestReport } from './projectTestReport';
import { utf8ByteLength } from './utf8Text';

export const MAX_PROJECT_TEST_RELATED=8;
export const MAX_PROJECT_TEST_DIAGNOSTIC_PATH_BYTES=4096;
export const MAX_PROJECT_TEST_DETAIL_UNITS=32*1024;
export type TestDetailCoverage='validated'|'summary-only'|'unsupported';
export interface TestDiagnosticInspection{
  readonly coverage:TestDetailCoverage;
  readonly detail:DiagnosticDetail|null;
}
const summaryOnly:TestDiagnosticInspection=Object.freeze({coverage:'summary-only',detail:null});
const unsupported:TestDiagnosticInspection=Object.freeze({coverage:'unsupported',detail:null});
/** Published v2 project test reports embed schema-1 error objects. The
 * project writer restricts location labels to portable relative paths.
 * Validate this additional contract independently of general diagnostics.
 * A label is never a path authorization, even when this returns true. */
export function isProjectDiagnosticLabel(path:string):boolean{
  return path.length>0&&utf8ByteLength(path)<=MAX_PROJECT_TEST_DIAGNOSTIC_PATH_BYTES&&
    !/[\\:\x00-\x1f\x7f-\x9f]/.test(path)&&
    path.split('/').every(part=>part!==''&&part!=='.'&&part!=='..');
}
function validLocation(site:DiagnosticLocation|null):boolean{
  return site===null||isProjectDiagnosticLabel(site.path);
}
function scalarBound(text:string,max:number):boolean{return Array.from(text).length<=max;}
/** Called only for a failed case of a parsed, action-bound project report.
 * Earlier Studio summaries remain usable when exact detail is unavailable.
 * A malformed or unsupported envelope must not expose partial locations. */
export function inspectProjectTestDiagnostic(raw:Record<string,unknown>):TestDiagnosticInspection{
  const fields=['span_encoding','column_encoding','position_base','primary','related'];
  if(!fields.some(field=>Object.hasOwn(raw,field)))return summaryOnly;
  const parsed=parseDiagnosticEnvelope(raw,0);
  if(!parsed.ok)return unsupported;
  const detail=parsed.detail;
  if(!scalarBound(detail.message,1600)||!validLocation(detail.primary)||
      (detail.help!==null&&!scalarBound(detail.help,512))||
      detail.related.length>MAX_PROJECT_TEST_RELATED||
      detail.related.some(note=>!scalarBound(note.message,512)||!validLocation(note.location)))return unsupported;
  return Object.freeze({coverage:'validated',detail});
}
export type TestFailureDetailFilter='all'|'located'|'unlocated'|'related'|'unavailable';
export interface TestFailureDetailRow{
  readonly path:string;
  readonly test:ScarpTestCase;
  readonly detail:DiagnosticDetail|null;
  readonly coverage:TestDetailCoverage;
}
export function testFailureDetailRows(report:ScarpTestReport):readonly TestFailureDetailRow[]{
  if(report.mode!=='run')return [];
  return report.tests.filter(test=>test.status==='failed').map(test=>({
    path:test.path,test,detail:test.inspection?.detail??null,coverage:test.inspection?.coverage??'summary-only',
  }));
}
export function filterTestFailureDetails(rows:readonly TestFailureDetailRow[],filter:TestFailureDetailFilter,query:string){
  const terms=query.slice(0,120).trim().toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter(row=>{
    if(filter==='located'&&!row.detail?.primary)return false;
    if(filter==='unlocated'&&(!row.detail||row.detail.primary))return false;
    if(filter==='related'&&!row.detail?.related.length)return false;
    if(filter==='unavailable'&&row.coverage==='validated')return false;
    const fields=[row.path,row.test.code,row.test.phase,row.test.message,row.test.help,row.detail?.primary?.path,
      ...row.detail?.related.flatMap(note=>[note.message,note.location?.path])??[]];
    return terms.every(term=>fields.some(value=>value?.toLowerCase().includes(term)));
  });
}
export function summarizeTestFailureDetails(rows:readonly TestFailureDetailRow[]){
  const locations=new Set<string>();
  let validated=0,located=0,related=0,unavailable=0;
  for(const row of rows){
    if(row.coverage==='validated')validated++;
    else unavailable++;
    if(row.detail?.primary){located++;locations.add(row.detail.primary.path);}
    for(const note of row.detail?.related??[]){related++;if(note.location)locations.add(note.location.path);}
  }
  return {total:rows.length,validated,located,related,unavailable,locations:locations.size};
}
export interface TestDetailExportOptions{
  readonly testLabels:boolean;
  readonly messages:boolean;
  readonly locations:boolean;
  readonly related:boolean;
}
export const DEFAULT_TEST_DETAIL_EXPORT:TestDetailExportOptions=Object.freeze({testLabels:false,messages:false,locations:false,related:false});
function field(value:string){return JSON.stringify(visibleDiagnosticText(value));}
export function buildTestFailureDetailExport(rows:readonly TestFailureDetailRow[],options:TestDetailExportOptions,historical:boolean){
  const header=[
    'Scarp Studio — project test failure detail',
    historical?'Historical report, not current source coordinates.':'Completed native test report; coordinates describe the run snapshot.',
    'Selected failures: '+rows.length,
    'Optional fields may disclose private source text or labels.',
  ];
  const chunks=[header.join('\n')+'\n'];
  let units=chunks[0].length,included=0;
  for(const row of rows){
    const lines=['','Failure '+(included+1)+' | '+(row.test.phase??'Unknown phase')+' | '+(row.test.code??'No code'),
      'Detail coverage: '+row.coverage];
    if(options.testLabels)lines.push('Test: '+field(row.path));
    if(options.messages&&row.test.message!==null)lines.push('Message: '+field(row.test.message));
    if(options.messages&&row.test.help!==null)lines.push('Help: '+field(row.test.help));
    if(row.detail){
      if(options.locations)lines.push('Primary: '+field(diagnosticLocationLabel(row.detail.primary)));
      lines.push('Related notes: '+row.detail.related.length);
      if(options.related)for(const [index,note] of row.detail.related.entries()){
        lines.push('Related '+(index+1)+(options.messages?': '+field(note.message):''));
        if(options.locations)lines.push('Location: '+field(diagnosticLocationLabel(note.location)));
      }
    }
    const chunk=lines.join('\n')+'\n';
    if(units+chunk.length>MAX_PROJECT_TEST_DETAIL_UNITS-100)break;
    chunks.push(chunk);units+=chunk.length;included++;
  }
  const omitted=rows.length-included;
  if(omitted)chunks.push('\n'+omitted+' whole failure row(s) omitted by size limit.');
  return {text:chunks.join(''),included,omitted};
}
