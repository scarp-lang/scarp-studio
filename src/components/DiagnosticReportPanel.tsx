import { useMemo,useState } from 'react';
import {
  buildDiagnosticReport,DEFAULT_DIAGNOSTIC_EXPORT,DEFAULT_DIAGNOSTIC_FILTER,diagnosticLocationLabel,
  diagnosticPage,filterDiagnosticDetails,summarizeDiagnostics,visibleDiagnosticText,
  type DiagnosticExportOptions,type DiagnosticFilter,type DiagnosticReport,
} from '../model/diagnosticReport';
interface Props{report:DiagnosticReport}
function Pager({page,pages,onPage}:{page:number;pages:number;onPage:(page:number)=>void}){
  return <div className="inspection-page-controls">
    <button type="button" disabled={page===1} onClick={()=>onPage(page-1)}>Previous</button>
    <span>{page}/{pages}</span>
    <button type="button" disabled={page===pages} onClick={()=>onPage(page+1)}>Next</button>
  </div>;
}
export function DiagnosticReportPanel({report}:Props){
  const [expanded,setExpanded]=useState(false);
  const [filter,setFilter]=useState<DiagnosticFilter>(DEFAULT_DIAGNOSTIC_FILTER);
  const [page,setPage]=useState(1);
  const [selected,setSelected]=useState<number|null>(null);
  const [notePage,setNotePage]=useState(1);
  const [showReport,setShowReport]=useState(false);
  const [options,setOptions]=useState<DiagnosticExportOptions>(DEFAULT_DIAGNOSTIC_EXPORT);
  const summary=useMemo(()=>summarizeDiagnostics(report),[report]);
  const rows=useMemo(()=>expanded?filterDiagnosticDetails(report,filter):[],[expanded,report,filter]);
  const current=diagnosticPage(rows,page);
  const detail=selected===null?null:report.diagnostics.find(row=>row.id===selected)??null;
  const notes=diagnosticPage(detail?.related??[],notePage,8);
  function update(patch:Partial<DiagnosticFilter>){
    setFilter(previous=>({...previous,...patch}));setPage(1);setSelected(null);setNotePage(1);
  }
  function resetExport(){setShowReport(false);setOptions(DEFAULT_DIAGNOSTIC_EXPORT);}
  return <section className="diagnostic-report-panel" aria-label="Static compiler diagnostic detail">
    <header className="activity-header"><div><strong>Compiler diagnostic detail</strong>
      <p>{summary.count} error record(s) · {summary.related} related note(s)</p></div>
      <button type="button" aria-expanded={expanded} onClick={()=>{setExpanded(v=>!v);resetExport();}}>
        {expanded?'Hide diagnostic detail':'Review diagnostic detail'}
      </button></header>
    {expanded&&<>
      <p>Compiler-reported historical byte spans and scalar columns. Related notes can explain a declaration, call or imported module.
        This detail view never opens a reported path, creates an editor marker, or modifies source.</p>
      <dl className="activity-metrics">
        <div><dt>Primary locations</dt><dd>{summary.located}</dd></div>
        <div><dt>No primary location</dt><dd>{summary.unlocated}</dd></div>
        <div><dt>Related notes</dt><dd>{summary.related}</dd></div>
        <div><dt>Distinct path labels</dt><dd>{summary.distinctPaths}</dd></div>
      </dl>
      <div className="activity-filters">
        <input type="search" aria-label="Search diagnostic details" maxLength={120} value={filter.query}
          onChange={event=>update({query:event.target.value})} placeholder="Code, message, help, file or note"/>
        <select aria-label="Diagnostic detail code" value={filter.code===null?'none':filter.code} onChange={event=>{
          const value=event.target.value;update({code:value==='none'?null:value});
        }}><option value="all">All codes</option>
          {summary.byCode.map(row=><option key={row.code??'none'} value={row.code??'none'}>{row.code??'No code'} ({row.count})</option>)}
        </select>
        <select aria-label="Diagnostic detail location" value={filter.location} onChange={event=>{
          const value=event.target.value;if(value==='all'||value==='located'||value==='unlocated')update({location:value});
        }}><option value="all">All locations</option><option value="located">Has primary location</option><option value="unlocated">No primary location</option></select>
        <label><input type="checkbox" checked={filter.relatedOnly} onChange={event=>update({relatedOnly:event.target.checked})}/> With related notes</label>
        <button type="button" onClick={()=>{setFilter(DEFAULT_DIAGNOSTIC_FILTER);setPage(1);setSelected(null);}}>Reset diagnostic filters</button>
      </div>
      <p role="status">{rows.length} matching of {summary.count} diagnostic records</p>
      <div className="inspection-symbol-list">
        {current.items.map(row=><button className="activity-record" type="button" key={row.id} aria-pressed={selected===row.id}
          onClick={()=>{setSelected(row.id);setNotePage(1);}}>
          <strong>#{row.id} · {row.code??'No code reported'}</strong>
          <span>{visibleDiagnosticText(row.message)}</span>
          <small>{row.primary?visibleDiagnosticText(row.primary.path)+':'+row.primary.start.line:'No source location'} · {row.related.length} note(s)</small>
        </button>)}
        {!rows.length&&<p>No diagnostics match these filters.</p>}
      </div>
      <Pager page={current.page} pages={current.pages} onPage={setPage}/>
      {detail&&<section className="activity-detail" aria-label="Selected diagnostic record">
        <header className="activity-header"><strong>{detail.code??'Compiler error'}</strong>
          <button type="button" onClick={()=>setSelected(null)}>Close diagnostic record</button></header>
        <p className="diagnostic-report-message" dir="auto">{visibleDiagnosticText(detail.message)}</p>
        <p>Primary: {diagnosticLocationLabel(detail.primary)}</p>
        {detail.help&&<div className="transfer-review"><strong>Compiler help</strong><p dir="auto">{visibleDiagnosticText(detail.help)}</p></div>}
        <h4>Related notes</h4>
        {!detail.related.length&&<p>No related notes reported.</p>}
        {notes.items.map((note,i)=><div key={i} className="transfer-review">
          <p dir="auto">{visibleDiagnosticText(note.message)}</p><small>{diagnosticLocationLabel(note.location)}</small>
        </div>)}
        {detail.related.length>0&&<Pager page={notes.page} pages={notes.pages} onPage={setNotePage}/>}
      </section>}
      <button type="button" aria-expanded={showReport} onClick={()=>{setShowReport(v=>!v);setOptions(DEFAULT_DIAGNOSTIC_EXPORT);}}>
        {showReport?'Hide diagnostic summary':'Review diagnostic summary'}
      </button>
      {showReport&&<>
        <p>Counts and codes only by default. Choose any additional details explicitly; messages can contain private source text and paths.</p>
        {(['messages','locations','help','related'] as const).map(key=><label key={key}>
          <input type="checkbox" checked={options[key]} onChange={event=>setOptions(previous=>({...previous,[key]:event.target.checked}))}/>
          Include {key==='related'?'related note rows':key}
        </label>)}
        <textarea aria-label="Diagnostic summary report" readOnly rows={10} value={buildDiagnosticReport(report,rows,options).text}/>
      </>}
    </>}
  </section>;
}
