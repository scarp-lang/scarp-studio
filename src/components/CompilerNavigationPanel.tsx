import { useMemo, useState } from 'react';
import {
  DEFAULT_NAVIGATION_FILTER, MAX_NAVIGATION_QUERY, SYMBOL_KINDS, REFERENCE_KINDS,
  filterCompilerSymbols, formatCompilerLocation, navigationPage, referencesToSymbol,
  symbolKindCounts, referenceKindCounts, symbolOwnerLabel,
  type CompilerNavigationReport, type NavigationFilter, type ReferenceFilter,
} from '../model/compilerNavigation';

interface Props {
  report: CompilerNavigationReport;
  onHide: () => void;
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (value: number) => void }) {
  return <div className="inspection-page-controls">
    <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
    <span>Page {page} / {pages}</span>
    <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
  </div>;
}

/** A compiler-generated static report, not a live editor index.
 * Paths and byte positions are intentionally display-only: the CLI does
 * not return authoritative content identities for imported files. */
export function CompilerNavigationPanel({ report, onHide }: Props) {
  const [filter, setFilter] = useState<NavigationFilter>(DEFAULT_NAVIGATION_FILTER);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [referenceFilter, setReferenceFilter] = useState<ReferenceFilter>({ kind: 'all', file: 'all' });
  const [referencePage, setReferencePage] = useState(1);
  const matches = useMemo(() => filterCompilerSymbols(report, filter), [report, filter]);
  const current = navigationPage(matches, page);
  const kinds = useMemo(() => symbolKindCounts(report), [report]);
  const symbol = selected === null ? null : report.symbols[selected];
  const allReferences = useMemo(() => symbol ? referencesToSymbol(report, symbol.id, {kind: 'all', file: 'all'}) : [], [report, symbol]);
  const referenceCounts = useMemo(() => referenceKindCounts(allReferences), [allReferences]);
  const refs = useMemo(() => symbol ? referencesToSymbol(report, symbol.id, referenceFilter) : [], [report, symbol, referenceFilter]);
  const refPage = navigationPage(refs, referencePage);
  function changeFilter(patch: Partial<NavigationFilter>) {
    setFilter(previous => ({...previous, ...patch})); setPage(1); setSelected(null); setReferencePage(1);
  }
  function choose(id: number) {
    setSelected(id); setReferenceFilter({kind: 'all', file: 'all'}); setReferencePage(1);
  }
  return <section className="compiler-navigation-panel" aria-label="Static compiler symbol and reference report">
    <header className="activity-header">
      <div><strong>Compiler {report.kind === 'references' ? 'references' : 'symbols'}</strong>
        <p>Static compiler snapshot of saved project files. This command does not execute program statements.</p></div>
      <button type="button" onClick={onHide}>Hide report</button>
    </header>
    <p role="status">Historical snapshot only. Files, symbol IDs and positions belong to this invocation.
      Source paths are displayed as text; opening files or applying edits from this report is not supported.</p>
    <dl className="activity-metrics">
      <div><dt>Files</dt><dd>{report.files.length}</dd></div>
      <div><dt>Symbols</dt><dd>{report.symbols.length}</dd></div>
      <div><dt>References</dt><dd>{report.kind === 'references' ? report.references.length : 'Not requested'}</dd></div>
      <div><dt>Matching symbols</dt><dd>{matches.length}</dd></div>
    </dl>
    <div className="activity-filters">
      <input type="search" aria-label="Search compiler symbols" placeholder="Name, owner, kind or file…" maxLength={MAX_NAVIGATION_QUERY}
        value={filter.query} onChange={event => changeFilter({query: event.target.value})}/>
      <select aria-label="Compiler symbol kind" value={filter.symbolKind} onChange={event => {
        const value = event.target.value as NavigationFilter['symbolKind'];
        if (value === 'all' || SYMBOL_KINDS.includes(value)) changeFilter({symbolKind: value});
      }}>
        <option value="all">All symbol kinds</option>
        {SYMBOL_KINDS.map(kind => <option key={kind} value={kind}>{kind.replaceAll('_', ' ')} ({kinds[kind]})</option>)}
      </select>
      <select aria-label="Compiler symbol file" value={filter.file} onChange={event => {
        const value = event.target.value;
        changeFilter({file: value === 'all' || value === 'implicit' ? value : Number(value)});
      }}>
        <option value="all">All files</option><option value="implicit">Implicit and builtins</option>
        {report.files.map(file => <option key={file.id} value={file.id}>{file.path}</option>)}
      </select>
      <select aria-label="Compiler symbol visibility" value={filter.visibility} onChange={event => {
        const value = event.target.value;
        if (value === 'all' || value === 'public' || value === 'private') changeFilter({visibility: value});
      }}>
        <option value="all">Any visibility</option><option value="public">Public</option><option value="private">Not public</option>
      </select>
      <label><input type="checkbox" checked={filter.mutableOnly} onChange={event => changeFilter({mutableOnly: event.target.checked})}/> Mutable only</label>
      <button type="button" onClick={() => { setFilter(DEFAULT_NAVIGATION_FILTER); setPage(1); setSelected(null); }}>Reset filters</button>
    </div>
    <div className="inspection-symbol-list">
      {current.items.map(item => <button key={item.id} type="button" className="activity-record"
        aria-pressed={selected === item.id} onClick={() => choose(item.id)}>
        <strong>#{item.id} · {item.name}</strong>
        <span>{item.kind.replaceAll('_', ' ')}{item.public ? ' · public' : ''}{item.mutable ? ' · mutable' : ''}</span>
        <small>{formatCompilerLocation(report, item.location)}</small>
      </button>)}
      {!matches.length && <p>No symbols match these filters.</p>}
    </div>
    <Pager page={current.page} pages={current.pages} onPage={setPage}/>
    {symbol && <section className="activity-detail" aria-label="Selected compiler symbol">
      <header className="activity-header"><strong>#{symbol.id} · {symbol.name}</strong>
        <button type="button" onClick={() => setSelected(null)}>Close symbol</button></header>
      <dl className="activity-metrics">
        <div><dt>Kind</dt><dd>{symbol.kind.replaceAll('_', ' ')}</dd></div>
        <div><dt>Owner</dt><dd>{symbolOwnerLabel(report, symbol) || 'None'}</dd></div>
        <div><dt>Visibility</dt><dd>{symbol.public ? 'Public' : 'Not public'}</dd></div>
        <div><dt>Mutability</dt><dd>{symbol.mutable ? 'Mutable' : 'Not marked mutable'}</dd></div>
      </dl>
      <p>Definition: {formatCompilerLocation(report, symbol.location)}</p>
      {symbol.targetModule !== null && <p>Target module: {report.files[symbol.targetModule]?.path}</p>}
      {report.kind === 'references' ? <>
        <p>{refs.length} matching reference(s) of {allReferences.length} to this exact symbol ID.</p>
        <div className="activity-filters">
          <select aria-label="Compiler reference kind" value={referenceFilter.kind} onChange={event => {
            const value = event.target.value as ReferenceFilter['kind'];
            if (value === 'all' || REFERENCE_KINDS.includes(value)) {
              setReferenceFilter(previous => ({...previous, kind: value})); setReferencePage(1);
            }
          }}>
            <option value="all">All reference kinds</option>
            {REFERENCE_KINDS.map(kind => <option key={kind} value={kind}>{kind.replaceAll('_', ' ')} ({referenceCounts[kind]})</option>)}
          </select>
          <select aria-label="Compiler reference file" value={referenceFilter.file} onChange={event => {
            setReferenceFilter(previous => ({...previous, file: event.target.value === 'all' ? 'all' : Number(event.target.value)}));
            setReferencePage(1);
          }}>
            <option value="all">All files</option>
            {report.files.map(file => <option key={file.id} value={file.id}>{file.path}</option>)}
          </select>
        </div>
        <ol className="inspection-reference-list">
          {refPage.items.map((reference, index) => <li key={index}>
            <strong>{reference.kind.replaceAll('_', ' ')}</strong>
            <span>{formatCompilerLocation(report, reference.location)}</span>
          </li>)}
        </ol>
        {!refs.length && <p>No references match these filters.</p>}
        <Pager page={refPage.page} pages={refPage.pages} onPage={setReferencePage}/>
      </> : <p>Use Inspect References to request use sites. A symbols-only report does not imply zero references.</p>}
    </section>}
  </section>;
}
