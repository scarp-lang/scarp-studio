import { currentActiveDocument, isUnchangedSnapshot, type EditorState, type BufferReplacement } from './editorState';
import { assertScarpSourceText } from './sourceLimits';
import { assertWellFormedUtf16 } from './utf8Text';
import type { StudioDocument } from './documents';

export const MAX_SELECTION_COUNT = 24;
export const MAX_SELECTION_SOURCE = 512 * 1024;
export const MAX_SELECTION_PREVIEW = 24 * 1024;
export const MAX_SELECTION_AFFIX = 120;
export const MAX_SELECTION_REPEAT = 5;
export const SELECTION_OPERATIONS = ['surround', 'unwrap', 'duplicate', 'uppercase', 'lowercase', 'replace-literal', 'delete'] as const;
export type SelectionOperation = typeof SELECTION_OPERATIONS[number];
export const SELECTION_LABELS: Readonly<Record<SelectionOperation,string>> = Object.freeze({
  surround: 'Surround each selection',
  unwrap: 'Remove matching outer text',
  duplicate: 'Duplicate each selection',
  uppercase: 'Uppercase selected text',
  lowercase: 'Lowercase selected text',
  'replace-literal': 'Replace literal text within selections',
  delete: 'Delete selected text',
});
export interface TextSpan { readonly start: number; readonly end: number }
export interface SelectionCapture {
  readonly sessionRevision: number;
  readonly document: StudioDocument;
  readonly spans: readonly TextSpan[];
}
export interface SelectionRequest {
  readonly operation: SelectionOperation;
  readonly prefix: string;
  readonly suffix: string;
  readonly copies: number;
  readonly find: string;
  readonly replacement: string;
}
export const DEFAULT_SELECTION_REQUEST: SelectionRequest = Object.freeze({
  operation:'surround', prefix:'(', suffix:')', copies:2, find:'', replacement:'',
});
export interface SelectionPreview {
  readonly span: TextSpan;
  readonly line: number;
  readonly column: number;
  readonly before: string;
  readonly after: string;
  readonly occurrences: number;
}
export interface SelectionEditPlan {
  readonly capture: SelectionCapture;
  readonly request: SelectionRequest;
  readonly previews: readonly SelectionPreview[];
  readonly changed: number;
  readonly change: BufferReplacement;
}
export type SelectionResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };
const failed = (error:string): SelectionResult<never> => ({ok:false,error});

function safeBoundary(source:string, offset:number):boolean {
  if(offset===0||offset===source.length)return true;
  const left=source.charCodeAt(offset-1),right=source.charCodeAt(offset);
  return !(left>=0xd800&&left<=0xdbff&&right>=0xdc00&&right<=0xdfff)
    && !(left===13&&right===10);
}
/** These are exact UTF-16 model offsets, never byte offsets or guesses from
 * displayed columns. Sorting does not alter selection contents. Adjacent
 * selections are refused rather than combining independent edit intent. */
