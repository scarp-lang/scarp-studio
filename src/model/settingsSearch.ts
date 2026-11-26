/** Settings search indexes only static, non-sensitive labels. */
export const MAX_SETTINGS_QUERY_UNITS = 120;
export const SETTINGS_GROUPS = [
  { id: 'appearance', label: 'Appearance', words: 'theme light dark color interface' },
  { id: 'editor', label: 'Code editor', words: 'font family size consolas cascadia monospace tab width wrap lines line numbers minimap whitespace spaces highlight active current indentation guides bracket colors smooth scrolling' },
  { id: 'intellisense', label: 'IntelliSense and language assistance', words: 'autocomplete completion suggestions automatic manual snippets templates keywords types builtins local functions hover documentation signature parameter hints intrinsic builtin arguments inline inlay labels definition navigation symbols outline delay limit budget word based suggestions enter tab presets profiles import export portable configuration transfer json reference catalog documentation lookup modified changed reset preference search preview examples test bench matching prefix subsequence abbreviation context qualified' },
  { id: 'files', label: 'Files and Auto Save', words: 'autosave auto save delay inactivity disk named source files disable reset' },
  { id: 'layout', label: 'Workspace layout', words: 'explorer width output height panel size focus reset' },
  { id: 'compiler', label: 'Compiler configuration', words: 'scarp executable binary path location version detect discovery scan startup download trust approval manual' },
  { id: 'recovery', label: 'Local draft recovery', words: 'unsaved copies checkpoint restore discard previous session privacy storage' },
] as const;
export type SettingsGroup = (typeof SETTINGS_GROUPS)[number]['id'];

export function matchingSettingsGroups(query: string, recoveryNeedsReview = false): SettingsGroup[] {
  const terms = query.slice(0, MAX_SETTINGS_QUERY_UNITS).trim().toLowerCase().split(/\s+/).filter(Boolean);
  return SETTINGS_GROUPS.filter(group => {
    if (recoveryNeedsReview && group.id === 'recovery') return true;
    const searchable = (group.label + ' ' + group.words).toLowerCase();
    return terms.every(term => searchable.includes(term));
  }).map(group => group.id);
}
