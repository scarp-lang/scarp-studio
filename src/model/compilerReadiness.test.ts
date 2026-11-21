import { describe, expect, it } from 'vitest';
import { createUntitled, markSaved, updateContent } from './documents';
import { captureRunSnapshot, runnableSource, validateRunSnapshot } from './compilerReadiness';

describe('compiler file readiness', () => {
  it('rejects an empty editor', () => {
    expect(() => runnableSource(null)).toThrow('Open a Scarp');
  });
  it('rejects an unsaved source', () => {
    expect(() => runnableSource(createUntitled(1))).toThrow('Save the source');
  });
  it('refuses to execute a dirty buffer instead of stale disk contents', () => {
    const initial = createUntitled(1);
    const saved = markSaved([initial], initial.id, '/workspace/main.srp', '')[0];
    const changed = updateContent([saved], saved.id, 'print("changed");')[0];
    expect(() => runnableSource(changed)).toThrow('Save your latest edits');
  });
  it('accepts only a clean saved Scarp source file', () => {
    const initial = createUntitled(1);
    const saved = markSaved([initial], initial.id, '/workspace/main.SRP', '')[0];
    expect(runnableSource(saved)).toBe('/workspace/main.SRP');
    expect(() => runnableSource({ ...saved, path: '/workspace/main.rs' })).toThrow('.srp');
  });
});

describe('run snapshot after asynchronous compiler setup', () => {
  const source = {
    ...createUntitled(2),
    id: 'main-source',
    name: 'main.srp',
    path: 'C:\\Project\\main.srp',
    content: 'print(1);',
    savedContent: 'print(1);',
  };

  it('accepts the same saved active file after a delayed consent dialog', () => {
    const snapshot = captureRunSnapshot(source);
    expect(snapshot).toEqual({
      documentId: 'main-source',
      path: source.path,
      savedContent: source.savedContent,
    });
    expect(() => validateRunSnapshot(snapshot, { ...source })).not.toThrow();
  });

  it('rejects dirty buffers created while the compiler trust dialog is open', () => {
    const snapshot = captureRunSnapshot(source);
    expect(() => validateRunSnapshot(snapshot, {
      ...source, content: 'print(2);',
    })).toThrow('Save your latest edits');
  });

  it('rejects a different active tab even with identical source content', () => {
    const snapshot = captureRunSnapshot(source);
    expect(() => validateRunSnapshot(snapshot, {
      ...source, id: 'different-tab',
    })).toThrow('active source changed');
  });

  it('rejects a newly saved source with different contents', () => {
    const snapshot = captureRunSnapshot(source);
    expect(() => validateRunSnapshot(snapshot, {
      ...source, content: 'print(2);', savedContent: 'print(2);',
    })).toThrow('saved source changed');
  });

  it('rejects a Save As change or a closed tab', () => {
    const snapshot = captureRunSnapshot(source);
    expect(() => validateRunSnapshot(snapshot, {
      ...source, path: 'C:\\Project\\other.srp',
    })).toThrow('saved source changed');
    expect(() => validateRunSnapshot(snapshot, null)).toThrow('active source changed');
  });

  it('accepts the equivalent case or slash spelling of the Windows path', () => {
    const snapshot = captureRunSnapshot(source);
    expect(() => validateRunSnapshot(snapshot, {
      ...source, path: 'c:/project/MAIN.srp',
    })).not.toThrow();
  });
});
