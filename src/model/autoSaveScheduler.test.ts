import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AutoSaveScheduler } from './autoSaveScheduler';
import type { StudioDocument } from './documents';

function savedDirty(id: string, content = 'new'): StudioDocument {
  return { id, name: id + '.srp', path: '/src/' + id + '.srp',
    content, savedContent: 'old' };
}

describe('per-file Auto Save scheduler', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does nothing when disabled or for unsaved untitled documents', () => {
    const save = vi.fn();
    const scheduler = new AutoSaveScheduler(save);
    scheduler.reconcile([savedDirty('main')], false, 1000, false);
    vi.advanceTimersByTime(1000);
    scheduler.reconcile([{ ...savedDirty('new'), path: null }], true, 1000, false);
    vi.advanceTimersByTime(1000);
    expect(save).not.toHaveBeenCalled();
    scheduler.dispose();
  });

  it('saves only after the configured idle delay', () => {
    const save = vi.fn();
    const scheduler = new AutoSaveScheduler(save);
    const original = savedDirty('main');
    scheduler.reconcile([original], true, 3000, false);
    vi.advanceTimersByTime(2900);
    expect(save).not.toHaveBeenCalled();
    scheduler.reconcile([{ ...original, content: 'more recent' }], true, 3000, false);
    vi.advanceTimersByTime(100);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2900);
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith({ ...original, content: 'more recent' });
    scheduler.dispose();
  });

  it('preserves timers for background tabs while another tab changes', () => {
    const save = vi.fn();
    const scheduler = new AutoSaveScheduler(save);
    const first = savedDirty('one');
    const second = savedDirty('two');
    scheduler.reconcile([first, second], true, 1000, false);
    vi.advanceTimersByTime(800);
    scheduler.reconcile([first, { ...second, content: 'latest' }], true, 1000, false);
    vi.advanceTimersByTime(200);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(first);
    vi.advanceTimersByTime(800);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith({ ...second, content: 'latest' });
    scheduler.dispose();
  });

  it('cancels pending writes when compiler execution begins and resumes after', () => {
    const save = vi.fn();
    const scheduler = new AutoSaveScheduler(save);
    const doc = savedDirty('script');
    scheduler.reconcile([doc], true, 1000, false);
    vi.advanceTimersByTime(800);
    scheduler.reconcile([doc], true, 1000, true);
    vi.advanceTimersByTime(3000);
    expect(save).not.toHaveBeenCalled();
    scheduler.reconcile([doc], true, 1000, false);
    vi.advanceTimersByTime(1000);
    expect(save).toHaveBeenCalledOnce();
    scheduler.dispose();
  });

  it('retries a blocked background save without resetting the other tab', () => {
    const writes: string[] = [];
    let busy = true;
    const scheduler = new AutoSaveScheduler((doc) => {
      if (doc.id === 'second' && busy) return false;
      writes.push(doc.id);
    });
    const a = savedDirty('first');
    const b = savedDirty('second');
    scheduler.reconcile([a, b], true, 1000, false);
    vi.advanceTimersByTime(1000);
    expect(writes).toEqual(['first']);
    busy = false;
    vi.advanceTimersByTime(249);
    expect(writes).toEqual(['first']);
    vi.advanceTimersByTime(1);
    expect(writes).toEqual(['first', 'second']);
    scheduler.dispose();
  });

  it('backs off blocked saves to a capped interval and resumes promptly', () => {
    let busy = true;
    const writes = vi.fn(() => busy ? false : undefined);
    const scheduler = new AutoSaveScheduler(writes);
    const doc = savedDirty('backoff');
    scheduler.reconcile([doc], true, 1000, false);

    vi.advanceTimersByTime(1000);
    expect(writes).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(249);
    expect(writes).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(writes).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(500);
    expect(writes).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(1000);
    expect(writes).toHaveBeenCalledTimes(4);
    vi.advanceTimersByTime(2000);
    expect(writes).toHaveBeenCalledTimes(5);

    busy = false;
    vi.advanceTimersByTime(2000);
    expect(writes).toHaveBeenCalledTimes(6);
    vi.advanceTimersByTime(10000);
    expect(writes).toHaveBeenCalledTimes(6);
    scheduler.dispose();
  });

  it('never resurrects a blocked retry after synchronous close or dispose', () => {
    const doc = savedDirty('closed');
    let scheduler!: AutoSaveScheduler;
    const save = vi.fn(() => {
      scheduler.reconcile([], true, 1000, false);
      return false;
    });
    scheduler = new AutoSaveScheduler(save);
    scheduler.reconcile([doc], true, 1000, false);
    vi.advanceTimersByTime(11000);
    expect(save).toHaveBeenCalledOnce();
    scheduler.dispose();

    const disposeSave = vi.fn(() => {
      scheduler.dispose();
      return false;
    });
    scheduler = new AutoSaveScheduler(disposeSave);
    scheduler.reconcile([doc], true, 1000, false);
    vi.advanceTimersByTime(11000);
    expect(disposeSave).toHaveBeenCalledOnce();
  });

  it('does not duplicate a new timer after reentrant reconciliation', () => {
    const doc = savedDirty('reentrant');
    let scheduler!: AutoSaveScheduler;
    let count = 0;
    const onSave = vi.fn(() => {
      count++;
      if (count === 1) scheduler.reconcile([doc], true, 1000, false);
      return false;
    });
    scheduler = new AutoSaveScheduler(onSave);
    scheduler.reconcile([doc], true, 1000, false);
    vi.advanceTimersByTime(1000);
    expect(onSave).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(250);
    expect(onSave).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(750);
    expect(onSave).toHaveBeenCalledTimes(2);
    scheduler.dispose();
  });

  it('cancels a busy retry if the user edits, closes or disables Auto Save', () => {
    const save = vi.fn(() => false);
    const scheduler = new AutoSaveScheduler(save);
    const document = savedDirty('main');
    scheduler.reconcile([document], true, 1000, false);
    vi.advanceTimersByTime(1000);
    expect(save).toHaveBeenCalledTimes(1);
    // New edits invalidate the retry callback for the old snapshot.
    const newer = { ...document, content: 'newer changes' };
    scheduler.reconcile([newer], true, 1000, false);
    vi.advanceTimersByTime(250);
    expect(save).toHaveBeenCalledTimes(1);
    scheduler.reconcile([], true, 1000, false);
    vi.advanceTimersByTime(1000);
    expect(save).toHaveBeenCalledTimes(1);
    scheduler.reconcile([newer], true, 1000, false);
    scheduler.reconcile([newer], false, 1000, false);
    vi.advanceTimersByTime(1000);
    expect(save).toHaveBeenCalledTimes(1);
    scheduler.dispose();
  });

  it('cancels old delays, closed tabs, cleaned files and disposed timers', () => {
    const save = vi.fn();
    const scheduler = new AutoSaveScheduler(save);
    const doc = savedDirty('main');
    scheduler.reconcile([doc], true, 5000, false);
    scheduler.reconcile([doc], true, 1000, false);
    vi.advanceTimersByTime(1000);
    expect(save).toHaveBeenCalledOnce();
    scheduler.reconcile([doc], true, 1000, false);
    scheduler.reconcile([{ ...doc, content: doc.savedContent }], true, 1000, false);
    vi.advanceTimersByTime(1000);
    expect(save).toHaveBeenCalledOnce();
    scheduler.reconcile([doc], true, 1000, false);
    scheduler.reconcile([], true, 1000, false);
    vi.advanceTimersByTime(1000);
    expect(save).toHaveBeenCalledOnce();
    scheduler.reconcile([doc], true, 1000, false);
    scheduler.dispose();
    vi.advanceTimersByTime(1000);
    expect(save).toHaveBeenCalledOnce();
  });
});
