import { describe, expect, it } from 'vitest';
import { effectiveWorkspaceVisibility, type WorkspaceVisibility } from './workspaceFocus';

describe('temporary workspace focus projection', () => {
  it('hides Explorer and collapses only the output body in focus mode', () => {
    const preferred: WorkspaceVisibility = { explorerVisible: true, outputPanelMode: 'expanded' };
    expect(effectiveWorkspaceVisibility(preferred, true)).toEqual({ explorerVisible: false, outputPanelMode: 'collapsed' });
    expect(preferred).toEqual({ explorerVisible: true, outputPanelMode: 'expanded' });
  });
  it('restores all previous visibility combinations without mutating them', () => {
    for (const explorerVisible of [true, false]) {
      for (const outputPanelMode of ['collapsed', 'normal', 'expanded'] as const) {
        const preferred = { explorerVisible, outputPanelMode };
        expect(effectiveWorkspaceVisibility(preferred, false)).toEqual(preferred);
      }
    }
  });
});
