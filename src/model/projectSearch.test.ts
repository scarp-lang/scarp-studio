import { describe, expect, it, vi } from 'vitest';
import {
  createUntitled, markSaved, openedDocument, updateContent, type StudioDocument,
} from './documents';
import {
  MAX_PROJECT_SEARCH_FILES, MAX_PROJECT_SEARCH_READ_BYTES,
  MAX_PROJECT_SEARCH_TOTAL_BYTES, editorChangeInvalidatesProjectSearch,
  searchListedProjectSources, selectProjectSearchSources,
} from './projectSearch';

const options = { caseSensitive: false, wholeWord: false };
const file = (name: string) => ({ name, path: 'C:/project/' + name });

function openFile(name: string, content: string): StudioDocument {
  return {
    ...createUntitled(1), id: 'open-' + name, name, path: 'C:/project/' + name,
    content, savedContent: 'saved version', revision: 5,
  };
}

describe('bounded read-only selected-project search', () => {
  it('keeps completed results through source navigation and unrelated edits', () => {
    const selected = openFile('src/main.srp', 'print("needle");');
    const unrelated = {
      ...openFile('unrelated.srp', 'other'),
      id: 'other-tab', path: 'C:/other/unrelated.srp',
    };
    const before = [selected, unrelated];
    const otherChanged = updateContent(before, unrelated.id, 'updated elsewhere');
    const anotherTab = [...before, createUntitled(5)];
    const openedListedSource = openedDocument(
      before, 'C:/project/tests/example.srp', 'needle',
    ).documents;
    for (const next of [before, [...before].reverse(), otherChanged,
      anotherTab, openedListedSource]) {
      expect(editorChangeInvalidatesProjectSearch(
        before, next, 'C:/project',
      )).toBe(false);
    }
    // Changes to search terms and Explorer membership are handled by the
    // caller's separate invalidation gates, not this editor-only guard.
    expect(editorChangeInvalidatesProjectSearch(before, otherChanged, null)).toBe(false);
  });

  it('invalidates completed search hits after in-project edits, saves, closes and Save As', () => {
    const selected = openFile('src/main.srp', 'needle');
    const before = [selected];
    const changed = updateContent(before, selected.id, 'new needle');
    const reverted = updateContent(changed, selected.id, selected.content);
    const saved = markSaved(before, selected.id, selected.path!, selected.content);
    const relocated = markSaved(before, selected.id, 'C:/outside/moved.srp', selected.content);
    for (const next of [changed, reverted, saved, relocated, []]) {
      expect(editorChangeInvalidatesProjectSearch(
        before, next, 'C:/project',
      )).toBe(true);
    }
    expect(editorChangeInvalidatesProjectSearch(
      before, changed, 'C:/other',
    )).toBe(false);
  });

  it('does not fetch paths for empty or invalid queries', async () => {
    const reader = vi.fn(async () => 'hello');
    const files = [file('src/main.srp')];
    expect((await searchListedProjectSources(files, [], '', options, reader))?.hits).toEqual([]);
    const invalid = await searchListedProjectSources(files, [], 'a\nb', options, reader);
    expect(invalid?.error).toMatch(/one line/);
    expect(reader).not.toHaveBeenCalled();
  });

  it('round-robins root, src, tests, examples and prioritizes main sources', () => {
    const files = [
      ...Array.from({ length: 80 }, (_, i) => file('a-' + i + '.srp')),
      file('src/other.srp'), file('tests/check.srp'),
      file('examples/demo.srp'), file('main.srp'), file('src/main.srp'),
    ];
    const selected = selectProjectSearchSources(files);
    expect(selected).toHaveLength(MAX_PROJECT_SEARCH_FILES);
    expect(selected.slice(0, 4).map((item) => item.name))
      .toEqual(['main.srp', 'src/main.srp', 'tests/check.srp', 'examples/demo.srp']);
  });

  it('rejects fabricated directory names, duplicate Windows paths, and non-Scarp entries', () => {
    const selected = selectProjectSearchSources([
      file('../unsafe.srp'), file('random/deep.srp'), file('notes.txt'),
      file('src/okay.srp'), { name: 'src/different.srp', path: 'c:\\project\\src\\OKAY.srp' },
      file('normal.srp'),
    ]);
    expect(selected.map((entry) => entry.name)).toEqual(['normal.srp', 'src/okay.srp']);
  });

  it('prioritizes dirty listed buffers outside the ordinary 24-file window', async () => {
    const listed = [
      ...Array.from({ length: 80 }, (_, i) => file('file-' + i + '.srp')),
      file('src/main.srp'), file('tests/check.srp'), file('examples/demo.srp'),
      file('z-dirty.srp'),
    ];
    const dirty = openFile('z-dirty.srp', 'unsaved needle');
    const read = vi.fn(async () => 'saved but unrelated text');
    const result = await searchListedProjectSources(
      listed, [dirty], 'needle', options, read,
    );
    expect(selectProjectSearchSources(listed).some((item) =>
      item.path === dirty.path)).toBe(false);
    expect(result?.hits.map((hit) => [hit.name, hit.fromOpenTab]))
      .toContainEqual(['z-dirty.srp', true]);
    expect(result?.searchedFiles).toBe(MAX_PROJECT_SEARCH_FILES);
    expect(result?.truncated).toBe(true);
    expect(read).not.toHaveBeenCalledWith(dirty.path, MAX_PROJECT_SEARCH_READ_BYTES);
  });

  it('keeps the cross-folder budget fair when several dirty sources are preferred', () => {
    const listed = [
      ...Array.from({ length: 60 }, (_, i) => file('root-' + i + '.srp')),
      file('main.srp'), file('src/main.srp'), file('tests/main.srp'),
      file('examples/main.srp'), file('root-dirty.srp'),
      file('src/dirty.srp'), file('tests/dirty.srp'), file('examples/dirty.srp'),
    ];
    const dirtyNames = ['root-dirty.srp', 'src/dirty.srp',
      'tests/dirty.srp', 'examples/dirty.srp'];
    const priority = dirtyNames.map((name) => file(name).path);
    expect(selectProjectSearchSources(listed, priority)
      .slice(0, 4).map((source) => source.name)).toEqual(dirtyNames);
    // Main entrypoints remain preferred over ordinary clean files afterwards.
    expect(selectProjectSearchSources(listed, priority)
      .slice(4, 8).map((source) => source.name))
      .toEqual(['main.srp', 'src/main.srp', 'tests/main.srp', 'examples/main.srp']);
    expect(selectProjectSearchSources(listed, priority))
      .toHaveLength(MAX_PROJECT_SEARCH_FILES);
  });

  it('never adds unlisted preferred paths or lets clean open tabs displace main.srp', async () => {
    const listed = [
      file('a.srp'), file('main.srp'), file('src/main.srp'),
      file('tests/check.srp'), file('examples/demo.srp'),
    ];
    const outside = openFile('not-listed.srp', 'needle');
    const injected = selectProjectSearchSources(listed, [outside.path!]);
    expect(injected.map((item) => item.name)).not.toContain(outside.name);
    expect(injected[0].name).toBe('main.srp');
    const clean = { ...openFile('a.srp', 'needle'), savedContent: 'needle' };
    const read = vi.fn(async () => 'other');
    const result = await searchListedProjectSources(
      listed, [outside, clean], 'needle', options, read,
    );
    expect(result?.hits.map((hit) => hit.name)).toEqual(['a.srp']);
    expect(read).not.toHaveBeenCalledWith(outside.path, MAX_PROJECT_SEARCH_READ_BYTES);
  });

  it('uses unsaved live tab contents and its identity rather than disk', async () => {
    const doc = openFile('src/main.srp', 'print("unsaved needle");');
    const read = vi.fn(async () => 'print("stale disk");');
    const result = await searchListedProjectSources([file('src/main.srp')], [doc],
      'needle', options, read);
    expect(result?.hits).toHaveLength(1);
    expect(result?.hits[0].fromOpenTab).toBe(true);
    expect(result?.hits[0].match.documentId).toBe(doc.id);
    expect(result?.hits[0].match.sourceRevision).toBe(5);
    expect(read).not.toHaveBeenCalled();
  });

  it('searches only listed files via a bounded scoped reader and returns exact navigation coordinates', async () => {
    const read = vi.fn(async () => 'hello\r\n🙂 needle');
    const result = await searchListedProjectSources([file('src/main.srp')], [],
      'needle', options, read);
    expect(read).toHaveBeenCalledExactlyOnceWith('C:/project/src/main.srp', MAX_PROJECT_SEARCH_READ_BYTES);
    expect(result?.hits.map(({ name, match }) => [name, match.line, match.column]))
      .toEqual([['src/main.srp', 2, 4]]);
    expect(result?.truncated).toBe(false);
  });

  it('reports inaccessible or oversized files and continues searching others', async () => {
    const read = vi.fn(async (path: string) => {
      if (path.endsWith('missing.srp')) throw new Error('scope denied');
      if (path.endsWith('large.srp')) return 'x'.repeat(MAX_PROJECT_SEARCH_READ_BYTES + 1);
      return 'needle';
    });
    const result = await searchListedProjectSources([
      file('missing.srp'), file('large.srp'), file('src/available.srp'),
    ], [], 'needle', options, read);
    expect(result?.hits.map((hit) => hit.name)).toEqual(['src/available.srp']);
    expect(result?.skippedFiles).toBe(2);
    expect(result?.truncated).toBe(true);
  });

  it('uses the exact UTF-8 byte cap for open Hindi/emoji buffers without allocating encoded copies', async () => {
    // 262K Hindi scalars are fewer than 512K UTF-16 units but exceed 512K UTF-8 bytes.
    const doc = openFile('src/main.srp',
      'न'.repeat(Math.floor(MAX_PROJECT_SEARCH_READ_BYTES / 2)) + 'needle');
    const read = vi.fn(async () => 'disk needle');
    const result = await searchListedProjectSources([file('src/main.srp')], [doc],
      'needle', options, read);
    expect(result?.hits).toEqual([]);
    expect(result?.searchedFiles).toBe(0);
    expect(result?.skippedFiles).toBe(1);
    expect(result?.truncated).toBe(true);
    expect(read).not.toHaveBeenCalled();
  });

  it('caps the number of files and treats unsearched files as incomplete', async () => {
    const files = Array.from({ length: MAX_PROJECT_SEARCH_FILES + 8 }, (_, index) =>
      file('src/file-' + index + '.srp'));
    const result = await searchListedProjectSources(files, [], 'a', options,
      async () => 'a');
    expect(result?.searchedFiles).toBe(MAX_PROJECT_SEARCH_FILES);
    expect(result?.skippedFiles).toBe(8);
    expect(result?.truncated).toBe(true);
  });

  it('halts on aggregate content budget and does not fetch the remaining paths', async () => {
    const files = Array.from({ length: 8 }, (_, i) => file('file-' + i + '.srp'));
    const read = vi.fn(async () => 'a'.repeat(MAX_PROJECT_SEARCH_READ_BYTES));
    const result = await searchListedProjectSources(files, [], 'needle', options, read);
    expect(result?.searchedFiles).toBe(MAX_PROJECT_SEARCH_TOTAL_BYTES / MAX_PROJECT_SEARCH_READ_BYTES);
    expect(result?.truncated).toBe(true);
    expect(result?.skippedFiles).toBe(4);
    expect(read).toHaveBeenCalledTimes(4);
  });

  it('shrinks native read limits to the remaining aggregate budget', async () => {
    const files = Array.from({ length: 5 }, (_, i) => file('part-' + i + '.srp'));
    const read = vi.fn(async () => 'a'.repeat(400_000));
    const result = await searchListedProjectSources(files, [], 'needle', options, read);
    expect(result?.searchedFiles).toBe(5);
    expect(result?.truncated).toBe(false);
    expect(read).toHaveBeenCalledTimes(5);
    for (let i = 0; i < 4; i++) {
      expect(read).toHaveBeenNthCalledWith(i + 1, files[i].path, MAX_PROJECT_SEARCH_READ_BYTES);
    }
    expect(read).toHaveBeenNthCalledWith(
      5, files[4].path, MAX_PROJECT_SEARCH_TOTAL_BYTES - 4 * 400_000,
    );
  });

  it('skips unfit sources while still searching smaller listed sources', async () => {
    const files = Array.from({ length: 6 }, (_, i) => file('part-' + i + '.srp'));
    const read = vi.fn(async (path: string) => {
      const index = Number(path.slice(path.lastIndexOf('part-') + 5).split('.')[0]);
      if (index < 3) return 'a'.repeat(MAX_PROJECT_SEARCH_READ_BYTES);
      if (index === 3) return 'a'.repeat(400_000);
      if (index === 4) return 'a'.repeat(200_000); // Adapter exceeds readLimit
      return 'needle';
    });
    const result = await searchListedProjectSources(files, [], 'needle', options, read);
    expect(result?.hits.map((hit) => hit.name)).toEqual(['part-5.srp']);
    expect(result?.searchedFiles).toBe(5);
    expect(result?.skippedFiles).toBe(1);
    expect(result?.truncated).toBe(true);
    const leftover = MAX_PROJECT_SEARCH_TOTAL_BYTES -
      3 * MAX_PROJECT_SEARCH_READ_BYTES - 400_000;
    expect(read).toHaveBeenNthCalledWith(5, files[4].path, leftover);
    expect(read).toHaveBeenNthCalledWith(6, files[5].path, leftover);
  });

  it('enforces the aggregate UTF-8 byte budget for multibyte project sources', async () => {
    // 160K Hindi characters are under 512 KiB in a single source but need
    // 480K UTF-8 bytes. The fifth source would exceed the 2 MiB total.
    const files = Array.from({ length: 5 }, (_, i) => file('source-' + i + '.srp'));
    const reader = vi.fn(async () => 'ह'.repeat(160_000));
    const result = await searchListedProjectSources(files, [], 'needle', options, reader);
    expect(result?.searchedFiles).toBe(4);
    expect(result?.skippedFiles).toBe(1);
    expect(result?.truncated).toBe(true);
    expect(reader).toHaveBeenCalledTimes(5);
  });

  it('stops a superseded search after a delayed native read', async () => {
    let release!: (value: string) => void;
    const blocked = new Promise<string>((resolve) => { release = resolve; });
    const read = vi.fn().mockReturnValueOnce(blocked);
    let active = true;
    const search = searchListedProjectSources([
      file('src/main.srp'), file('tests/next.srp'),
    ], [], 'needle', options, read, () => active);
    active = false;
    release('needle');
    expect(await search).toBeNull();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('preserves result-hit identity when a scanned buffer is later edited', async () => {
    const original = openFile('src/main.srp', 'needle');
    const result = await searchListedProjectSources(
      [file('src/main.srp')], [original], 'needle', options, async () => '');
    expect(result?.hits[0].match.sourceRevision).toBe(5);
    expect(updateContent([original], original.id, 'nEEdle')[0].revision).toBe(6);
    expect(result?.hits[0].match.sourceContent).toBe('needle');
  });
});
