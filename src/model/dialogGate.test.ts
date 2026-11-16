import { describe, expect, it } from 'vitest';
import { NativeDialogGate } from './dialogGate';

describe('NativeDialogGate', () => {
  it('rejects duplicate tab-close requests until the active one finishes', () => {
    const gate = new NativeDialogGate();
    expect(gate.begin('tab-close')).toBe(true);
    expect(gate.isActive).toBe(true);
    expect(gate.begin('tab-close')).toBe(false);
    gate.finish('tab-close');
    expect(gate.isActive).toBe(false);
    expect(gate.begin('tab-close')).toBe(true);
  });

  it('prevents tab-close and window-exit confirmations from overlapping', () => {
    const gate = new NativeDialogGate();
    expect(gate.begin('window-exit')).toBe(true);
    expect(gate.begin('tab-close')).toBe(false);
    gate.finish('window-exit');
    expect(gate.begin('tab-close')).toBe(true);
    expect(gate.begin('window-exit')).toBe(false);
  });

  it('does not allow the wrong confirmation owner to release the gate', () => {
    const gate = new NativeDialogGate();
    expect(gate.begin('tab-close')).toBe(true);
    gate.finish('window-exit');
    expect(gate.isActive).toBe(true);
    expect(gate.begin('window-exit')).toBe(false);
    gate.finish('tab-close');
    expect(gate.begin('window-exit')).toBe(true);
  });
});
