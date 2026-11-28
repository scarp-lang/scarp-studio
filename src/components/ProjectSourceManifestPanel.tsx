import {useMemo,useRef,useState} from 'react';
import {ProjectSearchScopeControls} from './ProjectSearchScopeControls';
import {ManifestHistoryPanel} from './ManifestHistoryPanel';
import {DEFAULT_PROJECT_SEARCH_SCOPE,type ProjectSearchScope} from '../model/projectSearchScope';
import {
  prepareProjectInspection,INSPECTION_READ_LIMITS,INSPECTION_ORIGIN_LABELS,
  type InspectionSettings,type ProjectInspectionPlan,type InspectionControl,type InspectionProgress,type InspectionMode,
} from '../model/projectInspection';
import type {ProjectSearchSource} from '../model/projectSearch';
import {
  DEFAULT_MANIFEST_FILTER,MANIFEST_STATES,MANIFEST_STATE_LABELS,PRIVATE_MANIFEST_EXPORT,
  filterManifestFiles,pageManifest,summarizeManifest,groupManifestDuplicates,manifestReportText,
  type ManifestFilter,type ProjectSourceManifest,type ManifestExecution,type ManifestFile,
} from '../model/projectSourceManifest';

interface Props{
  listed:readonly ProjectSearchSource[];
  listingLimited:boolean;
  available:boolean;
  busy:boolean;
  onRun:(plan:ProjectInspectionPlan,settings:InspectionSettings,control:InspectionControl)=>Promise<ManifestExecution>;
}
function ManifestReview({plan,busy,onConfirm,onCancel}:{
  plan:ProjectInspectionPlan;busy:boolean;onConfirm:()=>void;onCancel:()=>void;
}){
  const [labels,setLabels]=useState(false);
  return <section aria-label="Review source manifest scan" className="project-scope-coverage">
    <p><strong>Review local SHA-256 source manifest</strong></p>
    <p>{plan.selected} selected of {plan.listed} listed sources · {plan.excluded} excluded · {plan.deferred} deferred · {plan.withheld} withheld.</p>
    <p>{plan.settings.mode==='working'?'Working buffers take precedence.':'Read saved disk snapshots only.'}</p>
    {plan.settings.listingLimited&&<p>Explorer listing is known to be limited.</p>}
    <p>No source files are changed or uploaded. Relative labels, exact UTF-8 digests, byte counts and line metrics are retained in session memory.</p>
    <button type="button" aria-expanded={labels} onClick={()=>setLabels(!labels)}>{labels?'Hide manifest scan labels':'Review manifest scan labels'}</button>
    {labels&&<div className="project-scope-inventory"><ul>
      {plan.sources.map(source=><li key={source.name}><code dir="auto">{source.name}</code></li>)}
    </ul></div>}
    <button type="button" disabled={busy} onClick={onConfirm}>Confirm source manifest scan</button>
    <button type="button" onClick={onCancel}>Cancel manifest scan review</button>
  </section>;
}
function FileObservation({file,digests}:{file:ManifestFile;digests:boolean}){
  return <li>
    <strong><code dir="auto">{file.name}</code></strong>
    <p>{MANIFEST_STATE_LABELS[file.state]} · {INSPECTION_ORIGIN_LABELS[file.origin]}{file.dirty?' · Dirty tab exists':''}</p>
    {file.metrics&&<>
      <p>{file.bytes} bytes · {file.metrics.units} UTF-16 units · {file.metrics.lines} editor lines · {file.metrics.blankLines} blank lines</p>
      <p>EOL: {file.metrics.eol} · LF {file.metrics.lf} / CRLF {file.metrics.crlf} / CR {file.metrics.cr}</p>
      <p>Final newline: {file.metrics.finalNewline?'yes':'no'}</p>
    </>}
    {digests&&file.digest&&<code className="manifest-digest">{file.digest}</code>}
  </li>;
}
export function ProjectSourceManifestResults({report}:{report:ProjectSourceManifest}){
  const [filter,setFilter]=useState<ManifestFilter>(DEFAULT_MANIFEST_FILTER);
  const [page,setPage]=useState(1);
  const [groupPage,setGroupPage]=useState(1);
  const [duplicates,setDuplicates]=useState(false);
  const [digests,setDigests]=useState(false);
  const [showReport,setShowReport]=useState(false);
  const [options,setOptions]=useState(PRIVATE_MANIFEST_EXPORT);
  const summary=useMemo(()=>summarizeManifest(report),[report]);
  const rows=useMemo(()=>filterManifestFiles(report,filter),[report,filter]);
  const groups=useMemo(()=>groupManifestDuplicates(report),[report]);
  const paged=pageManifest(rows,page),pagedGroups=pageManifest(groups,groupPage);
  const output=useMemo(()=>showReport?manifestReportText(report,options):'',[showReport,report,options]);
  function update(patch:Partial<ManifestFilter>){setFilter(old=>({...old,...patch}));setPage(1);}
  return <section aria-label="Source manifest results" className="project-scope-coverage">
    <p role="status"><strong>Manifest {report.status}</strong> · {report.complete?'Complete for chosen listed scope':'Incomplete coverage'}</p>
    <p>Historical snapshot evidence, not a live filesystem guarantee or compiler verification.
      Equal digests and byte counts are evidence of equal observed text, not permission to merge or delete sources.</p>
    <dl className="project-scope-stats">
      <div><dt>Selected sources</dt><dd>{report.selected}</dd></div>
      <div><dt>Hashed sources</dt><dd>{summary.hashed}</dd></div>
      <div><dt>Read unavailable / not observed</dt><dd>{summary.unread}</dd></div>
      <div><dt>Digest failures</dt><dd>{summary.hashFailed}</dd></div>
      <div><dt>Observed bytes</dt><dd>{summary.observedBytes}</dd></div>
      <div><dt>Observed editor lines</dt><dd>{summary.observedLines}</dd></div>
      <div><dt>Dirty matching tabs</dt><dd>{summary.dirty}</dd></div>
      <div><dt>Mixed EOL sources</dt><dd>{summary.mixedEndings}</dd></div>
      <div><dt>Missing final newline</dt><dd>{summary.missingFinalNewline}</dd></div>
      <div><dt>Equal digest groups</dt><dd>{summary.duplicateGroups}</dd></div>
      <div><dt>Deferred / withheld</dt><dd>{report.deferred} / {report.withheld}</dd></div>
    </dl>
    <label>Filter labels<input type="search" maxLength={120} aria-label="Filter source manifest labels" value={filter.query}
      onChange={event=>update({query:event.target.value})}/></label>
    <label>Coverage<select aria-label="Manifest source state" value={filter.state}
      onChange={event=>{const value=event.target.value;if(value==='all'||MANIFEST_STATES.includes(value as typeof MANIFEST_STATES[number]))
        update({state:value as ManifestFilter['state']});}}>
      <option value="all">All states</option>{MANIFEST_STATES.map(state=><option value={state} key={state}>{MANIFEST_STATE_LABELS[state]}</option>)}
    </select></label>
    <label>Snapshot origin<select aria-label="Manifest source origin" value={filter.origin}
      onChange={event=>{const value=event.target.value;if(value==='all'||value==='disk'||value==='open-buffer'||value==='none')update({origin:value});}}>
      <option value="all">All origins</option><option value="disk">Disk</option><option value="open-buffer">Working buffer</option><option value="none">No observation</option>
    </select></label>
    <label>Line endings<select aria-label="Manifest line ending filter" value={filter.eol}
      onChange={event=>{const value=event.target.value;if(value==='all'||value==='none'||value==='lf'||value==='crlf'||value==='cr'||value==='mixed')update({eol:value});}}>
      {['all','none','lf','crlf','cr','mixed'].map(value=><option key={value} value={value}>{value}</option>)}
    </select></label>
    <label>Order<select aria-label="Manifest source order" value={filter.order}
      onChange={event=>{const value=event.target.value;if(value==='source'||value==='bytes'||value==='lines')update({order:value});}}>
      <option value="source">Relative label</option><option value="bytes">Largest observed bytes</option><option value="lines">Most observed editor lines</option>
    </select></label>
    <label><input type="checkbox" checked={filter.duplicateOnly} onChange={event=>update({duplicateOnly:event.target.checked})}/>Only equal-digest group members</label>
    <label><input type="checkbox" checked={digests} onChange={event=>setDigests(event.target.checked)}/>Reveal source digests locally</label>
    <button type="button" onClick={()=>{setFilter(DEFAULT_MANIFEST_FILTER);setPage(1);}}>Reset manifest filters</button>
    <p role="status">{rows.length} matching observations · Page {paged.page} of {paged.pages}</p>
    <div className="project-scope-inventory"><ul>{paged.rows.map(file=><FileObservation key={file.name} file={file} digests={digests}/>)}
      {!rows.length&&<li>No matching manifest observations.</li>}
    </ul></div>
    <div className="project-scope-fields">
      <button type="button" disabled={paged.page===1} onClick={()=>setPage(paged.page-1)}>Previous manifest page</button>
      <button type="button" disabled={paged.page===paged.pages} onClick={()=>setPage(paged.page+1)}>Next manifest page</button>
    </div>
    <button type="button" aria-expanded={duplicates} onClick={()=>{setDuplicates(!duplicates);setGroupPage(1);}}>
      {duplicates?'Hide equal digest groups':'Review equal digest groups'}
    </button>
    {duplicates&&<section aria-label="Equal digest groups">
      <p>{groups.length} groups of matching observed SHA-256 and byte count.</p>
      <div className="project-scope-inventory"><ol>{pagedGroups.rows.map(group=><li key={group.id}>
        <strong>Group {group.id} · {group.files.length} sources · {group.bytes} bytes each</strong>
        {digests&&<code className="manifest-digest">{group.digest}</code>}
        <ul>{group.files.map(file=><li key={file.name}><code dir="auto">{file.name}</code> · {INSPECTION_ORIGIN_LABELS[file.origin]}</li>)}</ul>
      </li>)}</ol></div>
      <p>Page {pagedGroups.page} of {pagedGroups.pages}</p>
      <button type="button" disabled={pagedGroups.page===1} onClick={()=>setGroupPage(pagedGroups.page-1)}>Previous digest group page</button>
      <button type="button" disabled={pagedGroups.page===pagedGroups.pages} onClick={()=>setGroupPage(pagedGroups.page+1)}>Next digest group page</button>
    </section>}
    <button type="button" aria-expanded={showReport} onClick={()=>{setShowReport(!showReport);setOptions(PRIVATE_MANIFEST_EXPORT);}}>
      {showReport?'Hide source manifest report':'Review source manifest report'}
    </button>
    {showReport&&<>
      <label><input type="checkbox" checked={options.labels} onChange={event=>setOptions(old=>({...old,labels:event.target.checked}))}/>Include relative manifest labels</label>
      <label><input type="checkbox" checked={options.digests} onChange={event=>setOptions(old=>({...old,digests:event.target.checked}))}/>Include manifest digests</label>
      <textarea aria-label="Source manifest report" readOnly rows={10} value={output}/>
    </>}
  </section>;
}
export function ProjectSourceManifestPanel({listed,listingLimited,available,busy,onRun}:Props){
  const [expanded,setExpanded]=useState(false);
  const [scope,setScope]=useState<ProjectSearchScope>(DEFAULT_PROJECT_SEARCH_SCOPE);
  const [mode,setMode]=useState<InspectionMode>('working');
  const [review,setReview]=useState<ProjectInspectionPlan|null>(null);
  const [report,setReport]=useState<ProjectSourceManifest|null>(null);
  const [running,setRunning]=useState(false);
  const [progress,setProgress]=useState<InspectionProgress|null>(null);
  const [cancelRequested,setCancelRequested]=useState(false);
  const [notice,setNotice]=useState('');
  const active=useRef<{cancelled:boolean}|null>(null);
  const settings={scope,mode,listingLimited};
  const blocked=busy||running||!available;
  function preview(){
    if(blocked)return;
    const prepared=prepareProjectInspection(listed,settings);
    if(prepared.ok){setReview(prepared.value);setNotice('');}
    else{setReview(null);setNotice(prepared.error);}
  }
  async function run(){
    if(!review||blocked||active.current)return;
    const token={cancelled:false};active.current=token;
    const plan=review;
    setReview(null);setReport(null);setNotice('');setRunning(true);setProgress(null);setCancelRequested(false);
    try{
      const response=await onRun(plan,settings,{isCurrent:()=>active.current===token,isCancelled:()=>token.cancelled,
        onProgress:value=>{if(active.current===token)setProgress(value);}});
      if(response.kind==='report')setReport(response.report);
      else setNotice('Manifest scan invalidated. Review current sources again.');
    }catch{setNotice('Manifest scan could not complete. Review current sources again.');}
    finally{active.current=null;setRunning(false);setProgress(null);setCancelRequested(false);}
  }
  return <section className="sidebar-section" aria-label="Listed source manifest">
    <div className="sidebar-heading">SOURCE SNAPSHOT MANIFEST</div>
    <button type="button" className="insights-toggle" aria-expanded={expanded} disabled={running}
      onClick={()=>{setExpanded(!expanded);setReview(null);}}>{expanded?'Hide source snapshot manifest':'Review source snapshot manifest'}</button>
    {expanded&&<>
      <p>Read-only SHA-256 and line metrics for up to {INSPECTION_READ_LIMITS.files} listed sources and
        {' '}{INSPECTION_READ_LIMITS.totalBytes/1024/1024} MiB. No source text retained in results.</p>
      {!available&&<p>Choose a workspace folder in the desktop application.</p>}
      <label>Snapshot mode<select aria-label="Manifest snapshot mode" value={mode} disabled={blocked}
        onChange={event=>{const value=event.target.value;if(value==='working'||value==='saved'){setMode(value);setReview(null);}}}>
        <option value="working">Working buffers and disk</option><option value="saved">Saved disk only</option>
      </select></label>
      <ProjectSearchScopeControls listed={listed} scope={scope} busy={blocked} onChange={next=>{setScope(next);setReview(null);}}/>
      <button type="button" disabled={blocked} onClick={preview}>Review source manifest scan</button>
      {review&&<ManifestReview plan={review} busy={blocked} onConfirm={()=>void run()} onCancel={()=>setReview(null)}/>}
      {running&&<div role="status"><p>{progress?progress.observed+' / '+progress.total+' source observations':'Starting manifest scan'}</p>
        <button type="button" disabled={cancelRequested} onClick={()=>{if(active.current)active.current.cancelled=true;setCancelRequested(true);}}>
          {cancelRequested?'Manifest cancellation requested':'Cancel manifest scan'}
        </button>
      </div>}
      {notice&&<p role="alert">{notice}</p>}
    </>}
    <div hidden={!expanded}><ManifestHistoryPanel current={report} busy={blocked}/></div>
    {expanded&&report&&<>
      <ProjectSourceManifestResults report={report}/>
      <button type="button" disabled={running} onClick={()=>setReport(null)}>Dismiss source manifest results</button>
    </>}
  </section>;
}
