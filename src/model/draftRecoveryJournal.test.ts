import { describe, expect, it } from 'vitest';
import { createUntitled, type StudioDocument } from './documents';
import { editorReducer, initialEditorState } from './editorState';
import { DRAFT_RECOVERY_KEY, MAX_RECOVERY_SOURCE_UNITS, parseRecoveryRecord } from './draftRecovery';
import { DraftRecoveryJournal, type RecoveryStorage } from './draftRecoveryJournal';

class MemoryStorage implements RecoveryStorage {
  data = new Map<string, string>();
  reads = 0;
  writes = 0;
  removes = 0;
  failRead = false;
  failWrite = false;
  failRemove = false;
  getItem(key: string): string | null {
    this.reads++;
    if (this.failRead) throw new Error('denied');
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.failWrite) throw new Error('quota');
    this.writes++;
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    if (this.failRemove) throw new Error('denied');
    this.removes++;
    this.data.delete(key);
  }
  raw(): string | null {
    return this.data.get(DRAFT_RECOVERY_KEY) ?? null;
  }
}

const dirty = (content = 'unsaved'): StudioDocument => ({
  id: 'a', name: 'main.srp', path: '/private/main.srp', content,
  savedContent: 'saved', revision: 1,
});
const time = 1700000000000;
function start(storage = new MemoryStorage(), docs = [dirty()]) {
  const journal = new DraftRecoveryJournal(storage);
  expect(journal.enable(docs, time)).toBe(true);
  return { storage, journal };
}

describe('opt-in recovery journal', () => {
  it('does not persist any content before opt-in', () => {
    const storage = new MemoryStorage();
    const journal = new DraftRecoveryJournal(storage);
    expect(journal.view()).toMatchObject({ available: true, enabled: false, previous: null, error: null });
    expect(journal.flush([dirty()], time)).toBe(false);
    expect(storage.raw()).toBeNull();
    expect(storage.writes).toBe(0);
  });

  it('persists opt-in even when there are no dirty sources', () => {
    const { storage, journal } = start(new MemoryStorage(), [createUntitled(1)]);
    expect(journal.view()).toMatchObject({ enabled: true, checkpointCount: 0, checkpointTime: null });
    expect(parseRecoveryRecord(storage.raw())).toEqual({
      ok: true, value: { version: 1, enabled: true, checkpoint: null },
    });
    const restarted = new DraftRecoveryJournal(storage);
    expect(restarted.view()).toMatchObject({ enabled: true, previous: null });
    expect(restarted.flush([dirty('new')], time + 1)).toBe(true);
    expect(restarted.view().checkpointCount).toBe(1);
  });

  it('does not rewrite unchanged checkpoint contents or advance their timestamp', () => {
    const { storage, journal } = start();
    expect(journal.flush([dirty()], time + 1)).toBe(true);
    expect(storage.writes).toBe(1);
    expect(journal.view().checkpointTime).toBe(time);
    expect(journal.flush([dirty('different')], time + 2)).toBe(true);
    expect(storage.writes).toBe(2);
    expect(journal.view().checkpointTime).toBe(time + 2);
  });

  it('removes the checkpoint when all source buffers are clean', () => {
    const { storage, journal } = start();
    expect(journal.flush([{ ...dirty(), content: 'saved' }], time + 1)).toBe(true);
    expect(journal.view()).toMatchObject({ enabled: true, checkpointCount: 0, checkpointTime: null });
    expect(new DraftRecoveryJournal(storage).view().previous).toBeNull();
  });

  it('preserves the last full checkpoint if a new checkpoint exceeds its budget', () => {
    const { storage, journal } = start();
    const previous = storage.raw();
    expect(journal.flush([dirty('x'.repeat(MAX_RECOVERY_SOURCE_UNITS + 1))], time + 1)).toBe(false);
    expect(storage.raw()).toBe(previous);
    expect(journal.view().error).toContain('512 Ki');
    expect(journal.flush([dirty('small again')], time + 2)).toBe(true);
    expect(journal.view().error).toBeNull();
  });

  it('does not persist opt-in if storage rejects the initial checkpoint', () => {
    const storage = new MemoryStorage();
    storage.failWrite = true;
    const journal = new DraftRecoveryJournal(storage);
    expect(journal.enable([dirty()], time)).toBe(false);
    expect(journal.view().enabled).toBe(false);
    expect(storage.raw()).toBeNull();
    expect(journal.view().error).toContain('write failed');
  });

  it('retains the earlier checkpoint on a quota failure', () => {
    const { storage, journal } = start();
    const previous = storage.raw();
    storage.failWrite = true;
    expect(journal.flush([dirty('new')], time + 1)).toBe(false);
    expect(storage.raw()).toBe(previous);
    expect(journal.view().checkpointTime).toBe(time);
    storage.failWrite = false;
    expect(journal.flush([dirty('new')], time + 2)).toBe(true);
  });

  it('handles inaccessible or missing desktop storage without enabling recovery', () => {
    const storage = new MemoryStorage();
    storage.failRead = true;
    for (const journal of [new DraftRecoveryJournal(storage), new DraftRecoveryJournal(null)]) {
      expect(journal.view().available).toBe(false);
      expect(journal.enable([dirty()], time)).toBe(false);
      expect(journal.flush([dirty()], time)).toBe(false);
      expect(journal.view().enabled).toBe(false);
    }
  });
});

