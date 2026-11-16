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
  it('prioritizes save safety over other simultaneous operations', () => {
    expect(exitBlockReason(true, true, true)).toMatch(/being saved/);
  });
});
