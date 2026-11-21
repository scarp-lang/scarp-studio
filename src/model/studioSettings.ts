import { isDirty, type StudioDocument } from './documents';

export type StudioTheme = 'dark' | 'light';
export type AutoSaveDelay = 1000 | 3000 | 5000;
export type EditorFontSize = 12 | 14 | 16 | 18 | 20;

export interface StudioSettings {
  theme: StudioTheme;
  autoSave: boolean;
  autoSaveDelay: AutoSaveDelay;
  fontSize: EditorFontSize;
  wordWrap: boolean;
  minimap: boolean;
}

export const SETTINGS_STORAGE_KEY = 'studio.settings.v1';
export const defaultStudioSettings: StudioSettings = {
  theme: 'dark',
  autoSave: false,
  autoSaveDelay: 3000,
  fontSize: 14,
  wordWrap: true,
  minimap: false,
};

const delays: readonly number[] = [1000, 3000, 5000];
const sizes: readonly number[] = [12, 14, 16, 18, 20];

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
    wordWrap: typeof candidate.wordWrap === 'boolean' ? candidate.wordWrap : true,
    minimap: typeof candidate.minimap === 'boolean' ? candidate.minimap : false,
  };
}

export function loadStudioSettings(): StudioSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored !== null) return normalizeStudioSettings(JSON.parse(stored) as unknown);
    // Migrate the editor-only alpha's theme setting, if present.
    return { ...defaultStudioSettings,
      theme: localStorage.getItem('studio.theme') === 'light' ? 'light' : 'dark',
    };
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
