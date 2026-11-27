import { useState } from 'react';
import { previewTestSelection,testFilterError,MAX_TEST_FILTER_BYTES,type TestSelectionAction } from '../model/projectTestSelection';
import { utf8ByteLength } from '../model/utf8Text';
import type { ScarpTestReport } from '../model/projectTestReport';

interface Props {
  readonly folder:string;
  readonly busy:boolean;
  readonly report:ScarpTestReport|null;
  readonly onCommand:(action:TestSelectionAction,filter:string)=>void;
}
export function ProjectTestSelectionPanel({folder,busy,report,onCommand}:Props){
  const [expanded,setExpanded]=useState(false);
  const [filter,setFilter]=useState('');
  const [review,setReview]=useState<{folder:string;filter:string;action:TestSelectionAction}|null>(null);
  const error=testFilterError(filter);
  const matches=previewTestSelection(report,filter);
  const current=review!==null&&review.folder===folder&&review.filter===filter&&!error;
  function confirm(){
    if(!review||!current||busy)return;
    onCommand(review.action,review.filter);
    setReview(null);
  }
  return <section className="project-test-selection" aria-label="Filtered Scarp project tests">
    <button type="button" aria-expanded={expanded} onClick={()=>{setExpanded(value=>!value);setReview(null);}}>
      {expanded?'Hide test selection':'Select tests by filename'}
    </button>
    {expanded&&<>
      <p>Requires Scarp v0.0.7-alpha.3. Match a literal, case-sensitive substring of the filename in tests/.
        Not a regular expression, glob or directory path. List is read-only; Run executes selected saved test sources.</p>
      <label>Test filename substring
        <input aria-label="Literal test filename substring" value={filter} maxLength={MAX_TEST_FILTER_BYTES}
          disabled={busy||!!review} onChange={event=>setFilter(event.target.value)} placeholder="math"/>
      </label>
      <small>{utf8ByteLength(filter)}/{MAX_TEST_FILTER_BYTES} UTF-8 bytes</small>
      {filter&&error&&<p role="status">{error}</p>}
      {report&&!error&&<details>
        <summary>{matches.length} matching filename(s) in the previous report</summary>
        <p>Previous {report.filter===undefined?'unfiltered':'filtered'} report only. The compiler will discover current files again.</p>
        <ul>{matches.map(path=><li key={path}>{path}</li>)}</ul>
      </details>}
      <button type="button" disabled={busy||!!error||!!review} onClick={()=>setReview({folder,filter,action:'list-tests'})}>Review filtered discovery</button>
      <button type="button" disabled={busy||!!error||!!review} onClick={()=>setReview({folder,filter,action:'run-tests'})}>Review filtered run</button>
      {review&&<div className="transfer-review" role="group" aria-label="Confirm filtered test command">
        <p>{review.action==='list-tests'?'Discover matching test filenames without executing sources.':
          'Execute saved test sources whose filenames contain this exact substring. No matches is a failed strict run.'}</p>
        <code>{JSON.stringify(review.filter)}</code>
        <p>This is not a full-suite result. Save relevant source changes before continuing.</p>
        {!current&&<p role="alert">Project target or filter changed. Review again.</p>}
        <button type="button" disabled={busy||!current} onClick={confirm}>
          {review.action==='list-tests'?'Confirm filtered discovery':'Confirm filtered run'}
        </button>
        <button type="button" onClick={()=>setReview(null)}>Cancel test selection</button>
      </div>}
    </>}
  </section>;
}
