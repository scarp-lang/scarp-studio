import { useMemo, useState } from 'react';
import type { StudioDocument } from '../model/documents';
import {
  buildTabInventory, currentTabSelection, filterTabInventory, matchesTabSelection,
  selectVisibleTabs, tabSelection, MAX_TAB_QUERY,
  type TabFilter, type TabSelection, type TabSort,
} from '../model/openEditorManagement';

interface Props {
  documents: readonly StudioDocument[];
  activeId: string | null;
  pinnedIds?: readonly string[];
  busy: boolean;
  onActivate: (document: StudioDocument) => void;
  onClose: (selections: readonly TabSelection[]) => boolean;
  initiallyExpanded?: boolean;
}

const PAGE_SIZE = 20;
const filters: readonly { value: TabFilter; label: string }[] = [
  { value: 'all', label: 'All open tabs' },
  { value: 'modified', label: 'Unsaved changes' },
  { value: 'saved', label: 'Saved sources' },
  { value: 'untitled', label: 'Untitled buffers' },
  { value: 'pinned', label: 'Pinned tabs' },
];
const orders: readonly { value: TabSort; label: string }[] = [
  { value: 'tab-order', label: 'Tab order' },
  { value: 'name', label: 'Filename' },
  { value: 'modified', label: 'Modified first' },
];

export function OpenEditorManager({
  documents, activeId, pinnedIds = [], busy, onActivate, onClose, initiallyExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<TabFilter>('all');
  const [sort, setSort] = useState<TabSort>('tab-order');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<TabSelection[]>([]);
  const inventory = useMemo(() => expanded
    ? buildTabInventory(documents, activeId, pinnedIds) : null, [expanded, documents, activeId, pinnedIds]);
  const filtered = useMemo(() => inventory
    ? filterTabInventory(inventory.entries, query, filter, sort) : [],
    [inventory, query, filter, sort]);
  const valid = useMemo(() => currentTabSelection(selected, documents, pinnedIds), [selected, documents, pinnedIds]);
  const stale = selected.length !== valid.length;
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function resetFilter() {
    setPage(1);
    setSelected([]);
  }
  function toggleSelection(document: StudioDocument, checked: boolean) {
    const selection = pinnedIds.includes(document.id) ? null : tabSelection(document);
    setSelected(previous => {
      const remaining = previous.filter(item => item.id !== document.id);
      return checked && selection ? [...remaining, selection] : remaining;
    });
  }
  function closeSelected() {
    if (busy || stale || !selected.length) return;
    if (onClose(selected)) setSelected([]);
  }
  return (
    <section className="sidebar-section open-editor-manager" aria-label="Open editor manager">
      <div className="sidebar-heading">MANAGE OPEN EDITORS</div>
      <button type="button" className="insights-toggle" aria-expanded={expanded}
        aria-controls="studio-editor-manager" onClick={() => {
          setExpanded(value => !value);
          setSelected([]);
        }}>
        <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
        <span>{expanded ? 'Hide editor manager' : 'Review and close saved tabs'}</span>
      </button>
      <div id="studio-editor-manager" hidden={!expanded}>
        {inventory && <div className="editor-manager-content">
          <p className="insights-disclaimer">
            Batch close is limited to saved, unmodified source tabs. Unsaved and untitled buffers
            are protected, along with pinned tabs. No source files are changed or deleted.
          </p>
          <div className="editor-manager-summary" role="status">
            {inventory.total} open · {inventory.modified} modified · {inventory.untitled} untitled · {inventory.pinned} pinned
          </div>
          {inventory.limited && <p className="sidebar-note" role="status">
            Only the first 200 open tabs can be managed here.
          </p>}
          <div className="editor-manager-filters">
            <input type="search" value={query} maxLength={MAX_TAB_QUERY}
              aria-label="Search open editor tabs" placeholder="Filter filenames or paths…"
              onChange={event => { setQuery(event.target.value); resetFilter(); }} />
            <select value={filter} aria-label="Filter editor tabs by state" onChange={event => {
              const next = filters.find(item => item.value === event.target.value);
              if (next) { setFilter(next.value); resetFilter(); }
            }}>
              {filters.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <select value={sort} aria-label="Sort open editor tabs" onChange={event => {
              const next = orders.find(item => item.value === event.target.value);
              if (next) { setSort(next.value); resetFilter(); }
            }}>
              {orders.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          <div className="editor-manager-actions">
            <button type="button" disabled={busy || !visible.some(entry => entry.closeEligible)}
              onClick={() => setSelected(selectVisibleTabs(visible))}>Select saved on page</button>
            <button type="button" disabled={!selected.length}
              onClick={() => setSelected([])}>Clear selection</button>
            <button type="button" disabled={busy || stale || !selected.length}
              onClick={closeSelected}>Close selected ({selected.length})</button>
          </div>
          {stale && <p className="sidebar-note" role="status">
            A selected tab changed or closed. Clear the selection and review the current tabs before closing.
          </p>}
          <div className="editor-manager-list">
            {visible.map(entry => {
              const document = entry.document;
              const checked = valid.some(item => matchesTabSelection(item, document));
              return <div key={document.id} className={'editor-manager-row' + (entry.active ? ' selected' : '')}>
                <input type="checkbox" checked={checked}
                  aria-label={'Select saved tab ' + entry.label}
                  disabled={busy || !entry.closeEligible}
                  onChange={event => toggleSelection(document, event.target.checked)} />
                <button type="button" disabled={busy} title={document.path ?? document.name}
                  aria-current={entry.active ? 'true' : undefined}
                  onClick={() => onActivate(document)}>
                  <span>{entry.label}</span>
                  <small>{entry.pinned ? 'Pinned · ' : ''}{entry.modified ? 'Modified' : document.path === null ? 'Untitled' : 'Saved'}</small>
                </button>
              </div>;
            })}
            {!visible.length && <p className="sidebar-note">No open tabs match these filters.</p>}
          </div>
          {pages > 1 && <div className="insights-pages">
            <button type="button" disabled={currentPage === 1} onClick={() => {
              setPage(currentPage - 1); setSelected([]);
            }}>Previous</button>
            <span>Page {currentPage} / {pages}</span>
            <button type="button" disabled={currentPage === pages} onClick={() => {
              setPage(currentPage + 1); setSelected([]);
            }}>Next</button>
          </div>}
        </div>}
      </div>
    </section>
  );
}
