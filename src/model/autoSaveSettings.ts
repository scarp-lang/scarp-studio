import { isDirty, isScarpPath, type StudioDocument } from './documents';

export type AutoSaveDelay = 1000 | 3000 | 5000;
export interface AutoSavePreferences {
  enabled: boolean;
  delay: AutoSaveDelay;
}

export const AUTO_SAVE_STORAGE_KEY = 'studio.autoSave.v1';
export const DEFAULT_AUTO_SAVE: AutoSavePreferences = {
  enabled: false,
  delay: 3000,
};
const delays: readonly number[] = [1000, 3000, 5000];

/** Persisted settings are untrusted. Auto Save is opt-in and off by default. */
export function parseAutoSavePreferences(stored: string | null): AutoSavePreferences {
  if (!stored) return { ...DEFAULT_AUTO_SAVE };
  try {
    const value: unknown = JSON.parse(stored);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return { ...DEFAULT_AUTO_SAVE };
    }
    const record = value as Record<string, unknown>;
    return {
      enabled: record.enabled === true,
      delay: delays.includes(record.delay as number)
        ? record.delay as AutoSaveDelay : DEFAULT_AUTO_SAVE.delay,
    };
  } catch {
    return { ...DEFAULT_AUTO_SAVE };
  }
}

export function loadAutoSavePreferences(): AutoSavePreferences {
  try {
    return parseAutoSavePreferences(localStorage.getItem(AUTO_SAVE_STORAGE_KEY));
  } catch {
    return { ...DEFAULT_AUTO_SAVE };
  }
}

export function persistAutoSavePreferences(settings: AutoSavePreferences): void {
  try {
    localStorage.setItem(AUTO_SAVE_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Browsers with disabled storage still support session-only settings.
  }
}

/** Never launch Save As automatically or write unnamed/non-Scarp buffers. */
export function canAutoSave(document: StudioDocument): boolean {
  return document.path !== null && isScarpPath(document.path) && isDirty(document);
}
