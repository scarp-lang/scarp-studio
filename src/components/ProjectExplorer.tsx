import { useMemo, useState } from 'react';
import { buildExplorerGroups, filterExplorerGroups, isHiddenByCollapsedExplorerAncestor, explorerHeadingIndent, explorerSourceIndent, explorerDirectoryLabel, type ExplorerDirectory, type ExplorerFilter } from '../model/explorerView';
import type { StudioDocument } from '../model/documents';
import type { ListedProjectSource } from '../model/projectQuickOpen';

interface Props {
  files: readonly ListedProjectSource[];
  directories?: readonly string[];
  documents: readonly StudioDocument[];
  activeId: string | null;
  projectRoots?: readonly { directory: string }[];
  selectedProjectDirectory?: string;
  onSelectProject?: (directory: string) => void;
  busy: boolean;
  onOpen: (path: string) => void;
}

export function ProjectExplorer({
  files, directories = [], documents, activeId, busy, onOpen,
  projectRoots = [], selectedProjectDirectory = '', onSelectProject,
}: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ExplorerFilter>('all');
  const [collapsed, setCollapsed] = useState<ReadonlySet<ExplorerDirectory>>(() => new Set());
  const groups = useMemo(() => buildExplorerGroups(
    files, documents, activeId, directories, projectRoots.map(root => root.directory),
  ), [files, documents, activeId, directories, projectRoots]);
  const filtered = useMemo(() => filterExplorerGroups(groups, query, filter), [groups, query, filter]);
  const total = groups.reduce((sum, group) => sum + group.sources.length, 0);
  const shown = filtered.reduce((sum, group) => sum + group.sources.length, 0);
  const searching = query.trim().length > 0 || filter !== 'all';
  const visibleGroups = searching ? filtered : filtered.filter(group =>
    !isHiddenByCollapsedExplorerAncestor(group.directory, collapsed));

  function toggle(directory: ExplorerDirectory) {
    setCollapsed(current => {
      const next = new Set(current);
      if (next.has(directory)) next.delete(directory);
      else next.add(directory);
      return next;
    });
  }

  return <div className="project-explorer">
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
    <div className="explorer-summary" role="status">{shown} of {total} listed sources</div>
    <div className="explorer-group-actions">
      <button type="button" disabled={searching} onClick={() => setCollapsed(new Set())}>Expand all</button>
      <button type="button" disabled={searching} onClick={() => setCollapsed(new Set(groups.map(g => g.directory)))}>Collapse all</button>
    </div>
    {visibleGroups.map((group, index) => {
      const expanded = searching || !collapsed.has(group.directory);
      const groupId = 'studio-explorer-group-' + index;
      const manifestRoot = projectRoots.some(root => root.directory === group.directory);
      const currentProject = manifestRoot && selectedProjectDirectory === group.directory;
      const folderName = group.directory || 'Workspace root';
      return <section key={group.directory} className="explorer-group">
        <div className="explorer-group-header">
          <button type="button" className="explorer-group-heading"
            aria-expanded={expanded} aria-controls={groupId}
            title={folderName} aria-label={'Folder ' + folderName}
            style={{ paddingLeft: explorerHeadingIndent(group.directory) }}
            disabled={searching} onClick={() => toggle(group.directory)}>
            <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
            <strong>{explorerDirectoryLabel(group.directory, searching)}</strong>
            <span className="explorer-count">{group.sources.length}</span>
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
            key={source.path} aria-current={source.active ? 'true' : undefined} title={source.path}
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
    {!shown && <p className="sidebar-note">{searching ? 'No listed sources match the filters.' : groups.length ? 'No .srp files found in these folders.' : 'No .srp files or folders found.'}</p>}
  </div>;
}
