import { THEME_MODES, CONTRAST_MODES, MOTION_MODES, resolveAppearance, type AppearancePreferences, type ResolvedAppearance } from '../model/studioAppearance';
interface Props { preferences: Readonly<AppearancePreferences>; resolved?: ResolvedAppearance; onChange: (patch: Partial<AppearancePreferences>) => void }
export function AppearanceSettings({ preferences: p, resolved, onChange }: Props) {
  const effective = resolved ?? resolveAppearance(p, { dark: true, highContrast: false, reducedMotion: false });
  return <section className="appearance-settings" aria-label="Studio appearance preferences">
    <p>Choose explicit or system-following appearance. The toolbar theme toggle selects an explicit light or dark theme.</p>
    <div className="settings-control-row">
      <label htmlFor="studio-theme">Color theme</label>
      <select id="studio-theme" value={p.theme} onChange={event => {
        const value = THEME_MODES.find(item => item === event.target.value); if (value) onChange({ theme: value });
      }}><option value="dark">Dark (default)</option><option value="light">Light</option><option value="system">Follow system</option></select>
    </div>
    <div className="settings-control-row">
      <label htmlFor="studio-contrast">Contrast preference</label>
      <select id="studio-contrast" value={p.contrast} onChange={event => {
        const value = CONTRAST_MODES.find(item => item === event.target.value); if (value) onChange({ contrast: value });
      }}><option value="normal">Normal</option><option value="high">High contrast</option><option value="system">Follow system</option></select>
    </div>
    <div className="settings-control-row">
      <label htmlFor="studio-motion">Motion preference</label>
      <select id="studio-motion" value={p.motion} onChange={event => {
        const value = MOTION_MODES.find(item => item === event.target.value); if (value) onChange({ motion: value });
      }}><option value="normal">Normal</option><option value="reduced">Reduced motion</option><option value="system">Follow system (default)</option></select>
    </div>
    <p role="status">Effective: {effective.theme} · {effective.highContrast ? 'high contrast' : 'normal contrast'} · {effective.reducedMotion ? 'reduced motion' : 'normal motion'}</p>
    <div className="appearance-swatch" aria-label="Current interface color samples">
      <span style={{ background: 'var(--bg)', color: 'var(--text)' }}>Editor</span>
      <span style={{ background: 'var(--surface)', color: 'var(--text)' }}>Panel</span>
      <span style={{ background: 'var(--raised)', color: 'var(--accent)' }}>Accent</span>
    </div>
    <p>Reduced motion temporarily overrides smooth scrolling and caret animation without changing saved editor settings. System changes do not alter the saved preference.</p>
  </section>;
}
