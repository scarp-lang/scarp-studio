import { describe, expect, it } from 'vitest';
import type { StudioDocument } from './documents';
import { editorReducer, hasUnchangedEditorSession, initialEditorState, type EditorState } from './editorState';
import {
  MAX_PINNED_EDITOR_TABS, organizeEditorTabs, tabMoveAvailability, validTabOrganization,
  type TabOrganizationOperation,
} from './tabOrganization';

function source(id: string, name = id + '.srp', path: string | null = '/workspace/' + name, modified = false): StudioDocument {
  return { id, name, path, content: modified ? 'edited' : 'saved', savedContent: 'saved', revision: 1 };
}

const docs = [
  source('a', 'file10.srp', '/workspace/b/file10.srp'),
  source('b', 'file2.srp', '/workspace/a/file2.srp', true),
  source('c', 'file1.srp', '/workspace/a/file1.srp'),
  source('u', 'Untitled-1.srp', null),
];

function plan(documents: readonly StudioDocument[], pins: readonly string[], operation: TabOrganizationOperation) {
  const result = organizeEditorTabs(documents, pins, operation);
  if (!result.ok) throw Error(result.error);
  return result.value;
}
const ids = (documents: readonly StudioDocument[]) => documents.map(document => document.id);

describe('tab organization model', () => {
  it('moves a newly pinned tab to the end of the pinned prefix without modifying any buffer', () => {
    const first = plan(docs, [], { kind: 'pin', id: 'c', pinned: true });
    expect(ids(first.documents)).toEqual(['c', 'a', 'b', 'u']);
    expect(first.pinnedIds).toEqual(['c']);
    const second = plan(first.documents, first.pinnedIds, { kind: 'pin', id: 'b', pinned: true });
    expect(ids(second.documents)).toEqual(['c', 'b', 'a', 'u']);
    expect(second.pinnedIds).toEqual(['c', 'b']);
    expect(second.documents[1]).toBe(docs[1]);
    expect(second.documents[1].content).toBe('edited');
    expect(ids(docs)).toEqual(['a', 'b', 'c', 'u']);
    expect(Object.isFrozen(second.pinnedIds)).toBe(true);
  });

  it('unpins a tab into the beginning of the unpinned group', () => {
    const ordered = [docs[2], docs[1], docs[0], docs[3]];
    const next = plan(ordered, ['c', 'b'], { kind: 'pin', id: 'c', pinned: false });
    expect(ids(next.documents)).toEqual(['b', 'c', 'a', 'u']);
    expect(next.pinnedIds).toEqual(['b']);
    expect(next.documents[1]).toBe(docs[2]);
  });

  it('can pin and unpin the tab already at the group boundary without changing order', () => {
    const pinned = plan(docs, [], { kind: 'pin', id: 'a', pinned: true });
    expect(ids(pinned.documents)).toEqual(ids(docs));
    expect(pinned.pinnedIds).toEqual(['a']);
    const unpinned = plan(pinned.documents, pinned.pinnedIds, { kind: 'pin', id: 'a', pinned: false });
    expect(unpinned.pinnedIds).toEqual([]);
    expect(ids(unpinned.documents)).toEqual(ids(docs));
  });

  it('refuses repeated, missing and malformed pin requests', () => {
    expect(organizeEditorTabs(docs, ['a'], { kind: 'pin', id: 'a', pinned: true }).ok).toBe(false);
    expect(organizeEditorTabs(docs, [], { kind: 'pin', id: 'a', pinned: false }).ok).toBe(false);
    expect(organizeEditorTabs(docs, [], { kind: 'pin', id: 'missing', pinned: true }).ok).toBe(false);
    expect(organizeEditorTabs(docs, [], { kind: 'pin', id: 'a', pinned: 'yes' } as unknown as TabOrganizationOperation).ok).toBe(false);
  });

  it('moves tabs only inside their current pinned or unpinned partition', () => {
    const ordered = [docs[2], docs[1], docs[0], docs[3]];
    const movedPin = plan(ordered, ['c', 'b'], { kind: 'move', id: 'b', direction: -1 });
    expect(ids(movedPin.documents)).toEqual(['b', 'c', 'a', 'u']);
    expect(movedPin.pinnedIds).toEqual(['b', 'c']);
    const movedNormal = plan(ordered, ['c', 'b'], { kind: 'move', id: 'u', direction: -1 });
    expect(ids(movedNormal.documents)).toEqual(['c', 'b', 'u', 'a']);
    expect(movedNormal.pinnedIds).toEqual(['c', 'b']);
    expect(organizeEditorTabs(ordered, ['c', 'b'], { kind: 'move', id: 'b', direction: 1 }).ok).toBe(false);
    expect(organizeEditorTabs(ordered, ['c', 'b'], { kind: 'move', id: 'a', direction: -1 }).ok).toBe(false);
  });

  it('reports move availability for group edges, missing tabs and empty sessions', () => {
    expect(tabMoveAvailability(docs, ['a', 'b'], 'a')).toEqual({ left: false, right: true });
    expect(tabMoveAvailability(docs, ['a', 'b'], 'b')).toEqual({ left: true, right: false });
    expect(tabMoveAvailability(docs, ['a', 'b'], 'c')).toEqual({ left: false, right: true });
    expect(tabMoveAvailability(docs, ['a', 'b'], 'u')).toEqual({ left: true, right: false });
    expect(tabMoveAvailability(docs, [], 'missing')).toEqual({ left: false, right: false });
    expect(tabMoveAvailability([], [], null)).toEqual({ left: false, right: false });
  });

  it('sorts unpinned filenames naturally while preserving the exact pinned order', () => {
    const pinned = [docs[3], docs[0], docs[1], docs[2]];
    const next = plan(pinned, ['u'], { kind: 'sort', order: 'name' });
    expect(ids(next.documents)).toEqual(['u', 'c', 'b', 'a']);
    expect(next.pinnedIds).toEqual(['u']);
    expect(next.documents[0]).toBe(pinned[0]);
    expect(next.documents[2]).toBe(docs[1]);
  });

  it('sorts by parent folder with untitled buffers after named sources', () => {
    const next = plan(docs, [], { kind: 'sort', order: 'folder' });
    expect(ids(next.documents)).toEqual(['c', 'b', 'a', 'u']);
    const reordered = [docs[3], docs[2], docs[1], docs[0]];
    const again = plan(reordered, [], { kind: 'sort', order: 'folder' });
    expect(ids(again.documents)).toEqual(['c', 'b', 'a', 'u']);
  });

  it('sorts modified buffers before clean buffers within the unpinned group', () => {
    const next = plan([docs[0], docs[2], docs[3], docs[1]], ['a'], { kind: 'sort', order: 'modified' });
    expect(ids(next.documents)).toEqual(['a', 'b', 'c', 'u']);
  });

  it('rejects no-op sort, invalid orders and unsupported operations', () => {
    const sorted = [docs[2], docs[1], docs[0]];
    expect(organizeEditorTabs(sorted, [], { kind: 'sort', order: 'name' }).ok).toBe(false);
    expect(organizeEditorTabs(docs, [], { kind: 'sort', order: 'invalid' } as unknown as TabOrganizationOperation).ok).toBe(false);
    expect(organizeEditorTabs(docs, [], { kind: 'move', id: 'a', direction: 2 } as unknown as TabOrganizationOperation).ok).toBe(false);
    expect(organizeEditorTabs(docs, [], { kind: 'invalid' } as unknown as TabOrganizationOperation).ok).toBe(false);
  });

  it('refuses inconsistent prefixes, duplicate document IDs and missing pinned IDs', () => {
    expect(validTabOrganization(docs, ['b'])).toBe(false);
    expect(validTabOrganization(docs, ['a', 'a'])).toBe(false);
    expect(validTabOrganization(docs, ['missing'])).toBe(false);
    expect(validTabOrganization([docs[0], docs[0]], [])).toBe(false);
    expect(organizeEditorTabs(docs, ['b'], { kind: 'sort', order: 'name' }).ok).toBe(false);
  });

  it('enforces the pinned group cap and allows unpinning at the limit', () => {
    const many = Array.from({ length: MAX_PINNED_EDITOR_TABS + 1 }, (_, index) => source(String(index)));
    const pins = ids(many.slice(0, MAX_PINNED_EDITOR_TABS));
    expect(validTabOrganization(many, pins)).toBe(true);
    expect(organizeEditorTabs(many, pins, { kind: 'pin', id: many.at(-1)!.id, pinned: true }).ok).toBe(false);
    const next = plan(many, pins, { kind: 'pin', id: pins[0], pinned: false });
    expect(next.pinnedIds).toHaveLength(MAX_PINNED_EDITOR_TABS - 1);
    expect(validTabOrganization(next.documents, next.pinnedIds)).toBe(true);
  });
});

