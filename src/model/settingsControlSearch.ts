import { SETTINGS_GROUPS, MAX_SETTINGS_QUERY_UNITS, matchingSettingsGroups, type SettingsGroup } from './settingsSearch';
import { EDITOR_EXPERIENCE_LABELS, EXPERIENCE_INFO, type EditorExperienceKey } from './editorExperience';
import { INTELLISENSE_CONTROL_INDEX } from './intelliSenseSettingsIndex';
import { SHORTCUT_COMMANDS } from './studioShortcuts';
import type { IntelliSensePreferences } from './intelliSensePreferences';

export interface SettingsSearchEntry { readonly id: string; readonly label: string; readonly group: SettingsGroup; readonly target: string; readonly aliases: string }
const base = (id: string, label: string, group: SettingsGroup, target: string, aliases = ''): SettingsSearchEntry =>
  Object.freeze({ id, label, group, target, aliases });
const basic: SettingsSearchEntry[] = [
  base('theme', 'Color theme', 'appearance', 'studio-theme', 'dark light system appearance'),
  base('contrast', 'Contrast preference', 'appearance', 'studio-contrast', 'high contrast system forced colors'),
  base('motion', 'Motion preference', 'appearance', 'studio-motion', 'reduced animation system accessibility'),
  base('font', 'Font family', 'editor', 'editor-font-family', 'consolas cascadia monospace'),
  base('fontSize', 'Font size', 'editor', 'editor-font-size', 'text size pixels'),
  base('tabSize', 'Tab width', 'editor', 'editor-tab-size', 'indentation size'),
  base('wordWrap', 'Wrap long lines', 'editor', 'editor-word-wrap', 'word wrap'),
  base('minimap', 'Show code minimap', 'editor', 'editor-minimap', 'overview'),
  base('showWhitespace', 'Show spaces and tabs', 'editor', 'editor-whitespace', 'whitespace invisible'),
  base('lineNumbers', 'Show line numbers', 'editor', 'editor-line-numbers'),
  base('highlightActiveLine', 'Highlight active line', 'editor', 'editor-highlight-line'),
  base('indentationGuides', 'Indentation guides', 'editor', 'editor-indent-guides'),
  base('bracketColors', 'Color matching bracket pairs', 'editor', 'editor-bracket-colors'),
  base('smoothScrolling', 'Smooth scrolling', 'editor', 'editor-smooth-scroll'),
  base('autoSave', 'Auto Save', 'files', 'studio-auto-save', 'autosave named files disk automatic'),
  base('autoSaveDelay', 'Auto Save delay', 'files', 'studio-auto-save-delay', 'inactivity timing milliseconds'),
  base('explorerWidth', 'Explorer width', 'layout', 'studio-explorer-width', 'panel size'),
  base('outputHeight', 'Output height', 'layout', 'studio-output-height', 'panel size'),
  base('startupScan', 'Scan for compiler at startup', 'compiler', 'compiler-startup-scan', 'discovery scan'),
  base('compilerSetup', 'Compiler setup and approval', 'compiler', 'settings-category-compiler', 'executable path location download trust'),
  base('portable', 'Import or export Studio preferences', 'portability', 'settings-category-portability', 'backup restore JSON transfer'),
  base('audit', 'Preference audit and selective reset', 'portability', 'studio-preference-audit', 'compare defaults modified individual settings report audit reset'),
  base('history', 'Preference change history', 'portability', 'settings-category-portability', 'timeline rollback previous changes undo'),
  base('named', 'Named Studio configurations', 'portability', 'settings-category-portability', 'saved snapshots profiles'),
  base('workspace', 'Workspace preference associations', 'portability', 'settings-category-portability', 'local workspace profile'),
  base('recovery', 'Local draft recovery', 'recovery', 'settings-category-recovery', 'checkpoint restore discard unsaved'),
  base('reference', 'Scarp language reference', 'intellisense', 'settings-category-intellisense', 'catalog documentation builtins'),
  base('preview', 'IntelliSense preview', 'intellisense', 'settings-category-intellisense', 'test bench examples'),
  base('diagnostics', 'IntelliSense availability', 'intellisense', 'settings-category-intellisense', 'diagnostics source limits'),
  base('shortcutTransfer', 'Keyboard shortcut backup and restore', 'shortcuts', 'studio-shortcut-transfer', 'export import JSON keybindings rollback transfer'),
  base('userSnippets', 'User Scarp snippets', 'intellisense', 'studio-user-snippets', 'custom templates library placeholders code reuse'),
  base('profiles', 'Saved IntelliSense profiles', 'intellisense', 'settings-category-intellisense', 'import export backup profiles'),
];
const intelliIds: Partial<Record<keyof IntelliSensePreferences, string>> = {
  completionMode: 'mode', matchingMode: 'matching', suggestionDelay: 'delay', suggestionLimit: 'limit',
  hoverDelay: 'hover-delay', inlayHintMode: 'inlay-mode', localAnalysisKiB: 'budget', acceptOnEnter: 'enter', tabCompletion: 'tab',
};
export const SETTINGS_CONTROL_INDEX: readonly SettingsSearchEntry[] = Object.freeze([
  ...basic,
  ...(Object.keys(EDITOR_EXPERIENCE_LABELS) as EditorExperienceKey[]).map(key =>
    base('experience:' + key, EDITOR_EXPERIENCE_LABELS[key], 'editor', 'editor-experience-' + key, EXPERIENCE_INFO[key].help + ' ' + key)),
  ...(Object.keys(INTELLISENSE_CONTROL_INDEX) as (keyof IntelliSensePreferences)[]).map(key => {
    const item = INTELLISENSE_CONTROL_INDEX[key];
    return base('intellisense:' + key, item.label, 'intellisense', 'intellisense-' + (intelliIds[key] ?? key), item.aliases);
  }),
  ...SHORTCUT_COMMANDS.map(item => base('shortcut:' + item.id, item.label + ' shortcut', 'shortcuts', 'studio-shortcut-' + item.id,
    item.default + ' ' + item.group + ' keyboard hotkey')),
]);
export const MAX_SETTINGS_RESULTS = 30;
export function searchSettingsControls(query: string): { total: number; entries: SettingsSearchEntry[] } {
  const normalized = query.slice(0, MAX_SETTINGS_QUERY_UNITS).trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return { total: 0, entries: [] };
  const terms = normalized.split(' ');
  const ranked = SETTINGS_CONTROL_INDEX.map((entry, index) => {
    const label = entry.label.toLowerCase();
    const haystack = (entry.label + ' ' + entry.aliases).toLowerCase();
    const rank = label === normalized ? 0 : label.startsWith(normalized) ? 1 :
      terms.every(term => label.includes(term)) ? 2 : terms.every(term => haystack.includes(term)) ? 3 : Infinity;
    return { entry, rank, index };
  }).filter(item => Number.isFinite(item.rank)).sort((a,b) => a.rank - b.rank || a.index - b.index);
  return { total: ranked.length, entries: ranked.slice(0, MAX_SETTINGS_RESULTS).map(item => item.entry) };
}
export function settingsVisibleGroups(query: string, selected: SettingsGroup | 'all', recoveryNeedsReview: boolean): SettingsGroup[] {
  const matches = query.trim() ? new Set([
    ...matchingSettingsGroups(query), ...searchSettingsControls(query).entries.map(entry => entry.group),
  ]) : new Set<SettingsGroup>(selected === 'all' ? SETTINGS_GROUPS.map(group => group.id) : [selected]);
  if (recoveryNeedsReview) matches.add('recovery');
  return SETTINGS_GROUPS.map(group => group.id).filter(group => matches.has(group));
}
