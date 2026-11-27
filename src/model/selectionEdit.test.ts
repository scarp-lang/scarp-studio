import { describe, expect, it } from 'vitest';
import { editorReducer, initialEditorState, type EditorState } from './editorState';
import { createOpenFileReplaceUndo, canUndoOpenFileReplace } from './openFileReplaceUndo';
import { DEFAULT_SELECTION_REQUEST, MAX_SELECTION_AFFIX, MAX_SELECTION_COUNT, MAX_SELECTION_PREVIEW,
  MAX_SELECTION_SOURCE, canonicalSelectionSpans, captureSelections, planSelectionEdit, selectionCaptureIsCurrent,
  selectionEditIsCurrent, selectionMatchesLive, type SelectionRequest, type TextSpan } from './selectionEdit';

function state(content:string):EditorState{
  return editorReducer(initialEditorState,{type:'edit',id:initialEditorState.activeId!,content});
}
function capture(editor:EditorState,spans:readonly TextSpan[]){
  const result=captureSelections(editor,editor.documents.find(doc=>doc.id===editor.activeId)!.content,spans);
  if(!result.ok)throw Error(result.error);
  return result.value;
}
function plan(content:string,spans:readonly TextSpan[],request:Partial<SelectionRequest>={}){
  const editor=state(content);
  const result=planSelectionEdit(editor,capture(editor,spans),{...DEFAULT_SELECTION_REQUEST,...request});
  if(!result.ok)throw Error(result.error);
  return result.value;
}
function rejects(content:string,spans:readonly TextSpan[],request:Partial<SelectionRequest>={}){
  const editor=state(content);
  const result=planSelectionEdit(editor,capture(editor,spans),{...DEFAULT_SELECTION_REQUEST,...request});
  expect(result.ok).toBe(false);
}
describe('exact model selection capture',()=>{
  it('sorts unsorted UTF-16 ranges without changing the selected text',()=>{
    const editor=state('abc😀def\nxyz');
    const captured=capture(editor,[{start:9,end:12},{start:3,end:5}]);
    expect(captured.spans).toEqual([{start:3,end:5},{start:9,end:12}]);
    expect(captured.document.content.slice(3,5)).toBe('😀');
    expect(Object.isFrozen(captured.spans)).toBe(true);
  });
  it('requires the actual synchronized editor model',()=>{
    const editor=state('a\r\nb');
    expect(captureSelections(editor,'a\nb',[{start:0,end:1}]).ok).toBe(false);
    expect(captureSelections({...editor,activeId:null},'a\r\nb',[{start:0,end:1}]).ok).toBe(false);
    expect(captureSelections(editor,'a\r\nb',[{start:0,end:1}]).ok).toBe(true);
  });
  it.each([
    [],[{start:0,end:0}],[{start:-1,end:1}],[{start:0,end:10}],
    [{start:0.5,end:1}],[{start:2,end:1}],[{start:0,end:NaN}],
    [{start:0,end:3},{start:1,end:4}],[{start:0,end:2},{start:2,end:4}],
    [{start:0,end:1},{start:0,end:1}],
  ])('rejects invalid or overlapping selection spans %#',(...spans)=>{
    // Each data row is an array of arguments, including the empty case.
    expect(canonicalSelectionSpans('abcd',spans).ok).toBe(false);
  });
  it('rejects ranges that bisect surrogate pairs or CRLF',()=>{
    expect(canonicalSelectionSpans('😀a',[{start:1,end:3}]).ok).toBe(false);
    expect(canonicalSelectionSpans('a😀',[{start:0,end:2}]).ok).toBe(false);
    expect(canonicalSelectionSpans('a\r\nb',[{start:2,end:4}]).ok).toBe(false);
    expect(canonicalSelectionSpans('a\r\nb',[{start:1,end:3}]).ok).toBe(true);
  });
  it('enforces capture count and complete preview bounds',()=>{
    const content='x '.repeat(MAX_SELECTION_COUNT+1);
    const spans=Array.from({length:MAX_SELECTION_COUNT+1},(_,i)=>({start:i*2,end:i*2+1}));
    expect(canonicalSelectionSpans(content,spans).ok).toBe(false);
    expect(canonicalSelectionSpans(content,spans.slice(0,MAX_SELECTION_COUNT)).ok).toBe(true);
    expect(canonicalSelectionSpans('x'.repeat(MAX_SELECTION_PREVIEW+1),[{start:0,end:MAX_SELECTION_PREVIEW+1}]).ok).toBe(false);
    const large='x'.repeat(MAX_SELECTION_SOURCE+1);
    expect(captureSelections(state(large),large,[{start:0,end:1}]).ok).toBe(false);
  });
  it('rejects invalid source Unicode even if the selection itself is valid',()=>{
    expect(captureSelections(state('a\uD800'),'a\uD800',[{start:0,end:1}]).ok).toBe(false);
  });
});
describe('reviewed literal transformations',()=>{
  it('surrounds independent selections and preserves every intervening character',()=>{
    const result=plan('abc + def\r\nfooter',[{start:0,end:3},{start:6,end:9}]);
    expect(result.change.content).toBe('(abc) + (def)\r\nfooter');
    expect(result.previews.map(row=>[row.before,row.after])).toEqual([['abc','(abc)'],['def','(def)']]);
    expect(result.changed).toBe(2);
  });
  it('supports one-sided affixes and Unicode text',()=>{
    expect(plan('x y',[{start:0,end:1},{start:2,end:3}],{prefix:'😀',suffix:''}).change.content).toBe('😀x 😀y');
    expect(plan('x',[{start:0,end:1}],{prefix:'',suffix:'!'}).change.content).toBe('x!');
  });
  it('requires a complete non-overlapping outer match for every unwrap',()=>{
    expect(plan('(a) (b)',[{start:0,end:3},{start:4,end:7}],{operation:'unwrap'}).change.content).toBe('a b');
    rejects('(a) [b]',[{start:0,end:3},{start:4,end:7}],{operation:'unwrap'});
    rejects('abc',[{start:0,end:3}],{operation:'unwrap',prefix:'ab',suffix:'bc'});
    expect(plan('()',[{start:0,end:2}],{operation:'unwrap'}).change.content).toBe('');
  });
  it('duplicates exact multiline text without inventing separator characters',()=>{
    expect(plan('a\r\nb!', [{start:0,end:4}],{operation:'duplicate',copies:3}).change.content).toBe('a\r\nba\r\nba\r\nb!');
  });
  it('converts Unicode case with possible length changes',()=>{
    expect(plan('ß x',[{start:0,end:1}],{operation:'uppercase'}).change.content).toBe('SS x');
    expect(plan('İ x',[{start:0,end:1}],{operation:'lowercase'}).change.content).toBe('i\u0307 x');
  });
  it('replaces only literal non-overlapping matches within selections',()=>{
    const result=plan('aaaa / aa / aa',[{start:0,end:4},{start:12,end:14}],{operation:'replace-literal',find:'aa',replacement:'$&'});
    expect(result.change.content).toBe('$&$& / aa / $&');
    expect(result.previews.map(row=>row.occurrences)).toEqual([2,1]);
  });
  it('never matches across a range boundary or changes unselected matching text',()=>{
    expect(plan('aabb aabb',[{start:0,end:2}],{operation:'replace-literal',find:'aa',replacement:'X'}).change.content).toBe('Xbb aabb');
    rejects('aabb',[{start:0,end:2}],{operation:'replace-literal',find:'ab',replacement:'X'});
  });
  it('deletes only captured ranges, including full source when selected',()=>{
    expect(plan('a,b,c',[{start:0,end:1},{start:4,end:5}],{operation:'delete'}).change.content).toBe(',b,');
    expect(plan('😀',[{start:0,end:2}],{operation:'delete'}).change.content).toBe('');
  });
  it('reports line and UTF-16 column accurately with CR, LF and CRLF',()=>{
    const source='a\r\nb\rc\n😀z';
    const result=plan(source,[{start:3,end:4},{start:9,end:10}]);
    expect(result.previews.map(row=>[row.line,row.column])).toEqual([[2,1],[4,3]]);
  });
  it('refuses cross-boundary CRLF fusion after deletion or repetition',()=>{
    rejects('a\rX\nb',[{start:2,end:3}],{operation:'delete'});
    rejects('\nx\r',[{start:0,end:3}],{operation:'duplicate',copies:2});
  });
  it('rejects unsupported options and no-op transformations',()=>{
    rejects('a',[{start:0,end:1}],{prefix:'',suffix:''});
    rejects('a',[{start:0,end:1}],{prefix:'x'.repeat(MAX_SELECTION_AFFIX+1)});
    rejects('a',[{start:0,end:1}],{prefix:'\u202e'});
    rejects('a',[{start:0,end:1}],{prefix:'\ud800'});
    rejects('a',[{start:0,end:1}],{operation:'duplicate',copies:1});
    rejects('a',[{start:0,end:1}],{operation:'duplicate',copies:6});
    rejects('a',[{start:0,end:1}],{operation:'replace-literal',find:''});
    rejects('A',[{start:0,end:1}],{operation:'uppercase'});
  });
  it('checks combined before/after preview budgets before a plan can be applied',()=>{
    const text='x'.repeat(MAX_SELECTION_PREVIEW);
    rejects(text,[{start:0,end:text.length}],{operation:'surround'});
    rejects(text,[{start:0,end:text.length}],{operation:'replace-literal',find:'x',replacement:'yy'});
    rejects(text,[{start:0,end:text.length}],{operation:'duplicate',copies:5});
  });
});
describe('selection edit provenance and undo',()=>{
  it('requires the same live range set regardless of selection direction/order',()=>{
    const editor=state('a b c');
    const captured=capture(editor,[{start:0,end:1},{start:4,end:5}]);
    expect(selectionMatchesLive(captured,'a b c',[{start:4,end:5},{start:0,end:1}])).toBe(true);
    expect(selectionMatchesLive(captured,'a b c',[{start:2,end:3},{start:4,end:5}])).toBe(false);
    expect(selectionMatchesLive(captured,'changed',captured.spans)).toBe(false);
  });
  it('rejects stale plans after editing, reverting, opening or activating another tab',()=>{
    const editor=state('a b');
    const captured=capture(editor,[{start:0,end:1}]);
    const result=planSelectionEdit(editor,captured,DEFAULT_SELECTION_REQUEST);
    if(!result.ok)throw Error(result.error);
    const edited=editorReducer(editor,{type:'edit',id:editor.activeId!,content:'different'});
    const reverted=editorReducer(edited,{type:'edit',id:editor.activeId!,content:'a b'});
    const another=editorReducer(editor,{type:'new'});
    const switched=editorReducer(another,{type:'activate',id:editor.activeId!});
    expect(selectionCaptureIsCurrent(captured,edited)).toBe(false);
    expect(selectionCaptureIsCurrent(captured,reverted)).toBe(false);
    expect(selectionEditIsCurrent(result.value,switched)).toBe(false);
    expect(selectionEditIsCurrent(result.value,editor)).toBe(true);
  });
  it('rebuilds exact previews before permitting the buffer transaction',()=>{
    const editor=state('a b');
    const result=planSelectionEdit(editor,capture(editor,[{start:0,end:1}]),DEFAULT_SELECTION_REQUEST);
    if(!result.ok)throw Error(result.error);
    expect(selectionEditIsCurrent({...result.value,change:{...result.value.change,content:'forged'}},editor)).toBe(false);
    expect(selectionEditIsCurrent({...result.value,previews:[{...result.value.previews[0],after:'forged'}]},editor)).toBe(false);
    expect(selectionEditIsCurrent({...result.value,changed:99},editor)).toBe(false);
  });
  it('applies atomically in memory and retains a guarded undo snapshot',()=>{
    const editor=state('a b');
    const result=planSelectionEdit(editor,capture(editor,[{start:0,end:1}]),DEFAULT_SELECTION_REQUEST);
    if(!result.ok)throw Error(result.error);
    const applied=editorReducer(editor,{type:'replace-open-files',changes:[result.value.change],allSnapshots:editor.documents});
    expect(applied.documents[0].content).toBe('(a) b');
    expect(applied.documents[0].savedContent).toBe(editor.documents[0].savedContent);
    const undo=createOpenFileReplaceUndo(editor.documents,applied.documents)!;
    expect(canUndoOpenFileReplace(undo,applied)).toBe(true);
    const restored=editorReducer(applied,{type:'replace-open-files',changes:undo.changes,allSnapshots:undo.after});
    expect(restored.documents[0].content).toBe('a b');
    expect(canUndoOpenFileReplace(undo,restored)).toBe(false);
  });
});
