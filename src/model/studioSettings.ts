import { isDirty, type StudioDocument } from './documents';

export type StudioTheme = 'dark' | 'light';
export type AutoSaveDelay = 1000 | 3000 | 5000;
export type EditorFontSize = 12 | 14 | 16 | 18 | 20 | 22 | 24;
export type EditorTabSize = 2 | 4 | 8;

export interface StudioSettings {
  theme: StudioTheme;
  autoSave: boolean;
  autoSaveDelay: AutoSaveDelay;
  fontSize: EditorFontSize;
  tabSize: EditorTabSize;
  wordWrap: boolean;
  minimap: boolean;
}

export const SETTINGS_STORAGE_KEY = 'studio.settings.v1';
export const defaultStudioSettings: StudioSettings = {
  theme: 'dark',
  autoSave: false,
  autoSaveDelay: 3000,
  fontSize: 14,
  tabSize: 4,
  wordWrap: true,
  minimap: false,
};

const delays: readonly number[] = [1000, 3000, 5000];
const sizes: readonly number[] = [12, 14, 16, 18, 20, 22, 24];
const tabs: readonly number[] = [2, 4, 8];

/** Treat local settings as untrusted: ignore unsupported or corrupted values. */
export function normalizeStudioSettings(value: unknown): StudioSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...defaultStudioSettings };
  }
  const candidate = value as Partial<Record<keyof StudioSettings, unknown>>;
  return {
    theme: candidate.theme === 'light' ? 'light' : 'dark',
    autoSave: typeof candidate.autoSave === 'boolean' ? candidate.autoSave : false,
    autoSaveDelay: delays.includes(candidate.autoSaveDelay as number)
      ? candidate.autoSaveDelay as AutoSaveDelay : 3000,
    fontSize: sizes.includes(candidate.fontSize as number)
      ? candidate.fontSize as EditorFontSize : 14,
    tabSize: tabs.includes(candidate.tabSize as number)
      ? candidate.tabSize as EditorTabSize : 4,
    wordWrap: typeof candidate.wordWrap === 'boolean' ? candidate.wordWrap : true,
    minimap: typeof candidate.minimap === 'boolean' ? candidate.minimap : false,
  };
}

/** Safely migrate previously shipped editor preferences without enabling Auto Save. */
export function loadStudioSettings(): StudioSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    let value: StudioSettings = { ...defaultStudioSettings };
    let hasNewSettings = false;
    let hasNewTabSize = false;
    if (stored !== null) {
      const parsed: unknown = JSON.parse(stored);
      value = normalizeStudioSettings(parsed);
      hasNewSettings = true;
      hasNewTabSize = parsed !== null && typeof parsed === 'object' &&
        !Array.isArray(parsed) && Object.hasOwn(parsed, 'tabSize');
    } else {
      value.theme = localStorage.getItem('studio.theme') === 'light' ? 'light' : 'dark';
    }
    const old = localStorage.getItem('studio.editorPreferences');
    if (old) {
      try {
        const parsed: unknown = JSON.parse(old);
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const legacy = parsed as Record<string, unknown>;
          if (!hasNewSettings) {
            if (sizes.includes(legacy.fontSize as number)) value.fontSize = legacy.fontSize as EditorFontSize;
            if (typeof legacy.wordWrap === 'boolean') value.wordWrap = legacy.wordWrap;
          }
          if (!hasNewTabSize && tabs.includes(legacy.tabSize as number)) {
            value.tabSize = legacy.tabSize as EditorTabSize;
          }
        }
      } catch { /* Old preferences may be malformed; retain safe defaults. */ }
    }
    return value;
  } catch {
    return { ...defaultStudioSettings };
  }
}

export function storeStudioSettings(settings: StudioSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage may be unavailable; the current session remains usable.
  }
}

/** Auto Save must never prompt for a filename or overwrite an unsaved document. */
export function canAutoSave(document: StudioDocument): boolean {
  return document.path !== null && /\.srp$/i.test(document.path) && isDirty(document);
}
