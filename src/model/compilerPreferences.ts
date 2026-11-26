/** Persist discovery preference only, never executable paths or approval. */
export interface CompilerPreferences { scanOnStartup: boolean }
export const COMPILER_PREFERENCES_KEY = 'studio.compilerPreferences.v1';
export const DEFAULT_COMPILER_PREFERENCES: CompilerPreferences = { scanOnStartup: true };
export const MAX_COMPILER_PREFERENCES_UNITS = 1024;

export function parseCompilerPreferences(raw: string | null): CompilerPreferences {
  if (!raw || raw.length > MAX_COMPILER_PREFERENCES_UNITS) return { ...DEFAULT_COMPILER_PREFERENCES };
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return { ...DEFAULT_COMPILER_PREFERENCES };
    const record = value as Record<string, unknown>;
    return { scanOnStartup: typeof record.scanOnStartup === 'boolean'
      ? record.scanOnStartup : DEFAULT_COMPILER_PREFERENCES.scanOnStartup };
  } catch { return { ...DEFAULT_COMPILER_PREFERENCES }; }
}
export function serializeCompilerPreferences(value: CompilerPreferences): string {
  return JSON.stringify({ scanOnStartup: value.scanOnStartup !== false });
}
export function loadCompilerPreferences(): CompilerPreferences {
  try { return parseCompilerPreferences(localStorage.getItem(COMPILER_PREFERENCES_KEY)); }
  catch { return { ...DEFAULT_COMPILER_PREFERENCES }; }
}
export function persistCompilerPreferences(value: CompilerPreferences): void {
  try { localStorage.setItem(COMPILER_PREFERENCES_KEY, serializeCompilerPreferences(value)); }
  catch { /* session-only fallback */ }
}
