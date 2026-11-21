import { describe, expect, it } from 'vitest';
import type { StudioDocument } from './documents';
import { MAX_DISPLAYED_SCARP_FILES } from './folderListing';
import { buildQuickOpenEntries } from './projectQuickOpen';

function tab(id: string, path: string | null, dirty = false): StudioDocument {
  return {
    id,
    name: path?.split(/[\\/]/).at(-1) || 'Untitled.srp',
    path,
    content: dirty ? 'edited' : 'saved',
    savedContent: 'saved',
    revision: 0,
  };
}

describe('Scarp project Quick Open', () => {
  it('lists open tabs first and unopened sources from the selected project', () => {
    const entries = buildQuickOpenEntries(
      [tab('a', 'C:/project/src/main.srp'), tab('scratch', null, true)],
      [
        { name: 'src/main.srp', path: 'C:/project/src/main.srp' },
        { name: 'tests/check.srp', path: 'C:/project/tests/check.srp' },
        { name: 'examples/demo.srp', path: 'C:/project/examples/demo.srp' },
      ],
    );
    expect(entries.map((entry) => entry.id)).toEqual([
      'tab:a', 'tab:scratch', 'project:1', 'project:2',
    ]);
    expect(entries[1].detail).toContain('modified');
    expect(entries[2]).toMatchObject({
      kind: 'project', label: 'tests/check.srp',
      sourcePath: 'C:/project/tests/check.srp',
    });
  });

  it('does not show Windows path aliases or duplicate project entries twice', () => {
    const entries = buildQuickOpenEntries(
      [tab('opened', 'C:/Project/SRC/Main.srp')],
      [
        { name: 'src/main.srp', path: 'c:\\project\\src\\main.SRP' },
        { name: 'tests/test.srp', path: 'C:/Project/tests/test.srp' },
        { name: 'tests/test.SRP', path: 'c:\\project\\tests\\TEST.SRP' },
      ],
    );
    expect(entries.map((entry) => entry.id)).toEqual(['tab:opened', 'project:1']);
  });

  it('ignores malformed names, unrelated folders and non-Scarp files', () => {
    const entries = buildQuickOpenEntries([], [
      { name: 'src/../escape.srp', path: 'C:/escape.srp' },
      { name: 'vendor/foreign.srp', path: 'C:/project/vendor/foreign.srp' },
      { name: 'tests/other.rs', path: 'C:/project/tests/other.rs' },
      { name: 'nested\\file.srp', path: 'C:/project/nested/file.srp' },
      { name: 'root.srp', path: 'C:/project/root.srp' },
    ]);
    expect(entries.map((entry) => entry.label)).toEqual(['root.srp']);
  });

  it('limits the project file entries and does not collide with tab ids', () => {
    const listed = Array.from({ length: MAX_DISPLAYED_SCARP_FILES + 2 },
      (_, index) => ({
        name: 'test' + index + '.srp',
        path: 'C:/project/test' + index + '.srp',
      }));
    const entries = buildQuickOpenEntries([tab('project:0', null)], listed);
    expect(entries).toHaveLength(MAX_DISPLAYED_SCARP_FILES + 1);
    expect(entries[0].id).toBe('tab:project:0');
    expect(entries[1].id).toBe('project:0');
    expect(entries.at(-1)?.id).toBe('project:' + (MAX_DISPLAYED_SCARP_FILES - 1));
  });

  it('does not read any files or open a compiler when building the palette', () => {
    expect(buildQuickOpenEntries([], [])).toEqual([]);
  });
});
