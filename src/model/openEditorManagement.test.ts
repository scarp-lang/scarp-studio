import { describe, expect, it } from 'vitest';
import {
  buildTabInventory, canBulkClose, currentTabSelection, filterTabInventory,
  matchesTabSelection, resolveBulkClose, selectVisibleTabs, tabSelection, MAX_MANAGED_TABS,
} from './openEditorManagement';
import { editorReducer, initialEditorState } from './editorState';
import type { StudioDocument } from './documents';

function source(id: string, changes: Partial<StudioDocument> = {}): StudioDocument {
  return {
    id, name: id + '.srp', path: '/workspace/' + id + '.srp',
    content: 'source', savedContent: 'source', revision: 1, ...changes,
  };
}
const clean = source('one');
const dirty = source('two', { content: 'edited' });
const untitled = source('three', { path: null, content: '', savedContent: '' });

describe('open editor inventory', () => {
  it('counts saved, modified and untitled buffers without accessing disk', () => {
    const report = buildTabInventory([clean, dirty, untitled], dirty.id);
    expect(report.total).toBe(3);
    expect(report.modified).toBe(1);
    expect(report.untitled).toBe(1);
    expect(report.closeEligible).toBe(1);
    expect(report.entries.map(entry => entry.active)).toEqual([false, true, false]);
    expect(report.entries.map(entry => entry.closeEligible)).toEqual([true, false, false]);
  });

  it('retains distinct display labels for duplicate basenames', () => {
    const docs = [
      source('a', { name: 'main.srp', path: '/practice/a/main.srp' }),
      source('b', { name: 'main.srp', path: '/practice/b/main.srp' }),
    ];
    const report = buildTabInventory(docs, null);
    expect(report.entries.map(entry => entry.label)).toEqual(['a/main.srp', 'b/main.srp']);
  });

  it('bounds managed tabs and reports the full total', () => {
    const docs = Array.from({ length: MAX_MANAGED_TABS + 4 }, (_, i) => source(String(i)));
    const report = buildTabInventory(docs, null);
    expect(report.limited).toBe(true);
    expect(report.entries).toHaveLength(MAX_MANAGED_TABS);
    expect(report.total).toBe(MAX_MANAGED_TABS + 4);
  });

  it('filters by metadata and state, not source text', () => {
    const entries = buildTabInventory([clean, dirty, untitled], null).entries;
    expect(filterTabInventory(entries, 'WORKSPACE ONE', 'all', 'tab-order').map(e => e.document.id)).toEqual(['one']);
    expect(filterTabInventory(entries, 'edited', 'all', 'tab-order')).toEqual([]);
    expect(filterTabInventory(entries, '', 'saved', 'tab-order').map(e => e.document.id)).toEqual(['one']);
    expect(filterTabInventory(entries, '', 'modified', 'tab-order').map(e => e.document.id)).toEqual(['two']);
    expect(filterTabInventory(entries, '', 'untitled', 'tab-order').map(e => e.document.id)).toEqual(['three']);
    expect(filterTabInventory(entries, '', 'all', 'modified')[0].document.id).toBe('two');
  });

  it('sorts natural numeric filenames without mutating the inventory', () => {
    const entries = buildTabInventory([source('file10'), source('file2')], null).entries;
    expect(filterTabInventory(entries, '', 'all', 'name').map(e => e.document.id)).toEqual(['file2', 'file10']);
    expect(entries.map(e => e.document.id)).toEqual(['file10', 'file2']);
  });
});

describe('explicit saved-tab selection', () => {
  it('protects dirty and untitled documents even when empty', () => {
    expect(canBulkClose(clean)).toBe(true);
    expect(canBulkClose(dirty)).toBe(false);
    expect(canBulkClose(untitled)).toBe(false);
    expect(tabSelection(dirty)).toBeNull();
    expect(tabSelection(untitled)).toBeNull();
    expect(selectVisibleTabs(buildTabInventory([clean, dirty, untitled], null).entries))
      .toEqual([tabSelection(clean)]);
  });

  it('invalidates a revision or path change even if content is clean', () => {
    const selected = tabSelection(clean)!;
    expect(matchesTabSelection(selected, clean)).toBe(true);
    expect(matchesTabSelection(selected, { ...clean, revision: 2 })).toBe(false);
    expect(matchesTabSelection(selected, { ...clean, path: '/workspace/new.srp' })).toBe(false);
    expect(matchesTabSelection(selected, { ...clean, content: 'dirty' })).toBe(false);
    expect(currentTabSelection([selected], [])).toEqual([]);
  });

  it('rejects an entire batch when one selected tab becomes unavailable', () => {
    const other = source('other');
    const choices = [tabSelection(clean)!, tabSelection(other)!];
    expect(resolveBulkClose(choices, [clean, other])).toEqual([clean, other]);
    expect(resolveBulkClose(choices, [clean])).toBeNull();
    expect(resolveBulkClose(choices, [clean, { ...other, revision: 2 }])).toBeNull();
    expect(resolveBulkClose(choices, [clean, { ...other, content: 'dirty' }])).toBeNull();
  });

  it('rejects duplicate, empty and oversized selections', () => {
    const selection = tabSelection(clean)!;
    expect(resolveBulkClose([], [clean])).toBeNull();
    expect(resolveBulkClose([selection, selection], [clean])).toBeNull();
    expect(resolveBulkClose(Array.from({ length: MAX_MANAGED_TABS + 1 }, () => selection), [clean])).toBeNull();
  });
});