describe('atomic tab organization reducer', () => {
  function state(): EditorState {
    return { documents: [...docs], activeId: 'b', nextUntitled: 2, sessionRevision: 8 };
  }
  function organize(current: EditorState, operation: TabOrganizationOperation, revision = current.sessionRevision) {
    return editorReducer(current, { type: 'organize-tabs', operation, expectedSessionRevision: revision });
  }

  it('advances the session generation without altering active identity or document generations', () => {
    const before = state();
    const after = organize(before, { kind: 'pin', id: 'b', pinned: true });
    expect(after.sessionRevision).toBe(9);
    expect(after.activeId).toBe('b');
    expect(after.nextUntitled).toBe(2);
    expect(after.documents[0]).toBe(before.documents[1]);
    expect(after.documents[0].revision).toBe(1);
    expect(hasUnchangedEditorSession(before, after)).toBe(false);
  });

  it('rejects stale reviews after an edit or an activation ABA', () => {
    const before = state();
    const operation = { kind: 'sort', order: 'name' } as const;
    const edited = editorReducer(before, { type: 'edit', id: 'a', content: 'different' });
    expect(organize(edited, operation, before.sessionRevision)).toBe(edited);
    const away = editorReducer(before, { type: 'activate', id: 'a' });
    const back = editorReducer(away, { type: 'activate', id: 'b' });
    expect(organize(back, operation, before.sessionRevision)).toBe(back);
  });

  it('keeps new and reopened sources outside the pinned prefix', () => {
    const pinned = organize(state(), { kind: 'pin', id: 'b', pinned: true });
    const created = editorReducer(pinned, { type: 'new' });
    const opened = editorReducer(created, { type: 'open', path: '/workspace/new.srp', content: 'new' });
    expect(opened.documents[0].id).toBe('b');
    expect(opened.pinnedTabIds).toEqual(['b']);
    expect(validTabOrganization(opened.documents, opened.pinnedTabIds!)).toBe(true);
  });

  it('rejects direct close of a pinned clean or dirty source at the reducer boundary', () => {
    for (const id of ['a', 'b']) {
      const pinned = organize(state(), { kind: 'pin', id, pinned: true });
      const document = pinned.documents[0];
      expect(editorReducer(pinned, { type: 'close', id, snapshot: document })).toBe(pinned);
      const unpinned = organize(pinned, { kind: 'pin', id, pinned: false });
      const closed = editorReducer(unpinned, { type: 'close', id, snapshot: document });
      expect(closed.documents.some(item => item.id === id)).toBe(false);
    }
  });

  it('rejects an entire clean bulk close if a requested tab has become pinned', () => {
    const before = state();
    const pinned = organize(before, { kind: 'pin', id: 'a', pinned: true });
    expect(editorReducer(pinned, { type: 'close-clean-tabs', snapshots: [docs[0], docs[2]] })).toBe(pinned);
    const next = editorReducer(pinned, { type: 'close-clean-tabs', snapshots: [docs[2]] });
    expect(ids(next.documents)).toEqual(['a', 'b', 'u']);
    expect(next.pinnedTabIds).toEqual(['a']);
  });

  it('preserves pins during edits, saves, and opening additional tabs', () => {
    const pinned = organize(state(), { kind: 'pin', id: 'u', pinned: true });
    const edited = editorReducer(pinned, { type: 'edit', id: 'u', content: 'new' });
    const saved = editorReducer(edited, { type: 'saved', id: 'u', path: '/workspace/saved.srp', savedContent: 'new' });
    expect(saved.documents[0].id).toBe('u');
    expect(saved.documents[0].path).toBe('/workspace/saved.srp');
    expect(saved.pinnedTabIds).toEqual(['u']);
    expect(validTabOrganization(saved.documents, saved.pinnedTabIds!)).toBe(true);
  });

  it('leaves initial session pins empty and does not advance generation for no-ops', () => {
    expect(initialEditorState.pinnedTabIds ?? []).toEqual([]);
    expect(organize(initialEditorState, { kind: 'move', id: initialEditorState.activeId!, direction: 1 })).toBe(initialEditorState);
  });
});
