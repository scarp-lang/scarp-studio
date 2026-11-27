import type { ProjectDiskCheckEvidence,ProjectCommandDiskReview } from '../model/projectCommandDiskGuard';
function Phase({label,review}:{label:string;review:ProjectCommandDiskReview|null}){
  if(!review)return <p>{label}: not completed.</p>;
  return <div>
    <strong>{label}: {review.status}</strong>
    <p>{review.checked}/{review.total} open source check(s) attempted.</p>
    {review.rows.length>0&&<ul className="project-command-disk-rows">{review.rows.map(row=><li key={row.id}>
      <span>{row.name}</span><span>{row.status}</span>
    </li>)}</ul>}
    {!review.total&&<p>No open file-backed Scarp source buffers in this project.</p>}
  </div>;
}
export function ProjectCommandDiskEvidence({evidence,historical}:{evidence:ProjectDiskCheckEvidence;historical:boolean}){
  return <details className="project-command-disk-evidence">
    <summary>Open-source disk consistency evidence</summary>
    {historical&&<p role="status">Historical check evidence. These observations do not describe current disk contents.</p>}
    <p>Only already-open project sources were checked. Closed imports, fixtures, manifests and changes between reads are not covered.
      A matched check is not an atomic filesystem snapshot or proof of identical execution inputs.</p>
    <Phase label="Before command" review={evidence.before}/>
    <Phase label="After command" review={evidence.after}/>
  </details>;
}