export function canonicalSelectionSpans(source:string, raw:readonly TextSpan[]):SelectionResult<readonly TextSpan[]> {
  if(!raw.length||raw.length>MAX_SELECTION_COUNT)return failed('Select between 1 and 24 nonempty text ranges.');
  const spans=raw.map(span=>({start:span.start,end:span.end})).sort((a,b)=>a.start-b.start||a.end-b.end);
  let previousEnd=-1,total=0;
  for(const span of spans){
    if(!Number.isSafeInteger(span.start)||!Number.isSafeInteger(span.end)||
      span.start<0||span.end>source.length||span.start>=span.end)
      return failed('Each selection must be a nonempty range inside the current source.');
    if(span.start<=previousEnd)return failed('Selections overlap or touch. Use separate ranges or a single combined selection.');
    if(!safeBoundary(source,span.start)||!safeBoundary(source,span.end))
      return failed('Selection splits a Unicode character or CRLF separator.');
    total+=span.end-span.start;
    if(total>MAX_SELECTION_PREVIEW)return failed('Selected text exceeds the complete preview budget.');
    previousEnd=span.end;
  }
  return {ok:true,value:Object.freeze(spans.map(span=>Object.freeze(span)))};
}
export function captureSelections(editor:EditorState,modelText:string,raw:readonly TextSpan[]):SelectionResult<SelectionCapture>{
  const document=currentActiveDocument(editor);
  if(!document)return failed('Open a source buffer before capturing selections.');
  if(document.content!==modelText)return failed('The editor model differs from the buffer. Capture again after it synchronizes.');
  if(document.content.length>MAX_SELECTION_SOURCE)return failed('Source exceeds the selection inspection limit.');
  try{assertScarpSourceText(document.content);}catch{return failed('Source contains unsupported text.');}
  const spans=canonicalSelectionSpans(document.content,raw);
  if(!spans.ok)return spans;
  return {ok:true,value:Object.freeze({sessionRevision:editor.sessionRevision,document:Object.freeze({...document}),spans:spans.value})};
}
export function sameSelectionSpans(left:readonly TextSpan[],right:readonly TextSpan[]):boolean{
  return left.length===right.length&&left.every((span,index)=>span.start===right[index].start&&span.end===right[index].end);
}
export function selectionCaptureIsCurrent(capture:SelectionCapture,editor:EditorState):boolean{
  const current=currentActiveDocument(editor);
  if(!current||editor.sessionRevision!==capture.sessionRevision||!isUnchangedSnapshot(current,capture.document))return false;
  const spans=canonicalSelectionSpans(current.content,capture.spans);
  return spans.ok&&sameSelectionSpans(spans.value,capture.spans);
}
export function selectionMatchesLive(capture:SelectionCapture,modelText:string,spans:readonly TextSpan[]):boolean{
  if(modelText!==capture.document.content)return false;
  const normalized=canonicalSelectionSpans(modelText,spans);
  return normalized.ok&&sameSelectionSpans(normalized.value,capture.spans);
}
function validLiteral(value:string,allowEmpty:boolean):boolean{
  if(typeof value!=='string'||(!allowEmpty&&!value.length)||value.length>MAX_SELECTION_AFFIX||
    /[\x00-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/.test(value))return false;
  try{assertWellFormedUtf16(value,'Selection text');return true;}catch{return false;}
}
function normalizeRequest(request:SelectionRequest):SelectionRequest|null{
  if(!SELECTION_OPERATIONS.includes(request.operation))return null;
  const affix=request.operation==='surround'||request.operation==='unwrap';
  const replace=request.operation==='replace-literal';
  if(affix&&(!validLiteral(request.prefix,true)||!validLiteral(request.suffix,true)||(!request.prefix&&!request.suffix)))return null;
  if(replace&&(!validLiteral(request.find,false)||!validLiteral(request.replacement,true)))return null;
  if(request.operation==='duplicate'&&(!Number.isSafeInteger(request.copies)||request.copies<2||request.copies>MAX_SELECTION_REPEAT))return null;
  return Object.freeze({
    operation:request.operation,prefix:affix?request.prefix:'',suffix:affix?request.suffix:'',
    copies:request.operation==='duplicate'?request.copies:2,find:replace?request.find:'',replacement:replace?request.replacement:'',
  });
}
function lineColumn(source:string,offset:number):{line:number;column:number}{
  let line=1,column=1;
  for(let i=0;i<offset;i++){
    if(source[i]==='\r'){if(source[i+1]==='\n')i++;line++;column=1;}
    else if(source[i]==='\n'){line++;column=1;}
    else column++;
  }
  return {line,column};
}
function transform(before:string,request:SelectionRequest):SelectionResult<{text:string;occurrences:number}>{
  let text=before,occurrences=0;
  switch(request.operation){
    case 'surround':text=request.prefix+before+request.suffix;break;
    case 'unwrap':
      if(!before.startsWith(request.prefix)||!before.endsWith(request.suffix)||
        before.length<request.prefix.length+request.suffix.length)
        return failed('Every selection must contain the complete matching outer text.');
      text=before.slice(request.prefix.length,before.length-request.suffix.length);
      break;
    case 'duplicate':
      if(before.endsWith('\r')&&before.startsWith('\n'))return failed('Duplication would fuse independent CR and LF separators.');
      if(before.length*request.copies>MAX_SELECTION_PREVIEW)return failed('Duplicated text exceeds the preview budget.');
      text=before.repeat(request.copies);break;
    case 'uppercase':text=before.toUpperCase();break;
    case 'lowercase':text=before.toLowerCase();break;
    case 'delete':text='';break;
    case 'replace-literal':{
      const parts:string[]=[];
      let offset=0,units=0;
      while(true){
        const found=before.indexOf(request.find,offset);
        if(found<0){parts.push(before.slice(offset));break;}
        units+=found-offset+request.replacement.length;
        if(units>MAX_SELECTION_PREVIEW)return failed('Literal replacement exceeds the preview budget.');
        parts.push(before.slice(offset,found),request.replacement);
        occurrences++;
        offset=found+request.find.length;
      }
      text=parts.join('');
      break;
    }
  }
  return {ok:true,value:{text,occurrences}};
}
/** All selections are reviewed against their original offsets and applied in
 * a single buffer transaction. This is literal text editing, not refactoring.
 * Never normalize text outside the captured selections. */
export function planSelectionEdit(editor:EditorState,capture:SelectionCapture,request:SelectionRequest):SelectionResult<SelectionEditPlan>{
  if(!selectionCaptureIsCurrent(capture,editor))return failed('Captured selection is stale. Capture again.');
  const normalized=normalizeRequest(request);
  if(!normalized)return failed('Choose valid operation options. Literal fields accept at most 120 units without control characters.');
  const source=capture.document.content;
  const previews:SelectionPreview[]=[];
  let total=0,changed=0;
  for(const span of capture.spans){
    const before=source.slice(span.start,span.end);
    const result=transform(before,normalized);
    if(!result.ok)return result;
    const after=result.value.text;
    total+=after.length;
    if(total>MAX_SELECTION_PREVIEW)return failed('Transformed selections exceed the complete preview budget.');
    // Refuse creating a CRLF across a formerly independent boundary.
    const left=source.slice(0,span.start),right=source.slice(span.end);
    if((left.endsWith('\r')&&(after.startsWith('\n')||(!after&&right.startsWith('\n'))))||
      (after.endsWith('\r')&&right.startsWith('\n')))
      return failed('Transformation would fuse separate CR and LF separators at a selection boundary.');
    if(before!==after)changed++;
    previews.push(Object.freeze({span,...lineColumn(source,span.start),before,after,occurrences:result.value.occurrences}));
  }
  if(!changed)return failed('The selected operation would not change any captured text.');
  const pieces:string[]=[];
  let offset=0;
  for(const preview of previews){
    pieces.push(source.slice(offset,preview.span.start),preview.after);
    offset=preview.span.end;
  }
  pieces.push(source.slice(offset));
  const content=pieces.join('');
  try{assertScarpSourceText(content);}catch{return failed('Transformed source exceeds Studio limits or contains unsupported text.');}
  return {ok:true,value:Object.freeze({capture,request:normalized,previews:Object.freeze(previews),changed,
    change:Object.freeze({id:capture.document.id,snapshot:capture.document,content})})};
}
export function selectionEditIsCurrent(plan:SelectionEditPlan,editor:EditorState):boolean{
  if(!selectionCaptureIsCurrent(plan.capture,editor)||
    !isUnchangedSnapshot(plan.capture.document,plan.change.snapshot)||plan.change.id!==plan.capture.document.id)return false;
  const fresh=planSelectionEdit(editor,plan.capture,plan.request);
  if(!fresh.ok)return false;
  const expected=fresh.value;
  return expected.change.content===plan.change.content&&expected.changed===plan.changed&&
    expected.previews.length===plan.previews.length&&expected.previews.every((row,index)=>{
      const other=plan.previews[index];
      return row.span.start===other.span.start&&row.span.end===other.span.end&&row.line===other.line&&
        row.column===other.column&&row.before===other.before&&row.after===other.after&&row.occurrences===other.occurrences;
    });
}
