import { describe, expect, it } from 'vitest';
import { buildExplorerGroups, filterExplorerGroups, isHiddenByCollapsedExplorerAncestor } from './explorerView';
import { openedDocument, updateContent } from './documents';
import {
  buildExplorerFolderIndex, completeExplorerHierarchy, explorerFolderAncestors, explorerFolderContains,
  folderScopeIsAvailable, folderScopeLabel, revealExplorerSource, scopeExplorerCount,
  scopeExplorerGroups, WHOLE_WORKSPACE, type ExplorerFolderScope,
} from './explorerFolderNavigation';

const files = [
  'main.srp',
  'basic_tuple/main.srp',
  'basic_tuple/src/deep/math.srp',
  'basic_tuple/src/deep/other.srp',
  'basic_tuple_extra/main.srp',
  'loops/main.srp',
  'loops/tests/check.srp',
].map(name => ({ name, path: 'C:/practice/' + name }));

const roots = ['', 'basic_tuple', 'basic_tuple_extra', 'loops', 'empty'];
const directories = ['basic_tuple', 'basic_tuple_extra', 'loops', 'loops/tests', 'empty'];

function fixture() {
  const opened = openedDocument([], 'c:/PRACTICE/basic_tuple/src/deep/math.srp', 'print(1);');
  const dirty = updateContent(opened.documents, opened.id, 'print(2);');
  const another = openedDocument(dirty, 'C:/practice/loops/main.srp', 'print(3);');
  const groups = completeExplorerHierarchy(buildExplorerGroups(
    files, another.documents, opened.id, directories, roots,
  ));
  return { groups, index: buildExplorerFolderIndex(groups, roots) };
}

function folder(directory: string, descendants = true): ExplorerFolderScope {
  return { kind: 'folder', directory, descendants };
}

