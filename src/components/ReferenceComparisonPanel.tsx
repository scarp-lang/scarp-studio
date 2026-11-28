import { useState } from 'react';
import type { StudioDocument } from '../model/documents';
import {
  captureReferenceComparison, referenceComparisonFreshness, referenceComparisonPage, referenceVersionLabel,
  type ReferenceComparisonReview, type ReferenceVersion, type ReferenceComparisonFreshness,
} from '../model/referenceComparison';

interface Props {
  documents: readonly StudioDocument[];
  activeId: string | null;
  selectedId: string | null;
  busy: boolean;
}
const freshnessMessages: Record<Exclude<ReferenceComparisonFreshness,'current'>,string> = {
  'selection-changed':'The selected sources or versions changed.',
  'source-closed':'A reviewed source has been closed.',
  'source-changed':'A reviewed source was edited, saved or renamed.',
  ambiguous:'A reviewed source identity is ambiguous.',
};
function VersionSelect({label,value,onChange}:{label:string;value:ReferenceVersion;onChange:(value:ReferenceVersion)=>void}) {
  return <label>{label}<select aria-label={label} value={value} onChange={event=>{
    const next=event.target.value;
    if(next==='working'||next==='saved')onChange(next);
  }}>
    <option value="working">Working buffer</option>
    <option value="saved">Last saved snapshot</option>
  </select></label>;
}
export function ReferenceComparisonPanel({documents,activeId,selectedId,busy}:Props) {
  const [primaryVersion,setPrimaryVersion]=useState<ReferenceVersion>('working');
  const [referenceVersion,setReferenceVersion]=useState<ReferenceVersion>('working');
  const [review,setReview]=useState<ReferenceComparisonReview|null>(null);
  const [error,setError]=useState('');
  const [context,setContext]=useState(true);
  const [page,setPage]=useState(1);
  const freshness=review?referenceComparisonFreshness(review,documents,activeId,selectedId,primaryVersion,referenceVersion):null;
  function compare() {
    if(busy||activeId===null||selectedId===null)return;
    const result=captureReferenceComparison(documents,activeId,selectedId,{
      primaryId:activeId,referenceId:selectedId,primaryVersion,referenceVersion,
    });
    setPage(1);
    if(result.ok){setReview(result.review);setError('');}
    else{setReview(null);setError(result.error);}
  }
  const visible=review?referenceComparisonPage(review.report,page):null;
  return <section className="reference-comparison" aria-label="Reference snapshot comparison">
    <p>Compare the active editor to the reference source. Reviews use in-memory snapshots only and never apply edits or read disk.</p>
    <div className="reference-comparison-controls">
      <VersionSelect label="Primary version" value={primaryVersion} onChange={setPrimaryVersion}/>
      <VersionSelect label="Compared reference version" value={referenceVersion} onChange={setReferenceVersion}/>
      <button type="button" disabled={busy||!activeId||!selectedId||activeId===selectedId} onClick={compare}>
        {review?'Refresh comparison':'Review comparison'}
      </button>
      {review&&<button type="button" onClick={()=>{setReview(null);setError('');setPage(1);}}>Clear comparison</button>}
    </div>
    {error&&<p role="alert">{error}</p>}
    {review&&visible&&<>
      <div className="reference-comparison-summary">
        <strong>{review.primary.name} → {review.reference.name}</strong>
        <small>{referenceVersionLabel(review.primary.version)} → {referenceVersionLabel(review.reference.version)}</small>
        {freshness==='current'?<span role="status">Current reviewed snapshots</span>:
          <span role="status">{freshness&&freshnessMessages[freshness]} Historical preview; refresh to compare current sources.</span>}
        {review.report.status==='clean'?<p>Selected snapshots are identical.</p>:
          review.report.status==='limited'?<p>{review.report.message}</p>:
          <p>+{review.report.addedLines} / −{review.report.removedLines} lines in reference relative to primary.
            {' '}{review.report.hunkCount} change hunks.</p>}
        {review.report.status==='ready'&&review.report.message&&<small>{review.report.message}</small>}
      </div>
      {visible.hunks.length>0&&<>
        <label className="reference-context-toggle"><input type="checkbox" checked={context} onChange={event=>setContext(event.target.checked)}/>
          Show unchanged context
        </label>
        {visible.hunks.map(hunk=><section className="reference-change-hunk" key={hunk.id}>
          <header>Primary {hunk.beforeStart},{hunk.beforeCount} → reference {hunk.afterStart},{hunk.afterCount}</header>
          <div className="reference-change-lines">
            {hunk.lines.filter(line=>context||line.kind!=='context').map((line,index)=>
              <div key={index} className={'reference-change-line reference-change-'+line.kind}>
                <span aria-label={line.kind}>{line.kind==='added'?'+':line.kind==='removed'?'−':'·'}</span>
                <span aria-label="Primary line">{line.beforeLine??'–'}</span>
                <span aria-label="Reference line">{line.afterLine??'–'}</span>
                <code dir="auto">{line.preview}{line.previewTruncated?'…':''}</code>
              </div>)}
          </div>
        </section>)}
        {visible.total>1&&<nav className="reference-comparison-pagination" aria-label="Change hunk pages">
          <button type="button" disabled={visible.page<=1} onClick={()=>setPage(visible.page-1)}>Previous hunks</button>
          <span>Page {visible.page} of {visible.total}</span>
          <button type="button" disabled={visible.page>=visible.total} onClick={()=>setPage(visible.page+1)}>Next hunks</button>
        </nav>}
      </>}
    </>}
  </section>;
}
