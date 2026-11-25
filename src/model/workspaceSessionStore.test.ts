import { describe, expect, it } from 'vitest';
import { WorkspaceSessionStore, type WorkspaceSessionStorage } from './workspaceSessionStore';
import { WORKSPACE_SESSIONS_KEY, MAX_REMEMBERED_WORKSPACES, type WorkspaceSession } from './workspaceSessions';

class MemoryStorage implements WorkspaceSessionStorage {
  raw: string | null = null;
  writes = 0;
  removes = 0;
  failRead = false;
  failWrite = false;
  failRemove = false;
  getItem(key: string): string | null {
    if (key !== WORKSPACE_SESSIONS_KEY || this.failRead) throw new Error('read failed');
    return this.raw;
  }
  setItem(key: string, value: string): void {
    if (key !== WORKSPACE_SESSIONS_KEY || this.failWrite) throw new Error('write failed');
    this.writes++;
    this.raw = value;
  }
  removeItem(key: string): void {
    if (key !== WORKSPACE_SESSIONS_KEY || this.failRemove) throw new Error('remove failed');
    this.removes++;
    this.raw = null;
  }
}
const session = (root = 'C:/practice', savedAt = 10): WorkspaceSession => ({
  root, savedAt, names: ['basic/main.srp', 'loops/main.srp'], active: 'loops/main.srp',
});

