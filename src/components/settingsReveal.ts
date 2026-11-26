import { createContext, useContext, useEffect, useRef } from 'react';
import type { SettingsGroup } from '../model/settingsSearch';
export interface SettingsRevealRequest { readonly id: string; readonly group: SettingsGroup; readonly sequence: number }
export const SettingsRevealContext = createContext<SettingsRevealRequest | null>(null);

/** IDs originate solely in the static Settings index. Scope queries to the
 * current Settings panel, never navigate to another page or trigger actions. */
export function focusSettingsTarget(panel: HTMLElement, id: string, fallback?: string): boolean {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return false;
  const target = panel.querySelector<HTMLElement>('#' + id);
  const candidate = target && !target.closest('[hidden]') && !target.matches(':disabled') ? target :
    fallback ? panel.querySelector<HTMLElement>('#' + fallback) : null;
  if (!candidate || candidate.closest('[hidden]')) return false;
  for (const previous of panel.querySelectorAll('[data-settings-revealed]')) previous.removeAttribute('data-settings-revealed');
  candidate.setAttribute('data-settings-revealed', 'true');
  candidate.focus({ preventScroll: true });
  candidate.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
  return true;
}
/** Advanced subpanels own their collapsed/filter state. Reveal first, then
 * focus on the next animation frame after React commits the controls. */
export function useSettingsReveal(group: SettingsGroup, prepare: () => void): void {
  const request = useContext(SettingsRevealContext);
  const latest = useRef(prepare);
  latest.current = prepare;
  useEffect(() => {
    if (!request || request.group !== group || typeof document === 'undefined') return;
    const nested = group === 'editor' ? request.id.startsWith('editor-experience-') :
      group === 'intellisense' ? request.id.startsWith('intellisense-') :
        group === 'shortcuts' && request.id.startsWith('studio-shortcut-');
    if (!nested) return;
    latest.current();
    let retry = 0;
    let frame = 0;
    const focus = () => {
      const panel = document.getElementById('editor-settings');
      if (!panel) return;
      if (focusSettingsTarget(panel, request.id)) return;
      if (retry++ < 2) frame = requestAnimationFrame(focus);
      else focusSettingsTarget(panel, request.id, 'settings-category-' + group);
    };
    frame = requestAnimationFrame(focus);
    return () => cancelAnimationFrame(frame);
  }, [request, group]);
}
