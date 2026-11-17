import { beforeEach, describe, expect, it, vi } from 'vitest';
import { save } from '@tauri-apps/plugin-dialog';
import { readTextFile, stat, writeTextFile } from '@tauri-apps/plugin-fs';
import { createUntitled, type StudioDocument } from '../model/documents';
import { saveAllModifiedSources } from './files';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}));
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  stat: vi.fn(),
  writeTextFile: vi.fn(),
}));

function unsaved(id: number, content: string): StudioDocument {
  return { ...createUntitled(id), content };
}

describe('sequential Save All safety', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(stat).mockResolvedValue({
      size: 12, isFile: true,
    } as Awaited<ReturnType<typeof stat>>);
  });

  it('does not prompt for clean, closed, or duplicate tab identities', async () => {
    const clean = createUntitled(1);
    const sources = new Map([[clean.id, clean]]);
    const onSaved = vi.fn();
    await expect(saveAllModifiedSources(
      [clean.id, clean.id, 'closed-tab'],
      (id) => sources.get(id),
      () => [],
      onSaved,
    )).resolves.toEqual({ saved: 0, cancelled: false });
    expect(save).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('saves modified tabs sequentially and reports their actual snapshots', async () => {
    const first = unsaved(1, 'print(1);');
    const second = unsaved(2, 'print(2);');
    const sources = new Map([[first.id, first], [second.id, second]]);
    const saved: Array<[string, string, string]> = [];
    vi.mocked(save).mockResolvedValueOnce('C:/work/one.srp')
      .mockResolvedValueOnce('C:/work/two.srp');
    const result = await saveAllModifiedSources(
      [first.id, second.id, first.id],
      (id) => sources.get(id),
      () => [],
      (document, path) => {
        saved.push([document.id, path, document.content]);
        sources.set(document.id, {
          ...document, path, savedContent: document.content,
        });
      },
    );
    expect(result).toEqual({ saved: 2, cancelled: false });
    expect(saved).toEqual([
      ['untitled-1', 'C:/work/one.srp', 'print(1);'],
      ['untitled-2', 'C:/work/two.srp', 'print(2);'],
    ]);
    expect(writeTextFile).toHaveBeenNthCalledWith(1, 'C:/work/one.srp', 'print(1);');
    expect(writeTextFile).toHaveBeenNthCalledWith(2, 'C:/work/two.srp', 'print(2);');
  });

  it('stops after cancellation without touching subsequent unsaved sources', async () => {
    const docs = [unsaved(1, 'first'), unsaved(2, 'second'), unsaved(3, 'third')];
    vi.mocked(save).mockResolvedValueOnce('C:/work/first.srp').mockResolvedValueOnce(null);
    const marked = vi.fn();
    const result = await saveAllModifiedSources(
      docs.map((doc) => doc.id),
      (id) => docs.find((doc) => doc.id === id),
      () => [],
      marked,
    );
    expect(result).toEqual({ saved: 1, cancelled: true });
    expect(marked).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(2);
    expect(writeTextFile).toHaveBeenCalledTimes(1);
  });

  it('reads each document again after earlier Save As dialogs', async () => {
    const first = unsaved(1, 'first');
    const previous = unsaved(2, 'earlier version');
    const latest = { ...previous, content: 'newer edits' };
    const docs = new Map([[first.id, first], [previous.id, previous]]);
    vi.mocked(save).mockImplementationOnce(async () => {
      docs.set(previous.id, latest);
      return 'C:/work/one.srp';
    }).mockResolvedValueOnce('C:/work/two.srp');
    const marked = vi.fn();
    await saveAllModifiedSources(
      [first.id, previous.id],
      (id) => docs.get(id),
      () => [],
      marked,
    );
    expect(writeTextFile).toHaveBeenNthCalledWith(2, 'C:/work/two.srp', 'newer edits');
    expect(marked).toHaveBeenNthCalledWith(2, latest, 'C:/work/two.srp');
  });

  it('rejects a collision caused by a tab opened during Save As', async () => {
    const source = unsaved(1, 'source');
    const openedPaths: string[] = [];
    vi.mocked(save).mockImplementation(async () => {
      openedPaths.push(String.raw`C:\\work\\ALREADY.SRP`);
      return 'c:/work/already.srp';
    });
    await expect(saveAllModifiedSources(
      [source.id],
      () => source,
      () => openedPaths,
      vi.fn(),
    )).rejects.toThrow(/stopped at Untitled-1.srp.*already open/);
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it('stops before overwriting an externally changed named source', async () => {
    const source: StudioDocument = {
      ...unsaved(3, 'local edits'),
      path: 'C:/work/entry.srp',
      savedContent: 'original on disk',
    };
    vi.mocked(readTextFile).mockResolvedValue('external changes');
    await expect(saveAllModifiedSources(
      [source.id], () => source, () => [], vi.fn(),
    )).rejects.toThrow('changed on disk');
    expect(save).not.toHaveBeenCalled();
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it('never marks a snapshot saved when the native writer fails', async () => {
    const source = unsaved(5, 'must remain dirty');
    vi.mocked(save).mockResolvedValue('C:/work/unwritable.srp');
    vi.mocked(writeTextFile).mockRejectedValue(new Error('permission denied'));
    const onSaved = vi.fn();
    await expect(saveAllModifiedSources(
      [source.id], () => source, () => [], onSaved,
    )).rejects.toThrow('permission denied');
    expect(onSaved).not.toHaveBeenCalled();
  });
});
