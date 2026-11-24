import { describe, expect, it } from 'vitest';
import { createUntitled, markSaved, updateContent } from './documents';
import { runnableSource, compilerActionBlock, compilerActionHint, type CompilerActionState } from './compilerReadiness';

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

describe('compiler action availability and guidance', () => {
  const untitled = createUntitled(1);
  const saved = markSaved([untitled], untitled.id, 'C:/project/main.srp', '')[0];
  const dirty = updateContent([saved], saved.id, 'print(1);')[0];
  const ready: CompilerActionState = { native: true, busy: false, source: saved, inputError: null };

  it('explains empty, unsaved, dirty and wrong-extension states consistently', () => {
    for (const mode of ['exec', 'verify'] as const) {
      expect(compilerActionBlock({ ...ready, source: null }, mode)).toBe('no-source');
      expect(compilerActionBlock({ ...ready, source: untitled }, mode)).toBe('unsaved');
      expect(compilerActionBlock({ ...ready, source: dirty }, mode)).toBe('dirty');
      expect(compilerActionBlock({ ...ready, source: { ...saved, path: 'C:/main.rs' } }, mode)).toBe('unsaved');
      expect(compilerActionBlock(ready, mode)).toBeNull();
    }
  });
  it('preserves static Verify when only preloaded Run input is invalid', () => {
    const state = { ...ready, inputError: 'Invalid input' };
    expect(compilerActionBlock(state, 'exec')).toBe('invalid-input');
    expect(compilerActionBlock(state, 'verify')).toBeNull();
    expect(compilerActionHint('invalid-input', state.inputError)).toBe('Invalid input');
  });
  it('prioritizes desktop and busy guards and supplies actionable save hints', () => {
    expect(compilerActionBlock({ ...ready, native: false, busy: true }, 'exec')).toBe('desktop');
    expect(compilerActionBlock({ ...ready, busy: true, source: null }, 'verify')).toBe('busy');
    expect(compilerActionHint('dirty', null)).toContain('Ctrl+S');
    expect(compilerActionHint(null, null)).toBeNull();
  });
});
