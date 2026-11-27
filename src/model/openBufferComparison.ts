import { sameOpenDocumentSnapshots, type EditorState, type BufferReplacement } from './editorState';
import { exactSnapshotEditBlocks, compareScarpSnapshots, type SnapshotEditBlock, type SourceDiffReport } from './sourceDiff';
import type { StudioDocument } from './documents';
import { assertScarpSourceText } from './sourceLimits';

export const MAX_TRANSFER_BLOCKS = 48;
export const MAX_TRANSFER_BLOCK_UNITS = 4096;
export const MAX_TRANSFER_PREVIEW_UNITS = 48 * 1024;
export type BufferVersion = 'working' | 'saved';
export interface BufferSide {
  readonly documentId: string;
  readonly version: BufferVersion;
}
export interface BufferComparisonRequest {
  readonly target: BufferSide;
  readonly reference: BufferSide;
}
export interface BufferComparison {
  readonly request: BufferComparisonRequest;
  readonly sessionRevision: number;
  readonly snapshots: readonly StudioDocument[];
  readonly target: StudioDocument;
  readonly reference: StudioDocument;
  readonly targetText: string;
  readonly referenceText: string;
  readonly report: SourceDiffReport;
}
export interface TransferBlock extends SnapshotEditBlock {
  readonly before: string;
  readonly after: string;
}
export interface TransferReview {
  readonly comparison: BufferComparison;
  readonly blocks: readonly TransferBlock[];
}
export interface BufferTransferPlan {
  readonly review: TransferReview;
  readonly selectedIds: readonly number[];
  readonly change: BufferReplacement;
}
type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): Result<never> => ({ ok: false, error });
const validVersion = (value: string) => value === 'working' || value === 'saved';
const sideText = (document: StudioDocument, version: BufferVersion) =>
  version === 'working' ? document.content : document.savedContent;
export function compareOpenBuffers(editor: EditorState, request: BufferComparisonRequest): Result<BufferComparison> {
  if (!validVersion(request.target.version) || !validVersion(request.reference.version)) return fail('Choose valid source versions.');
  if (request.target.documentId === request.reference.documentId && request.target.version === request.reference.version) {
    return fail('Choose two different buffer versions.');
  }
  const target = editor.documents.find(doc => doc.id === request.target.documentId);
  const reference = editor.documents.find(doc => doc.id === request.reference.documentId);
  if (!target || !reference) return fail('Both selected sources must still be open.');
  const targetText = sideText(target, request.target.version), referenceText = sideText(reference, request.reference.version);
  return { ok: true, value: Object.freeze({
    request: Object.freeze({ target: Object.freeze({ ...request.target }), reference: Object.freeze({ ...request.reference }) }),
    sessionRevision: editor.sessionRevision,
    snapshots: Object.freeze(editor.documents.map(doc => Object.freeze({ ...doc }))),
    target: Object.freeze({ ...target }), reference: Object.freeze({ ...reference }), targetText, referenceText,
    report: compareScarpSnapshots(targetText, referenceText),
  }) };
}
export function bufferComparisonIsCurrent(comparison: BufferComparison, editor: EditorState): boolean {
  return comparison.sessionRevision === editor.sessionRevision &&
    sameOpenDocumentSnapshots(comparison.snapshots, editor.documents);
}
function sameComparison(a: BufferComparison,b: BufferComparison): boolean {
  return a.request.target.documentId === b.request.target.documentId && a.request.reference.documentId === b.request.reference.documentId &&
    a.request.target.version === b.request.target.version && a.request.reference.version === b.request.reference.version &&
    a.targetText === b.targetText && a.referenceText === b.referenceText &&
    sameOpenDocumentSnapshots([a.target,a.reference],[b.target,b.reference]);
}
/** Transfer is only into a working buffer, never into a saved baseline.
 * Exact non-context blocks are separately reviewed; limited diff previews
 * cannot authorize an edit. */
