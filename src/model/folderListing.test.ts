import { describe, expect, it } from 'vitest';
import {
  collectTopLevelScarpNames, MAX_DISPLAYED_SCARP_FILES, MAX_INSPECTED_FOLDER_ENTRIES,
  safeTopLevelSourceName, type FolderEntryCandidate,
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

  it('rejects separator traversal names and embedded NUL', () => {
    for (const name of ['../escape.srp', '..\\escape.srp', 'nested/file.srp', 'a\0b.srp']) {
      expect(safeTopLevelSourceName(file(name))).toBe(false);
    }
    expect(safeTopLevelSourceName(file('plain.srp'))).toBe(true);
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

  it('returns no files and no truncation for an empty directory', () => {
    expect(collectTopLevelScarpNames([])).toEqual({ names: [], truncated: false });
  });
});
