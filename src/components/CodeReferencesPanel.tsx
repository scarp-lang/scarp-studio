import { useMemo, useState } from 'react';
import type { StudioDocument } from '../model/documents';
import {
  scarpIdentifierAtCursor, findOpenCodeReferences,
  currentReferenceNavigationTarget, countReferenceRoles,
} from '../model/openCodeReferences';
import type { InsightNavigation } from './SourceInsightsPanel';

const PAGE_SIZE = 24;
interface Props {
  documents: readonly StudioDocument[];
  activeId: string | null;
  cursor: { line:number; column:number };
  busy: boolean;
  onNavigate: (target: InsightNavigation) => void;
  initiallyExpanded?: boolean;
  initialQuery?: string;
}
export function CodeReferencesPanel({
  documents, activeId, cursor, busy, onNavigate,
  initiallyExpanded = false, initialQuery = '',
}: Props) {
  const [expanded,setExpanded] = useState(initiallyExpanded);
  const [query,setQuery] = useState(initialQuery);
  const [caseSensitive,setCaseSensitive] = useState(true);
  const [scope,setScope] = useState<'all'|'active'>('all');
  const [page,setPage] = useState(1);
  const [hint,setHint] = useState<string | null>(null);
  const active = documents.find(doc=>doc.id===activeId) ?? null;
  const result = useMemo(() => !expanded || !query.trim() ? null :
    findOpenCodeReferences(documents,query.trim(),{
      caseSensitive,scope,activeId,
    }),[expanded,query,caseSensitive,scope,activeId,documents]);
  const pages = Math.max(1,Math.ceil((result?.hits.length ?? 0)/PAGE_SIZE));
  const displayedPage = Math.min(page,pages);
  const visible = result?.hits.slice((displayedPage-1)*PAGE_SIZE,
    displayedPage*PAGE_SIZE) ?? [];
  const roles = result ? countReferenceRoles(result.hits) : null;

  function useCursor(): void {
    if (!active) {
      setHint('Open a Scarp source before selecting the identifier under your cursor.');
      return;
    }
    const word = scarpIdentifierAtCursor(active.content,cursor.line,cursor.column);
    if (!word) {
      setHint('Move the cursor onto a Scarp code identifier, not a comment or string.');
      return;
    }
    setQuery(word);
    setHint(null);
    setPage(1);
  }
  return <section className="sidebar-section references-panel"
    aria-label="Scarp open code references">
    <div className="sidebar-heading">CODE REFERENCES</div>
    <button type="button" className="insights-toggle"
      aria-expanded={expanded} aria-controls="studio-code-references-body"
      onClick={()=>setExpanded(open=>!open)}>
      <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
      <span>{expanded ? 'Hide references' : 'Find code references'}</span>
    </button>
    <div id="studio-code-references-body" hidden={!expanded}>
      <div className="references-content">
        <p className="insights-disclaimer">
          Literal code identifier matches in open Scarp tabs, excluding
          strings and comments. Not semantic symbol resolution.
        </p>
        <div className="references-search">
          <input type="search" maxLength={128}
            aria-label="Identifier to find in open Scarp files" value={query}
            placeholder="Scarp identifier…"
            onChange={event=>{setQuery(event.target.value);setPage(1);setHint(null);}}/>
          <button type="button" disabled={!active || busy}
            onClick={useCursor} title="Use the exact code token beneath the Monaco cursor">
            At cursor
          </button>
        </div>
        <div className="references-options">
          <label><input type="checkbox" checked={caseSensitive}
            onChange={event=>{setCaseSensitive(event.target.checked);setPage(1);}}/>
            Match case</label>
          <label><input type="checkbox" checked={scope==='active'}
            onChange={event=>{setScope(event.target.checked?'active':'all');setPage(1);}}/>
            Current tab only</label>
        </div>
        {hint && <p className="sidebar-note" role="status">{hint}</p>}
        {!query.trim() && <p className="sidebar-note">
          Enter an identifier or select At cursor. No native files are searched.
        </p>}
        {result && <>
          {result.error && <p className="sidebar-note" role="status">{result.error}</p>}
          <div className="references-totals" role="status">
            <span>{result.matches} code reference{result.matches===1?'':'s'}</span>
            <span>{roles?.declarationLike} declaration-like · {roles?.usages} uses</span>
          </div>
          {result.message && <p className="sidebar-note" role="status">{result.message}</p>}
          <p className="insights-disclaimer">
            {result.searchedDocuments} open source buffers scanned ·
            {result.skippedDocuments} skipped
          </p>
          <div className="references-list">
            {visible.map(hit=><div className="references-row" key={hit.id}>
              <div className="references-title">
                <strong>{hit.documentName}</strong>
                <span>{hit.role} · {hit.line}:{hit.column}</span>
              </div>
              <code title={hit.preview}>{hit.preview}</code>
              <button type="button" disabled={busy ||
                currentReferenceNavigationTarget(hit,documents)===null}
                title="Go to the current exact open-buffer code token"
                onClick={()=>{
                  const target = currentReferenceNavigationTarget(hit,documents);
                  if (!busy && target) onNavigate(target);
                }}>
                Go to reference
              </button>
            </div>)}
            {!visible.length && !result.error && <p className="sidebar-note">
              No matching code identifiers in the scanned open buffers.
            </p>}
          </div>
          {pages>1 && <div className="insights-pages">
            <button type="button" disabled={displayedPage===1}
              onClick={()=>setPage(p=>Math.max(1,p-1))}>Previous</button>
            <span>Page {displayedPage} / {pages}</span>
            <button type="button" disabled={displayedPage===pages}
              onClick={()=>setPage(p=>Math.min(pages,p+1))}>Next</button>
          </div>}
        </>}
      </div>
    </div>
  </section>;
}
