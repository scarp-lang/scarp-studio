import {useMemo,useState} from 'react';
import type {ProjectMigrationPlan} from '../model/projectIdentifierMigration';
import {buildMigrationImpact,pageImpact,impactReport,type ImpactFragment,type ImpactWindow} from '../model/migrationImpact';
function Fragments({parts,clippedStart,clippedEnd,side}:{
  parts:readonly ImpactFragment[];clippedStart:boolean;clippedEnd:boolean;side:'before'|'after';
}){
  return <code dir="auto" className="migration-preview-code">
    {clippedStart&&<span aria-label="Earlier context omitted">…</span>}
    {parts.map((part,index)=>part.changed?
      <mark key={index} className={'migration-token-'+side} title={'Mapping '+(part.rule!+1)}>{part.text}</mark>:
      <span key={index}>{part.text}</span>)}
    {clippedEnd&&<span aria-label="Later context omitted">…</span>}
  </code>;
}
function Window({window}:{window:ImpactWindow}){
  const ending=window.ending==='\r\n'?'CRLF':window.ending==='\r'?'CR':window.ending==='\n'?'LF':'End of file';
  return <li className="migration-preview-window">
    <p><strong>Line {window.line}</strong> · {window.sites} selected sites · {ending} unchanged</p>
    <div className="migration-preview-pair">
      <div><span>Before · column {window.beforeColumn}</span>
        <Fragments parts={window.before} clippedStart={window.prefixClipped} clippedEnd={window.suffixClipped} side="before"/>
      </div>
      <div><span>After · column {window.afterColumn}</span>
        <Fragments parts={window.after} clippedStart={window.prefixClipped} clippedEnd={window.suffixClipped} side="after"/>
      </div>
    </div>
  </li>;
}
export function MigrationImpactPanel({plan}:{plan:ProjectMigrationPlan}){
  const [expanded,setExpanded]=useState(false);
  const [source,setSource]=useState('');
  const [page,setPage]=useState(1);
  const [showReport,setShowReport]=useState(false);
  const [labels,setLabels]=useState(false);
  const result=useMemo(()=>expanded?buildMigrationImpact(plan):null,[expanded,plan]);
  const impact=result?.ok?result.value:null;
  const file=impact?.files.find(item=>item.source===source)??impact?.files[0];
  const visible=pageImpact(file?.windows??[],page);
  const output=useMemo(()=>impact&&showReport?impactReport(impact,labels):'',[impact,showReport,labels]);
  return <section aria-label="Migration combined impact" className="project-scope-coverage">
    <button type="button" aria-expanded={expanded} onClick={()=>{
      setExpanded(!expanded);if(expanded){setShowReport(false);setLabels(false);}
    }}>{expanded?'Hide combined migration preview':'Review combined migration preview'}</button>
    {expanded&&result&&!result.ok&&<p role="alert">{result.error}</p>}
    {impact&&<>
      <p>Review combined selected substitutions on each changed line. Highlighted tokens are the only proposed changes.
        Long lines are shown in bounded context windows; unchanged context may be omitted.</p>
      <dl className="project-scope-stats">
        <div><dt>Changed sources</dt><dd>{impact.files.length}</dd></div>
        <div><dt>Changed lines</dt><dd>{impact.changedLines}</dd></div>
        <div><dt>Selected substitutions</dt><dd>{impact.edits}</dd></div>
        <div><dt>UTF-8 bytes before</dt><dd>{impact.bytesBefore}</dd></div>
        <div><dt>UTF-8 bytes after</dt><dd>{impact.bytesAfter}</dd></div>
      </dl>
      <table><caption>Selected migration impact by mapping</caption>
        <thead><tr><th>Mapping</th><th>Selected sites</th></tr></thead>
        <tbody>{impact.ruleCounts.map((count,index)=><tr key={index}>
          <td><code>{plan.inventory.review.rules[index].from}</code> → <code>{plan.inventory.review.rules[index].to}</code></td><td>{count}</td>
        </tr>)}</tbody>
      </table>
      <label>Source<select aria-label="Migration combined preview source" value={file?.source??''}
        onChange={event=>{setSource(event.target.value);setPage(1);}}>
        {impact.files.map(item=><option key={item.source} value={item.source}>{item.source} · {item.changedLines} lines</option>)}
      </select></label>
      {file&&<>
        <p>{file.edits} substitutions over {file.changedLines} lines · {file.origin==='open-buffer'?'Working buffer':'Current disk snapshot'}</p>
        <p>{file.windows.length} context windows · Page {visible.page} of {visible.pages}</p>
        <div className="project-scope-inventory"><ul>{visible.rows.map(window=><Window key={window.id} window={window}/>)}</ul></div>
        <button type="button" disabled={visible.page===1} onClick={()=>setPage(visible.page-1)}>Previous migration preview page</button>
        <button type="button" disabled={visible.page===visible.pages} onClick={()=>setPage(visible.page+1)}>Next migration preview page</button>
      </>}
      <button type="button" aria-expanded={showReport} onClick={()=>{setShowReport(!showReport);if(showReport)setLabels(false);}}>
        {showReport?'Hide migration impact report':'Review migration impact report'}
      </button>
      {showReport&&<>
        <label><input type="checkbox" checked={labels} onChange={event=>setLabels(event.target.checked)}/>Include relative impact labels</label>
        <textarea aria-label="Migration impact report" readOnly rows={8} value={output}/>
        <p>Impact reports never include source text, identifier names or native paths.</p>
      </>}
    </>}
  </section>;
}