export function reviewBufferTransfer(comparison: BufferComparison, editor: EditorState): Result<TransferReview> {
  if (!bufferComparisonIsCurrent(comparison,editor)) return fail('Editor session changed. Compare again.');
  if (comparison.request.target.version !== 'working') return fail('Choose a working buffer as the transfer target.');
  const fresh = compareOpenBuffers(editor,comparison.request);
  if (!fresh.ok || !sameComparison(fresh.value,comparison)) return fail('Comparison snapshots no longer match.');
  try { assertScarpSourceText(fresh.value.targetText); assertScarpSourceText(fresh.value.referenceText); }
  catch { return fail('Source contains unsupported text.'); }
  const exact = exactSnapshotEditBlocks(fresh.value.targetText,fresh.value.referenceText);
  if (!exact.ok) return fail(exact.error);
  if (!exact.blocks.length) return fail('The selected texts are identical.');
  if (exact.blocks.length > MAX_TRANSFER_BLOCKS) return fail('Too many changed blocks for a complete transfer review.');
  let units=0;
  const blocks:TransferBlock[]=[];
  for(const block of exact.blocks){
    const before=fresh.value.targetText.slice(block.beforeStart,block.beforeEnd);
    const after=fresh.value.referenceText.slice(block.afterStart,block.afterEnd);
    units+=before.length+after.length;
    if(before.length>MAX_TRANSFER_BLOCK_UNITS||after.length>MAX_TRANSFER_BLOCK_UNITS||units>MAX_TRANSFER_PREVIEW_UNITS){
      return fail('Changed text exceeds the complete transfer preview budget. Edit manually or compare smaller sources.');
    }
    blocks.push(Object.freeze({...block,before,after}));
  }
  return {ok:true,value:Object.freeze({comparison:fresh.value,blocks:Object.freeze(blocks)})};
}
function sameBlocks(a:readonly TransferBlock[],b:readonly TransferBlock[]):boolean {
  return JSON.stringify(a)===JSON.stringify(b);
}
export function planBufferTransfer(review:TransferReview,selectedIds:readonly number[],editor:EditorState):Result<BufferTransferPlan>{
  const fresh=reviewBufferTransfer(review.comparison,editor);
  if(!fresh.ok||!sameBlocks(fresh.value.blocks,review.blocks))return fail('Transfer review changed. Compare again.');
  const ids=new Set(selectedIds);
  if(!ids.size||ids.size!==selectedIds.length||selectedIds.some(id=>!fresh.value.blocks.some(block=>block.id===id))){
    return fail('Select distinct reviewed change blocks.');
  }
  const selected=fresh.value.blocks.filter(block=>ids.has(block.id));
  const target=fresh.value.comparison.targetText;
  const chunks:string[]=[];
  let offset=0;
  for(const block of selected){
    if(block.beforeStart<offset||target.slice(block.beforeStart,block.beforeEnd)!==block.before)return fail('Transfer coordinates no longer match.');
    chunks.push(target.slice(offset,block.beforeStart),block.after);
    offset=block.beforeEnd;
  }
  chunks.push(target.slice(offset));
  // Partial application can put an LF beside a CR from another change.
  // Conservatively reject such joins rather than silently merging lines.
  const nonempty=chunks.filter(Boolean);
  if(nonempty.some((chunk,i)=>i>0&&nonempty[i-1].endsWith('\r')&&chunk.startsWith('\n'))){
    return fail('Selected blocks would merge adjacent CR and LF separators.');
  }
  const content=chunks.join('');
  if(content===target)return fail('Selected blocks would not change the target.');
  try{assertScarpSourceText(content);}catch{return fail('Transferred content exceeds the source limit.');}
  return {ok:true,value:Object.freeze({
    review:fresh.value,selectedIds:Object.freeze(selected.map(block=>block.id)),
    change:Object.freeze({id:fresh.value.comparison.target.id,snapshot:fresh.value.comparison.target,content}),
  })};
}
export function bufferTransferIsCurrent(plan:BufferTransferPlan,editor:EditorState):boolean{
  const fresh=planBufferTransfer(plan.review,plan.selectedIds,editor);
  return fresh.ok&&fresh.value.change.id===plan.change.id&&fresh.value.change.content===plan.change.content&&
    sameOpenDocumentSnapshots([fresh.value.change.snapshot],[plan.change.snapshot])&&
    fresh.value.selectedIds.every((id,i)=>id===plan.selectedIds[i]);
}
export function visibleTransferText(text:string):string{
  return JSON.stringify(text).replace(/[\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,
    char=>'\\u'+char.charCodeAt(0).toString(16).padStart(4,'0'));
}
