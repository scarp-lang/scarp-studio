import { describe, expect, it } from 'vitest';
import { nextOutputPanelMode, revealOutputPanel, type OutputPanelMode } from './outputPanelLayout';

describe('compiler output panel layout', () => {
  it('toggles collapsed and normal modes without retaining stale expansion', () => {
    expect(nextOutputPanelMode('normal', 'toggle')).toBe('collapsed');
    expect(nextOutputPanelMode('expanded', 'toggle')).toBe('collapsed');
    expect(nextOutputPanelMode('collapsed', 'toggle')).toBe('normal');
  });
  it('expands and restores output independently of its contents', () => {
    expect(nextOutputPanelMode('normal', 'expand')).toBe('expanded');
    expect(nextOutputPanelMode('expanded', 'expand')).toBe('normal');
    expect(nextOutputPanelMode('collapsed', 'expand')).toBe('expanded');
  });
  it('reveals collapsed output for explicit actions without shrinking expanded output', () => {
    const modes: OutputPanelMode[] = ['collapsed', 'normal', 'expanded'];
    expect(modes.map(revealOutputPanel)).toEqual(['normal', 'normal', 'expanded']);
  });
});
