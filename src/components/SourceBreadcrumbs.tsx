import { useMemo, useState } from 'react';
import type { StudioDocument } from '../model/documents';
import { activeSourceBreadcrumbs, buildSourceBreadcrumbIndex, currentBreadcrumbTarget,
  type SourceBreadcrumb, type BreadcrumbKind } from '../model/sourceBreadcrumbs';
import type { InsightNavigation } from './SourceInsightsPanel';

interface Props {
  document: StudioDocument;
  line: number;
  column: number;
  busy: boolean;
  onNavigate: (target: InsightNavigation) => void;
}
const kinds: Record<BreadcrumbKind,string>={function:'Function',record:'Record',variant:'Variant'};
const pageSize=24;

export function SourceBreadcrumbs({document,line,column,busy,onNavigate}:Props) {
  const [expanded,setExpanded]=useState(false);
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState<BreadcrumbKind|'all'>('all');
  const [page,setPage]=useState(1);
  const index=useMemo(()=>buildSourceBreadcrumbIndex(document),[document]);
  const active=activeSourceBreadcrumbs(index,line,column);
  const matches=useMemo(()=>{
    if(!expanded)return [];
    const search=query.trim().toLowerCase();
    return index.ranges.filter(entry=>(filter==='all'||entry.kind===filter)&&
      (!search||entry.name.toLowerCase().includes(search)));
  },[index,expanded,filter,query]);
  const pages=Math.max(1,Math.ceil(matches.length/pageSize));
  const shownPage=Math.min(page,pages);
  function jump(entry:SourceBreadcrumb){
    if(busy)return;
    const target=currentBreadcrumbTarget(index,document,entry);
    if(target){onNavigate(target);setExpanded(false);}
  }
  return <section className="source-breadcrumbs" aria-label="Source navigation breadcrumbs">
    <div className="source-breadcrumb-row">
      <button type="button" className="source-breadcrumb-file" disabled={busy}
        title="Go to start of current source" onClick={()=>onNavigate({
          documentId:document.id,revision:document.revision,source:document.content,line:1,column:1,
        })}>{document.name}</button>
      {active.map(entry=><span className="source-breadcrumb-segment" key={entry.id}>
        <span aria-hidden="true">›</span>
        <button type="button" title={kinds[entry.kind]+' · line '+entry.line}
          disabled={busy} onClick={()=>jump(entry)}>{entry.name}</button>
      </span>)}
      {!active.length&&<span className="source-breadcrumb-muted">File scope</span>}
      {!index.complete&&<span className="source-breadcrumb-muted" title="Only confirmed lexical ranges are shown">Partial outline</span>}
      <button type="button" className="source-breadcrumb-toggle" aria-expanded={expanded}
        aria-controls="source-breadcrumb-outline" onClick={()=>{setExpanded(value=>!value);setPage(1);}}>
        Outline
      </button>
    </div>
    {expanded&&<div id="source-breadcrumb-outline" className="source-breadcrumb-outline">
      <p>Lexical declaration ranges in the active buffer; not compiler-resolved scopes.</p>
      <div className="source-breadcrumb-filters">
        <input type="search" maxLength={120} aria-label="Filter breadcrumb declarations"
          placeholder="Find declaration…" value={query} onChange={event=>{setQuery(event.target.value);setPage(1);}}/>
        <select aria-label="Breadcrumb declaration kind" value={filter} onChange={event=>{
          const next=event.target.value;
          if(next==='all'||next==='function'||next==='record'||next==='variant'){setFilter(next);setPage(1);}
        }}>
          <option value="all">All declarations</option>
          <option value="function">Functions</option>
          <option value="record">Records</option>
          <option value="variant">Variants</option>
        </select>
      </div>
      <p role="status">{matches.length} matching declarations{index.complete?'':' · partial index'}</p>
      <ul>
        {matches.slice((shownPage-1)*pageSize,shownPage*pageSize).map(entry=><li key={entry.id}>
          <button type="button" disabled={busy} onClick={()=>jump(entry)}>
            <strong>{entry.name}</strong><small>{kinds[entry.kind]} · line {entry.line}</small>
          </button>
        </li>)}
      </ul>
      {pages>1&&<div className="source-breadcrumb-pages">
        <button type="button" disabled={shownPage===1} onClick={()=>setPage(shownPage-1)}>Previous</button>
        <span>{shownPage}/{pages}</span>
        <button type="button" disabled={shownPage===pages} onClick={()=>setPage(shownPage+1)}>Next</button>
      </div>}
    </div>}
  </section>;
}
