import { useMemo, useState } from 'react';
import type { ProjectSearchHit, ProjectSearchResult } from '../model/projectSearch';
import type { ScopedSearchSummary } from '../model/projectSearchScope';
import {
  buildProjectMatchInventory, filterProjectMatchInventory, pageProjectMatchRows, adjacentProjectMatch,
  resolveReviewedProjectMatch, projectMatchExplorerReport, visibleMatchContext,
  DEFAULT_PROJECT_MATCH_FILTER, PROJECT_MATCH_FILTER_LIMIT, PROJECT_MATCH_PAGE_SIZE, MATCH_COVERAGE_LABELS, MATCH_ORIGIN_LABELS,
  type ProjectMatchFilter, type ProjectMatchRow, type ProjectMatchContext, type ProjectMatchInventory,
} from '../model/projectMatchExplorer';

interface Props {
  readonly result: ProjectSearchResult;
  readonly coverage: ScopedSearchSummary;
  readonly busy: boolean;
  readonly onNavigate: (hit: ProjectSearchHit) => void;
}

export function MatchContextText({ context }: { readonly context: ProjectMatchContext }) {
  return <code className="project-match-context" dir="auto">
    {context.leadingOmitted && <span aria-label="Earlier line context omitted">…</span>}
    {visibleMatchContext(context.before)}
    <mark>{visibleMatchContext(context.match)}</mark>
    {visibleMatchContext(context.after)}
    {context.trailingOmitted && <span aria-label="Later line context omitted">…</span>}
  </code>;
}
export function ProjectMatchReview({ row, previous, next, busy, onSelect, onNavigate }: {
  readonly row: ProjectMatchRow;
  readonly previous: ProjectMatchRow | null;
  readonly next: ProjectMatchRow | null;
  readonly busy: boolean;
  readonly onSelect: (index: number) => void;
  readonly onNavigate: () => void;
}) {
  return <div className="project-match-review" role="group" aria-label="Reviewed project search occurrence">
    <p><strong><code dir="auto">{row.name}</code> · {row.line}:{row.column}</strong></p>
    <p>{MATCH_ORIGIN_LABELS[row.origin]} · {MATCH_COVERAGE_LABELS[row.coverage]}</p>
    <p>Exact UTF-16 coordinate in the search snapshot; surrounding context is bounded.
      Opening the occurrence rechecks the current source before navigation.</p>
    <MatchContextText context={row.context}/>
    <div className="project-scope-fields">
      <button type="button" disabled={!previous} onClick={() => { if (previous) onSelect(previous.index); }}>Previous reviewed match</button>
      <button type="button" disabled={!next} onClick={() => { if (next) onSelect(next.index); }}>Next reviewed match</button>
      <button type="button" disabled={busy} onClick={onNavigate}>Open reviewed match</button>
    </div>
  </div>;
}

