import { useMemo, useRef, useState } from 'react';
import {
  compareVerificationBaselines, filterVerificationComparison, pageVerificationComparison,
  verificationComparisonReport, verificationDeltaLabel, MAX_VERIFICATION_BASELINES,
  type VerificationBaseline, type VerificationComparison, type VerificationComparisonFilter,
} from '../model/verificationComparison';
import { VERIFICATION_STATUS_LABELS, VERIFICATION_FILE_LABELS } from '../model/projectVerification';
import { INSPECTION_ORIGIN_LABELS } from '../model/projectInspection';

interface SavedBaseline {readonly id:number;readonly evidence:VerificationBaseline}
const filters:ReadonlyArray<{value:VerificationComparisonFilter;label:string}>=[
  {value:'all',label:'All source labels'},
  {value:'changed',label:'Changed counts or origin'},
  {value:'uncertain',label:'Not comparable'},
  {value:'earlier-only',label:'Earlier only'},
  {value:'current-only',label:'Current only'},
];

function ComparisonResults({data}:{data:VerificationComparison}){
  const [index,setIndex]=useState(0);
  const [filter,setFilter]=useState<VerificationComparisonFilter>('all');
  const [page,setPage]=useState(1);
  const [showReport,setShowReport]=useState(false);
  const [names,setNames]=useState(false);
  const [labels,setLabels]=useState(false);
  const rule=data.rules.find(item=>item.index===index)??data.rules[0];
  const rows=useMemo(()=>rule?filterVerificationComparison(rule,filter):[],[rule,filter]);
  const visible=pageVerificationComparison(rows,page);
  const report=useMemo(()=>showReport?verificationComparisonReport(data,names,labels):'',[data,names,labels,showReport]);
  return <section aria-label="Verification comparison results" className="project-scope-coverage">
    <p>Historical evidence only. Counts are comparable solely for fully scanned matching labels with the same source origin.</p>
    <dl className="project-scope-stats">
      <div><dt>Changed expectation statuses</dt><dd>{data.changedStatuses}</dd></div>
      <div><dt>Rules with incomplete coverage</dt><dd>{data.uncertainRules}</dd></div>
    </dl>
    <ul>{data.rules.map(item=><li key={item.index}>
      <button type="button" aria-pressed={item.index===rule?.index} onClick={()=>{
        setIndex(item.index);setPage(1);setFilter('all');
      }}>{item.name}</button>
      <p>{VERIFICATION_STATUS_LABELS[item.earlierStatus]} → {VERIFICATION_STATUS_LABELS[item.currentStatus]}</p>
      <p>{item.comparable} comparable labels · count change {verificationDeltaLabel(item.delta)}</p>
    </li>)}</ul>
    {rule&&<>
      <h4>Evidence for {rule.name}</h4>
      <p>{rule.earlierOnly} earlier-only · {rule.currentOnly} current-only labels.</p>
      <p>Comparable observed counts: {rule.earlierMatches??'Unknown'} → {rule.currentMatches??'Unknown'}.</p>
      <label>Comparison filter<select aria-label="Verification comparison filter" value={filter} onChange={event=>{
        const value=filters.find(item=>item.value===event.target.value);
        if(value){setFilter(value.value);setPage(1);}
      }}>{filters.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <div className="project-scope-inventory"><table>
        <caption>Compared literal evidence</caption>
        <thead><tr><th>Source label</th><th>Earlier observation</th><th>Current observation</th><th>Comparable change</th></tr></thead>
        <tbody>{visible.rows.map(row=><tr key={row.name}>
          <td><code dir="auto">{row.name}</code></td>
          <td>{row.earlier?VERIFICATION_FILE_LABELS[row.earlier.state]+' · '+INSPECTION_ORIGIN_LABELS[row.earlier.origin]+' · '+row.earlier.matches:'Not selected'}</td>
          <td>{row.current?VERIFICATION_FILE_LABELS[row.current.state]+' · '+INSPECTION_ORIGIN_LABELS[row.current.origin]+' · '+row.current.matches:'Not selected'}</td>
          <td>{verificationDeltaLabel(row.delta)}{row.originChanged?' · Origin changed':''}</td>
        </tr>)}</tbody>
      </table></div>
      {!rows.length&&<p>No labels match this comparison filter.</p>}
      <button type="button" disabled={visible.page===1} onClick={()=>setPage(visible.page-1)}>Previous verification comparison page</button>
      <span>Page {visible.page} of {visible.pages}</span>
      <button type="button" disabled={visible.page===visible.pages} onClick={()=>setPage(visible.page+1)}>Next verification comparison page</button>
    </>}
    <button type="button" aria-expanded={showReport} onClick={()=>setShowReport(value=>!value)}>
      {showReport?'Hide verification comparison report':'Review verification comparison report'}
    </button>
    {showReport&&<>
      <label><input type="checkbox" checked={names} onChange={event=>setNames(event.target.checked)}/>Include rule names in comparison report</label>
      <label><input type="checkbox" checked={labels} onChange={event=>setLabels(event.target.checked)}/>Include source labels in comparison report</label>
      <textarea aria-label="Verification comparison report" readOnly rows={8} value={report}/>
    </>}
  </section>;
}

export function VerificationComparisonPanel({current,busy}:{current:VerificationBaseline|null;busy:boolean}){
  const [expanded,setExpanded]=useState(false);
  const [saved,setSaved]=useState<readonly SavedBaseline[]>([]);
  const [selected,setSelected]=useState<number|null>(null);
  const [clearReview,setClearReview]=useState<readonly SavedBaseline[]|null>(null);
  const sequence=useRef(1);
  const earlier=saved.find(item=>item.id===selected);
  const comparison=useMemo(()=>earlier&&current?compareVerificationBaselines(earlier.evidence,current):null,[earlier,current]);
  function capture(){
    if(busy||!current||saved.length>=MAX_VERIFICATION_BASELINES)return;
    const id=sequence.current++;
    setSaved(previous=>[...previous,{id,evidence:current}]);
    setSelected(id);setClearReview(null);
  }
  return <section className="project-scope-coverage" aria-label="Verification history comparison">
    <button type="button" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>
      {expanded?'Hide verification history':'Compare verification runs'}
    </button>
    {expanded&&<>
      <p>Save up to {MAX_VERIFICATION_BASELINES} in-memory run baselines. Exact private rule settings remain in session memory for compatibility checks, never in reports.</p>
      <p>{saved.length} / {MAX_VERIFICATION_BASELINES} verification baselines saved.</p>
      <button type="button" disabled={busy||!current||saved.length>=MAX_VERIFICATION_BASELINES} onClick={capture}>Capture verification baseline</button>
      <label>Earlier verification run<select aria-label="Earlier verification run" value={selected??''}
        onChange={event=>setSelected(event.target.value?Number(event.target.value):null)}>
        <option value="">Choose a baseline</option>
        {saved.map(item=><option key={item.id} value={item.id}>Baseline {item.id} ({item.evidence.rules.length} rules)</option>)}
      </select></label>
      <button type="button" disabled={busy||!earlier} onClick={()=>{
        setSaved(previous=>previous.filter(item=>item.id!==selected));setSelected(null);setClearReview(null);
      }}>Remove verification baseline</button>
      <button type="button" disabled={busy||!saved.length} onClick={()=>setClearReview(saved)}>Review clearing verification baselines</button>
      {clearReview&&<div>
        <p>Remove all saved verification baselines? Current results are unchanged.</p>
        <button type="button" disabled={busy||clearReview!==saved} onClick={()=>{
          setSaved([]);setSelected(null);setClearReview(null);
        }}>Confirm clear verification baselines</button>
        <button type="button" onClick={()=>setClearReview(null)}>Cancel clearing verification baselines</button>
      </div>}
      {!current&&<p>Complete a reviewed verification run before comparing evidence.</p>}
      {comparison&& (comparison.ok?<ComparisonResults key={selected} data={comparison.value}/>:<p role="alert">{comparison.error}</p>)}
    </>}
  </section>;
}
