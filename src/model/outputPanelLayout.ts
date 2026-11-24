export type OutputPanelMode = 'collapsed' | 'normal' | 'expanded';
export type OutputPanelAction = 'toggle' | 'expand';

/** Presentation only: no execution or input state is changed by resizing. */
export function nextOutputPanelMode(mode: OutputPanelMode, action: OutputPanelAction): OutputPanelMode {
  if (action === 'toggle') return mode === 'collapsed' ? 'normal' : 'collapsed';
  return mode === 'expanded' ? 'normal' : 'expanded';
}

/** Explicit Run/Verify/Project actions reveal hidden results but never
 * shrink a panel the user has deliberately expanded. */
export function revealOutputPanel(mode: OutputPanelMode): OutputPanelMode {
  return mode === 'collapsed' ? 'normal' : mode;
}