function MatchFilterControls({ inventory, filter, onChange }: {
  readonly inventory: ProjectMatchInventory;
  readonly filter: ProjectMatchFilter;
  readonly onChange: (next: ProjectMatchFilter) => void;
}) {
  const patch = (value: Partial<ProjectMatchFilter>) => onChange({ ...filter, ...value });
  return <div className="project-scope-fields">
    <label>Source label<select aria-label="Filter displayed project match source" value={filter.source}
      onChange={event => patch({ source: event.target.value })}>
      <option value="">All matching sources</option>
      {inventory.groups.map(group => <option key={group.name} value={group.name}>{group.name} ({group.count})</option>)}
    </select></label>
    <label>Snapshot origin<select aria-label="Filter project match origin" value={filter.origin} onChange={event => {
      const value = event.target.value;
      if (value === 'all' || value === 'disk' || value === 'open-buffer') patch({ origin: value });
    }}>
      <option value="all">Any source origin</option><option value="open-buffer">Open buffer at search</option>
      <option value="disk">Disk snapshot at search</option>
    </select></label>
    <label>Coverage evidence<select aria-label="Filter project match coverage" value={filter.coverage} onChange={event => {
      const value = event.target.value;
      if (value === 'all' || value === 'fully-scanned' || value === 'partial' || value === 'unknown') patch({ coverage: value });
    }}>
      <option value="all">Any coverage</option><option value="fully-scanned">Fully scanned sources</option>
      <option value="partial">Partial source scans</option><option value="unknown">Unknown per-file coverage</option>
    </select></label>
    <label>Context contains<input aria-label="Filter displayed match context" type="search" maxLength={PROJECT_MATCH_FILTER_LIMIT}
      value={filter.context} onChange={event => patch({ context: event.target.value })}/></label>
    <label>First line<input aria-label="First displayed match line" inputMode="numeric" maxLength={7}
      placeholder="Any" value={filter.lineFrom} onChange={event => patch({ lineFrom: event.target.value })}/></label>
    <label>Last line<input aria-label="Last displayed match line" inputMode="numeric" maxLength={7}
      placeholder="Any" value={filter.lineTo} onChange={event => patch({ lineTo: event.target.value })}/></label>
    <label>Order<select aria-label="Displayed project match order" value={filter.sort} onChange={event => {
      const value = event.target.value;
      if (value === 'search-order' || value === 'source' || value === 'file-density') patch({ sort: value });
    }}>
      <option value="search-order">Original search order</option><option value="source">Relative label and position</option>
      <option value="file-density">Most displayed matches per file</option>
    </select></label>
    <button type="button" onClick={() => onChange(DEFAULT_PROJECT_MATCH_FILTER)}>Reset displayed match filters</button>
  </div>;
}

