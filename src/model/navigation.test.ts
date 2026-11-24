import { describe, expect, it } from 'vitest';
import {
  boundedNavigationQuery, clampLineLocation, filterNavigationEntries,
  clampPaletteIndex, stepPaletteIndex,
  MAX_NAVIGATION_QUERY_UNITS, parseLineLocation,
} from './navigation';

const entries = [
  { id: 'one', label: 'Main.srp', detail: 'C:/Project/Main.srp' },
  { id: 'two', label: 'math.srp', detail: 'C:/Project/math.srp' },
  { id: 'three', label: 'Other.srp', detail: 'D:/Other/Other.srp' },
  { id: 'four', label: 'New Scarp File', detail: 'Ctrl+N' },
];

describe('quick navigation matching', () => {
  it('returns entries without altering source order for a blank query', () => {
    expect(filterNavigationEntries(entries, '').map((entry) => entry.id))
      .toEqual(['one', 'two', 'three', 'four']);
    expect(entries[0].label).toBe('Main.srp');
  });

  it('matches case-insensitively across names and paths', () => {
    expect(filterNavigationEntries(entries, 'MATH').map((entry) => entry.id)).toEqual(['two']);
    expect(filterNavigationEntries(entries, 'project main').map((entry) => entry.id)).toEqual(['one']);
    expect(filterNavigationEntries(entries, 'ctrl+n').map((entry) => entry.id)).toEqual(['four']);
  });

  it('ranks name prefix above matches appearing only in the directory', () => {
    const ordered = filterNavigationEntries([
      { id: 'folder', label: 'utility.srp', detail: 'C:/main/utility.srp' },
      { id: 'name', label: 'main.srp', detail: 'D:/main.srp' },
    ], 'main');
    expect(ordered.map((entry) => entry.id)).toEqual(['name', 'folder']);
  });

  it('uses locale-independent casing for ASCII I in source names and paths', () => {
    const files = [
      { id: 'file', label: 'File.srp', detail: 'C:/Project/File.srp' },
      { id: 'library', label: 'I18N.srp', detail: 'C:/project/International' },
    ];
    expect(filterNavigationEntries(files, 'FILE').map((entry) => entry.id))
      .toEqual(['file']);
    expect(filterNavigationEntries(files, 'i18n').map((entry) => entry.id))
      .toEqual(['library']);
  });

  it('rejects over-budget pasted queries before normalizing any entries', () => {
    const expensive = {
      id: 'huge', label: 'source.srp', detail: 'X'.repeat(100_000),
    };
    expect(filterNavigationEntries([expensive], 'a'.repeat(MAX_NAVIGATION_QUERY_UNITS + 1)))
      .toEqual([]);
    expect(filterNavigationEntries([expensive], 'source')).toHaveLength(1);
    expect(filterNavigationEntries([expensive], 'source', 0)).toEqual([]);
  });

  it('clips long Quick Open queries without splitting an emoji pair', () => {
    expect(boundedNavigationQuery('hello')).toBe('hello');
    const long = 'a'.repeat(MAX_NAVIGATION_QUERY_UNITS - 1) + '😀' + 'tail';
    const bounded = boundedNavigationQuery(long);
    expect(bounded).toBe('a'.repeat(MAX_NAVIGATION_QUERY_UNITS - 1));
    expect(bounded).toHaveLength(MAX_NAVIGATION_QUERY_UNITS - 1);
    const complete = 'a'.repeat(MAX_NAVIGATION_QUERY_UNITS - 2) + '😀' + 'tail';
    expect(boundedNavigationQuery(complete))
      .toBe('a'.repeat(MAX_NAVIGATION_QUERY_UNITS - 2) + '😀');
    expect(boundedNavigationQuery('z'.repeat(MAX_NAVIGATION_QUERY_UNITS + 200)))
      .toHaveLength(MAX_NAVIGATION_QUERY_UNITS);
  });

  it('limits results and rejects invalid limits', () => {
    expect(filterNavigationEntries(entries, 'srp', 2)).toHaveLength(2);
    expect(filterNavigationEntries(entries, '', -2)).toEqual([]);
    expect(filterNavigationEntries(entries, '', Number.NaN)).toEqual([]);
  });
});

