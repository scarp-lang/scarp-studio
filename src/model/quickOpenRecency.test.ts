import { describe, expect, it } from 'vitest';
import {
  EMPTY_QUICK_OPEN_RECENCY, MAX_RECENT_QUICK_OPEN_TABS,
  quickOpenRecencyRanks, updateQuickOpenRecency,
} from './quickOpenRecency';

describe('session-local Quick Open recency', () => {
  it('moves newly activated live tabs to the front', () => {
    const a = updateQuickOpenRecency(EMPTY_QUICK_OPEN_RECENCY, ['a', 'b', 'c'], 'a');
    const b = updateQuickOpenRecency(a, ['a', 'b', 'c'], 'b');
    const c = updateQuickOpenRecency(b, ['a', 'b', 'c'], 'a');
    expect(a.ids).toEqual(['a']);
    expect(b.ids).toEqual(['b', 'a']);
    expect(c.ids).toEqual(['a', 'b']);
    expect(quickOpenRecencyRanks(c).get('a')).toBe(0);
    expect(quickOpenRecencyRanks(c).get('b')).toBe(1);
  });

  it('prunes closed tabs without admitting unactivated open tabs', () => {
    const before = { ids: ['a', 'b', 'c'] };
    expect(updateQuickOpenRecency(before, ['b', 'd'], null).ids).toEqual(['b']);
    expect(updateQuickOpenRecency(before, ['b', 'd'], 'd').ids).toEqual(['d', 'b']);
    expect(updateQuickOpenRecency(before, [], null).ids).toEqual([]);
  });

  it('rejects stale active IDs and removes duplicate history records', () => {
    const before = { ids: ['a', 'a', 'b', 'gone'] };
    expect(updateQuickOpenRecency(before, ['a', 'b'], 'stale').ids).toEqual(['a', 'b']);
    expect(updateQuickOpenRecency(before, ['a', 'a', 'b'], 'b').ids).toEqual(['b', 'a']);
  });

  it('preserves object identity when document edits do not change activation', () => {
    const first = updateQuickOpenRecency(EMPTY_QUICK_OPEN_RECENCY, ['a'], 'a');
    expect(updateQuickOpenRecency(first, ['a'], 'a')).toBe(first);
    expect(updateQuickOpenRecency(first, ['a', 'unvisited'], 'a')).toBe(first);
  });

  it('bounds recency to the newest 100 still-open activated tabs', () => {
    const ids = Array.from({ length: MAX_RECENT_QUICK_OPEN_TABS + 5 }, (_, index) => 'tab-' + index);
    let history = EMPTY_QUICK_OPEN_RECENCY;
    for (const id of ids) history = updateQuickOpenRecency(history, ids, id);
    expect(history.ids).toHaveLength(MAX_RECENT_QUICK_OPEN_TABS);
    expect(history.ids[0]).toBe(ids.at(-1));
    expect(history.ids.at(-1)).toBe(ids[5]);
    expect(history.ids).not.toContain(ids[4]);
    expect(Object.isFrozen(history)).toBe(true);
    expect(Object.isFrozen(history.ids)).toBe(true);
  });

  it('does not retain tab names, paths, or source contents', () => {
    const value = updateQuickOpenRecency(EMPTY_QUICK_OPEN_RECENCY, ['opaque-tab-id'], 'opaque-tab-id');
    expect(Object.keys(value)).toEqual(['ids']);
    expect(JSON.stringify(value)).toBe('{"ids":["opaque-tab-id"]}');
    expect(quickOpenRecencyRanks({ ids: ['a', 'a', 'b'] }).size).toBe(2);
  });
});