export function ProjectMatchExplorer({ result, coverage, busy, onNavigate }: Props) {
  const inventory = useMemo(() => buildProjectMatchInventory(result, coverage), [result, coverage]);
  const [filter, setFilter] = useState<ProjectMatchFilter>(DEFAULT_PROJECT_MATCH_FILTER);
  const [requestedPage, setPage] = useState(1);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showGroups, setShowGroups] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [includeLocations, setIncludeLocations] = useState(false);
  const [notice, setNotice] = useState('');
  const filtered = useMemo(() => inventory.ok ? filterProjectMatchInventory(inventory.value, filter) : null, [inventory, filter]);
  const report = useMemo(() => showReport && inventory.ok && filtered?.ok
    ? projectMatchExplorerReport(inventory.value, filtered.value, includeLocations) : '',
  [showReport, inventory, filtered, includeLocations]);

  function updateFilter(next: ProjectMatchFilter) {
    setFilter(next); setPage(1); setSelectedIndex(null); setNotice('');
  }
  function navigate(row: ProjectMatchRow) {
    if (busy) return;
    const hit = resolveReviewedProjectMatch(result, row);
    if (!hit) { setNotice('The reviewed occurrence no longer matches this result. Search again.'); return; }
    setNotice(''); onNavigate(hit);
  }

  if (!inventory.ok) return <section aria-label="Project match review unavailable">
    <p role="alert">{inventory.error} Run a new project search to review exact context.</p>
  </section>;

  const data = inventory.value;
  const rows = filtered?.ok ? filtered.value : [];
  const page = pageProjectMatchRows(rows, requestedPage);
  const selected = rows.find(row => row.index === selectedIndex);
  return <section className="project-match-explorer" aria-label="Displayed project match workbench">
    <p>Filter and inspect displayed matches only. Filters never search new files or change the selection in
      the separate workspace replacement tool.</p>
    {data.incomplete && <p role="status">The source scope is incomplete. Filtered counts do not include undiscovered matches.</p>}
    <button type="button" aria-expanded={showGroups} onClick={() => setShowGroups(value => !value)}>
      {showGroups ? 'Hide matching source overview' : 'Review matching source overview'}
    </button>
    {showGroups && <div className="project-scope-inventory"><table>
      <caption>Displayed matches by source</caption>
      <thead><tr><th>Relative source label</th><th>Matches</th><th>Observed lines</th><th>Evidence</th></tr></thead>
      <tbody>{data.groups.map(group => <tr key={group.name}>
        <td><button type="button" onClick={() => updateFilter({ ...DEFAULT_PROJECT_MATCH_FILTER, source: group.name })}>
          <code dir="auto">{group.name}</code></button></td>
        <td>{group.count}</td><td>{group.firstLine}–{group.lastLine}</td>
        <td>{MATCH_ORIGIN_LABELS[group.origin]} · {MATCH_COVERAGE_LABELS[group.coverage]}</td>
      </tr>)}</tbody>
    </table></div>}
    <MatchFilterControls inventory={data} filter={filter} onChange={updateFilter}/>
    {filtered && !filtered.ok && <p role="alert">{filtered.error}</p>}
    <p role="status">{rows.length} filtered of {data.rows.length} displayed matches
      {rows.length > 0 && ' · showing ' + page.first + '–' + page.last}</p>
    {selected && <ProjectMatchReview row={selected} busy={busy}
      previous={adjacentProjectMatch(rows, selected.index, -1)} next={adjacentProjectMatch(rows, selected.index, 1)}
      onSelect={index => {
        setSelectedIndex(index);
        const position = rows.findIndex(row => row.index === index);
        if (position >= 0) {
          const nextPage = pageProjectMatchRows(rows, Math.floor(position / PROJECT_MATCH_PAGE_SIZE) + 1);
          setPage(nextPage.page);
        }
      }} onNavigate={() => navigate(selected)}/>}
    <div className="search-results" role="list" aria-label="Matches in selected Scarp project">
      {page.rows.map(row => <div role="listitem" key={row.index} className="project-match-list-row">
        <button className="search-result-row" type="button" disabled={busy} onClick={() => navigate(row)}
          title={row.name + ' at ' + row.line + ':' + row.column}>
          <span className="search-result-location"><code dir="auto">{row.name}</code> · {row.line}:{row.column}
            {row.origin === 'open-buffer' && ' · open buffer'}</span>
          <span className="search-result-preview"><MatchContextText context={row.context}/></span>
        </button>
        <button type="button" aria-pressed={selectedIndex === row.index}
          aria-label={'Review displayed occurrence ' + (row.index + 1)}
          onClick={() => setSelectedIndex(value => value === row.index ? null : row.index)}>Review context</button>
      </div>)}
      {!rows.length && <p className="sidebar-note">{data.rows.length
        ? 'No displayed matches satisfy the current filters.' : 'No displayed matches in this search. Check coverage before drawing conclusions.'}</p>}
    </div>
    <div className="project-scope-fields">
      <button type="button" disabled={page.page <= 1} onClick={() => setPage(page.page - 1)}>Previous match page</button>
      <span>Page {page.page} of {page.pages}</span>
      <button type="button" disabled={page.page >= page.pages} onClick={() => setPage(page.page + 1)}>Next match page</button>
    </div>
    {notice && <p role="alert">{notice}</p>}
    <button type="button" aria-expanded={showReport} disabled={!filtered?.ok}
      onClick={() => setShowReport(value => !value)}>{showReport ? 'Hide displayed match report' : 'Review displayed match report'}</button>
    {showReport && filtered?.ok && <>
      <label><input type="checkbox" checked={includeLocations} onChange={event => setIncludeLocations(event.target.checked)}/>
        Include relative source labels and coordinates</label>
      <label>Copyable displayed match report<textarea aria-label="Displayed project match report" readOnly rows={9} value={report}/></label>
      <p>Default report contains counts only. Even with locations enabled, query, match text, surrounding context
        and native paths are excluded.</p>
    </>}
  </section>;
}
