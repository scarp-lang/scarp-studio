import {useEffect,useMemo,useRef,useState} from 'react';
import {confirmManifestLedger,prepareManifestLedger,startManifestLedger,prepareLedgerBatch,recordManifestLedgerBatch,summarizeManifestLedger,
  ledgerDigestGroups,filterLedgerRows,manifestLedgerText,DEFAULT_LEDGER_FILTER,LEDGER_ROW_STATES,ledgerRowStateLabel,
  type ManifestLedger,type ManifestLedgerPlan,type LedgerFilter} from '../model/manifestBatchLedger';
import {pageManifest,MANIFEST_STATE_LABELS,type ManifestExecution} from '../model/projectSourceManifest';
import {INSPECTION_ORIGIN_LABELS,type InspectionMode,type InspectionSettings,type ProjectInspectionPlan,type InspectionControl,type InspectionProgress} from '../model/projectInspection';
import type {ProjectSearchScope} from '../model/projectSearchScope';
import type {ProjectSearchSource} from '../model/projectSearch';
interface Props{
  listed:readonly ProjectSearchSource[];scope:ProjectSearchScope;mode:InspectionMode;listingLimited:boolean;
  visible:boolean;busy:boolean;onRun:(plan:ProjectInspectionPlan,settings:InspectionSettings,control:InspectionControl)=>Promise<ManifestExecution>;
}
function LedgerObservations({ledger}:{ledger:ManifestLedger}){
  const [filter,setFilter]=useState(DEFAULT_LEDGER_FILTER);
  const [page,setPage]=useState(1);
  const [showGroups,setShowGroups]=useState(false);
  const [groupPage,setGroupPage]=useState(1);
  const [digests,setDigests]=useState(false);
  const [showReport,setShowReport]=useState(false);
  const [reportLabels,setReportLabels]=useState(false);
  const [reportDigests,setReportDigests]=useState(false);
  const summary=useMemo(()=>summarizeManifestLedger(ledger),[ledger]);
  const groups=useMemo(()=>ledgerDigestGroups(summary),[summary]);
  const rows=useMemo(()=>filterLedgerRows(summary,filter),[summary,filter]);
  const visible=pageManifest(rows,page),visibleGroups=pageManifest(groups,groupPage);
  const output=useMemo(()=>showReport?manifestLedgerText(ledger,reportLabels,reportDigests):'',[ledger,showReport,reportLabels,reportDigests]);
  function update(patch:Partial<LedgerFilter>){setFilter(old=>({...old,...patch}));setPage(1);}
  return <section aria-label="Sequential manifest ledger observations">
    <p>Receipts are historical, sequential observations. They do not prove that all files had these contents at the same instant.</p>
    <dl className="project-scope-stats">
      <div><dt>Recorded batches</dt><dd>{summary.recorded} / {summary.batches}</dd></div>
      <div><dt>Fully hashed completed batches</dt><dd>{summary.finished}</dd></div>
      <div><dt>Selected labels</dt><dd>{summary.selected}</dd></div>
      <div><dt>Hashed labels</dt><dd>{summary.hashed}</dd></div>
      <div><dt>Pending labels</dt><dd>{summary.pending}</dd></div>
      <div><dt>Unavailable observations</dt><dd>{summary.unavailable}</dd></div>
      <div><dt>Observed bytes</dt><dd>{summary.bytes}</dd></div>
      <div><dt>Equal digest groups</dt><dd>{groups.length}</dd></div>
    </dl>
    <p>{summary.allSelectedHashed?'All selected labels hashed across completed batches.':'Selected coverage incomplete.'}
      {' '}{summary.fullListedCoverage?'Full listed coverage across completed batches.':'Full listed coverage not established.'}</p>
    <label>Filter labels<input aria-label="Ledger label filter" type="search" maxLength={120} value={filter.query}
      onChange={event=>update({query:event.target.value})}/></label>
    <label>Observation state<select aria-label="Ledger observation state" value={filter.state}
      onChange={event=>{const value=event.target.value as LedgerFilter['state'];if(LEDGER_ROW_STATES.includes(value))update({state:value});}}>
      {LEDGER_ROW_STATES.map(state=><option key={state} value={state}>{ledgerRowStateLabel(state)}</option>)}
    </select></label>
    <label>Batch<select aria-label="Ledger observation batch" value={filter.batch??''} onChange={event=>update({batch:event.target.value?Number(event.target.value):null})}>
      <option value="">All batches</option>{ledger.plan.batches.map(batch=><option key={batch.index} value={batch.index}>Batch {batch.index}</option>)}
    </select></label>
    <label><input type="checkbox" checked={filter.duplicatesOnly} onChange={event=>update({duplicatesOnly:event.target.checked})}/>Only equal digest group members</label>
    <label><input type="checkbox" checked={digests} onChange={event=>setDigests(event.target.checked)}/>Reveal ledger digests locally</label>
    <button type="button" onClick={()=>{setFilter(DEFAULT_LEDGER_FILTER);setPage(1);}}>Reset ledger filters</button>
    <p>{rows.length} matching observations · Page {visible.page} of {visible.pages}</p>
    <div className="project-scope-inventory"><ul>{visible.rows.map(row=><li key={row.label}>
      <strong><code dir="auto">{row.label}</code></strong>
      <p>Batch {row.batch} · {row.sequence===null?'No receipt':'Receipt '+row.sequence} · {row.file?MANIFEST_STATE_LABELS[row.file.state]:'Not yet observed'}</p>
      {row.file&&<p>{INSPECTION_ORIGIN_LABELS[row.file.origin]} · {row.file.bytes===null?'Unknown bytes':row.file.bytes+' bytes'}</p>}
      {digests&&row.file?.digest&&<code className="manifest-digest">{row.file.digest}</code>}
    </li>)}</ul></div>
    {!rows.length&&<p>No matching ledger observations.</p>}
    <button type="button" disabled={visible.page===1} onClick={()=>setPage(visible.page-1)}>Previous ledger page</button>
    <button type="button" disabled={visible.page===visible.pages} onClick={()=>setPage(visible.page+1)}>Next ledger page</button>
    <button type="button" aria-expanded={showGroups} onClick={()=>{setShowGroups(!showGroups);setGroupPage(1);}}>
      {showGroups?'Hide':'Review'} cross-batch digest groups
    </button>
    {showGroups&&<section aria-label="Cross-batch digest groups">
      <p>Digest and byte equality across sequential observations is not permission to remove or merge sources.</p>
      <ul>{visibleGroups.rows.map(group=><li key={group.digest+':'+group.bytes}>
        <strong>{group.rows.length} labels across {group.batches} batches · {group.bytes} bytes each</strong>
        {digests&&<code className="manifest-digest">{group.digest}</code>}
        <ul>{group.rows.map(row=><li key={row.label}><code dir="auto">{row.label}</code> · Batch {row.batch}</li>)}</ul>
      </li>)}</ul>
      <p>Page {visibleGroups.page} of {visibleGroups.pages}</p>
      <button type="button" disabled={visibleGroups.page===1} onClick={()=>setGroupPage(visibleGroups.page-1)}>Previous ledger group page</button>
      <button type="button" disabled={visibleGroups.page===visibleGroups.pages} onClick={()=>setGroupPage(visibleGroups.page+1)}>Next ledger group page</button>
    </section>}
    <button type="button" aria-expanded={showReport} onClick={()=>{setShowReport(!showReport);setReportLabels(false);setReportDigests(false);}}>
      {showReport?'Hide':'Review'} sequential manifest report
    </button>
    {showReport&&<>
      <label><input type="checkbox" checked={reportLabels} onChange={event=>setReportLabels(event.target.checked)}/>Include relative ledger labels</label>
      <label><input type="checkbox" checked={reportDigests} onChange={event=>setReportDigests(event.target.checked)}/>Include ledger digest strings</label>
      <textarea aria-label="Sequential manifest ledger report" readOnly rows={10} value={output}/>
    </>}
  </section>;
}

