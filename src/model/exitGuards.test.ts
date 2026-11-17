import { describe, expect, it } from 'vitest';
import { exitBlockReason } from './exitGuards';

describe('safe native window close guards', () => {
  it('permits exit when no file or compiler operation is active', () => {
    expect(exitBlockReason(false, false, false)).toBeNull();
  });
  it('blocks closing while an executable is running', () => {
    expect(exitBlockReason(false, true, false)).toMatch(/Stop it/);
  });
  it('blocks closing during an in-flight file save', () => {
    expect(exitBlockReason(true, false, false)).toMatch(/being saved/);
  });
  it('blocks closing while the selected compiler is being probed', () => {
    expect(exitBlockReason(false, false, true)).toMatch(/selecting/);
  });
  it('blocks exit during a native source or project-folder picker', () => {
    expect(exitBlockReason(false, false, false, true)).toMatch(/source or folder/);
    expect(exitBlockReason(false, false, false, false)).toBeNull();
  });
  it('gives executing and save operations priority over source picker state', () => {
    expect(exitBlockReason(true, false, false, true)).toMatch(/being saved/);
    expect(exitBlockReason(false, true, false, true)).toMatch(/Stop it/);
  });
  it('prioritizes save safety over other simultaneous operations', () => {
    expect(exitBlockReason(true, true, true)).toMatch(/being saved/);
  });
});
