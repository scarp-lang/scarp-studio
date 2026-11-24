import { describe, expect, it } from 'vitest';
import {
  collectTopLevelScarpNames, selectBalancedScarpProjectNames,
  MAX_DISPLAYED_SCARP_FILES, MAX_INSPECTED_FOLDER_ENTRIES,
  safeTopLevelSourceName, safeRelativeScarpSourceName, type FolderEntryCandidate,
} from './folderListing';

function file(name: string, overrides: Partial<FolderEntryCandidate> = {}): FolderEntryCandidate {
  return { name, isFile: true, isSymlink: false, ...overrides };
}

describe('safe and bounded top-level Scarp folder listing', () => {
  it('includes only regular .srp files and sorts them', () => {
    const listing = collectTopLevelScarpNames([
      file('z.SRP'), file('ignore.rs'), file('a.srp'),
      file('links.srp', { isSymlink: true }),
      file('directory.srp', { isFile: false }),
    ]);
    expect(listing.names).toEqual(['a.srp', 'z.SRP']);
    expect(listing.truncated).toBe(false);
  });

  it('rejects separator traversal names and control characters consistently', () => {
    // A native readDir entry is a single basename; embedded separators
    // must be rejected even when the same text is a valid Explorer relative
    // path assembled from two individually validated directory entries.
    expect(safeTopLevelSourceName(file('nested/file.srp'))).toBe(false);
    expect(safeRelativeScarpSourceName('nested/file.srp')).toBe(true);
    for (const name of ['../escape.srp', '..\\escape.srp', 'a\0b.srp', 'bad\nname.srp', 'tab\tname.srp', 'ctrl\x1fname.srp']) {
      expect(safeTopLevelSourceName(file(name))).toBe(false);
      expect(safeRelativeScarpSourceName(name)).toBe(false);
    }
    expect(safeTopLevelSourceName(file('plain.srp'))).toBe(true);
  });

  it('never lists C0-control filenames read from a native directory', () => {
    const listing = collectTopLevelScarpNames([
      file('safe.srp'), file('hidden\\nproject.srp'.replace('\\n', '\n')),
      file('tab\\tname.srp'.replace('\\t', '\t')),
    ]);
    expect(listing.names).toEqual(['safe.srp']);
  });

  it('ignores symlink entries even if their names have a Scarp extension', () => {
    expect(safeTopLevelSourceName(file('external.srp', { isSymlink: true }))).toBe(false);
  });

  it('limits visible Scarp files without silently hiding the cap', () => {
    const entries = Array.from({ length: MAX_DISPLAYED_SCARP_FILES + 4 },
      (_, index) => file('item-' + String(index).padStart(4, '0') + '.srp'));
    const listing = collectTopLevelScarpNames(entries);
    expect(listing.names).toHaveLength(MAX_DISPLAYED_SCARP_FILES);
    expect(listing.truncated).toBe(true);
    expect(listing.names[0]).toBe('item-0000.srp');
  });

  it('retains main.srp inside an individually crowded folder', () => {
    const entries = [
      ...Array.from({ length: 250 }, (_, index) =>
        file('a-' + String(index).padStart(3, '0') + '.srp')),
      file('main.srp'),
    ];
    const listing = collectTopLevelScarpNames(entries);
    expect(listing.names).toHaveLength(MAX_DISPLAYED_SCARP_FILES);
    expect(listing.truncated).toBe(true);
    expect(listing.names).toContain('main.srp');
    expect(listing.names).toEqual([...listing.names].sort((a, b) => a.localeCompare(b)));
  });

  it('limits frontend processing when a folder contains many entries', () => {
    const entries = [
      ...Array.from({ length: MAX_INSPECTED_FOLDER_ENTRIES }, (_, index) =>
        file('folder-' + index + '.rs')),
      file('hidden.srp'),
    ];
    const listing = collectTopLevelScarpNames(entries);
    expect(listing.names).toEqual([]);
    expect(listing.truncated).toBe(true);
  });

  it('reserves only an exact safe main.srp beyond the generic 4096-entry budget', () => {
    const ordinary = Array.from({ length: MAX_INSPECTED_FOLDER_ENTRIES },
      (_, index) => file('note-' + index + '.rs'));
    const listing = collectTopLevelScarpNames([
      ...ordinary, file('ignored.srp'), file('main.srp'),
    ]);
    expect(listing.names).toEqual(['main.srp']);
    expect(listing.truncated).toBe(true);

    const unsafe = collectTopLevelScarpNames([
      ...ordinary, file('main.srp', { isSymlink: true }),
    ]);
    expect(unsafe.names).toEqual([]);
    expect(unsafe.truncated).toBe(true);
  });

  it('returns no files and no truncation for an empty directory', () => {
    expect(collectTopLevelScarpNames([])).toEqual({ names: [], truncated: false });
  });
});

describe('balanced bounded project Explorer selection', () => {
  it('keeps src, tests and examples visible when root consumes the full per-folder cap', () => {
    const rootNames = Array.from({ length: MAX_DISPLAYED_SCARP_FILES },
      (_, index) => 'root-' + String(index).padStart(3, '0') + '.srp');
    const selected = selectBalancedScarpProjectNames([
      { directory: '', names: rootNames },
      { directory: 'src', names: ['main.srp'] },
      { directory: 'tests', names: ['smoke.srp'] },
      { directory: 'examples', names: ['demo.srp'] },
    ]);
    expect(selected).toHaveLength(MAX_DISPLAYED_SCARP_FILES);
    expect(selected).toContain('src/main.srp');
    expect(selected).toContain('tests/smoke.srp');
    expect(selected).toContain('examples/demo.srp');
    expect(selected).toEqual([...selected].sort((a, b) => a.localeCompare(b)));
  });

  it('prioritizes main.srp in combined cap even if it appears last in its group', () => {
    const crowded = Array.from({ length: MAX_DISPLAYED_SCARP_FILES - 1 },
      (_, i) => 'a-' + String(i).padStart(3, '0') + '.srp');
    const selected = selectBalancedScarpProjectNames([
      { directory: '', names: [...crowded, 'main.srp'] },
      { directory: 'src', names: [...crowded, 'main.srp'] },
      { directory: 'tests', names: crowded },
      { directory: 'examples', names: crowded },
    ]);
    expect(selected).toHaveLength(MAX_DISPLAYED_SCARP_FILES);
    expect(selected).toContain('main.srp');
    expect(selected).toContain('src/main.srp');
  });

  it('shares the cap between four crowded groups without exceeding it', () => {
    const names = Array.from({ length: MAX_DISPLAYED_SCARP_FILES },
      (_, index) => 'file-' + String(index).padStart(3, '0') + '.srp');
    const selected = selectBalancedScarpProjectNames([
      { directory: '', names },
      { directory: 'src', names },
      { directory: 'tests', names },
      { directory: 'examples', names },
    ]);
    expect(selected).toHaveLength(MAX_DISPLAYED_SCARP_FILES);
    for (const prefix of ['', 'src/', 'tests/', 'examples/']) {
      expect(selected.filter((name) => name.startsWith(prefix) &&
        (prefix !== '' || !name.includes('/')))).toHaveLength(50);
    }
  });

  it('keeps the old complete alphabetical result for uncrowded projects', () => {
    expect(selectBalancedScarpProjectNames([
      { directory: '', names: ['z.srp', 'a.srp'] },
      { directory: 'src', names: ['main.srp'] },
      { directory: 'tests', names: [] },
    ])).toEqual(['a.srp', 'src/main.srp', 'z.srp']);
    expect(selectBalancedScarpProjectNames([])).toEqual([]);
  });
});
