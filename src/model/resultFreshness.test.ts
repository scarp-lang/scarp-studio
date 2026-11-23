import { describe, expect, it } from 'vitest';
import { createUntitled, type StudioDocument } from './documents';
import { editorReducer, initialEditorState } from './editorState';
import { captureVerifiedSource } from './verifiedSource';
import {
  completedProjectOutputWarning, projectResultFreshness, sourceResultIsStale,
} from './resultFreshness';
import type { ScarpProjectAction } from '../services/project';

function source(): StudioDocument {
  return {
    id: 'file-C:/project/main.srp',
    name: 'main.srp',
    path: 'C:/project/main.srp',
    content: 'print("ok");',
    savedContent: 'print("ok");',
    revision: 7,
  };
}

describe('source compiler result freshness', () => {
  it('retains output validity across tab switches and unrelated edits', () => {
    const saved = source();
    const snapshot = captureVerifiedSource(saved)!;
    expect(sourceResultIsStale(snapshot, [saved])).toBe(false);
    expect(sourceResultIsStale(snapshot, [createUntitled(1), saved])).toBe(false);
    expect(sourceResultIsStale(snapshot, [
      { ...createUntitled(1), content: 'unrelated changes', revision: 8 }, saved,
    ])).toBe(false);
    expect(sourceResultIsStale(snapshot, [
      { ...saved, path: String.raw`c:\PROJECT\MAIN.srp` },
    ])).toBe(false);
  });

  it('marks a run stale for edits, saving unchanged bytes, renamed files and tab removal', () => {
    const saved = source();
    const snapshot = captureVerifiedSource(saved)!;
    expect(sourceResultIsStale(snapshot, [{ ...saved, content: 'changed', revision: 8 }])).toBe(true);
    expect(sourceResultIsStale(snapshot, [{ ...saved, revision: 8 }])).toBe(true);
    expect(sourceResultIsStale(snapshot, [{ ...saved, path: 'C:/project/renamed.srp' }])).toBe(true);
    expect(sourceResultIsStale(snapshot, [])).toBe(true);
  });

  it('rejects same-byte A→B→A edits of a running saved source', () => {
    const base = editorReducer(initialEditorState, {
      type: 'open', path: 'C:/project/main.srp', content: 'print(1);',
    });
    const first = base.documents.at(-1)!;
    const snapshot = captureVerifiedSource(first)!;
    const edited = editorReducer(base, { type: 'edit', id: first.id, content: 'print(2);' });
    const reverted = editorReducer(edited, { type: 'edit', id: first.id, content: first.content });
    expect(reverted.documents.at(-1)!.content).toBe(snapshot.content);
    expect(sourceResultIsStale(snapshot, reverted.documents)).toBe(true);
  });
});

describe('project compiler result freshness', () => {
  const actions: ScarpProjectAction[] = ['info', 'verify', 'run', 'list-tests', 'run-tests'];
  const listing = { path: 'C:/project', files: [] };

  it('keeps all unchanged project outputs current, but exposes structured reports only for tests', () => {
    for (const action of actions) {
      const fresh = projectResultFreshness(action,
        { epoch: 5, listing }, { epoch: 5, listing });
      expect(fresh).toEqual({
        stale: false,
        allowStructuredTests: action === 'list-tests' || action === 'run-tests',
        warning: null,
      });
    }
  });

  it('marks every project command stale when sources change while it executes', () => {
    for (const action of actions) {
      const outcome = projectResultFreshness(action,
        { epoch: 5, listing }, { epoch: 6, listing });
      expect(outcome.stale).toBe(true);
      expect(outcome.allowStructuredTests).toBe(false);
      expect(outcome.warning).toContain('earlier saved-on-disk state');
      expect(outcome.warning).toContain('project ' + action);
    }
  });

  it('rejects listing changes even after reselecting the same pathname', () => {
    const replaced = { path: listing.path, files: [] };
    for (const action of actions) {
      const result = projectResultFreshness(action,
        { epoch: 2, listing }, { epoch: 2, listing: replaced });
      expect(result.stale).toBe(true);
    }
  });

  it('allows stable null selections without inventing a changed project', () => {
    expect(projectResultFreshness('info',
      { epoch: 0, listing: null }, { epoch: 0, listing: null }).stale).toBe(false);
    expect(projectResultFreshness('info',
      { epoch: 0, listing: null }, { epoch: 0, listing }).stale).toBe(true);
  });
  it('keeps a completed project report visibly stale after subsequent edits or Explorer refresh', () => {
    const completed = { action: 'run-tests' as const, epoch: 12, listing };
    expect(completedProjectOutputWarning(null, completed)).toBeNull();
    expect(completedProjectOutputWarning(completed, {
      epoch: 12, listing,
    })).toBeNull();

    // A command can finish successfully, then source content changes later.
    // This must not revive a clean-looking old PASS report in the output pane.
    const edited = completedProjectOutputWarning(completed, {
      epoch: 13, listing,
    });
    expect(edited).toContain('now stale');
    expect(edited).toContain('after this result was produced');
    expect(edited).toContain('run-tests');

    // Reselecting the same folder pathname still yields a new listing identity.
    const refreshed = completedProjectOutputWarning(completed, {
      epoch: 12, listing: { ...listing },
    });
    expect(refreshed).toContain('Explorer changed');
    // Switching to a different selected project is also stale.
    expect(completedProjectOutputWarning(completed, {
      epoch: 12, listing: null,
    })).not.toBeNull();
  });

});
