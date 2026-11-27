import { useMemo,useState } from 'react';
import { AUDIT_EDGE_STATUSES,AUDIT_EDGE_LABELS,AUDIT_PAGE,MAX_AUDIT_FILES,MAX_AUDIT_TOTAL_BYTES,
  filterAuditEdges,auditSummary,type AuditMode,type AuditFilter,type AuditResult,type ProjectDependencyAudit } from '../model/projectDependencyAudit';
import { reachableImportNodes,type DependencyDirection } from '../model/importDependencyReview';
interface Props{
  readonly folder:string|null;
  readonly busy:boolean;
  readonly generation:number;
  readonly onAudit:(mode:AuditMode)=>Promise<AuditResult>;
  readonly onOpen:(audit:ProjectDependencyAudit,id:string)=>void;
}
const defaultFilter:AuditFilter={query:'',status:'all',file:'all'};
export function ProjectDependencyAuditPanel({folder,busy,generation,onAudit,onOpen}:Props){
  const [expanded,setExpanded]=useState(false);
  const [mode,setMode]=useState<AuditMode>('working');
  const [result,setResult]=useState<{audit:ProjectDependencyAudit;generation:number}|null>(null);
  const [pending,setPending]=useState(false);
  const [notice,setNotice]=useState('');
  const [filter,setFilter]=useState<AuditFilter>(defaultFilter);
  const [page,setPage]=useState(1);
  const [filePage,setFilePage]=useState(1);
  const [root,setRoot]=useState('');
  const [direction,setDirection]=useState<DependencyDirection>('dependencies');
  const [pathPage,setPathPage]=useState(1);
  const [showReport,setShowReport]=useState(false);
  const [labels,setLabels]=useState(false);
  const audit=result?.audit??null,current=!!result&&result.generation===generation&&result.audit.folder===folder;
  const names=useMemo(()=>new Map(audit?.files.map(file=>[file.id,file])??[]),[audit]);
  const edges=useMemo(()=>audit?filterAuditEdges(audit,filter):[],[audit,filter]);
  const reach=useMemo(()=>audit&&root?reachableImportNodes(audit.dependency,root,direction):[],[audit,root,direction]);
  const pages=Math.max(1,Math.ceil(edges.length/AUDIT_PAGE)),shown=Math.min(page,pages);
  const filePages=Math.max(1,Math.ceil((audit?.files.length??0)/AUDIT_PAGE)),shownFiles=Math.min(filePage,filePages);
  const pathPages=Math.max(1,Math.ceil(reach.length/AUDIT_PAGE)),shownPaths=Math.min(pathPage,pathPages);
  async function run(){
    if(!folder||busy||pending)return;
    setPending(true);setNotice('');setResult(null);setShowReport(false);
    try{
      const response=await onAudit(mode);
      if(response.ok){setResult({audit:response.audit,generation});setFilter(defaultFilter);setPage(1);setFilePage(1);setRoot('');setPathPage(1);}
      else setNotice(response.error);
    }catch(error){setNotice(error instanceof Error?error.message:String(error));}
    finally{setPending(false);}
  }
  return <section className="project-dependency-audit" aria-label="Listed project dependency audit">
    <button type="button" className="insights-toggle" aria-expanded={expanded} disabled={pending}
      onClick={()=>{setExpanded(value=>!value);setResult(null);setShowReport(false);}}>
      {expanded?'Hide listed dependency audit':'Audit listed project imports'}
    </button>
    {expanded&&<>
      <p>Explicitly scan up to {MAX_AUDIT_FILES} listed sources, at most {MAX_AUDIT_TOTAL_BYTES/1024/1024} MiB.
        This uses observed import labels, not compiler module resolution. No files are modified or executed.</p>
      <label>Source snapshots<select aria-label="Dependency audit source mode" value={mode} disabled={pending||busy}
        onChange={event=>{if(event.target.value==='working'||event.target.value==='saved'){setMode(event.target.value);setResult(null);}}}>
        <option value="working">Open working buffers + unopened disk files</option><option value="saved">Saved disk files only</option>
      </select></label>
      <button type="button" disabled={!folder||busy||pending} onClick={()=>void run()}>{pending?'Scanning listed sources…':'Scan selected project imports'}</button>
      {!folder&&<p>Select a discovered manifest project first.</p>}
      {notice&&<p role="status">{notice}</p>}
      {audit&&<>
        {!current&&<p role="alert">The editor or selected project changed. This result is historical; opening from it is disabled.</p>}
        <p>{audit.files.length} listed files · {audit.edges.length} observed import headers · {audit.bytes} UTF-8 bytes read.
          {audit.mode==='saved'?' Unsaved edits were not used.':' Open working buffers took precedence.'}</p>
        {audit.dependency.incomplete&&<p role="status">Incomplete or unresolved coverage. Missing paths and absence of cycles are not conclusive.</p>}
        <dl className="activity-metrics">{AUDIT_EDGE_STATUSES.map(status=><div key={status}><dt>{AUDIT_EDGE_LABELS[status]}</dt><dd>{audit.counts[status]}</dd></div>)}</dl>
        <details><summary>Source read coverage ({audit.files.length})</summary>
          <ul className="audit-file-list">{audit.files.slice((shownFiles-1)*AUDIT_PAGE,shownFiles*AUDIT_PAGE).map(file=><li key={file.id}>
            <strong>{file.name}</strong><small>{file.state} · {file.origin}{file.dirty?' · dirty tab exists':''}</small>
            {file.error&&<p>{file.error}</p>}
            <button type="button" disabled={!current||busy||pending} onClick={()=>onOpen(audit,file.id)}>Open listed source</button>
          </li>)}</ul>
          <div className="insights-pages"><button type="button" disabled={shownFiles===1} onClick={()=>setFilePage(shownFiles-1)}>Previous files</button>
            <span>{shownFiles}/{filePages}</span><button type="button" disabled={shownFiles===filePages} onClick={()=>setFilePage(shownFiles+1)}>Next files</button></div>
        </details>
        <h4>Observed import headers</h4>
        <input type="search" aria-label="Filter listed import audit" value={filter.query} maxLength={120}
          onChange={event=>{setFilter(previous=>({...previous,query:event.target.value}));setPage(1);}}/>
        <select aria-label="Filter import audit status" value={filter.status} onChange={event=>{
          const status=event.target.value as AuditFilter['status'];if(status==='all'||AUDIT_EDGE_STATUSES.includes(status)){setFilter(previous=>({...previous,status}));setPage(1);}
        }}><option value="all">All import statuses</option>{AUDIT_EDGE_STATUSES.map(status=><option key={status} value={status}>{AUDIT_EDGE_LABELS[status]}</option>)}</select>
        <select aria-label="Filter import audit source" value={filter.file} onChange={event=>{setFilter(previous=>({...previous,file:event.target.value}));setPage(1);}}>
          <option value="all">All sources</option>{audit.files.map(file=><option key={file.id} value={file.id}>{file.name}</option>)}
        </select>
        <p role="status">{edges.length} matching headers</p>
        <ul className="audit-file-list">{edges.slice((shown-1)*AUDIT_PAGE,shown*AUDIT_PAGE).map(edge=><li key={edge.id}>
          <strong>{names.get(edge.from)?.name}:{edge.line}:{edge.column}</strong>
          <code>{JSON.stringify(edge.specifier)}{edge.alias?' as '+edge.alias:''}</code>
          <span>{AUDIT_EDGE_LABELS[edge.status]}{edge.targetLabel?' · '+edge.targetLabel:''}</span>
          {edge.target&&<button type="button" disabled={!current||busy||pending} onClick={()=>onOpen(audit,edge.target!)}>Open listed target</button>}
        </li>)}</ul>
        {!edges.length&&<p>No observed headers match.</p>}
        <div className="insights-pages"><button type="button" disabled={shown===1} onClick={()=>setPage(shown-1)}>Previous imports</button>
          <span>{shown}/{pages}</span><button type="button" disabled={shown===pages} onClick={()=>setPage(shown+1)}>Next imports</button></div>
        <details><summary>Observed cyclic groups</summary>
          {audit.dependency.components.filter(component=>component.cyclic).map(component=><ul key={component.id}>
            {component.members.map(node=><li key={node.id}>{node.name}</li>)}</ul>)}
          {!audit.dependency.components.some(component=>component.cyclic)&&<p>No cyclic group observed among scanned links.</p>}
        </details>
        <details><summary>Reachable scanned sources</summary>
          <select aria-label="Audit dependency root" value={root} onChange={event=>{setRoot(event.target.value);setPathPage(1);}}>
            <option value="">Choose scanned source</option>{audit.dependency.nodes.map(node=><option key={node.id} value={node.id}>{node.name}</option>)}
          </select>
          <select aria-label="Audit dependency direction" value={direction} onChange={event=>{
            if(event.target.value==='dependencies'||event.target.value==='dependents'){setDirection(event.target.value);setPathPage(1);}
          }}><option value="dependencies">Dependencies</option><option value="dependents">Dependents</option></select>
          <p>{reach.length} reachable scanned nodes</p>
          <ul>{reach.slice((shownPaths-1)*AUDIT_PAGE,shownPaths*AUDIT_PAGE).map(item=><li key={item.node.id}>
            {item.node.name} · {item.distance} observed links · {item.route.map(node=>node.name).join(direction==='dependencies'?' → ':' ← ')}
          </li>)}</ul>
          <div className="insights-pages"><button type="button" disabled={shownPaths===1} onClick={()=>setPathPage(shownPaths-1)}>Previous paths</button>
            <span>{shownPaths}/{pathPages}</span><button type="button" disabled={shownPaths===pathPages} onClick={()=>setPathPage(shownPaths+1)}>Next paths</button></div>
        </details>
        <button type="button" aria-expanded={showReport} onClick={()=>{setShowReport(value=>!value);setLabels(false);}}>{showReport?'Hide audit report':'Review audit report'}</button>
        {showReport&&<><label><input type="checkbox" checked={labels} onChange={event=>setLabels(event.target.checked)}/>Include relative file labels</label>
          <textarea aria-label="Listed project audit report" rows={8} readOnly value={auditSummary(audit,labels)}/></>}
      </>}
    </>}
  </section>;
}
