import { describe, expect, it } from 'vitest';
import { isDirty } from './documents';
import { editorReducer, initialEditorState } from './editorState';
import { captureRecoveryCheckpoint } from './draftRecovery';
import { captureWorkspaceSession, planWorkspaceRestore } from './workspaceSessions';
import { emptyRecentlyClosed, reconcileRecentlyClosed } from './recentlyClosed';

const root = 'C:/practice';
const listing = [
  { name: 'basic/main.srp', path: root + '/basic/main.srp' },
  { name: 'loops/main.srp', path: root + '/loops/main.srp' },
  { name: 'notes.srp', path: root + '/notes.srp' },
];

function openPractice() {
  return listing.reduce((state, file) => editorReducer(state, {
    type: 'open', path: file.path, content: 'saved ' + file.name,
  }), initialEditorState);
}

describe('combined workspace and editor reliability', () => {
  it('bulk closes only clean snapshots and remembers them for reopening', () => {
    const before = openPractice();
    const snapshots = before.documents.filter(doc => doc.path !== null);
    const after = editorReducer(before, { type: 'close-clean-tabs', snapshots });
    expect(after.documents).toEqual([before.documents[0]]);
    const history = reconcileRecentlyClosed(emptyRecentlyClosed,
      before.documents, after.documents, before.activeId);
    expect(history.entries.map(entry => entry.path)).toEqual([
      listing[2].path, listing[1].path, listing[0].path,
    ]);
    expect(JSON.stringify(history)).not.toContain('saved basic/main.srp');
  });

  it('restores clean workspace tabs without consuming dirty recovered copies', () => {
    const initial = openPractice();
    const captured = captureWorkspaceSession(root, listing, initial.documents, initial.activeId, 10);
    expect(captured.session).not.toBeNull();
    const restoredDraft = editorReducer(initialEditorState, {
      type: 'restore-drafts', drafts: [{ name: 'main.srp', content: 'unsaved recovery' }],
    });
    const recovered = restoredDraft.documents.at(-1)!;
    const plan = planWorkspaceRestore(captured.session!, root, listing, restoredDraft.documents);
    expect(plan.ok).toBe(true);
    const next = editorReducer(restoredDraft, {
      type: 'restore-workspace-tabs',
      files: listing.map(file => ({ path: file.path, content: 'fresh disk content' })),
      activePath: listing[2].path,
    });
    expect(next.documents.find(doc => doc.id === recovered.id)).toEqual(recovered);
    expect(isDirty(recovered)).toBe(true);
    expect(next.documents.find(doc => doc.id === next.activeId)?.path).toBe(listing[2].path);
    const checkpoint = captureRecoveryCheckpoint(next.documents, 20);
    expect(checkpoint.ok).toBe(true);
    if (checkpoint.ok) expect(checkpoint.value?.drafts.map(draft => draft.content)).toEqual(['unsaved recovery']);
  });

  it('rejects an entire bulk close if one saved snapshot became dirty', () => {
    const before = openPractice();
    const snapshots = before.documents.filter(doc => doc.path !== null);
    const edited = editorReducer(before, { type: 'edit', id: snapshots[0].id, content: 'new unsaved text' });
    const after = editorReducer(edited, { type: 'close-clean-tabs', snapshots });
    expect(after).toBe(edited);
    expect(reconcileRecentlyClosed(emptyRecentlyClosed,
      edited.documents, after.documents, edited.activeId)).toBe(emptyRecentlyClosed);
    expect(after.documents.find(doc => doc.id === snapshots[0].id)?.content).toBe('new unsaved text');
  });
});
