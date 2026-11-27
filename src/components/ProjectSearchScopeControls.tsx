import { useMemo,useState } from 'react';
import { DEFAULT_PROJECT_SEARCH_SCOPE, MAX_SCOPE_NAME_QUERY, MAX_SCOPE_PREVIEW_FILES,
  buildProjectScopeInventory, planScopedProjectSearch, scopeLabel, scopedSearchReport, sameProjectScope, SEARCH_COVERAGE_LABELS, searchCoverageOrigin,
  type ProjectSearchScope, type ScopedSearchSummary } from '../model/projectSearchScope';
import { MAX_PROJECT_SEARCH_FILES, type ProjectSearchSource } from '../model/projectSearch';

interface Props{
  listed:readonly ProjectSearchSource[];
  scope:ProjectSearchScope;
  busy:boolean;
  onChange:(scope:ProjectSearchScope)=>void;
}
export function ProjectSearchScopeControls({listed,scope,busy,onChange}:Props){
  const inventory=useMemo(()=>buildProjectScopeInventory(listed),[listed]);
  const plan=useMemo(()=>planScopedProjectSearch(inventory,scope),[inventory,scope]);
  const [expanded,setExpanded]=useState(false);
  const [preview,setPreview]=useState(false);
  function update(patch:Partial<ProjectSearchScope>){
    onChange({...scope,...patch});setPreview(false);
  }
  return <section className="project-scope-controls" aria-label="Project search scope">
    <button type="button" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>
      {expanded?'Hide project search scope':'Configure project search scope'}
    </button>
    <p>{scopeLabel(scope)}{scope.filename?' · filename contains '+JSON.stringify(scope.filename):''}</p>
    {expanded&&<>
      <p>Choose among listed Scarp source directories. Filtering does not read files, perform a search,
        or change the open-file search above.</p>
      <div className="project-scope-fields">
        <label>Listed directory<select aria-label="Project search directory" disabled={busy}
          value={scope.directory} onChange={event=>update({directory:event.target.value})}>
          {!inventory.directories.some(dir=>dir.name===scope.directory)&&<option value={scope.directory} disabled>Directory no longer listed</option>}
          {inventory.directories.map(dir=><option key={dir.name} value={dir.name}>
            {dir.name||'Workspace root'} ({scope.descendants?dir.descendants:dir.direct})
          </option>)}
        </select></label>
        <label><input type="checkbox" checked={scope.descendants} disabled={busy}
          onChange={event=>update({descendants:event.target.checked})}/>Include descendant directories</label>
        <label>Filename contains<input aria-label="Project filename substring" disabled={busy} maxLength={MAX_SCOPE_NAME_QUERY}
          value={scope.filename} placeholder="Literal basename substring" onChange={event=>update({filename:event.target.value})}/></label>
        <button type="button" disabled={busy||sameProjectScope(scope,DEFAULT_PROJECT_SEARCH_SCOPE)} onClick={()=>{
          onChange(DEFAULT_PROJECT_SEARCH_SCOPE);setPreview(false);
        }}>Reset project scope</button>
      </div>
      {!plan.ok?<p role="alert">{plan.error}</p>:<>
        <p role="status">{plan.value.sources.length} listed eligible source(s) in scope · {plan.value.excluded} excluded by scope.</p>
        {plan.value.sources.length>MAX_PROJECT_SEARCH_FILES&&<p>Only up to {MAX_PROJECT_SEARCH_FILES} files can be scanned per search.
          Choose a narrower directory or filename substring for better coverage.</p>}
        {plan.value.invalid+plan.value.ambiguous+plan.value.uninspected>0&&<p role="alert">
          {plan.value.invalid} invalid · {plan.value.ambiguous} ambiguous · {plan.value.uninspected} uninspected entries withheld.
        </p>}
        <button type="button" aria-expanded={preview} onClick={()=>setPreview(value=>!value)}>
          {preview?'Hide scope inventory':'Review scope inventory'}
        </button>
        {preview&&<div className="project-scope-inventory">
          <p>Eligible candidates only; read and result budgets still apply.</p>
          {plan.value.sources.length?<ul>{plan.value.sources.slice(0,MAX_SCOPE_PREVIEW_FILES).map(source=><li key={source.name}>
            <code dir="auto">{source.name}</code>
          </li>)}</ul>:<p>No eligible sources match this scope.</p>}
        </div>}
      </>}
    </>}
  </section>;
}
export function ProjectSearchCoverage({summary}:{summary:ScopedSearchSummary}){
  const [expanded,setExpanded]=useState(false);
  const [includeLabels,setIncludeLabels]=useState(false);
  const [coverageFilter,setCoverageFilter]=useState<'all'|'incomplete'|'matched'>('all');
  const [includeFilenameQuery,setIncludeFilenameQuery]=useState(false);
  const report=useMemo(()=>expanded?scopedSearchReport(summary,{includeLabels,includeFilenameQuery}):'',
    [expanded,summary,includeLabels,includeFilenameQuery]);
  return <section className="project-scope-coverage" aria-label="Project search coverage">
    <p>{scopeLabel(summary.scope)} · {summary.inScope} eligible candidate(s) · {summary.excluded} excluded by scope</p>
    {summary.withheld>0&&<p role="alert">{summary.withheld} listing entries were withheld before reading.</p>}
    {summary.incomplete&&<p>Coverage is incomplete. Zero displayed matches does not prove the query is absent.</p>}
    <button type="button" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>
      {expanded?'Hide search coverage report':'Review search coverage report'}
    </button>
    {expanded&&<>
      <p>Counts describe the completed search snapshot. Per-file totals count displayed matches, not undiscovered
        matches beyond the search limits.</p>
      <dl className="project-scope-stats">
        <div><dt>Fully scanned</dt><dd>{summary.searched}</dd></div>
        <div><dt>Not fully scanned</dt><dd>{summary.skipped}</dd></div>
        <div><dt>Displayed matches</dt><dd>{summary.hits}</dd></div>
        <div><dt>Matching files</dt><dd>{summary.matchingFiles}</dd></div>
      </dl>
      {summary.fileCoverage&&<>
        <label>File coverage filter<select aria-label="Project file coverage filter" value={coverageFilter}
          onChange={event=>{
            const value=event.target.value;
            if(value==='all'||value==='incomplete'||value==='matched')setCoverageFilter(value);
          }}>
          <option value="all">All in-scope files</option>
          <option value="incomplete">Not fully scanned</option>
          <option value="matched">Files with displayed matches</option>
        </select></label>
        <div className="project-scope-inventory"><table>
          <caption>Per-file search coverage</caption>
          <thead><tr><th>Source label</th><th>Coverage</th><th>Matches</th><th>Origin</th></tr></thead>
          <tbody>{summary.fileCoverage.filter(row=>coverageFilter==='all'||
            (coverageFilter==='incomplete'?row.state!=='scanned':row.hits>0)).map(row=><tr key={row.name}>
            <td><code dir="auto">{row.name}</code></td>
            <td>{SEARCH_COVERAGE_LABELS[row.state]}</td><td>{row.hits}</td>
            <td>{searchCoverageOrigin(row)}</td>
          </tr>)}</tbody>
        </table></div>
        <p>Read unavailable includes missing, denied or native bounded-reader failures; no arbitrary native error text is retained.
          Content or match budget includes partial and unstarted in-memory scans.</p>
      </>}
      {!summary.fileCoverage&&summary.rows.length>0&&<div className="project-scope-inventory"><table>
        <caption>Displayed match counts by listed source</caption>
        <thead><tr><th>Source label</th><th>Matches</th><th>Origin</th></tr></thead>
        <tbody>{summary.rows.map(row=><tr key={row.name}><td><code dir="auto">{row.name}</code></td>
          <td>{row.hits}</td><td>{row.openBuffer?'Open buffer':'Disk snapshot'}</td></tr>)}</tbody>
      </table></div>}
      <label><input type="checkbox" checked={includeLabels} onChange={event=>setIncludeLabels(event.target.checked)}/>
        Include relative source labels in report</label>
      <label><input type="checkbox" checked={includeFilenameQuery} onChange={event=>setIncludeFilenameQuery(event.target.checked)}/>
        Include filename substring in report</label>
      <label>Copyable coverage report<textarea aria-label="Project search coverage report text" readOnly rows={8} value={report}/></label>
      <p>Report excludes native paths, source text and the content-search query. Relative labels and filename
        filters may still contain private information when explicitly included.</p>
    </>}
  </section>;
}
