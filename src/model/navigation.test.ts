import { describe, expect, it } from 'vitest';
import {
  clampLineLocation, filterNavigationEntries, parseLineLocation,
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
