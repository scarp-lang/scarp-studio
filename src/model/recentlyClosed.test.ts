import { describe, expect, it } from 'vitest';
import { createUntitled, type StudioDocument } from './documents';
import { editorReducer, initialEditorState } from './editorState';
import {
  emptyRecentlyClosed, reconcileRecentlyClosed, forgetRecentlyClosed, clearRecentlyClosed,
  resolveRecentlyClosed, MAX_RECENTLY_CLOSED, type RecentlyClosedState,
} from './recentlyClosed';

function doc(path: string, content = 'saved', savedContent = content): StudioDocument {
  return { id: path, path, name: path.split('/').at(-1)!, content, savedContent, revision: 0 };
}
function close(before: StudioDocument[], after: StudioDocument[] = [], state = emptyRecentlyClosed, active: string | null = null) {
  return reconcileRecentlyClosed(state, before, after, active);
}

describe('recently closed saved-source history', () => {
  it('retains only closed clean named Scarp files, not their source content', () => {
    const saved = doc('C:/work/main.srp', 'PRIVATE CONTENT');
    const state = close([saved, doc('C:/work/dirty.srp', 'modified', 'saved'),
      createUntitled(1), { ...createUntitled(2), recoveredDraft: 'old.srp' },
      doc('C:/work/readme.txt'), doc('relative.srp')]);
    expect(state.entries).toEqual([{ sequence: 1, path: saved.path, name: 'main.srp' }]);
    expect(JSON.stringify(state)).not.toContain('PRIVATE CONTENT');
    expect(state.nextSequence).toBe(2);
  });

  it('does not add paths for tabs that are still open', () => {
    const a = doc('C:/work/main.srp');
    expect(close([a], [a])).toBe(emptyRecentlyClosed);
  });

  it('keeps an open alias from entering the closed history', () => {
    const a = doc('C:/work/main.srp');
    const alias = doc('c:/WORK/MAIN.SRP');
    expect(close([a, alias], [alias])).toBe(emptyRecentlyClosed);
  });

  it('places a formerly active source first during a bulk close', () => {
    const a = doc('/a.srp');
    const b = doc('/b.srp');
    const c = doc('/c.srp');
    const state = close([a, b, c], [], emptyRecentlyClosed, b.id);
    expect(state.entries.map(entry => entry.path)).toEqual(['/b.srp', '/c.srp', '/a.srp']);
  });

  it('does not duplicate Windows aliases in history', () => {
    const first = close([doc('C:/work/main.srp')]);
    const second = close([doc('c:/WORK/MAIN.SRP')], [], first);
    expect(second.entries).toHaveLength(1);
    expect(second.entries[0].sequence).toBe(2);
    expect(second.entries[0].path).toBe('c:/WORK/MAIN.SRP');
    expect(second.nextSequence).toBe(3);
  });

  it('preserves distinct POSIX names with different case', () => {
    const state = close([doc('/work/Main.srp'), doc('/work/main.srp')]);
    expect(state.entries).toHaveLength(2);
  });

  it('caps the history at 20 most recently closed clean sources', () => {
    let state: RecentlyClosedState = emptyRecentlyClosed;
    for (let i = 0; i < MAX_RECENTLY_CLOSED + 5; i++) {
      state = close([doc('/work/' + i + '.srp')], [], state);
    }
    expect(state.entries).toHaveLength(MAX_RECENTLY_CLOSED);
    expect(state.entries[0].path).toBe('/work/24.srp');
    expect(state.entries.at(-1)?.path).toBe('/work/5.srp');
  });

  it('removes a history item after ordinary open or Save As reaches its path', () => {
    const state = close([doc('C:/work/main.srp'), doc('C:/work/other.srp')]);
    const reopened = reconcileRecentlyClosed(state, [], [doc('c:/WORK/MAIN.SRP')], null);
    expect(reopened.entries.map(entry => entry.path)).toEqual(['C:/work/other.srp']);
    expect(reopened.nextSequence).toBe(state.nextSequence);
  });

  it('does not add a history item on an edit, save or active tab change', () => {
    const a = doc('/a.srp');
    expect(close([a], [{ ...a, content: 'edited' }])).toBe(emptyRecentlyClosed);
    expect(close([a], [{ ...a, path: '/b.srp' }])).toBe(emptyRecentlyClosed);
    expect(close([a], [a], emptyRecentlyClosed, a.id)).toBe(emptyRecentlyClosed);
  });
});

