import { describe, expect, it, vi } from 'vitest';
import { createUntitled, updateContent, type StudioDocument } from './documents';
import {
  MAX_PROJECT_SEARCH_FILES, MAX_PROJECT_SEARCH_READ_BYTES,
  MAX_PROJECT_SEARCH_TOTAL_UNITS, searchListedProjectSources,
  selectProjectSearchSources,
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
    expect(result?.searchedFiles).toBe(MAX_PROJECT_SEARCH_TOTAL_UNITS / MAX_PROJECT_SEARCH_READ_BYTES);
    expect(result?.truncated).toBe(true);
    expect(result?.skippedFiles).toBe(4);
    expect(read).toHaveBeenCalledTimes(5);
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