describe('workspace folder navigation', () => {
  it('supplies missing intermediate headings without inventing source paths', () => {
    const { groups } = fixture();
    expect(groups.map(group => group.directory)).toEqual([
      '', 'basic_tuple', 'basic_tuple/src', 'basic_tuple/src/deep',
      'basic_tuple_extra', 'empty', 'loops', 'loops/tests',
    ]);
    expect(groups.find(group => group.directory === 'basic_tuple/src')?.sources).toEqual([]);
    expect(groups.flatMap(group => group.sources).map(source => source.path).sort())
      .toEqual(files.map(file => file.path).sort());
  });

  it('does not manufacture an empty root heading for independent projects', () => {
    const groups = completeExplorerHierarchy(buildExplorerGroups(
      [{ name: 'practice/src/main.srp', path: '/practice/src/main.srp' }], [], null,
    ));
    expect(groups.map(group => group.directory)).toEqual(['practice', 'practice/src']);
    expect(groups[0].sources).toEqual([]);
    expect(completeExplorerHierarchy([])).toEqual([]);
  });

  it('uses exact segment boundaries and preserves case in relative labels', () => {
    expect(explorerFolderAncestors('a/b/c')).toEqual(['', 'a', 'a/b', 'a/b/c']);
    expect(explorerFolderAncestors('')).toEqual(['']);
    expect(explorerFolderContains('basic_tuple', 'basic_tuple/src')).toBe(true);
    expect(explorerFolderContains('basic_tuple', 'basic_tuple_extra')).toBe(false);
    expect(explorerFolderContains('basic_tuple', 'Basic_Tuple/src')).toBe(false);
    expect(explorerFolderContains('', 'anything')).toBe(true);
  });

  it('counts each file once in the workspace and in its folder ancestry', () => {
    const { index } = fixture();
    expect(index.workspace).toMatchObject({
      direct: 1, total: 7, open: 2, modified: 1, projects: 5, active: true,
    });
    expect(index.summaries.get('basic_tuple')).toMatchObject({
      direct: 1, total: 3, open: 1, modified: 1, projects: 1, active: true,
    });
    expect(index.summaries.get('basic_tuple/src')).toMatchObject({
      direct: 0, total: 2, open: 1, modified: 1, projects: 0, active: true,
    });
    expect(index.summaries.get('basic_tuple_extra')).toMatchObject({
      direct: 1, total: 1, modified: 0, active: false,
    });
    expect(index.summaries.get('empty')).toMatchObject({
      direct: 0, total: 0, projects: 1, active: false,
    });
  });

  it('does not duplicate counts for repeated or unknown project roots', () => {
    const { groups } = fixture();
    const index = buildExplorerFolderIndex(groups, ['loops', 'loops', 'unknown']);
    expect(index.workspace.projects).toBe(1);
    expect(index.summaries.get('loops')?.projects).toBe(1);
    expect(index.summaries.get('basic_tuple')?.projects).toBe(0);
  });

  it('supports direct-only and recursive browsing without changing original groups', () => {
    const { groups, index } = fixture();
    expect(scopeExplorerGroups(groups, folder('basic_tuple')).map(group => group.directory))
      .toEqual(['basic_tuple', 'basic_tuple/src', 'basic_tuple/src/deep']);
    expect(scopeExplorerCount(index, folder('basic_tuple'))).toBe(3);
    expect(scopeExplorerGroups(groups, folder('basic_tuple', false)).map(group => group.directory))
      .toEqual(['basic_tuple']);
    expect(scopeExplorerCount(index, folder('basic_tuple', false))).toBe(1);
    expect(scopeExplorerCount(index, WHOLE_WORKSPACE)).toBe(7);
    expect(groups).toHaveLength(8);
  });

  it('distinguishes the root source heading from whole-workspace scope', () => {
    const { groups, index } = fixture();
    expect(scopeExplorerCount(index, folder('', false))).toBe(1);
    expect(scopeExplorerGroups(groups, folder('', false)).map(group => group.directory)).toEqual(['']);
    expect(scopeExplorerGroups(groups, folder(''))).toEqual(groups);
    expect(folderScopeLabel(folder('', false))).toBe('Workspace root only');
    expect(folderScopeLabel(WHOLE_WORKSPACE)).toBe('Entire listed workspace');
  });

  it('fails closed when a selected directory is no longer listed', () => {
    const { groups, index } = fixture();
    const stale = folder('removed');
    expect(folderScopeIsAvailable(index, stale)).toBe(false);
    expect(scopeExplorerGroups(groups, stale)).toEqual([]);
    expect(scopeExplorerCount(index, stale)).toBe(0);
    expect(folderScopeIsAvailable(index, folder('empty'))).toBe(true);
    expect(scopeExplorerGroups(groups, folder('empty'))).toHaveLength(1);
  });

  it('combines folder scope with the ordinary filename and modified filters', () => {
    const { groups } = fixture();
    const scoped = scopeExplorerGroups(groups, folder('basic_tuple'));
    expect(filterExplorerGroups(scoped, 'main', 'all').flatMap(group => group.sources)
      .map(source => source.name)).toEqual(['basic_tuple/main.srp']);
    expect(filterExplorerGroups(scoped, '', 'modified').flatMap(group => group.sources)
      .map(source => source.name)).toEqual(['basic_tuple/src/deep/math.srp']);
    expect(filterExplorerGroups(scoped, 'loops', 'all')).toEqual([]);
  });

  it('reveals the active source by removing only its collapsed ancestors', () => {
    const { index } = fixture();
    const active = index.activeSource!;
    expect(active.name).toBe('basic_tuple/src/deep/math.srp');
    const original = new Set(['', 'basic_tuple', 'basic_tuple/src', 'basic_tuple/src/deep', 'loops']);
    const revealed = revealExplorerSource(original, active);
    expect([...revealed]).toEqual(['loops']);
    expect(original.size).toBe(5);
    expect(isHiddenByCollapsedExplorerAncestor(active.directory, revealed)).toBe(false);
    expect(isHiddenByCollapsedExplorerAncestor('loops/tests', revealed)).toBe(true);
  });

  it('does not choose an arbitrary active source if multiple matches are supplied', () => {
    const { groups } = fixture();
    const duplicate = groups.map(group => ({
      ...group, sources: group.sources.map(source => ({ ...source, active: true })),
    }));
    const index = buildExplorerFolderIndex(duplicate, roots);
    expect(index.activeSource).toBeNull();
    expect(index.activeAmbiguous).toBe(true);
    expect(index.workspace.active).toBe(true);
  });

  it('handles an empty workspace and no active listed source', () => {
    const index = buildExplorerFolderIndex([], []);
    expect(index.workspace).toMatchObject({ total: 0, open: 0, modified: 0, projects: 0, active: false });
    expect(index.activeSource).toBeNull();
    expect(index.activeAmbiguous).toBe(false);
    expect(folderScopeIsAvailable(index, WHOLE_WORKSPACE)).toBe(true);
  });
});