describe('manual workspace metadata store', () => {
  it('does not write an empty record at startup or while inspecting workspaces', () => {
    const storage = new MemoryStorage();
    const store = new WorkspaceSessionStore(storage);
    expect(store.view()).toMatchObject({ available: true, blocked: false, sessions: [], error: null });
    expect(store.find('C:/practice')).toBeNull();
    expect(storage.writes).toBe(0);
    expect(storage.raw).toBeNull();
  });

  it('persists the explicitly remembered metadata and finds it on restart', () => {
    const storage = new MemoryStorage();
    const store = new WorkspaceSessionStore(storage);
    expect(store.remember(session(), null)).toBe(true);
    expect(storage.writes).toBe(1);
    const restarted = new WorkspaceSessionStore(storage);
    expect(restarted.find('c:\\PRACTICE')).toEqual(session());
    expect(restarted.view().sessions).toHaveLength(1);
  });

  it('preserves other workspaces when replacing the exact reviewed record', () => {
    const storage = new MemoryStorage();
    const store = new WorkspaceSessionStore(storage);
    expect(store.remember(session(), null)).toBe(true);
    expect(store.remember(session('/second'), null)).toBe(true);
    const old = store.find('C:/practice')!;
    expect(store.remember(session('c:/PRACTICE', 20), old)).toBe(true);
    expect(store.view().sessions).toEqual([session('c:/PRACTICE', 20), session('/second')]);
    expect(store.find('C:/practice')?.savedAt).toBe(20);
  });

  it('requires exact reviewed identity for replacement, deletion and restore', () => {
    const storage = new MemoryStorage();
    const store = new WorkspaceSessionStore(storage);
    expect(store.remember(session(), null)).toBe(true);
    const old = store.find('C:/practice')!;
    const raw = storage.raw;
    expect(store.remember(session('C:/practice', 20), null)).toBe(false);
    expect(store.remember(session('C:/practice', 20), { ...old })).toBe(false);
    expect(store.forget({ ...old })).toBe(false);
    expect(store.canRestore({ ...old })).toBe(false);
    expect(storage.raw).toBe(raw);
    expect(store.canRestore(old)).toBe(true);
  });

  it('rejects stale confirmations after the record is replaced', () => {
    const store = new WorkspaceSessionStore(new MemoryStorage());
    expect(store.remember(session(), null)).toBe(true);
    const old = store.find('C:/practice')!;
    const oldList = store.view().sessions;
    expect(store.remember(session('C:/practice', 20), old)).toBe(true);
    expect(store.forget(old)).toBe(false);
    expect(store.clearAll(oldList)).toBe(false);
    expect(store.canRestore(old)).toBe(false);
    expect(store.find('C:/practice')?.savedAt).toBe(20);
  });

  it('does not evict a remembered workspace when the store reaches capacity', () => {
    const storage = new MemoryStorage();
    const store = new WorkspaceSessionStore(storage);
    for (let i = 0; i < MAX_REMEMBERED_WORKSPACES; i++) {
      expect(store.remember(session('/practice/' + i), null)).toBe(true);
    }
    const raw = storage.raw;
    expect(store.remember(session('/new'), null)).toBe(false);
    expect(store.view().error).toContain('Eight workspaces');
    expect(store.view().sessions).toHaveLength(MAX_REMEMBERED_WORKSPACES);
    expect(storage.raw).toBe(raw);
    expect(store.forget(store.find('/practice/0')!)).toBe(true);
    expect(store.remember(session('/new'), null)).toBe(true);
  });

  it('removes only selected metadata and removes the key when the final workspace is forgotten', () => {
    const storage = new MemoryStorage();
    const store = new WorkspaceSessionStore(storage);
    store.remember(session(), null);
    store.remember(session('/second'), null);
    expect(store.forget(store.find('C:/practice')!)).toBe(true);
    expect(new WorkspaceSessionStore(storage).view().sessions).toEqual([session('/second')]);
    expect(store.forget(store.find('/second')!)).toBe(true);
    expect(storage.raw).toBeNull();
    expect(storage.removes).toBe(1);
  });

  it('rejects invalid metadata before storing it', () => {
    const storage = new MemoryStorage();
    const store = new WorkspaceSessionStore(storage);
    expect(store.remember({ ...session(), names: ['../outside.srp'], active: null }, null)).toBe(false);
    expect(storage.raw).toBeNull();
    expect(storage.writes).toBe(0);
  });

  it('keeps an existing valid record after a quota or removal failure', () => {
    const storage = new MemoryStorage();
    const store = new WorkspaceSessionStore(storage);
    store.remember(session(), null);
    const old = store.find('C:/practice')!;
    const raw = storage.raw;
    storage.failWrite = true;
    expect(store.remember(session('C:/practice', 20), old)).toBe(false);
    expect(storage.raw).toBe(raw);
    expect(store.find('C:/practice')).toBe(old);
    storage.failRemove = true;
    expect(store.forget(old)).toBe(false);
    expect(storage.raw).toBe(raw);
    storage.failRemove = false;
    expect(store.forget(old)).toBe(true);
  });

  it('blocks unknown records and permits explicit removal without overwriting them', () => {
    const storage = new MemoryStorage();
    storage.raw = '{unrecognized';
    const store = new WorkspaceSessionStore(storage);
    expect(store.view().blocked).toBe(true);
    expect(store.remember(session(), null)).toBe(false);
    expect(storage.raw).toBe('{unrecognized');
    expect(store.clearAll(store.view().sessions)).toBe(true);
    expect(store.view().blocked).toBe(false);
    expect(storage.raw).toBeNull();
  });

  it('fails closed on external changes, including when restore is attempted', () => {
    const storage = new MemoryStorage();
    const store = new WorkspaceSessionStore(storage);
    store.remember(session(), null);
    const old = store.find('C:/practice')!;
    storage.raw = 'external data';
    expect(store.canRestore(old)).toBe(false);
    expect(store.view().blocked).toBe(true);
    expect(store.clearAll(store.view().sessions)).toBe(false);
    expect(storage.raw).toBe('external data');
  });

  it('handles inaccessible and disabled storage without claiming success', () => {
    const storage = new MemoryStorage();
    storage.failRead = true;
    for (const store of [new WorkspaceSessionStore(storage), new WorkspaceSessionStore(null)]) {
      expect(store.view().available).toBe(false);
      expect(store.remember(session(), null)).toBe(false);
      expect(store.clearAll(store.view().sessions)).toBe(false);
    }
  });
});