describe('previous-session recovery review', () => {
  it('never replaces a previous-session checkpoint with new unsaved work', () => {
    const { storage } = start();
    const raw = storage.raw();
    const restarted = new DraftRecoveryJournal(storage);
    expect(restarted.view().previous?.drafts[0].content).toBe('unsaved');
    expect(restarted.flush([dirty('new session')], time + 1)).toBe(false);
    expect(storage.raw()).toBe(raw);
    expect(restarted.prepareExit()).toBe(true);
    expect(storage.raw()).toBe(raw);
  });

  it('requires exact review identity and rejects a stale copied checkpoint', () => {
    const { storage } = start();
    const restarted = new DraftRecoveryJournal(storage);
    const previous = restarted.view().previous!;
    const raw = storage.raw();
    expect(restarted.resolvePrevious({ ...previous }, [], time + 1)).toBe(false);
    expect(storage.raw()).toBe(raw);
    expect(restarted.view().previous).toBe(previous);
  });

  it('restores prior drafts together with current dirty tabs and retains their names', () => {
    const { storage } = start();
    const restarted = new DraftRecoveryJournal(storage);
    const previous = restarted.view().previous!;
    const state = editorReducer(initialEditorState, { type: 'edit', id: 'untitled-1', content: 'new work' });
    const next = editorReducer(state, { type: 'restore-drafts', drafts: previous.drafts });
    expect(restarted.resolvePrevious(previous, next.documents, time + 1)).toBe(true);
    expect(restarted.view().previous).toBeNull();
    expect(new DraftRecoveryJournal(storage).view().previous?.drafts).toEqual([
      { name: 'Untitled-1.srp', content: 'new work' },
      { name: 'main.srp', content: 'unsaved' },
    ]);
    expect(restarted.resolvePrevious(previous, [], time + 2)).toBe(false);
  });

  it('keeps review pending if the combined restore checkpoint cannot fit', () => {
    const { storage } = start();
    const restarted = new DraftRecoveryJournal(storage);
    const previous = restarted.view().previous!;
    const raw = storage.raw();
    const state = editorReducer(initialEditorState, {
      type: 'edit', id: 'untitled-1', content: 'x'.repeat(MAX_RECOVERY_SOURCE_UNITS),
    });
    const next = editorReducer(state, { type: 'restore-drafts', drafts: previous.drafts });
    expect(restarted.resolvePrevious(previous, next.documents, time + 1)).toBe(false);
    expect(storage.raw()).toBe(raw);
    expect(restarted.view().previous).toBe(previous);
  });

  it('keeps review pending if replacement storage fails, then permits retry', () => {
    const { storage } = start();
    const restarted = new DraftRecoveryJournal(storage);
    const previous = restarted.view().previous!;
    const raw = storage.raw();
    storage.failWrite = true;
    expect(restarted.resolvePrevious(previous, [dirty('new')], time + 1)).toBe(false);
    expect(storage.raw()).toBe(raw);
    expect(restarted.view().previous).toBe(previous);
    storage.failWrite = false;
    expect(restarted.resolvePrevious(previous, [dirty('new')], time + 2)).toBe(true);
    expect(new DraftRecoveryJournal(storage).view().previous?.drafts[0].content).toBe('new');
  });

  it('can explicitly discard prior drafts without discarding current dirty tabs', () => {
    const { storage } = start();
    const restarted = new DraftRecoveryJournal(storage);
    const current = dirty('current session source');
    expect(restarted.resolvePrevious(restarted.view().previous!, [current], time + 1)).toBe(true);
    expect(new DraftRecoveryJournal(storage).view().previous?.drafts[0].content).toBe(current.content);
    expect(current.content).toBe('current session source');
  });
});

