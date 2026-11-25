import { describe, expect, it, vi } from 'vitest';
import type { StudioDocument } from '../model/documents';
import { emptyRecentlyClosed, reconcileRecentlyClosed, clearRecentlyClosed } from '../model/recentlyClosed';
import { MAX_SCARP_SOURCE_BYTES } from '../model/sourceLimits';
import { assertRecentlyClosedReadCurrent, prepareRecentlyClosedRead } from './recentlyClosedRead';

function fixture() {
  const document: StudioDocument = {
    id: 'source', name: 'main.srp', path: '/project/main.srp',
    content: 'old disk contents', savedContent: 'old disk contents', revision: 1,
  };
  let history = reconcileRecentlyClosed(emptyRecentlyClosed, [document], [], document.id);
  let documents: StudioDocument[] = [];
  let current = true;
  const read = vi.fn(async (_path: string) => 'new disk contents');
  const request = {
    entry: history.entries[0], expectedPath: document.path!, read,
    getCurrent: () => ({ history, documents }),
    isCurrent: () => current,
  };
  return {
    document, request, read,
    invalidate: () => { current = false; },
    clear: () => { history = clearRecentlyClosed(history); },
    reopen: () => { documents = [document]; },
    cycle: () => {
      history = reconcileRecentlyClosed(history, [], [document], null);
      history = reconcileRecentlyClosed(history, [document], [], document.id);
    },
  };
}

describe('prepareRecentlyClosedRead', () => {
  it('reads the exact retained path and returns current disk text', async () => {
    const f = fixture();
    await expect(prepareRecentlyClosedRead(f.request)).resolves.toBe('new disk contents');
    expect(f.read).toHaveBeenCalledExactlyOnceWith('/project/main.srp');
    expect(f.request.getCurrent().history.entries).toHaveLength(1);
  });

  it('does not read a substituted destination', async () => {
    const f = fixture();
    await expect(prepareRecentlyClosedRead({ ...f.request, expectedPath: '/project/other.srp' })).rejects.toThrow('changed');
    expect(f.read).not.toHaveBeenCalled();
  });

  it('rejects forgotten entries and stale editor sessions before reading', async () => {
    const a = fixture();
    a.clear();
    await expect(prepareRecentlyClosedRead(a.request)).rejects.toThrow('changed');
    expect(a.read).not.toHaveBeenCalled();
    const b = fixture();
    b.invalidate();
    await expect(prepareRecentlyClosedRead(b.request)).rejects.toThrow('changed');
    expect(b.read).not.toHaveBeenCalled();
  });

  it('does not overwrite an existing editor tab', async () => {
    const f = fixture();
    f.reopen();
    await expect(prepareRecentlyClosedRead(f.request)).rejects.toThrow('changed');
    expect(f.read).not.toHaveBeenCalled();
  });

  it('rejects an editor change during the native read', async () => {
    const f = fixture();
    f.read.mockImplementationOnce(async () => {
      f.invalidate();
      return 'late contents';
    });
    await expect(prepareRecentlyClosedRead(f.request)).rejects.toThrow('changed');
  });

  it('rejects a clear or close/reopen/close cycle during the native read', async () => {
    for (const change of ['clear', 'cycle'] as const) {
      const f = fixture();
      f.read.mockImplementationOnce(async () => {
        f[change]();
        return 'late contents';
      });
      await expect(prepareRecentlyClosedRead(f.request)).rejects.toThrow('changed');
    }
  });

  it('requires a final commit check even after a successful prepared read', async () => {
    for (const change of ['invalidate', 'clear', 'reopen', 'cycle'] as const) {
      const f = fixture();
      const content = await prepareRecentlyClosedRead(f.request);
      expect(content).toBe('new disk contents');
      f[change]();
      expect(() => assertRecentlyClosedReadCurrent(f.request)).toThrow('changed');
      expect(f.read).toHaveBeenCalledTimes(1);
    }
  });

  it('accepts a still-current prepared result without an extra disk read', async () => {
    const f = fixture();
    await prepareRecentlyClosedRead(f.request);
    expect(() => assertRecentlyClosedReadCurrent(f.request)).not.toThrow();
    expect(f.read).toHaveBeenCalledTimes(1);
  });

  it('preserves exact newlines and Unicode source', async () => {
    const f = fixture();
    const text = '\uFEFFprint("नमस्ते 😀")\r\n';
    f.read.mockResolvedValueOnce(text);
    await expect(prepareRecentlyClosedRead(f.request)).resolves.toBe(text);
  });

  it('rejects oversized or ill-formed results even from an injected reader', async () => {
    const f = fixture();
    f.read.mockResolvedValueOnce('a'.repeat(MAX_SCARP_SOURCE_BYTES + 1));
    await expect(prepareRecentlyClosedRead(f.request)).rejects.toThrow('4 MiB');
    f.read.mockResolvedValueOnce('\uD800');
    await expect(prepareRecentlyClosedRead(f.request)).rejects.toThrow();
  });

  it('propagates missing-file and scope errors without consuming history', async () => {
    for (const message of ['File not found', 'Path not allowed']) {
      const f = fixture();
      f.read.mockRejectedValueOnce(new Error(message));
      await expect(prepareRecentlyClosedRead(f.request)).rejects.toThrow(message);
      expect(f.request.getCurrent().history.entries).toEqual([f.request.entry]);
    }
  });
});
