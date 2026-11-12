/** Local-only display choices; these never change the contents of .srp files. */
export const FONT_SIZES = [12, 14, 16, 18, 20, 22, 24] as const;
export const TAB_SIZES = [2, 4, 8] as const;

export interface EditorPreferences {
  fontSize: (typeof FONT_SIZES)[number];
  tabSize: (typeof TAB_SIZES)[number];
  wordWrap: boolean;
}

export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  fontSize: 14,
  tabSize: 4,
  wordWrap: true,
};

/** Persisted settings are untrusted and may be stale or malformed. */
export function parseEditorPreferences(stored: string | null): EditorPreferences {
  if (!stored) return { ...DEFAULT_EDITOR_PREFERENCES };
  try {
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ...DEFAULT_EDITOR_PREFERENCES };
    }
    const value = parsed as Record<string, unknown>;
    return {
      fontSize: FONT_SIZES.find((size) => size === value.fontSize) ??
        DEFAULT_EDITOR_PREFERENCES.fontSize,
      tabSize: TAB_SIZES.find((size) => size === value.tabSize) ??
        DEFAULT_EDITOR_PREFERENCES.tabSize,
      wordWrap: typeof value.wordWrap === 'boolean'
        ? value.wordWrap : DEFAULT_EDITOR_PREFERENCES.wordWrap,
    };
  } catch {
    return { ...DEFAULT_EDITOR_PREFERENCES };
  }
}
