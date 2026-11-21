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
    expect(save).toHaveBeenCalledExactlyOnceWith(first);
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
