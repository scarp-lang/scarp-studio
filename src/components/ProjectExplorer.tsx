import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  explorerFolderKey, explorerSourceKey, explorerNavigationRows,
  isExplorerNavigationKey, resolveExplorerNavigation,
} from '../model/explorerKeyboardNavigation';
import {
  buildExplorerFolderIndex, completeExplorerHierarchy, folderScopeIsAvailable,
  folderScopeLabel, revealExplorerSource, scopeExplorerCount, scopeExplorerGroups,
  WHOLE_WORKSPACE, type ExplorerFolderScope,
} from '../model/explorerFolderNavigation';
import { buildExplorerGroups, filterExplorerGroups, isHiddenByCollapsedExplorerAncestor, explorerHeadingIndent, explorerSourceIndent, explorerDirectoryLabel, type ExplorerDirectory, type ExplorerFilter } from '../model/explorerView';
import type { StudioDocument } from '../model/documents';
import type { ListedProjectSource } from '../model/projectQuickOpen';

interface Props {
  files: readonly ListedProjectSource[];
  directories?: readonly string[];
  documents: readonly StudioDocument[];
  activeId: string | null;
  projectRoots?: readonly { directory: string }[];
  selectedProjectDirectory?: string | null;
  onSelectProject?: (directory: string) => void;
  busy: boolean;
  onOpen: (path: string) => void;
}

