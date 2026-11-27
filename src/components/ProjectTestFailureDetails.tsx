import { useMemo,useState } from 'react';
import type { ScarpTestReport } from '../model/projectTestReport';
import { diagnosticLocationLabel,diagnosticPage,visibleDiagnosticText } from '../model/diagnosticReport';
import { testFailureDetailRows,filterTestFailureDetails,summarizeTestFailureDetails,buildTestFailureDetailExport,
  DEFAULT_TEST_DETAIL_EXPORT,type TestFailureDetailFilter,type TestDetailExportOptions } from '../model/projectTestDiagnostic';

interface Props{
  report:ScarpTestReport;
  historical:boolean;
}
export function ProjectTestFailureDetails({report,historical}:Props){
  const [expanded,setExpanded]=useState(false);
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState<TestFailureDetailFilter>('all');
  const [page,setPage]=useState(1);
  const [selected,setSelected]=useState<string|null>(null);
  const [exportOpen,setExportOpen]=useState(false);
  const [options,setOptions]=useState<TestDetailExportOptions>(DEFAULT_TEST_DETAIL_EXPORT);
  const [priorReport,setPriorReport]=useState(report);
  if(priorReport!==report){
    setPriorReport(report);setSelected(null);setPage(1);setExportOpen(false);setOptions(DEFAULT_TEST_DETAIL_EXPORT);
  }
  const rows=useMemo(()=>testFailureDetailRows(report),[report]);
  const summary=useMemo(()=>summarizeTestFailureDetails(rows),[rows]);
  const matching=useMemo(()=>expanded?filterTestFailureDetails(rows,filter,query):[],[expanded,rows,filter,query]);
  const visible=diagnosticPage(matching,page,8);
  const detail=matching.find(row=>row.path===selected)??null;
  if(!rows.length)return null;
  return <section className="test-failure-details" aria-label="Project test failure diagnostics">
    <header className="activity-header"><div><strong>Failure diagnostics</strong>
      <p>{summary.validated}/{summary.total} full diagnostic envelopes validated · {summary.related} related notes</p></div>
      <button type="button" aria-expanded={expanded} onClick={()=>{setExpanded(value=>!value);setExportOpen(false);setOptions(DEFAULT_TEST_DETAIL_EXPORT);}}>
        {expanded?'Hide failure diagnostics':'Inspect failure diagnostics'}
      </button></header>
    {expanded&&<>
      <p>Locations describe compiler-reported byte spans and Unicode scalar positions from the test run.
        They are not navigation targets. No file is opened or changed by this view.</p>
      {historical&&<p role="status">Historical failure details. Run tests again to obtain current reports.</p>}
      <dl className="activity-metrics">
        <div><dt>Primary locations</dt><dd>{summary.located}</dd></div>
        <div><dt>Related notes</dt><dd>{summary.related}</dd></div>
        <div><dt>Reported path labels</dt><dd>{summary.locations}</dd></div>
        <div><dt>Summary-only or unsupported</dt><dd>{summary.unavailable}</dd></div>
      </dl>
      <div className="activity-filters">
        <input type="search" aria-label="Search test failure diagnostics" value={query} maxLength={120}
          placeholder="Test, code, message, location or note" onChange={event=>{setQuery(event.target.value);setPage(1);setSelected(null);setExportOpen(false);}}/>
        <select aria-label="Test failure detail coverage" value={filter} onChange={event=>{
          const value=event.target.value;
          if(value==='all'||value==='located'||value==='unlocated'||value==='related'||value==='unavailable'){
            setFilter(value);setPage(1);setSelected(null);setExportOpen(false);
          }
        }}>
          <option value="all">All failures</option><option value="located">With primary location</option>
          <option value="unlocated">Validated without location</option><option value="related">With related notes</option>
          <option value="unavailable">Full detail unavailable</option>
        </select>
      </div>
      <p role="status">{matching.length} matching of {rows.length} failed tests</p>
      <div className="inspection-symbol-list">{visible.items.map(row=><button type="button" className="activity-record" key={row.path}
        aria-pressed={selected===row.path} onClick={()=>setSelected(row.path)}>
        <strong>{visibleDiagnosticText(row.path)}</strong>
        <span>{row.test.phase} · {row.test.code??'No code'}</span>
        <small>{row.coverage==='validated'?row.detail?.primary?'Primary location reported':'No primary location reported':'Full diagnostic unavailable'}</small>
      </button>)}</div>
      {!matching.length&&<p>No failed tests match these filters.</p>}
      {visible.pages>1&&<div className="inspection-page-controls">
        <button type="button" disabled={visible.page===1} onClick={()=>setPage(visible.page-1)}>Previous failures</button>
        <span>{visible.page}/{visible.pages}</span>
        <button type="button" disabled={visible.page===visible.pages} onClick={()=>setPage(visible.page+1)}>Next failures</button>
      </div>}
      {detail&&<section className="activity-detail" aria-label="Selected test failure diagnostic">
        <header className="activity-header"><strong>{visibleDiagnosticText(detail.path)}</strong>
          <button type="button" onClick={()=>setSelected(null)}>Close failure detail</button></header>
        {detail.test.message!==null&&<p dir="auto">{visibleDiagnosticText(detail.test.message)}</p>}
        {detail.test.help!==null&&<p dir="auto">{visibleDiagnosticText(detail.test.help)}</p>}
        {detail.detail?<>
          <p>Primary: {diagnosticLocationLabel(detail.detail.primary)}</p>
          <h4>Related notes ({detail.detail.related.length})</h4>
          {detail.detail.related.map((note,index)=><div className="transfer-review" key={index}>
            <p dir="auto">{visibleDiagnosticText(note.message)}</p>
            <small>{diagnosticLocationLabel(note.location)}</small>
          </div>)}
        </>:<p>{detail.coverage==='unsupported'?'The full envelope failed schema or project-label validation.':'The report did not contain full diagnostic detail.'}
          Only the original validated failure summary is available.</p>}
      </section>}
      <button type="button" aria-expanded={exportOpen} onClick={()=>{setExportOpen(value=>!value);setOptions(DEFAULT_TEST_DETAIL_EXPORT);}}>
        {exportOpen?'Hide failure export':'Review failure export'}
      </button>
      {exportOpen&&<>
        <p>Counts, phases and codes by default. Select private detail fields only if you intend to share them.</p>
        {(['testLabels','messages','locations','related'] as const).map(key=><label key={key}>
          <input type="checkbox" checked={options[key]} onChange={event=>setOptions(previous=>({...previous,[key]:event.target.checked}))}/>
          Include {key==='testLabels'?'relative test labels':key==='related'?'related note rows':key}
        </label>)}
        <textarea readOnly rows={10} aria-label="Reviewed test failure export"
          value={buildTestFailureDetailExport(matching,options,historical).text}/>
      </>}
    </>}
  </section>;
}