describe('external changes and explicit deletion', () => {
  it('preserves malformed records and only removes them on explicit disable', () => {
    const storage = new MemoryStorage();
    storage.data.set(DRAFT_RECOVERY_KEY, '{invalid');
    const journal = new DraftRecoveryJournal(storage);
    expect(journal.view()).toMatchObject({ blocked: true, enabled: false });
    expect(journal.enable([dirty()], time)).toBe(false);
    expect(journal.flush([dirty()], time)).toBe(false);
    expect(storage.raw()).toBe('{invalid');
    expect(journal.disable()).toBe(true);
    expect(storage.raw()).toBeNull();
    expect(journal.view()).toMatchObject({ blocked: false, enabled: false, paused: false, error: null });
  });

  it('rejects a concurrent writer without overwriting or deleting their data', () => {
    const { storage, journal } = start();
    storage.data.set(DRAFT_RECOVERY_KEY, 'new external data');
    expect(journal.flush([dirty('new')], time + 1)).toBe(false);
    expect(journal.view().blocked).toBe(true);
    expect(journal.disable()).toBe(false);
    expect(storage.raw()).toBe('new external data');
  });

  it('does not let an old recovery review replace a newer external checkpoint', () => {
    const { storage } = start();
    const restarted = new DraftRecoveryJournal(storage);
    const previous = restarted.view().previous!;
    storage.data.set(DRAFT_RECOVERY_KEY, 'external');
    expect(restarted.resolvePrevious(previous, [], time + 1)).toBe(false);
    expect(storage.raw()).toBe('external');
    expect(restarted.view().blocked).toBe(true);
  });

  it('does not resume writing after a failed disable; permits explicit retry', () => {
    const { storage, journal } = start();
    const raw = storage.raw();
    storage.failRemove = true;
    expect(journal.disable()).toBe(false);
    expect(journal.view().paused).toBe(true);
    expect(journal.flush([dirty('new')], time + 1)).toBe(false);
    expect(storage.raw()).toBe(raw);
    storage.failRemove = false;
    expect(journal.disable()).toBe(true);
    expect(storage.raw()).toBeNull();
    expect(journal.flush([dirty()], time + 2)).toBe(false);
  });

  it('does not revive an explicitly disabled writer after an interrupted close', () => {
    const { storage, journal } = start();
    storage.failRemove = true;
    expect(journal.disable()).toBe(false);
    expect(journal.prepareExit()).toBe(false);
    journal.resumeAfterExitFailure([dirty('must not persist')], time + 1);
    expect(journal.view().paused).toBe(true);
    expect(journal.flush([dirty('must not persist')], time + 2)).toBe(false);
    storage.failRemove = false;
    expect(journal.prepareExit()).toBe(true);
    expect(storage.raw()).toBeNull();
    expect(new DraftRecoveryJournal(storage).view().enabled).toBe(false);
  });

  it('does not erase source files or current editor objects when disabled', () => {
    const doc = dirty();
    const { storage, journal } = start(new MemoryStorage(), [doc]);
    expect(journal.disable()).toBe(true);
    expect(storage.raw()).toBeNull();
    expect(doc).toEqual(dirty());
    expect(new DraftRecoveryJournal(storage).view().enabled).toBe(false);
  });
});

describe('normal shutdown and interrupted shutdown', () => {
  it('clears only the current checkpoint and suppresses late pagehide writes', () => {
    const { storage, journal } = start();
    expect(journal.prepareExit()).toBe(true);
    expect(journal.view().paused).toBe(true);
    expect(journal.flush([dirty()], time + 1)).toBe(false);
    expect(new DraftRecoveryJournal(storage).view()).toMatchObject({ enabled: true, previous: null });
  });

  it('recreates the live checkpoint if native window destruction fails', () => {
    const { storage, journal } = start();
    expect(journal.prepareExit()).toBe(true);
    journal.resumeAfterExitFailure([dirty('still open')], time + 1);
    expect(journal.view().paused).toBe(false);
    expect(new DraftRecoveryJournal(storage).view().previous?.drafts[0].content).toBe('still open');
  });

  it('reports cleanup failures before exit and retains the old checkpoint', () => {
    const { storage, journal } = start();
    const raw = storage.raw();
    storage.failWrite = true;
    expect(journal.prepareExit()).toBe(false);
    expect(storage.raw()).toBe(raw);
    expect(journal.view().paused).toBe(true);
    storage.failWrite = false;
    journal.resumeAfterExitFailure([dirty('more work')], time + 1);
    expect(journal.view().paused).toBe(false);
    expect(new DraftRecoveryJournal(storage).view().previous?.drafts[0].content).toBe('more work');
  });
});
