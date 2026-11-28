import {useMemo,useRef,useState} from 'react';
import type {ListedSymbolReport,ListedSymbolSite} from '../model/listedSymbolIndex';
import {displayInterfaceShape,INTERFACE_ISSUE_LABELS} from '../language/scarpFunctionInterfaces';
import {captureInterfaceBaseline,compareInterfaceBaselines,filterInterfaces,filterInterfaceComparison,
  pageInterfaces,interfaceInventoryReport,interfaceComparisonReport,DEFAULT_INTERFACE_FILTER,INTERFACE_CHANGES,
  INTERFACE_CHANGE_LABELS,MAX_INTERFACE_BASELINES,type InterfaceBaseline,type InterfaceComparison,
  type InterfaceFilter,type InterfaceRecord,type InterfaceExportOptions} from '../model/listedFunctionInterfaces';

interface Saved{readonly id:number;readonly baseline:InterfaceBaseline}
const PRIVATE_EXPORT:InterfaceExportOptions={includeLabels:false,includeNames:false,includeShapes:false};
function Filters({filter,sources,onChange,comparison=false}:{
  filter:InterfaceFilter;sources:readonly string[];onChange:(patch:Partial<InterfaceFilter>)=>void;comparison?:boolean;
}){
  const prefix=comparison?'Interface comparison':'Function interface';
  return <div className="project-scope-fields">
    <label>Find name or file<input type="search" aria-label={prefix+' filter'} maxLength={120}
      value={filter.query} onChange={event=>onChange({query:event.target.value})}/></label>
    <label>Source<select aria-label={prefix+' source'} value={filter.source} onChange={event=>onChange({source:event.target.value})}>
      <option value="">All observed labels</option>{sources.map(source=><option key={source} value={source}>{source}</option>)}
    </select></label>
    <label><input type="checkbox" checked={filter.publicOnly} onChange={event=>onChange({publicOnly:event.target.checked})}/>
      Public modifiers only</label>
    {comparison&&<>
      <label>Change state<select aria-label="Interface change state" value={filter.change} onChange={event=>{
        const value=event.target.value as InterfaceFilter['change'];
        if(value==='all'||INTERFACE_CHANGES.includes(value))onChange({change:value});
      }}><option value="all">All change states</option>{INTERFACE_CHANGES.map(change=>
        <option key={change} value={change}>{INTERFACE_CHANGE_LABELS[change]}</option>)}</select></label>
      <label><input type="checkbox" checked={filter.changedOnly} onChange={event=>onChange({changedOnly:event.target.checked})}/>
        Exclude unchanged shapes</label>
    </>}
  </div>;
}
function ExportOptions({options,onChange,report,label}:{
  options:InterfaceExportOptions;onChange:(patch:Partial<InterfaceExportOptions>)=>void;report:string;label:string;
}){
  return <>
    <label><input type="checkbox" checked={options.includeLabels} onChange={event=>onChange({includeLabels:event.target.checked})}/>
      Include interface source labels</label>
    <label><input type="checkbox" checked={options.includeNames} onChange={event=>onChange({includeNames:event.target.checked})}/>
      Include function names</label>
    <label><input type="checkbox" checked={options.includeShapes} onChange={event=>onChange({includeShapes:event.target.checked})}/>
      Include full captured lexical shapes (contains function and type names)</label>
    <textarea aria-label={label} readOnly rows={10} value={report}/>
    <p>Default exports contain counts only. Shapes include private identifiers but never function bodies or contract expressions.</p>
  </>;
}
function ShapeRecord({record}:{record:InterfaceRecord}){
  return <li>
    <p>{record.public?'Public modifier':'No public modifier'}{record.pure?' · pure':''}</p>
    {record.shape?<code dir="auto">{displayInterfaceShape(record.shape)}</code>:
      <p>{record.issue?INTERFACE_ISSUE_LABELS[record.issue]:'Shape unavailable'}</p>}
  </li>;
}
function ComparisonView({data}:{data:InterfaceComparison}){
  const [filter,setFilter]=useState(DEFAULT_INTERFACE_FILTER);
  const [page,setPage]=useState(1);
  const [detail,setDetail]=useState<string|null>(null);
  const [showReport,setShowReport]=useState(false);
  const [options,setOptions]=useState(PRIVATE_EXPORT);
  const rows=useMemo(()=>filterInterfaceComparison(data,filter),[data,filter]);
  const visible=pageInterfaces(rows,page);
  const sources=useMemo(()=>[...new Set(data.rows.map(row=>row.source))].sort(),[data]);
  const output=useMemo(()=>showReport?interfaceComparisonReport(data,options):'',[data,showReport,options]);
  function update(patch:Partial<InterfaceFilter>){setFilter(old=>({...old,...patch}));setPage(1);setDetail(null);}
  return <section aria-label="Function interface comparison results" className="project-scope-coverage">
    <p>Exact relative file and name pairs only. No claim about ABI, source compatibility, overload identity or contract behavior.</p>
    {(!data.earlierComplete||!data.currentComplete)&&<p role="status">At least one captured interface inventory is incomplete.</p>}
    <dl className="project-scope-stats">{INTERFACE_CHANGES.map(change=><div key={change}>
      <dt>{INTERFACE_CHANGE_LABELS[change]}</dt><dd>{data.counts[change]}</dd>
    </div>)}</dl>
    <Filters filter={filter} sources={sources} onChange={update} comparison/>
    <button type="button" onClick={()=>{setFilter(DEFAULT_INTERFACE_FILTER);setPage(1);setDetail(null);}}>Reset interface comparison filters</button>
    <p>{rows.length} name groups · Page {visible.page} of {visible.pages}</p>
    <div className="project-scope-inventory"><ul>{visible.rows.map(row=><li key={row.id}>
      <strong><code dir="auto">{row.name}</code></strong> · {INTERFACE_CHANGE_LABELS[row.change]}
      <p><code dir="auto">{row.source}</code> · {row.before.length} earlier / {row.after.length} current observations</p>
      <button type="button" aria-expanded={detail===row.id} onClick={()=>setDetail(value=>value===row.id?null:row.id)}>
        {detail===row.id?'Hide compared shapes':'Review compared shapes'}
      </button>
      {detail===row.id&&<div aria-label="Compared interface shapes">
        <h5>Earlier observations</h5><ul>{row.before.map((record,index)=><ShapeRecord key={index} record={record}/>)}</ul>
        {!row.before.length&&<p>No retained earlier observation.</p>}
        <h5>Current observations</h5><ul>{row.after.map((record,index)=><ShapeRecord key={index} record={record}/>)}</ul>
        {!row.after.length&&<p>No retained current observation.</p>}
      </div>}
    </li>)}</ul></div>
    {!rows.length&&<p>No interface name groups match the filters.</p>}
    <button type="button" disabled={visible.page===1} onClick={()=>setPage(visible.page-1)}>Previous interface comparison page</button>
    <button type="button" disabled={visible.page===visible.pages} onClick={()=>setPage(visible.page+1)}>Next interface comparison page</button>
    <button type="button" aria-expanded={showReport} onClick={()=>{setShowReport(!showReport);if(showReport)setOptions(PRIVATE_EXPORT);}}>
      {showReport?'Hide interface comparison report':'Review interface comparison report'}
    </button>
    {showReport&&<ExportOptions options={options} onChange={patch=>setOptions(old=>({...old,...patch}))}
      report={output} label="Function interface comparison report"/>}
  </section>;
}