describe('atomic editor reducer bulk close', () => {
  function openSources() {
    let state = initialEditorState;
    for (const name of ['a', 'b', 'c']) {
      state = editorReducer(state, { type: 'open', path: '/workspace/' + name + '.srp', content: name });
    }
    return state;
  }

  it('closes all requested clean tabs in a single generation and preserves survivors', () => {
    const state = openSources();
    const a = state.documents[1];
    const c = state.documents[3];
    const next = editorReducer(state, { type: 'close-clean-tabs', snapshots: [a, c] });
    expect(next.documents).toEqual([state.documents[0], state.documents[2]]);
    expect(next.documents[1]).toBe(state.documents[2]);
    expect(next.activeId).toBe(state.documents[2].id);
    expect(next.sessionRevision).toBe(state.sessionRevision + 1);
    expect(next.nextUntitled).toBe(state.nextUntitled);
  });

  it('keeps active focus when an unrelated tab is closed', () => {
    const state = openSources();
    const next = editorReducer(state, { type: 'close-clean-tabs', snapshots: [state.documents[1]] });
    expect(next.activeId).toBe(state.activeId);
  });

  it('focuses the next surviving tab in original order', () => {
    const state = openSources();
    const active = editorReducer(state, { type: 'activate', id: state.documents[1].id });
    const next = editorReducer(active, { type: 'close-clean-tabs', snapshots: [state.documents[1]] });
    expect(next.activeId).toBe(state.documents[2].id);
  });

  it('refuses dirty or untitled snapshots, preserving every tab', () => {
    const state = openSources();
    const modified = editorReducer(state, { type: 'edit', id: state.documents[1].id, content: 'new' });
    expect(editorReducer(modified, { type: 'close-clean-tabs', snapshots: [modified.documents[1], modified.documents[2]] })).toBe(modified);
    expect(editorReducer(state, { type: 'close-clean-tabs', snapshots: [state.documents[0], state.documents[1]] })).toBe(state);
  });

  it('refuses a stale snapshot after A→B→A edits', () => {
    const state = openSources();
    const original = state.documents[1];
    const edit = editorReducer(state, { type: 'edit', id: original.id, content: 'different' });
    const reverted = editorReducer(edit, { type: 'edit', id: original.id, content: original.content });
    expect(editorReducer(reverted, { type: 'close-clean-tabs', snapshots: [original, state.documents[2]] })).toBe(reverted);
  });

  it('refuses a stale snapshot after close and reopen at the same path', () => {
    const state = openSources();
    const original = state.documents[1];
    const closed = editorReducer(state, { type: 'close', id: original.id, snapshot: original });
    const reopened = editorReducer(closed, { type: 'open', path: original.path!, content: original.content });
    expect(editorReducer(reopened, { type: 'close-clean-tabs', snapshots: [original] })).toBe(reopened);
  });

  it('rejects duplicate or missing targets without advancing generation', () => {
    const state = openSources();
    expect(editorReducer(state, { type: 'close-clean-tabs', snapshots: [state.documents[1], state.documents[1]] })).toBe(state);
    expect(editorReducer(state, { type: 'close-clean-tabs', snapshots: [source('missing')] })).toBe(state);
    expect(editorReducer(state, { type: 'close-clean-tabs', snapshots: [] })).toBe(state);
  });
});

describe('pin-aware editor manager', () => {
  it('includes pinned clean sources in saved inventory but excludes them from close selection', () => {
    const other = source('other');
    const inventory = buildTabInventory([clean, other, dirty, untitled], clean.id, [clean.id, dirty.id]);
    expect(inventory.pinned).toBe(2);
    expect(inventory.closeEligible).toBe(1);
    expect(filterTabInventory(inventory.entries, '', 'pinned', 'tab-order').map(entry => entry.document.id))
      .toEqual([clean.id, dirty.id]);
    expect(filterTabInventory(inventory.entries, '', 'saved', 'tab-order').map(entry => entry.document.id))
      .toEqual([clean.id, other.id]);
    expect(selectVisibleTabs(inventory.entries)).toEqual([tabSelection(other)]);
  });

  it('invalidates an existing selection when a previously clean tab is pinned', () => {
    const selected = tabSelection(clean)!;
    expect(currentTabSelection([selected], [clean], [clean.id])).toEqual([]);
    expect(resolveBulkClose([selected], [clean], [clean.id])).toBeNull();
    expect(resolveBulkClose([selected], [clean], [])).toEqual([clean]);
  });
});
