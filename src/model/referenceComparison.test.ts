import { describe, expect, it } from 'vitest';
import type { StudioDocument } from './documents';
import {
  captureReferenceComparison, referenceComparisonFreshness, referenceComparisonPage,
  referenceVersionLabel, type ReferenceComparisonRequest, type ReferenceComparisonReview,
} from './referenceComparison';
import { MAX_DIFF_SOURCE_UNITS } from './sourceDiff';

const doc=(id:string,content:string,savedContent=content,revision=1):StudioDocument=>
  ({id,name:id+'.srp',path:null,content,savedContent,revision});
const a=doc('a','first\nsecond\n','old a\n');
const b=doc('b','first\nthird\n','old b\n');
const request:ReferenceComparisonRequest={primaryId:'a',referenceId:'b',primaryVersion:'working',referenceVersion:'working'};
function capture(documents:readonly StudioDocument[]=[a,b], selection=request):ReferenceComparisonReview {
  const result=captureReferenceComparison(documents,selection.primaryId,selection.referenceId,selection);
  if(!result.ok)throw Error(result.error);
  return result.review;
}
function freshness(review:ReferenceComparisonReview,documents:readonly StudioDocument[]=[a,b],
  activeId:string|null='a',selectedId:string|null='b',
  primaryVersion=request.primaryVersion,referenceVersion=request.referenceVersion) {
  return referenceComparisonFreshness(review,documents,activeId,selectedId,primaryVersion,referenceVersion);
}
describe('reference comparison captures',()=>{
  it('compares working buffers in the documented direction',()=>{
    const review=capture();
    expect(review.report.status).toBe('ready');
    expect(review.report.addedLines).toBe(1);
    expect(review.report.removedLines).toBe(1);
    expect(review.report.hunks.flatMap(hunk=>hunk.lines).find(line=>line.kind==='added')?.preview).toBe('third');
    expect(review.report.hunks.flatMap(hunk=>hunk.lines).find(line=>line.kind==='removed')?.preview).toBe('second');
  });
  it('supports independently selecting saved or working versions',()=>{
    const review=capture([a,b],{...request,primaryVersion:'saved'});
    expect(review.primary.text).toBe('old a\n');
    expect(review.reference.text).toBe(b.content);
    expect(capture([a,b],{...request,referenceVersion:'saved'}).reference.text).toBe('old b\n');
    expect(referenceVersionLabel('saved')).toBe('Last saved snapshot');
    expect(referenceVersionLabel('working')).toBe('Working buffer');
  });
  it('reports identical snapshots without fabricating changes',()=>{
    const review=capture([a,{...b,content:a.content}]);
    expect(review.report.status).toBe('clean');
    expect(review.report.hunks).toEqual([]);
  });
  it('rejects missing, ambiguous, same-source and changed selections',()=>{
    expect(captureReferenceComparison([a],'a','b',request).ok).toBe(false);
    expect(captureReferenceComparison([a,b,b],'a','b',request).ok).toBe(false);
    expect(captureReferenceComparison([a,b],'b','a',request).ok).toBe(false);
    expect(captureReferenceComparison([a,b],null,'b',request).ok).toBe(false);
    expect(captureReferenceComparison([a,b],'a','a',{...request,referenceId:'a'}).ok).toBe(false);
  });
  it('enforces the text budget even for identical large snapshots',()=>{
    const huge='x'.repeat(MAX_DIFF_SOURCE_UNITS+1);
    expect(captureReferenceComparison([doc('a',huge),doc('b',huge)],'a','b',request).ok).toBe(false);
    expect(captureReferenceComparison([doc('a','tiny',huge),b],'a','b',{...request,primaryVersion:'saved'}).ok).toBe(false);
  });
  it('keeps diff engine limitations visible instead of guessing counts',()=>{
    const large=Array.from({length:2500},(_,i)=>'line'+i).join('\n');
    const review=capture([doc('a',large),b]);
    expect(review.report.status).toBe('limited');
    expect(review.report.addedLines).toBeNull();
    expect(review.report.hunks).toEqual([]);
  });
  it('copies identity and selected text, not live document objects',()=>{
    const mutable={...a};
    const review=capture([mutable,b]);
    mutable.content='changed';
    expect(review.primary.text).toBe(a.content);
    expect(Object.isFrozen(review.primary)).toBe(true);
    expect(Object.isFrozen(review.request)).toBe(true);
  });
});
describe('reference comparison freshness',()=>{
  it('ignores unrelated tabs and reordering',()=>{
    const review=capture();
    expect(freshness(review,[b,a,doc('c','new')])).toBe('current');
  });
  it('invalidates source changes and edit/revert generations',()=>{
    const review=capture();
    expect(freshness(review,[{...a,content:'edited',revision:2},b])).toBe('source-changed');
    expect(freshness(review,[{...a,revision:3},b])).toBe('source-changed');
    expect(freshness(review,[a,{...b,path:'/saved/b.srp'}])).toBe('source-changed');
  });
  it('tracks selection, version, closure and ambiguity independently',()=>{
    const review=capture();
    expect(freshness(review,[a,b],'b','a')).toBe('selection-changed');
    expect(freshness(review,[a,b],'a','b','saved')).toBe('selection-changed');
    expect(freshness(review,[a])).toBe('source-closed');
    expect(freshness(review,[a,a,b])).toBe('ambiguous');
  });
});
describe('reference comparison pagination',()=>{
  it('normalizes invalid and out-of-range pages',()=>{
    const report=capture().report;
    for(const page of [0,NaN,Infinity,100,-2,1.5]){
      expect(referenceComparisonPage(report,page).page).toBe(1);
      expect(referenceComparisonPage(report,page).hunks).toEqual(report.hunks);
    }
  });
  it('pages distant change hunks without duplicating them',()=>{
    const before=Array.from({length:100},(_,i)=>'line '+i);
    const after=before.map((line,i)=>i%10===0?'updated '+i:line);
    const report=capture([doc('a',before.join('\n')),doc('b',after.join('\n'))]).report;
    expect(report.hunks.length).toBeGreaterThan(4);
    const first=referenceComparisonPage(report,1);
    const second=referenceComparisonPage(report,2);
    expect(first.hunks).toHaveLength(4);
    expect(first.hunks.some(hunk=>second.hunks.some(item=>item.id===hunk.id))).toBe(false);
    expect(referenceComparisonPage(report,999).page).toBe(first.total);
  });
});
