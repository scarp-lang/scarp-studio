import type { ExplorerGroup, ExplorerSource } from './explorerView';

export interface ExplorerFolderSummary {
  readonly directory: string;
  readonly direct: number;
  readonly total: number;
  readonly open: number;
  readonly modified: number;
  readonly active: boolean;
  readonly projects: number;
}

export interface ExplorerFolderIndex {
  readonly summaries: ReadonlyMap<string, ExplorerFolderSummary>;
  readonly directories: readonly string[];
  readonly workspace: ExplorerFolderSummary;
  readonly activeSource: ExplorerSource | null;
  readonly activeAmbiguous: boolean;
}

export type ExplorerFolderScope =
  | { readonly kind: 'workspace' }
  | { readonly kind: 'folder'; readonly directory: string; readonly descendants: boolean };

export const WHOLE_WORKSPACE: ExplorerFolderScope = Object.freeze({ kind: 'workspace' });

type MutableSummary = { -readonly [K in keyof ExplorerFolderSummary]: ExplorerFolderSummary[K] };

function blank(directory: string): MutableSummary {
  return { directory, direct: 0, total: 0, open: 0, modified: 0, active: false, projects: 0 };
}

/** Includes the directory itself and the empty workspace-root label.
 * This is a relative-label relation, not native path canonicalization. */
export function explorerFolderAncestors(directory: string): readonly string[] {
  if (!directory) return [''];
  const segments = directory.split('/');
  const ancestors = [''];
  let prefix = '';
  for (const segment of segments) {
    prefix = prefix ? prefix + '/' + segment : segment;
    ancestors.push(prefix);
  }
  return ancestors;
}

export function explorerFolderContains(parent: string, child: string): boolean {
  return parent === '' || parent === child || child.startsWith(parent + '/');
}

/** Materialize missing presentation ancestors of already validated groups.
 * Do not manufacture any source or native path; synthetic headings can only
 * expand/collapse the sources and known project roots already in memory. */
export function completeExplorerHierarchy(groups: readonly ExplorerGroup[]): ExplorerGroup[] {
  const known = new Map(groups.map(group => [group.directory, group]));
  const result: ExplorerGroup[] = [];
  const added = new Set<string>();
  for (const group of groups) {
    for (const directory of explorerFolderAncestors(group.directory)) {
      // The empty root is a direct-source heading, not an artificial parent
      // above every independent top-level project.
      if (directory === '' && !known.has('')) continue;
      if (added.has(directory)) continue;
      added.add(directory);
      result.push(known.get(directory) ?? { directory, sources: [] });
    }
  }
  return result;
}

export function buildExplorerFolderIndex(
  groups: readonly ExplorerGroup[],
  projectDirectories: readonly string[],
): ExplorerFolderIndex {
  const summaries = new Map<string, MutableSummary>();
  const workspace = blank('');
  const known = new Set(groups.map(group => group.directory));
  let activeSource: ExplorerSource | null = null;
  let activeAmbiguous = false;

  for (const group of groups) {
    summaries.set(group.directory, blank(group.directory));
  }

  for (const group of groups) {
    const ancestors = explorerFolderAncestors(group.directory);
    for (const source of group.sources) {
      workspace.total++;
      if (group.directory === '') workspace.direct++;
      if (source.documentId !== null) workspace.open++;
      if (source.modified) workspace.modified++;
      if (source.active) {
        workspace.active = true;
        if (activeSource !== null) activeAmbiguous = true;
        else activeSource = source;
      }
      for (const directory of ancestors) {
        const summary = summaries.get(directory);
        if (!summary) continue;
        summary.total++;
        if (directory === group.directory) summary.direct++;
        if (source.documentId !== null) summary.open++;
        if (source.modified) summary.modified++;
        if (source.active) summary.active = true;
      }
    }
  }
  // A manifest root can be empty. Deduplicate known root labels and never
  // count a forged or unavailable directory as a selectable project.
  for (const directory of new Set(projectDirectories)) {
    if (!known.has(directory)) continue;
    workspace.projects++;
    for (const ancestor of explorerFolderAncestors(directory)) {
      const summary = summaries.get(ancestor);
      if (summary) summary.projects++;
    }
  }
  const readonly = new Map<string, ExplorerFolderSummary>();
  for (const [directory, summary] of summaries) readonly.set(directory, Object.freeze(summary));
  return Object.freeze({
    summaries: readonly,
    directories: Object.freeze(groups.map(group => group.directory)),
    workspace: Object.freeze(workspace),
    activeSource: activeAmbiguous ? null : activeSource,
    activeAmbiguous,
  });
}

export function folderScopeIsAvailable(index: ExplorerFolderIndex, scope: ExplorerFolderScope): boolean {
  return scope.kind === 'workspace' || index.summaries.has(scope.directory);
}

export function scopeExplorerGroups(
  groups: readonly ExplorerGroup[],
  scope: ExplorerFolderScope,
): ExplorerGroup[] {
  if (scope.kind === 'workspace') return [...groups];
  if (!groups.some(group => group.directory === scope.directory)) return [];
  return groups.filter(group => scope.descendants
    ? explorerFolderContains(scope.directory, group.directory)
    : scope.directory === group.directory);
}

export function scopeExplorerCount(index: ExplorerFolderIndex, scope: ExplorerFolderScope): number {
  if (scope.kind === 'workspace') return index.workspace.total;
  const summary = index.summaries.get(scope.directory);
  return summary ? scope.descendants ? summary.total : summary.direct : 0;
}

/** Expand only the active path, keeping unrelated collapsed folders intact.
 * The caller must reset incompatible search or folder scope separately. */
export function revealExplorerSource(
  collapsed: ReadonlySet<string>,
  source: ExplorerSource,
): ReadonlySet<string> {
  const next = new Set(collapsed);
  for (const directory of explorerFolderAncestors(source.directory)) {
    next.delete(directory);
  }
  return next;
}

export function folderScopeLabel(scope: ExplorerFolderScope): string {
  if (scope.kind === 'workspace') return 'Entire listed workspace';
  const folder = scope.directory || 'Workspace root';
  return folder + (scope.descendants ? ' and subfolders' : ' only');
}
