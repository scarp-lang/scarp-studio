import { describe, expect, it } from 'vitest';
import { createUntitled, markSaved, updateContent } from './documents';
import { runnableSource } from './compilerReadiness';

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