describe('explicit history reopening and removal', () => {
  it('resolves the exact path for an explicit scoped native read', () => {
    const state = close([doc('C:/work/main.srp')]);
    const entry = state.entries[0];
    expect(resolveRecentlyClosed(state, entry, [])).toEqual({ kind: 'read', path: entry.path });
  });

  it('prefers existing dirty editor contents if a matching tab is open', () => {
    const state = close([doc('C:/work/main.srp')]);
    const existing = doc('c:/WORK/MAIN.SRP', 'unsaved', 'saved');
    expect(resolveRecentlyClosed(state, state.entries[0], [existing])).toEqual({
      kind: 'activate', documentId: existing.id,
    });
  });

  it('rejects ambiguous open aliases instead of picking an arbitrary tab', () => {
    const state = close([doc('C:/work/main.srp')]);
    expect(resolveRecentlyClosed(state, state.entries[0], [
      doc('C:/work/main.srp'), doc('c:/WORK/MAIN.SRP'),
    ])).toEqual({ kind: 'ambiguous' });
  });

  it('rejects copied, forgotten and earlier-cycle entries', () => {
    const a = doc('/work/main.srp');
    const first = close([a]);
    const entry = first.entries[0];
    expect(resolveRecentlyClosed(first, { ...entry }, [])).toEqual({ kind: 'stale' });
    const forgot = forgetRecentlyClosed(first, entry);
    expect(resolveRecentlyClosed(forgot, entry, [])).toEqual({ kind: 'stale' });
    const second = close([a], [], forgot);
    expect(second.entries[0].sequence).toBeGreaterThan(entry.sequence);
    expect(resolveRecentlyClosed(second, entry, [])).toEqual({ kind: 'stale' });
    expect(forgetRecentlyClosed(second, entry)).toBe(second);
  });

  it('clears metadata without resetting the sequence used to detect old clicks', () => {
    const first = close([doc('/a.srp'), doc('/b.srp')]);
    const cleared = clearRecentlyClosed(first);
    expect(cleared.entries).toEqual([]);
    expect(cleared.nextSequence).toBe(first.nextSequence);
    expect(clearRecentlyClosed(cleared)).toBe(cleared);
    const next = close([doc('/a.srp')], [], cleared);
    expect(next.entries[0].sequence).toBe(first.nextSequence);
  });

  it('works with real editor transitions, never keeping an explicitly discarded dirty copy', () => {
    const opened = editorReducer(initialEditorState, { type: 'open', path: '/work/main.srp', content: 'saved' });
    const dirty = editorReducer(opened, { type: 'edit', id: opened.activeId!, content: 'discarded' });
    const dirtyDoc = dirty.documents.at(-1)!;
    const discarded = editorReducer(dirty, { type: 'close', id: dirtyDoc.id, snapshot: dirtyDoc });
    expect(reconcileRecentlyClosed(emptyRecentlyClosed, dirty.documents, discarded.documents, dirty.activeId))
      .toBe(emptyRecentlyClosed);
    const cleanDoc = opened.documents.at(-1)!;
    const closed = editorReducer(opened, { type: 'close', id: cleanDoc.id, snapshot: cleanDoc });
    const history = reconcileRecentlyClosed(emptyRecentlyClosed, opened.documents, closed.documents, opened.activeId);
    expect(history.entries[0].path).toBe(cleanDoc.path);
    const reopened = editorReducer(closed, { type: 'open', path: cleanDoc.path!, content: 'current disk' });
    expect(reopened.documents.at(-1)?.content).toBe('current disk');
    expect(reconcileRecentlyClosed(history, closed.documents, reopened.documents, closed.activeId).entries)
      .toEqual([]);
  });
});