describe('go to line parser', () => {
  it('reads one-based line and optional column', () => {
    expect(parseLineLocation(' 34 ')).toEqual({ line: 34, column: 1 });
    expect(parseLineLocation('7:19')).toEqual({ line: 7, column: 19 });
  });

  it('rejects zero, negative, non-numeric, and oversized locations', () => {
    for (const invalid of ['0', '1:0', '-1', '1:-2', '1.2', '10:', 'a:3', '12:4:5', '9999999999']) {
      expect(parseLineLocation(invalid)).toBeNull();
    }
  });

  it('clamps positions to the actual Monaco model boundaries', () => {
    expect(clampLineLocation({ line: 999, column: 500 }, 10, () => 7))
      .toEqual({ line: 10, column: 7 });
    expect(clampLineLocation({ line: 2, column: 3 }, 5, (line) => line === 2 ? 4 : 8))
      .toEqual({ line: 2, column: 3 });
  });
});

describe('open-tab cycling', () => {
  it('wraps forward and backward across open tabs', async () => {
    const { cycleTabId } = await import('./navigation');
    const ids = ['first', 'second', 'third'];
    expect(cycleTabId(ids, 'third', 1)).toBe('first');
    expect(cycleTabId(ids, 'first', -1)).toBe('third');
    expect(cycleTabId(ids, 'first', 1)).toBe('second');
  });

  it('handles an empty editor and a missing active tab', async () => {
    const { cycleTabId } = await import('./navigation');
    expect(cycleTabId([], null, 1)).toBeNull();
    expect(cycleTabId(['first', 'second'], 'removed', 1)).toBe('first');
    expect(cycleTabId(['first', 'second'], null, -1)).toBe('second');
  });
});

describe('accessible tablist keyboard navigation', () => {
  it('wraps ArrowLeft / ArrowRight and supports Home / End', async () => {
    const { keyboardTabTarget } = await import('./navigation');
    const tabs = ['main', 'new', 'third'];
    expect(keyboardTabTarget(tabs, 'main', 'ArrowLeft')).toBe('third');
    expect(keyboardTabTarget(tabs, 'third', 'ArrowRight')).toBe('main');
    expect(keyboardTabTarget(tabs, 'new', 'Home')).toBe('main');
    expect(keyboardTabTarget(tabs, 'new', 'End')).toBe('third');
    expect(keyboardTabTarget(tabs, 'main', 'ArrowRight')).toBe('new');
  });

  it('never activates stale or missing tabs or interprets unrelated keys', async () => {
    const { keyboardTabTarget } = await import('./navigation');
    expect(keyboardTabTarget([], 'main', 'ArrowRight')).toBeNull();
    expect(keyboardTabTarget(['main'], 'closed', 'Home')).toBeNull();
    expect(keyboardTabTarget(['main'], 'main', 'Delete')).toBeNull();
    expect(keyboardTabTarget(['main'], 'main', 'ArrowLeft')).toBe('main');
    expect(keyboardTabTarget(['main'], 'main', 'End')).toBe('main');
  });
});

describe('navigation palette selection', () => {
  it('clamps stale selection when the result set shrinks', () => {
    expect(clampPaletteIndex(39, 2)).toBe(1);
    expect(clampPaletteIndex(-1, 2)).toBe(0);
    expect(clampPaletteIndex(NaN, 2)).toBe(0);
    expect(clampPaletteIndex(5, 0)).toBe(0);
  });
  it('wraps keyboard selection in either direction after clamping', () => {
    expect(stepPaletteIndex(0, 3, -1)).toBe(2);
    expect(stepPaletteIndex(2, 3, 1)).toBe(0);
    expect(stepPaletteIndex(39, 2, 1)).toBe(0);
    expect(stepPaletteIndex(0, 0, -1)).toBe(0);
    expect(stepPaletteIndex(0, 1, 1)).toBe(0);
  });
});
