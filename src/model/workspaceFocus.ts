import type { OutputPanelMode } from './outputPanelLayout';

export interface WorkspaceVisibility {
  explorerVisible: boolean;
  outputPanelMode: OutputPanelMode;
}

/** Focus mode is a temporary display projection. It never overwrites the
 * user's previous visibility, panel size, source or compiler state.
 * The compiler header remains present even when its body is collapsed. */
export function effectiveWorkspaceVisibility(preferred: WorkspaceVisibility, focusMode: boolean): WorkspaceVisibility {
  return focusMode ? { explorerVisible: false, outputPanelMode: 'collapsed' } : preferred;
}