export function ManifestBatchLedgerPanel({listed,scope,mode,listingLimited,visible,busy,onRun}:Props){
  const [expanded,setExpanded]=useState(false);
  const [review,setReview]=useState<ManifestLedgerPlan|null>(null);
  const [ledger,setLedger]=useState<ManifestLedger|null>(null);
  const [batch,setBatch]=useState(1);
  const [batchReview,setBatchReview]=useState<ProjectInspectionPlan|null>(null);
  const [running,setRunning]=useState(false);
  const [progress,setProgress]=useState<InspectionProgress|null>(null);
  const [cancelRequested,setCancelRequested]=useState(false);
  const [notice,setNotice]=useState('');
  const active=useRef<{cancelled:boolean}|null>(null);
  const blocked=busy||running;
  const current=useMemo(()=>ledger?confirmManifestLedger(ledger.plan,listed,scope,mode,listingLimited):null,[ledger,listed,scope,mode,listingLimited]);
  const latest=useRef({listed,scope,mode,listingLimited,visible});
  latest.current={listed,scope,mode,listingLimited,visible};
  useEffect(()=>{if(!visible){setExpanded(false);setReview(null);setBatchReview(null);setNotice('');if(active.current)active.current.cancelled=true;}},[visible]);
  function preview(){
    if(blocked)return;
    const result=prepareManifestLedger(listed,scope,mode,listingLimited);
    setBatchReview(null);
    if(result.ok){setReview(result.value);setNotice('');}
    else{setReview(null);setNotice(result.error);}
  }
  function start(){
    if(blocked||!review)return;
    const checked=confirmManifestLedger(review,listed,scope,mode,listingLimited);
    setReview(null);
    if(!checked.ok){setNotice(checked.error);return;}
    setLedger(startManifestLedger(checked.value));setBatch(1);setBatchReview(null);setNotice('Started ledger. No source reads yet.');
  }
  function reviewBatch(){
    if(blocked||!ledger)return;
    const checked=prepareLedgerBatch(ledger,batch,listed,scope,mode,listingLimited);
    if(checked.ok){setBatchReview(checked.value);setNotice('');}
    else{setBatchReview(null);setNotice(checked.error);}
  }
  async function run(){
    if(!ledger||!batchReview||blocked||active.current)return;
    const checked=prepareLedgerBatch(ledger,batch,listed,scope,mode,listingLimited);
    const original=batchReview;
    setBatchReview(null);
    if(!checked.ok||JSON.stringify(checked.value)!==JSON.stringify(original)){
      setNotice('Batch review changed. Review again.');return;
    }
    const token={cancelled:false};active.current=token;
    setRunning(true);setProgress(null);setCancelRequested(false);setNotice('');
    const settings=checked.value.settings;
    const stillCurrent=()=>{
      const now=latest.current;
      return active.current===token&&now.visible&&confirmManifestLedger(ledger.plan,now.listed,now.scope,now.mode,now.listingLimited).ok;
    };
    try{
      const result=await onRun(checked.value,settings,{isCurrent:stillCurrent,isCancelled:()=>token.cancelled,
        onProgress:value=>{if(active.current===token)setProgress(value);}});
      if(result.kind!=='report'||!stillCurrent()){setNotice('Ledger batch invalidated. Existing receipts retained.');return;}
      const recorded=recordManifestLedgerBatch(ledger,result.report,true);
      if(!recorded.ok){setNotice(recorded.error);return;}
      setLedger(recorded.value);setNotice('Recorded batch '+batch+' as '+result.report.status+'.');
    }catch{setNotice('Ledger batch failed. Existing receipts retained.');}
    finally{active.current=null;setRunning(false);setProgress(null);setCancelRequested(false);}
  }
  if(!visible)return null;
  return <section className="project-scope-coverage" aria-label="Sequential source manifest ledger">
    <button type="button" aria-expanded={expanded} disabled={running} onClick={()=>{setExpanded(!expanded);setReview(null);setBatchReview(null);setNotice('');}}>
      {expanded?'Hide':'Review'} sequential manifest ledger
    </button>
    {expanded&&<>
      <p>Review all numbered windows in the current directory and filename scope. The ordinary batch filter is ignored when creating a ledger.
        Each window requires separate confirmation; the ledger never starts background reads.</p>
      <button type="button" disabled={blocked} onClick={preview}>{ledger?'Review replacement ledger':'Review new manifest ledger'}</button>
      {review&&<section aria-label="Review manifest ledger membership">
        <p>{review.sources.length} eligible labels across {review.batches.length} batches · {review.excluded} excluded · {review.withheld} withheld.</p>
        <p>Mode: {review.mode}. {ledger?'Replacing the ledger discards existing receipt metadata.':'No files will be read yet.'}</p>
        <div className="project-scope-inventory"><ol>{review.batches.map(item=><li key={item.index}>
          Batch {item.index} · {item.labels.length} labels<ul>{item.labels.map(label=><li key={label}><code dir="auto">{label}</code></li>)}</ul>
        </li>)}</ol></div>
        <button type="button" disabled={blocked} onClick={start}>Confirm ledger membership</button>
        <button type="button" onClick={()=>setReview(null)}>Cancel ledger membership review</button>
      </section>}
      {ledger&&<>
        {current&&!current.ok&&<p role="alert">{current.error} Historical receipts remain available.</p>}
        <label>Batch to observe<select aria-label="Manifest ledger batch" value={batch} disabled={blocked}
          onChange={event=>{setBatch(Number(event.target.value));setBatchReview(null);}}>
          {ledger.plan.batches.map(item=>{
            const receipt=ledger.receipts.find(value=>value.batch===item.index);
            return <option key={item.index} value={item.index}>Batch {item.index} · {item.labels.length} labels · {receipt?receipt.status:'pending'}</option>;
          })}
        </select></label>
        <button type="button" disabled={blocked||!current?.ok} onClick={reviewBatch}>Review ledger batch scan</button>
        {batchReview&&<section aria-label="Review ledger batch scan">
          <p>{batchReview.selected} selected labels. {ledger.receipts.some(receipt=>receipt.batch===batch)?'This replaces the existing receipt for this batch.':'This records a new receipt.'}</p>
          <ul>{batchReview.sources.map(source=><li key={source.name}><code dir="auto">{source.name}</code></li>)}</ul>
          <button type="button" disabled={blocked||!current?.ok} onClick={()=>void run()}>Confirm ledger batch scan</button>
          <button type="button" onClick={()=>setBatchReview(null)}>Cancel ledger batch review</button>
        </section>}
        {running&&<div role="status"><p>{progress?progress.observed+' / '+progress.total+' observations':'Starting batch'}</p>
          <button type="button" disabled={cancelRequested} onClick={()=>{if(active.current)active.current.cancelled=true;setCancelRequested(true);}}>
            {cancelRequested?'Ledger cancellation requested':'Cancel ledger batch scan'}
          </button>
        </div>}
        <LedgerObservations key={ledger.plan.sources.map(source=>source.name).join('|')+':'+ledger.nextSequence} ledger={ledger}/>
      </>}
      {notice&&<p role="status">{notice}</p>}
    </>}
  </section>;
}
