import { describe, expect, it } from 'vitest';
import { exitBlockReason, saveBlockReason } from './exitGuards';

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


describe('manual file save and native compiler exclusion', () => {
  it('permits manual saves only when no compiler command or selection is active', () => {
    expect(saveBlockReason(false, false)).toBeNull();
  });

  it('blocks Save and Save As while Scarp Run/Verify is in progress', () => {
    expect(saveBlockReason(true, false)).toMatch(/running or verifying/);
  });

  it('blocks all manual writes while the compiler chooser or probe is pending', () => {
    expect(saveBlockReason(false, true)).toMatch(/compiler selection/);
  });

  it('takes the active execution lock over the selection lock', () => {
    expect(saveBlockReason(true, true)).toMatch(/running or verifying/);
  });
});
