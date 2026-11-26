/** Local-only display choices; these never change the contents of .srp files. */
export const FONT_SIZES = [12, 14, 16, 18, 20, 22, 24] as const;
export const TAB_SIZES = [2, 4, 8] as const;
export const EDITOR_FONTS = {
  consolas: 'Consolas, monospace',
  cascadiacode: '"Cascadia Code", Consolas, monospace',
  monospace: 'monospace',
} as const;
export type EditorFont = keyof typeof EDITOR_FONTS;
export const MAX_EDITOR_PREFERENCES_UNITS = 8192;

export interface EditorPreferences {
  fontSize: (typeof FONT_SIZES)[number];
  tabSize: (typeof TAB_SIZES)[number];
  wordWrap: boolean;
  minimap: boolean;
  showWhitespace: boolean;
  font: EditorFont;
  lineNumbers: boolean;
  highlightActiveLine: boolean;
  indentationGuides: boolean;
  bracketColors: boolean;
  smoothScrolling: boolean;
}

export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  fontSize: 14,
  tabSize: 4,
  wordWrap: true,
  minimap: false,
  showWhitespace: false,
  font: 'consolas',
  lineNumbers: true,
  highlightActiveLine: true,
  indentationGuides: true,
  bracketColors: true,
  smoothScrolling: false,
};

/** Persisted settings are untrusted and may be stale or malformed. */
export function parseEditorPreferences(stored: string | null): EditorPreferences {
  if (!stored || stored.length > MAX_EDITOR_PREFERENCES_UNITS) return { ...DEFAULT_EDITOR_PREFERENCES };
  try {
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ...DEFAULT_EDITOR_PREFERENCES };
    }
    const value = parsed as Record<string, unknown>;
    const boolean = (key: 'lineNumbers' | 'highlightActiveLine' | 'indentationGuides' |
      'bracketColors' | 'smoothScrolling'): boolean =>
      typeof value[key] === 'boolean' ? value[key] : DEFAULT_EDITOR_PREFERENCES[key];
    return {
      fontSize: FONT_SIZES.find((size) => size === value.fontSize) ??
        DEFAULT_EDITOR_PREFERENCES.fontSize,
      tabSize: TAB_SIZES.find((size) => size === value.tabSize) ??
        DEFAULT_EDITOR_PREFERENCES.tabSize,
      wordWrap: typeof value.wordWrap === 'boolean'
        ? value.wordWrap : DEFAULT_EDITOR_PREFERENCES.wordWrap,
      minimap: typeof value.minimap === 'boolean'
        ? value.minimap : DEFAULT_EDITOR_PREFERENCES.minimap,
      showWhitespace: typeof value.showWhitespace === 'boolean'
        ? value.showWhitespace : DEFAULT_EDITOR_PREFERENCES.showWhitespace,
      font: typeof value.font === 'string' && Object.hasOwn(EDITOR_FONTS, value.font)
        ? value.font as EditorFont : DEFAULT_EDITOR_PREFERENCES.font,
      lineNumbers: boolean('lineNumbers'),
      highlightActiveLine: boolean('highlightActiveLine'),
      indentationGuides: boolean('indentationGuides'),
      bracketColors: boolean('bracketColors'),
      smoothScrolling: boolean('smoothScrolling'),
    };
  } catch {
    return { ...DEFAULT_EDITOR_PREFERENCES };
  }
}

/** One mapping for all Monaco display options. No source writes or model edits. */
export function editorDisplayOptions(preferences: EditorPreferences) {
  return {
    automaticLayout: true,
    fontSize: preferences.fontSize,
    fontFamily: EDITOR_FONTS[preferences.font],
    minimap: { enabled: preferences.minimap },
    scrollBeyondLastLine: false,
    renderWhitespace: preferences.showWhitespace ? 'all' as const : 'none' as const,
    tabSize: preferences.tabSize,
    wordWrap: preferences.wordWrap ? 'on' as const : 'off' as const,
    detectIndentation: false,
    lineNumbers: preferences.lineNumbers ? 'on' as const : 'off' as const,
    renderLineHighlight: preferences.highlightActiveLine ? 'line' as const : 'none' as const,
    guides: { indentation: preferences.indentationGuides },
    bracketPairColorization: { enabled: preferences.bracketColors },
    smoothScrolling: preferences.smoothScrolling,
  };
}