export function ProjectExplorer({
  files, directories = [], documents, activeId, busy, onOpen,
  projectRoots = [], selectedProjectDirectory = null, onSelectProject,
}: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ExplorerFilter>('all');
  const [collapsed, setCollapsed] = useState<ReadonlySet<ExplorerDirectory>>(() => new Set());
  const [scope, setScope] = useState<ExplorerFolderScope>(WHOLE_WORKSPACE);
  const [revealRequest, setRevealRequest] = useState(0);
  const activeRow = useRef<HTMLButtonElement | null>(null);
  const groups = useMemo(() => completeExplorerHierarchy(buildExplorerGroups(
    files, documents, activeId, directories, projectRoots.map(root => root.directory),
  )), [files, documents, activeId, directories, projectRoots]);
  const folderIndex = useMemo(() => buildExplorerFolderIndex(groups,
    projectRoots.map(root => root.directory)), [groups, projectRoots]);
  const scopeAvailable = folderScopeIsAvailable(folderIndex, scope);
  const scoped = useMemo(() => scopeExplorerGroups(groups, scope), [groups, scope]);
  const filtered = useMemo(() => filterExplorerGroups(scoped, query, filter), [scoped, query, filter]);
  const total = scopeExplorerCount(folderIndex, scope);
  const shown = filtered.reduce((sum, group) => sum + group.sources.length, 0);
  const searching = query.trim().length > 0 || filter !== 'all';
  const scopedCollapsed = useMemo(() => new Set(scoped
    .filter(group => collapsed.has(group.directory)).map(group => group.directory)), [scoped, collapsed]);
  const visibleGroups = searching ? filtered : filtered.filter(group =>
    !isHiddenByCollapsedExplorerAncestor(group.directory, scopedCollapsed));

  useEffect(() => {
    if (!revealRequest) return;
    const row = activeRow.current;
    if (row && !row.disabled) {
      row.focus({ preventScroll: true });
      row.scrollIntoView?.({ block: 'nearest' });
    }
  }, [revealRequest]);

  function revealActive() {
    const source = folderIndex.activeSource;
    if (busy || !source) return;
    setScope(WHOLE_WORKSPACE);
    setQuery('');
    setFilter('all');
    setCollapsed(previous => revealExplorerSource(previous, source));
    setRevealRequest(previous => previous + 1);
  }

  function navigateRows(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        !isExplorerNavigationKey(event.key) || !(event.target instanceof HTMLButtonElement)) return;
    const key = event.target.dataset.explorerRow;
    if (key === undefined || event.target.disabled) return;
    const rows = explorerNavigationRows(visibleGroups, collapsed, searching, busy);
    if (!rows.some(row => row.key === key)) return;
    const action = resolveExplorerNavigation(rows, key, event.key);
    event.preventDefault();
    if (action.kind === 'expand' || action.kind === 'collapse') {
      setCollapsed(previous => {
        const next = new Set(previous);
        if (action.kind === 'expand') next.delete(action.directory);
        else next.add(action.directory);
        return next;
      });
    } else if (action.kind === 'focus') {
      const target = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-explorer-row]'))
        .find(button => button.dataset.explorerRow === action.key && !button.disabled);
      if (target) {
        target.focus({ preventScroll: true });
        target.scrollIntoView?.({ block: 'nearest' });
      }
    }
  }

  function toggle(directory: ExplorerDirectory) {
    setCollapsed(current => {
      const next = new Set(current);
      if (next.has(directory)) next.delete(directory);
      else next.add(directory);
      return next;
    });
  }

  return <div className="project-explorer">
    <div className="explorer-workspace-navigation">
      <div className="explorer-summary">
        {folderIndex.workspace.total} listed files · {folderIndex.workspace.open} open · {folderIndex.workspace.modified} modified · {folderIndex.workspace.projects} projects
      </div>
      <label>Browse folder
        <select aria-label="Browse listed folder" value={scope.kind === 'workspace' ? 'w' : 'f' + scope.directory}
          onChange={event => {
            const value = event.target.value;
            if (value === 'w') { setScope(WHOLE_WORKSPACE); return; }
            if (!value.startsWith('f')) return;
            const directory = value.slice(1);
            if (!folderIndex.summaries.has(directory)) return;
            setScope({ kind: 'folder', directory, descendants: scope.kind === 'folder' ? scope.descendants : true });
            setCollapsed(previous => {
              const next = new Set(previous);
              next.delete(directory);
              return next;
            });
          }}>
          <option value="w">Entire listed workspace</option>
          {!scopeAvailable && scope.kind === 'folder' &&
            <option value={'f' + scope.directory} disabled>Folder no longer listed</option>}
          {folderIndex.directories.map(directory => <option key={directory} value={'f' + directory}>
            {directory || 'Workspace root'} ({folderIndex.summaries.get(directory)?.total ?? 0})
          </option>)}
        </select>
      </label>
      {scope.kind === 'folder' && <label>
        <input type="checkbox" checked={scope.descendants}
          onChange={event => setScope({ kind: 'folder', directory: scope.directory, descendants: event.target.checked })}/>
        Include subfolders
      </label>}
      {!scopeAvailable && <p role="status">The selected folder is no longer listed. Choose another folder or reset to the workspace.</p>}
      <button type="button" disabled={busy || !folderIndex.activeSource} onClick={revealActive}>
        Reveal active file
      </button>
      {folderIndex.activeAmbiguous && <p role="status">The active file matches multiple listed sources; reveal is unavailable.</p>}
    </div>
    <div className="explorer-filter">
      <input type="search" aria-label="Filter listed Scarp sources" placeholder="Filter project files…" value={query}
        maxLength={160} onChange={event => setQuery(event.target.value)} />
      <select aria-label="Show project files by editor state" value={filter} onChange={event => {
        const value = event.target.value;
        if (value === 'all' || value === 'open' || value === 'modified') setFilter(value);
      }}>
        <option value="all">All files</option><option value="open">Open files</option><option value="modified">Modified files</option>
      </select>
      {searching && <button type="button" onClick={() => { setQuery(''); setFilter('all'); }}>Clear filters</button>}
    </div>
    <div className="explorer-summary" role="status">{shown} of {total} listed sources · {folderScopeLabel(scope)}</div>
    <div className="explorer-group-actions">
      <button type="button" disabled={searching} onClick={() => setCollapsed(previous => {
        const next = new Set(previous);
        for (const group of scoped) next.delete(group.directory);
        return next;
      })}>Expand all</button>
      <button type="button" disabled={searching} onClick={() => setCollapsed(previous => new Set([...previous, ...scoped.map(group => group.directory)]))}>Collapse all</button>
    </div>
    <p className="explorer-keyboard-hint">On a file or folder: ↑ ↓ move, ← → navigate folders, Home / End jump.</p>
    <div aria-label="Listed workspace files and folders" onKeyDown={navigateRows}>
    {visibleGroups.map((group, index) => {
      const expanded = searching || !collapsed.has(group.directory);
      const groupId = 'studio-explorer-group-' + index;
      const manifestRoot = projectRoots.some(root => root.directory === group.directory);
      const currentProject = manifestRoot && selectedProjectDirectory === group.directory;
      const folderName = group.directory || 'Workspace root';
      const summary = folderIndex.summaries.get(group.directory);
      return <section key={group.directory} className="explorer-group">
        <div className="explorer-group-header">
          <button type="button" className="explorer-group-heading"
            aria-expanded={expanded} aria-controls={groupId}
            data-explorer-row={explorerFolderKey(group.directory)}
            title={folderName} aria-label={'Folder ' + folderName}
            style={{ paddingLeft: explorerHeadingIndent(group.directory) }}
            disabled={searching} onClick={() => toggle(group.directory)}>
            <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
            <strong>{explorerDirectoryLabel(group.directory, searching)}</strong>
            <span className="explorer-count" title={summary
              ? summary.direct + ' direct files; ' + summary.total + ' including subfolders; ' + summary.modified + ' modified'
              : undefined}>{group.sources.length}{!searching && scope.kind !== 'folder' && summary && summary.total !== summary.direct
                ? ' / ' + summary.total : ''}</span>
            {summary?.active && <span className="explorer-folder-active" aria-label="Contains active source" title="Contains active source">•</span>}
            {!!summary?.modified && <span className="explorer-folder-modified" aria-label={summary.modified + ' modified sources in folder tree'} title="Modified sources in folder tree">●</span>}
          </button>
          {manifestRoot && (currentProject
            ? <span className="explorer-project-selected" title="Current target for project commands">Project ✓</span>
            : onSelectProject && <button type="button" className="explorer-project-switch"
                title={'Use ' + folderName + ' for Info, Verify, Run and Tests (does not execute)'}
                aria-label={'Select Scarp project ' + folderName}
                disabled={busy} onClick={() => onSelectProject(group.directory)}>
                Use Project
              </button>)}
        </div>
        <div id={groupId} hidden={!expanded}>
          {group.sources.map(source => <button type="button" className={'file-row explorer-source' + (source.active ? ' selected' : '')}
            key={source.path} data-explorer-row={explorerSourceKey(source.path)} ref={source.active ? activeRow : undefined} aria-current={source.active ? 'true' : undefined} title={source.path}
            style={{ paddingLeft: explorerSourceIndent(group.directory) }}
            disabled={busy} onClick={() => onOpen(source.path)}>
            <span aria-hidden="true" className="file-glyph">S</span>
            <span className="file-name">{source.basename}</span>
            {source.entrypoint && <span className="explorer-entrypoint" title="Conventional main source">main</span>}
            {source.modified ? <span className="dirty-indicator" aria-label="Modified source">●</span>
              : source.documentId && <span className="explorer-open" aria-label="Open source">○</span>}
          </button>)}
        </div>
      </section>;
    })}
    </div>
    {!shown && scopeAvailable && <p className="sidebar-note">{searching ? 'No listed sources match the filters.' : scoped.length ? 'No .srp files found in these folders.' : 'No .srp files or folders found.'}</p>}
  </div>;
}
