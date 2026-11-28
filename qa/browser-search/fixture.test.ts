import { describe, expect, it } from 'vitest';
import { searchListedProjectSources } from '../../src/model/projectSearch';
import { buildProjectScopeInventory, DEFAULT_PROJECT_SEARCH_SCOPE,
  planScopedProjectSearch, summarizeScopedSearch } from '../../src/model/projectSearchScope';
import {
  ROOT, QUERY, DENSE_LABEL, BUFFER_LABEL, FAILED_LABEL, FIRST_LABEL,
  createFixture, listedSources, editBuffer, recoverFile, addListedFile,
  removeDenseFile, createFixtureReader,
} from './fixture';

describe('browser search fixture isolation', () => {
  it('exposes only names and paths through the listing', () => {
    const fixture = createFixture();
    expect(listedSources(fixture)).toHaveLength(7);
    expect(Object.keys(listedSources(fixture)[0]).sort()).toEqual(['name', 'path']);
    expect(fixture.documents[0].content).not.toEqual(fixture.documents[0].savedContent);
  });

  it('rejects paths outside the exact synthetic inventory', async () => {
    const reader = createFixtureReader(createFixture());
    const outside = ROOT + '/../outside.srp';
    await expect(reader.read(outside, 1024)).rejects.toThrow('Synthetic reader refusal');
    await expect(reader.read(ROOT + '/' + FAILED_LABEL, 1024)).rejects.toThrow('Synthetic reader refusal');
    expect(reader.paths()).toEqual([outside, ROOT + '/' + FAILED_LABEL]);
  });

  it('returns copies of read logs and enforces the byte budget', async () => {
    const reader = createFixtureReader(createFixture());
    const path = ROOT + '/' + DENSE_LABEL;
    await expect(reader.read(path, 1)).rejects.toThrow('Synthetic byte limit');
    await expect(reader.read(path, Number.NaN)).rejects.toThrow('Synthetic byte limit');
    const before = reader.paths();
    const content = await reader.read(path, 64 * 1024);
    expect(content.split('\n')).toHaveLength(27);
    expect(before).toHaveLength(2);
    expect(reader.paths()).toHaveLength(3);
  });

  it('mutations leave earlier fixture snapshots unchanged', () => {
    const original = createFixture();
    const changed = editBuffer(original);
    expect(changed.documents[0].revision).toBe(original.documents[0].revision + 1);
    expect(changed.documents[0].savedContent).toBe(original.documents[0].savedContent);
    expect(changed.documents[0].content).not.toBe(original.documents[0].content);
    expect(original.unavailable).toEqual([FAILED_LABEL]);
    expect(recoverFile(original).unavailable).toEqual([]);
    const added = addListedFile(original);
    expect(added.files).toHaveLength(8);
    expect(addListedFile(added)).toBe(added);
    expect(removeDenseFile(original).files).toHaveLength(6);
    expect(original.files).toHaveLength(7);
  });

  it('first batch records exact read paths and partial coverage', async () => {
    const workspace = createFixture();
    const plan = planScopedProjectSearch(buildProjectScopeInventory(listedSources(workspace)),
      { ...DEFAULT_PROJECT_SEARCH_SCOPE, batch: 1 });
    expect(plan.ok).toBe(true);
    if (!plan.ok) throw Error(plan.error);
    const reader = createFixtureReader(workspace);
    const result = await searchListedProjectSources(plan.value.sources, workspace.documents,
      QUERY, { caseSensitive: true, wholeWord: true }, reader.read);
    expect(result).not.toBeNull();
    if (!result) throw Error('Missing search result');
    expect([...reader.paths()].sort()).toEqual([DENSE_LABEL, FAILED_LABEL, FIRST_LABEL]
      .map(name => ROOT + '/' + name).sort());
    expect(result.hits.filter(hit => hit.name === BUFFER_LABEL)).toHaveLength(2);
    const summary = summarizeScopedSearch(plan.value, result);
    expect(summary).toMatchObject({ ok: true, value: { searched: 3, skipped: 1, hits: 29, incomplete: true } });
  });

  it('cancels in-flight reads without yielding a result', async () => {
    const workspace = createFixture();
    let release!: () => void;
    const paused = new Promise<void>(resolve => { release = resolve; });
    const reader = createFixtureReader(workspace, () => paused);
    let current = true;
    const search = searchListedProjectSources(listedSources(workspace), workspace.documents,
      QUERY, { caseSensitive: true, wholeWord: true }, reader.read, () => current);
    expect(reader.paths()).toHaveLength(1);
    current = false;
    release();
    await expect(search).resolves.toBeNull();
    expect(reader.paths()).toHaveLength(1);
  });
});