export function ListedFunctionInterfacesPanel({report,busy,onNavigate,visible=true}:{
  report:ListedSymbolReport|null;busy:boolean;onNavigate:(report:ListedSymbolReport,site:ListedSymbolSite)=>void;visible?:boolean;
}){
  const [expanded,setExpanded]=useState(false);
  const [filter,setFilter]=useState(DEFAULT_INTERFACE_FILTER);
  const [page,setPage]=useState(1);
  const [showInventoryReport,setShowInventoryReport]=useState(false);
  const [options,setOptions]=useState(PRIVATE_EXPORT);
  const [saved,setSaved]=useState<readonly Saved[]>([]);
  const [selected,setSelected]=useState<number|null>(null);
  const [clearReview,setClearReview]=useState<readonly Saved[]|null>(null);
  const sequence=useRef(1);
  const candidate=useMemo(()=>report?captureInterfaceBaseline(report):null,[report]);
  const chosen=saved.find(item=>item.id===selected);
  const comparison=useMemo(()=>chosen&&candidate?.ok?compareInterfaceBaselines(chosen.baseline,candidate.value):null,[chosen,candidate]);
  const rows=useMemo(()=>report?filterInterfaces(report,filter):[],[report,filter]);
  const shown=pageInterfaces(rows,page);
  const output=useMemo(()=>report&&showInventoryReport?interfaceInventoryReport(report,options):'',
    [report,showInventoryReport,options]);
  function capture(){
    if(busy||!candidate?.ok||saved.length>=MAX_INTERFACE_BASELINES)return;
    const id=sequence.current++;
    setSaved([...saved,{id,baseline:candidate.value}]);setSelected(id);setClearReview(null);
  }
  if(!visible)return null;
  return <section className="project-scope-coverage" aria-label="Captured function interfaces">
    <button type="button" aria-expanded={expanded} onClick={()=>{
      setExpanded(!expanded);if(expanded){setShowInventoryReport(false);setOptions(PRIVATE_EXPORT);setClearReview(null);}
    }}>{expanded?'Hide function interfaces':'Review function interfaces'}</button>
    {expanded&&<>
      <p>Capture is opt-in at index review. Only top-level recognized Scarp function headers are included.
        Types and parameters are lexical token shapes; contracts and bodies are not compared.</p>
      {report?.interfaces===null&&<p>Interface capture was not requested in this index. Enable it in the next review.</p>}
      {report?.interfaces&&<>
        <dl className="project-scope-stats">
          <div><dt>Retained functions</dt><dd>{report.interfaces.length}</dd></div>
          <div><dt>Public modifiers</dt><dd>{report.interfaces.filter(item=>item.site.visibility==='public').length}</dd></div>
          <div><dt>Captured shapes</dt><dd>{report.interfaces.filter(item=>item.evidence.ok).length}</dd></div>
          <div><dt>Unavailable shapes</dt><dd>{report.interfaces.filter(item=>!item.evidence.ok).length}</dd></div>
        </dl>
        <Filters filter={filter} sources={report.files.map(file=>file.name)} onChange={patch=>{
          setFilter(old=>({...old,...patch}));setPage(1);
        }}/>
        <button type="button" onClick={()=>{setFilter(DEFAULT_INTERFACE_FILTER);setPage(1);}}>Reset function interface filters</button>
        <p>{rows.length} matching interfaces · Page {shown.page} of {shown.pages}</p>
        <div className="project-scope-inventory"><ul>{shown.rows.map(item=><li key={item.site.id}>
          <strong>{item.site.name}</strong> · <code>{item.site.source}:{item.site.line}</code>
          {item.evidence.ok?<p><code dir="auto">{displayInterfaceShape(item.evidence.shape)}</code></p>:
            <p>{INTERFACE_ISSUE_LABELS[item.evidence.issue]}</p>}
          <button type="button" disabled={busy} onClick={()=>onNavigate(report,item.site)}>Recheck and open interface declaration</button>
        </li>)}</ul></div>
        {!rows.length&&<p>No captured functions match the filters.</p>}
        <button type="button" disabled={shown.page===1} onClick={()=>setPage(shown.page-1)}>Previous function interface page</button>
        <button type="button" disabled={shown.page===shown.pages} onClick={()=>setPage(shown.page+1)}>Next function interface page</button>
        <button type="button" aria-expanded={showInventoryReport} onClick={()=>{
          setShowInventoryReport(!showInventoryReport);if(showInventoryReport)setOptions(PRIVATE_EXPORT);
        }}>{showInventoryReport?'Hide function interface report':'Review function interface report'}</button>
        {showInventoryReport&&<ExportOptions options={options} onChange={patch=>setOptions(old=>({...old,...patch}))}
          report={output} label="Function interface inventory report"/>}
      </>}
      <h4>Session baselines</h4>
      <p>Retain up to {MAX_INTERFACE_BASELINES} captured interface baselines in memory. No automatic persistence.</p>
      <p>{saved.length} / {MAX_INTERFACE_BASELINES} interface baselines saved.</p>
      {candidate&&!candidate.ok&&report?.interfaces!==null&&<p role="alert">{candidate.error}</p>}
      <button type="button" disabled={busy||!candidate?.ok||saved.length>=MAX_INTERFACE_BASELINES} onClick={capture}>
        Capture function interface baseline
      </button>
      <label>Earlier interface baseline<select aria-label="Earlier function interface baseline" value={selected??''}
        onChange={event=>{setSelected(event.target.value?Number(event.target.value):null);setClearReview(null);}}>
        <option value="">Choose a baseline</option>{saved.map(item=>
          <option key={item.id} value={item.id}>Baseline {item.id} · {item.baseline.mode} · {item.baseline.complete?'complete':'limited'}</option>)}
      </select></label>
      <button type="button" disabled={busy||!chosen} onClick={()=>{
        setSaved(saved.filter(item=>item.id!==selected));setSelected(null);setClearReview(null);
      }}>Remove function interface baseline</button>
      <button type="button" disabled={busy||!saved.length} onClick={()=>setClearReview(saved)}>Review clearing interface baselines</button>
      {clearReview&&<div>
        <p>Remove saved interface metadata? Current source files and index are unchanged.</p>
        <button type="button" disabled={busy||clearReview!==saved} onClick={()=>{setSaved([]);setSelected(null);setClearReview(null);}}>
          Confirm clear interface baselines
        </button>
        <button type="button" onClick={()=>setClearReview(null)}>Cancel clear interface baselines</button>
      </div>}
      {comparison&&!comparison.ok&&<p role="alert">{comparison.error}</p>}
      {comparison?.ok&&<ComparisonView key={selected} data={comparison.value}/>}
    </>}
  </section>;
}
