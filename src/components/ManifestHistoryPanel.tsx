import {useMemo,useState} from 'react';
import {
  captureManifestBaseline,compareManifestBaselines,exportManifestBaseline,parseManifestBackup,
  filterManifestComparison,manifestComparisonReport,MANIFEST_CHANGES,MANIFEST_CHANGE_LABELS,
  DEFAULT_MANIFEST_COMPARISON_FILTER,MAX_MANIFEST_BASELINES,MAX_MANIFEST_BACKUP_UNITS,
  type SourceManifestBaseline,type ManifestComparison,type ManifestComparisonFilter,
} from '../model/sourceManifestComparison';
import {pageManifest,MANIFEST_STATE_LABELS,type ProjectSourceManifest,type ManifestFile} from '../model/projectSourceManifest';
import {INSPECTION_ORIGIN_LABELS} from '../model/projectInspection';

interface Entry{
  readonly id:number;
  readonly imported:boolean;
  readonly baseline:SourceManifestBaseline;
}
interface ImportReview{
  readonly raw:string;
  readonly revision:number;
  readonly baseline:SourceManifestBaseline;
}
function SnapshotCell({file,digests}:{file:ManifestFile|null;digests:boolean}){
  if(!file)return <span>Not selected</span>;
  return <div>
    <p>{MANIFEST_STATE_LABELS[file.state]} · {INSPECTION_ORIGIN_LABELS[file.origin]}</p>
    <p>{file.bytes===null?'Bytes unknown':file.bytes+' bytes'} · {file.metrics?file.metrics.lines+' editor lines':'Lines unknown'}</p>
    {digests&&file.digest&&<code className="manifest-digest">{file.digest}</code>}
  </div>;
}
function ComparisonResults({comparison}:{comparison:ManifestComparison}){
  const [filter,setFilter]=useState<ManifestComparisonFilter>(DEFAULT_MANIFEST_COMPARISON_FILTER);
  const [page,setPage]=useState(1);
  const [digests,setDigests]=useState(false);
  const [showReport,setShowReport]=useState(false);
  const [labels,setLabels]=useState(false);
  const [reportDigests,setReportDigests]=useState(false);
  const rows=useMemo(()=>filterManifestComparison(comparison,filter),[comparison,filter]);
  const paged=pageManifest(rows,page);
  const report=useMemo(()=>showReport?manifestComparisonReport(comparison,labels,reportDigests):'',
    [comparison,labels,reportDigests,showReport]);
  function update(patch:Partial<ManifestComparisonFilter>){
    setFilter(old=>({...old,...patch}));setPage(1);
  }
  return <section aria-label="Source manifest comparison" className="project-scope-coverage">
    <p>Only observations with the same relative label and snapshot origin are comparable.
      A label present in one selection does not establish creation or deletion.</p>
    <p>Earlier / current coverage: {comparison.earlierComplete?'complete':'incomplete'} / {comparison.currentComplete?'complete':'incomplete'}.</p>
    <dl className="project-scope-stats">
      {MANIFEST_CHANGES.map(change=><div key={change}><dt>{MANIFEST_CHANGE_LABELS[change]}</dt><dd>{comparison.counts[change]}</dd></div>)}
      <div><dt>Comparable labels</dt><dd>{comparison.comparable}</dd></div>
      <div><dt>Comparable byte delta</dt><dd>{comparison.byteDelta}</dd></div>
      <div><dt>Comparable editor-line delta</dt><dd>{comparison.lineDelta}</dd></div>
    </dl>
    <label>Filter labels<input type="search" maxLength={120} aria-label="Filter manifest comparison" value={filter.query}
      onChange={event=>update({query:event.target.value})}/></label>
    <label>Observation state<select aria-label="Manifest comparison state" value={filter.change}
      onChange={event=>{const value=event.target.value;if(value==='all'||MANIFEST_CHANGES.includes(value as typeof MANIFEST_CHANGES[number]))
        update({change:value as ManifestComparisonFilter['change']});}}>
      <option value="all">All observations</option>
      {MANIFEST_CHANGES.map(change=><option key={change} value={change}>{MANIFEST_CHANGE_LABELS[change]}</option>)}
    </select></label>
    <label><input type="checkbox" checked={filter.changedOnly} onChange={event=>update({changedOnly:event.target.checked})}/>Hide same-digest observations</label>
    <label><input type="checkbox" checked={digests} onChange={event=>setDigests(event.target.checked)}/>Reveal comparison digests locally</label>
    <button type="button" onClick={()=>{setFilter(DEFAULT_MANIFEST_COMPARISON_FILTER);setPage(1);}}>Reset manifest comparison filters</button>
    <p role="status">{rows.length} matching observations · Page {paged.page} of {paged.pages}</p>
    <div className="project-scope-inventory"><ul>
      {paged.rows.map(row=><li key={row.source}>
        <strong><code dir="auto">{row.source}</code></strong>
        <p>{MANIFEST_CHANGE_LABELS[row.change]}</p>
        <div className="manifest-pair">
          <div><strong>Earlier</strong><SnapshotCell file={row.earlier} digests={digests}/></div>
          <div><strong>Current</strong><SnapshotCell file={row.current} digests={digests}/></div>
        </div>
        {row.byteDelta!==null&&<p>Byte delta {row.byteDelta} · Editor-line delta {row.lineDelta}</p>}
      </li>)}
      {!rows.length&&<li>No matching observations.</li>}
    </ul></div>
    <div className="project-scope-fields">
      <button type="button" disabled={paged.page===1} onClick={()=>setPage(paged.page-1)}>Previous comparison page</button>
      <button type="button" disabled={paged.page===paged.pages} onClick={()=>setPage(paged.page+1)}>Next comparison page</button>
    </div>
    <button type="button" aria-expanded={showReport} onClick={()=>{setShowReport(!showReport);setLabels(false);setReportDigests(false);}}>
      {showReport?'Hide manifest comparison report':'Review manifest comparison report'}
    </button>
    {showReport&&<>
      <label><input type="checkbox" checked={labels} onChange={event=>setLabels(event.target.checked)}/>Include comparison labels</label>
      <label><input type="checkbox" checked={reportDigests} onChange={event=>setReportDigests(event.target.checked)}/>Include comparison digests</label>
      <textarea aria-label="Manifest comparison report" value={report} readOnly rows={10}/>
    </>}
  </section>;
}
export function ManifestHistoryPanel({current,busy}:{current:ProjectSourceManifest|null;busy:boolean}){
  const [entries,setEntries]=useState<readonly Entry[]>([]);
  const [nextId,setNextId]=useState(1);
  const [revision,setRevision]=useState(0);
  const [selected,setSelected]=useState(0);
  const [expanded,setExpanded]=useState(false);
  const [raw,setRaw]=useState('');
  const [review,setReview]=useState<ImportReview|null>(null);
  const [reveal,setReveal]=useState(false);
  const [notice,setNotice]=useState('');
  const chosen=entries.find(entry=>entry.id===selected);
  const currentBaseline=useMemo(()=>current?captureManifestBaseline(current):null,[current]);
  const comparison=useMemo(()=>chosen&&currentBaseline?.ok?
    compareManifestBaselines(chosen.baseline,currentBaseline.value):null,[chosen,currentBaseline]);
  const backup=useMemo(()=>reveal&&chosen?exportManifestBaseline(chosen.baseline):null,[reveal,chosen]);
  function add(baseline:SourceManifestBaseline,imported:boolean){
    if(busy||entries.length>=MAX_MANIFEST_BASELINES)return;
    setEntries(previous=>[...previous,{id:nextId,imported,baseline}]);
    setSelected(nextId);setNextId(nextId+1);setRevision(revision+1);setReview(null);setReveal(false);
    setNotice(imported?'Imported metadata retained for comparison only.':'Local source manifest captured in session history.');
  }
  function previewImport(){
    if(busy||entries.length>=MAX_MANIFEST_BASELINES)return;
    const parsed=parseManifestBackup(raw);
    if(!parsed.ok){setReview(null);setNotice(parsed.error);return;}
    setReview({raw,revision,baseline:parsed.value});setNotice('');
  }
  function confirmImport(){
    if(!review||busy||review.raw!==raw||review.revision!==revision||entries.length>=MAX_MANIFEST_BASELINES){
      setReview(null);setNotice('Import review changed; review again.');return;
    }
    add(review.baseline,true);setRaw('');
  }
  function remove(){
    if(!chosen||busy)return;
    setEntries(old=>old.filter(entry=>entry.id!==selected));setSelected(0);
    setRevision(revision+1);setReveal(false);setReview(null);setNotice('Selected baseline removed from session.');
  }
  return <section aria-label="Source manifest history" className="project-scope-coverage">
    <button type="button" aria-expanded={expanded} onClick={()=>{setExpanded(!expanded);setReview(null);setRaw('');setReveal(false);setNotice('');}}>
      {expanded?'Hide source manifest history':'Review source manifest history'}
    </button>
    {expanded&&<>
      <p>{entries.length} / {MAX_MANIFEST_BASELINES} session baselines. No automatic disk persistence.
        Imported evidence is unverified and cannot authorize file access.</p>
      <button type="button" disabled={busy||entries.length>=MAX_MANIFEST_BASELINES||!currentBaseline?.ok}
        onClick={()=>{if(currentBaseline?.ok)add(currentBaseline.value,false);}}>Capture current source manifest</button>
      <label>Earlier baseline<select aria-label="Earlier manifest baseline" value={selected}
        onChange={event=>{setSelected(Number(event.target.value));setReveal(false);setReview(null);}}>
        <option value={0}>Choose earlier baseline</option>
        {entries.map(entry=><option key={entry.id} value={entry.id}>Baseline {entry.id} · {entry.imported?'imported':'local'} · {entry.baseline.files.length} labels</option>)}
      </select></label>
      {chosen&&<>
        <p>Baseline {chosen.id}: {chosen.baseline.mode} mode · {chosen.baseline.complete?'complete':'incomplete'} coverage.
          {chosen.imported?' Imported metadata is not authenticated.':''}</p>
        <button type="button" disabled={busy} onClick={remove}>Remove selected manifest baseline</button>
        <label><input type="checkbox" checked={reveal} onChange={event=>setReveal(event.target.checked)}/>
          Reveal portable baseline including relative labels and digests</label>
        {backup?.ok&&<textarea aria-label="Portable source manifest baseline" rows={10} readOnly value={backup.value}/>}
        {backup&&!backup.ok&&<p role="alert">{backup.error}</p>}
      </>}
      {comparison?.ok&&<ComparisonResults key={selected} comparison={comparison.value}/>}
      {comparison&&!comparison.ok&&<p role="alert">{comparison.error}</p>}
      <label>Portable manifest JSON<textarea aria-label="Import source manifest baseline" rows={5} value={raw}
        maxLength={MAX_MANIFEST_BACKUP_UNITS} disabled={busy||entries.length>=MAX_MANIFEST_BASELINES}
        onChange={event=>{setRaw(event.target.value);setReview(null);setNotice('');}}/></label>
      <button type="button" disabled={busy||!raw||entries.length>=MAX_MANIFEST_BASELINES} onClick={previewImport}>Review manifest import</button>
      {review&&<section aria-label="Review source manifest import">
        <p>{review.baseline.files.length} selected labels · {review.baseline.mode} mode ·
          {' '}{review.baseline.complete?'reported complete':'reported incomplete'} coverage.</p>
        <p>Only relative labels, digest strings and bounded metrics are retained. These are supplied claims, not authenticated observations.</p>
        <button type="button" disabled={busy} onClick={confirmImport}>Confirm metadata-only manifest import</button>
        <button type="button" onClick={()=>setReview(null)}>Cancel manifest import</button>
      </section>}
      {notice&&<p role="status">{notice}</p>}
    </>}
  </section>;
}
