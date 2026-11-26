/** A finite primitive schema shared by persistence, UI and Monaco. */
export const EDITOR_EXPERIENCE_CHOICES = {
  lineHeight: [0, 18, 20, 22, 24, 28, 32, 36, 40],
  letterSpacing: [0, 0.5, 1, 1.5, 2],
  fontLigatures: [false, true],
  cursorStyle: ['line', 'block', 'underline', 'line-thin', 'block-outline', 'underline-thin'],
  cursorBlinking: ['blink', 'smooth', 'phase', 'expand', 'solid'],
  cursorSmoothCaretAnimation: ['off', 'explicit', 'on'],
  renderControlCharacters: [false, true],
  folding: [true, false],
  showFoldingControls: ['mouseover', 'always', 'never'],
  matchBrackets: ['always', 'near', 'never'],
  rulerColumn: [0, 80, 100, 120],
  minimapSide: ['right', 'left'],
  minimapCharacters: [true, false],
  scrollBeyondLastLine: [false, true],
  mouseWheelZoom: [false, true],
  accessibilitySupport: ['auto', 'on'],
  insertSpaces: [true, false],
  autoClosingBrackets: ['languageDefined', 'never', 'always', 'beforeWhitespace'],
  autoClosingQuotes: ['languageDefined', 'never', 'always', 'beforeWhitespace'],
  autoSurround: ['languageDefined', 'never', 'quotes', 'brackets'],
  autoIndent: ['full', 'advanced', 'brackets', 'keep', 'none'],
  trimAutoWhitespace: [true, false],
  useTabStops: [true, false],
} as const;
export type EditorExperienceKey = keyof typeof EDITOR_EXPERIENCE_CHOICES;
export type EditorExperiencePreferences = { [K in EditorExperienceKey]: (typeof EDITOR_EXPERIENCE_CHOICES)[K][number] };
export const DEFAULT_EDITOR_EXPERIENCE: Readonly<EditorExperiencePreferences> = Object.freeze({
  lineHeight: 0, letterSpacing: 0, fontLigatures: false, cursorStyle: 'line', cursorBlinking: 'blink',
  cursorSmoothCaretAnimation: 'off', renderControlCharacters: false, folding: true,
  showFoldingControls: 'mouseover', matchBrackets: 'always', rulerColumn: 0, minimapSide: 'right',
  minimapCharacters: true, scrollBeyondLastLine: false, mouseWheelZoom: false, accessibilitySupport: 'auto',
  insertSpaces: true, autoClosingBrackets: 'languageDefined', autoClosingQuotes: 'languageDefined',
  autoSurround: 'languageDefined', autoIndent: 'full', trimAutoWhitespace: true, useTabStops: true,
});
export const EDITOR_EXPERIENCE_LABELS: Readonly<Record<EditorExperienceKey, string>> = Object.freeze({
  lineHeight: 'Line height', letterSpacing: 'Letter spacing', fontLigatures: 'Font ligatures',
  cursorStyle: 'Cursor shape', cursorBlinking: 'Cursor animation', cursorSmoothCaretAnimation: 'Smooth caret movement',
  renderControlCharacters: 'Show control characters', folding: 'Code folding', showFoldingControls: 'Folding controls',
  matchBrackets: 'Bracket matching', rulerColumn: 'Column ruler', minimapSide: 'Minimap side',
  minimapCharacters: 'Minimap characters', scrollBeyondLastLine: 'Scroll beyond last line', mouseWheelZoom: 'Ctrl+mouse wheel zoom',
  accessibilitySupport: 'Screen reader support', insertSpaces: 'Insert spaces instead of tabs',
  autoClosingBrackets: 'Automatically close brackets', autoClosingQuotes: 'Automatically close quotes',
  autoSurround: 'Automatically surround selection', autoIndent: 'Automatic indentation',
  trimAutoWhitespace: 'Trim automatically inserted whitespace', useTabStops: 'Use tab stops',
});
export const EXPERIENCE_GROUPS = ['Typography and caret', 'Navigation and overview', 'Accessibility and motion', 'Editing behavior'] as const;
type Group = (typeof EXPERIENCE_GROUPS)[number];
export const EXPERIENCE_INFO: Record<EditorExperienceKey, { group: Group; help: string }> = {
  lineHeight: { group: 'Typography and caret', help: 'Vertical line spacing; Auto follows the font.' },
  letterSpacing: { group: 'Typography and caret', help: 'Additional spacing between characters.' },
  fontLigatures: { group: 'Typography and caret', help: 'Use ligatures when supported by the selected font.' },
  cursorStyle: { group: 'Typography and caret', help: 'Visible caret shape.' },
  cursorBlinking: { group: 'Accessibility and motion', help: 'Solid disables caret blinking.' },
  cursorSmoothCaretAnimation: { group: 'Accessibility and motion', help: 'Control animation during caret movement.' },
  renderControlCharacters: { group: 'Accessibility and motion', help: 'Show normally invisible control characters.' },
  folding: { group: 'Navigation and overview', help: 'Enable Monaco folding; no compiler-derived ranges yet.' },
  showFoldingControls: { group: 'Navigation and overview', help: 'Show folding controls on hover, always, or never.' },
  matchBrackets: { group: 'Navigation and overview', help: 'Highlight matching brackets near the caret.' },
  rulerColumn: { group: 'Navigation and overview', help: 'Visual column guide, not a formatting rule.' },
  minimapSide: { group: 'Navigation and overview', help: 'Position the minimap when enabled.' },
  minimapCharacters: { group: 'Navigation and overview', help: 'Render miniature characters instead of blocks.' },
  scrollBeyondLastLine: { group: 'Navigation and overview', help: 'Allow extra empty space below the last source line.' },
  mouseWheelZoom: { group: 'Accessibility and motion', help: 'Allow Ctrl+mouse wheel font zoom.' },
  accessibilitySupport: { group: 'Accessibility and motion', help: 'Auto detection or explicitly enabled screen reader support.' },
  insertSpaces: { group: 'Editing behavior', help: 'Choose spaces or literal tabs for new indentation, not existing text.' },
  autoClosingBrackets: { group: 'Editing behavior', help: 'Choose when opening brackets insert closing brackets.' },
  autoClosingQuotes: { group: 'Editing behavior', help: 'Choose when typed quotes insert a closing quote.' },
  autoSurround: { group: 'Editing behavior', help: 'Choose whether typed quotes or brackets surround a selection.' },
  autoIndent: { group: 'Editing behavior', help: 'Automatic indentation policy for future typing.' },
  trimAutoWhitespace: { group: 'Editing behavior', help: 'Trim whitespace automatically inserted by Monaco.' },
  useTabStops: { group: 'Editing behavior', help: 'Use configured tab stops for insertion and deletion.' },
};
const keys = Object.keys(EDITOR_EXPERIENCE_CHOICES) as EditorExperienceKey[];
export function parseEditorExperience(value: unknown): EditorExperiencePreferences {
  const record = typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Object.fromEntries(keys.map(key => {
    const candidate = Object.hasOwn(record, key) ? record[key] : undefined;
    const choices: readonly unknown[] = EDITOR_EXPERIENCE_CHOICES[key];
    return [key, choices.includes(candidate) ? candidate : DEFAULT_EDITOR_EXPERIENCE[key]];
  })) as EditorExperiencePreferences;
}
export function editorExperienceOptions(p: Readonly<EditorExperiencePreferences>) {
  return {
    lineHeight: p.lineHeight, letterSpacing: p.letterSpacing, fontLigatures: p.fontLigatures,
    cursorStyle: p.cursorStyle, cursorBlinking: p.cursorBlinking, cursorSmoothCaretAnimation: p.cursorSmoothCaretAnimation,
    renderControlCharacters: p.renderControlCharacters, folding: p.folding, showFoldingControls: p.showFoldingControls,
    matchBrackets: p.matchBrackets, rulers: p.rulerColumn === 0 ? [] : [p.rulerColumn],
    scrollBeyondLastLine: p.scrollBeyondLastLine, mouseWheelZoom: p.mouseWheelZoom, accessibilitySupport: p.accessibilitySupport,
    insertSpaces: p.insertSpaces, autoClosingBrackets: p.autoClosingBrackets, autoClosingQuotes: p.autoClosingQuotes,
    autoSurround: p.autoSurround, autoIndent: p.autoIndent, trimAutoWhitespace: p.trimAutoWhitespace, useTabStops: p.useTabStops,
  };
}
export function experienceValueLabel(key: EditorExperienceKey, value: string | number | boolean): string {
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (key === 'lineHeight') return value === 0 ? 'Auto' : value + ' px';
  if (key === 'letterSpacing') return value + ' px';
  if (key === 'rulerColumn') return value === 0 ? 'Off' : 'Column ' + value;
  const labels: Record<string, string> = { languageDefined: 'Language defined', beforeWhitespace: 'Before whitespace', mouseover: 'On hover',
    'line-thin': 'Thin line', 'block-outline': 'Block outline', 'underline-thin': 'Thin underline' };
  const text = String(value);
  return labels[text] ?? text.charAt(0).toUpperCase() + text.slice(1);
}
export function matchEditorExperience(p: Readonly<EditorExperiencePreferences>, query: string, modifiedOnly: boolean): EditorExperienceKey[] {
  const terms = query.slice(0, 120).toLowerCase().trim().split(/\s+/).filter(Boolean);
  return keys.filter(key => {
    if (modifiedOnly && p[key] === DEFAULT_EDITOR_EXPERIENCE[key]) return false;
    const info = EXPERIENCE_INFO[key];
    const text = [EDITOR_EXPERIENCE_LABELS[key], info.help, info.group, key].join(' ').toLowerCase();
    return terms.every(term => text.includes(term));
  });
}
export function editorExperiencePatch<K extends EditorExperienceKey>(key: K, candidate: unknown): Pick<EditorExperiencePreferences, K> | null {
  const choices: readonly unknown[] = EDITOR_EXPERIENCE_CHOICES[key];
  return choices.includes(candidate) ? { [key]: candidate } as Pick<EditorExperiencePreferences, K> : null;
}
export function accessibilityExperiencePatch(): Partial<EditorExperiencePreferences> {
  return { cursorBlinking: 'solid', cursorSmoothCaretAnimation: 'off', renderControlCharacters: true,
    accessibilitySupport: 'on', lineHeight: 28, letterSpacing: 0.5 };
}
