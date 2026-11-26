export const THEME_MODES = ['dark', 'light', 'system'] as const;
export const CONTRAST_MODES = ['normal', 'high', 'system'] as const;
export const MOTION_MODES = ['normal', 'reduced', 'system'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];
export type ContrastMode = (typeof CONTRAST_MODES)[number];
export type MotionMode = (typeof MOTION_MODES)[number];
export interface AppearancePreferences { theme: ThemeMode; contrast: ContrastMode; motion: MotionMode }
export const APPEARANCE_STORAGE_KEY = 'studio.appearance.v1';
export const DEFAULT_APPEARANCE: Readonly<AppearancePreferences> = Object.freeze({ theme: 'dark', contrast: 'normal', motion: 'system' });
export interface SystemAppearance { dark: boolean; highContrast: boolean; reducedMotion: boolean }
export interface ResolvedAppearance {
  theme: 'dark' | 'light';
  highContrast: boolean;
  reducedMotion: boolean;
  monacoTheme: 'vs' | 'vs-dark' | 'hc-black' | 'hc-light';
}
export function parseAppearanceRecord(value: unknown, legacyTheme: string | null = null): AppearancePreferences {
  const record = typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const own = (key: string) => Object.hasOwn(record, key) ? record[key] : undefined;
  return {
    theme: THEME_MODES.find(mode => mode === own('theme')) ?? (legacyTheme === 'light' ? 'light' : 'dark'),
    contrast: CONTRAST_MODES.find(mode => mode === own('contrast')) ?? DEFAULT_APPEARANCE.contrast,
    motion: MOTION_MODES.find(mode => mode === own('motion')) ?? DEFAULT_APPEARANCE.motion,
  };
}
export function parseAppearance(raw: string | null, legacyTheme: string | null): AppearancePreferences {
  if (!raw || raw.length > 1024) return parseAppearanceRecord(null, legacyTheme);
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, 'version') || (value as { version: unknown }).version !== 1) return parseAppearanceRecord(null, legacyTheme);
    return parseAppearanceRecord(value, legacyTheme);
  } catch { return parseAppearanceRecord(null, legacyTheme); }
}
export function loadAppearance(): AppearancePreferences {
  try { return parseAppearance(localStorage.getItem(APPEARANCE_STORAGE_KEY), localStorage.getItem('studio.theme')); }
  catch { return { ...DEFAULT_APPEARANCE }; }
}
export function persistAppearance(p: AppearancePreferences): void {
  try {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({ version: 1, ...parseAppearanceRecord(p) }));
    // Retain compatibility with the old explicit theme key on downgrade.
    if (p.theme !== 'system') localStorage.setItem('studio.theme', p.theme);
  } catch { /* preferences remain active in memory */ }
}
export function resolveAppearance(p: Readonly<AppearancePreferences>, system: Readonly<SystemAppearance>): ResolvedAppearance {
  const theme = p.theme === 'system' ? system.dark ? 'dark' : 'light' : p.theme;
  const highContrast = p.contrast === 'high' || p.contrast === 'system' && system.highContrast;
  const reducedMotion = p.motion === 'reduced' || p.motion === 'system' && system.reducedMotion;
  return { theme, highContrast, reducedMotion,
    monacoTheme: highContrast ? theme === 'dark' ? 'hc-black' : 'hc-light' : theme === 'dark' ? 'vs-dark' : 'vs' };
}
const media = {
  dark: '(prefers-color-scheme: dark)', contrast: '(prefers-contrast: more)',
  forcedColors: '(forced-colors: active)', reducedMotion: '(prefers-reduced-motion: reduce)',
} as const;
type MatchMedia = (query: string) => MediaQueryList;
function getMatchMedia(): MatchMedia | null {
  try { return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : null; }
  catch { return null; }
}
export function readSystemAppearance(match = getMatchMedia()): SystemAppearance {
  if (!match) return { dark: true, highContrast: false, reducedMotion: false };
  const matches = (query: string) => { try { return match(query).matches; } catch { return false; } };
  return { dark: matches(media.dark), highContrast: matches(media.contrast) || matches(media.forcedColors), reducedMotion: matches(media.reducedMotion) };
}
export function subscribeSystemAppearance(listener: (value: SystemAppearance) => void, match = getMatchMedia()): () => void {
  if (!match) return () => {};
  const lists: MediaQueryList[] = [];
  const refresh = () => listener(readSystemAppearance(match));
  for (const query of Object.values(media)) {
    try { const list = match(query); list.addEventListener('change', refresh); lists.push(list); } catch { /* unsupported media query */ }
  }
  refresh();
  return () => { for (const list of lists) list.removeEventListener('change', refresh); };
}
export function reducedMotionEditorOptions(resolved: ResolvedAppearance) {
  return resolved.reducedMotion ? { smoothScrolling: false, cursorSmoothCaretAnimation: 'off' as const, cursorBlinking: 'solid' as const } : {};
}
