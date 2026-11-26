import { DEFAULT_EDITOR_PREFERENCES, parseEditorPreferences, type EditorPreferences } from './editorPreferences';
import { DEFAULT_AUTO_SAVE, parseAutoSavePreferences, type AutoSaveDelay } from './autoSaveSettings';
import { DEFAULT_WORKSPACE_LAYOUT, parseWorkspaceLayout, type WorkspaceLayout } from './workspaceLayout';
import { DEFAULT_INTELLISENSE_PREFERENCES, type IntelliSensePreferences } from './intelliSensePreferences';
import { exactKeys, hasUniqueJsonKeys, profileError, recordOf, strictIntelliSensePreferences,
  diffIntelliSensePreferences, PROFILE_FORMAT_VERSION, type ProfileResult } from './intelliSenseProfileTransfer';

export const STUDIO_TRANSFER_FORMAT = 'scarp-studio.preferences';
export const STUDIO_TRANSFER_VERSION = 1;
export const MAX_STUDIO_TRANSFER_UNITS = 16384;
export const PORTABLE_GROUPS = ['appearance', 'editor', 'intelliSense', 'layout', 'files'] as const;
export type PortableGroup = (typeof PORTABLE_GROUPS)[number];
export const PORTABLE_GROUP_LABELS: Readonly<Record<PortableGroup, string>> = Object.freeze({
  appearance: 'Appearance', editor: 'Code editor', intelliSense: 'IntelliSense',
  layout: 'Workspace dimensions', files: 'Auto Save delay',
});
export interface StudioPortablePreferences {
  readonly appearance: Readonly<{ theme: 'dark' | 'light' }>;
  readonly editor: Readonly<EditorPreferences>;
  readonly intelliSense: Readonly<IntelliSensePreferences>;
  readonly layout: Readonly<WorkspaceLayout>;
  readonly files: Readonly<{ autoSaveDelay: AutoSaveDelay }>;
}

/** Explicit field selection prevents accidental export of new internal
 * properties. Auto Save enablement, startup discovery and compiler trust
 * are intentionally not portable because they authorize local actions. */
export function captureStudioPreferences(theme: 'dark' | 'light', editor: Readonly<EditorPreferences>,
  intelligence: Readonly<IntelliSensePreferences>, layout: Readonly<WorkspaceLayout>, delay: AutoSaveDelay): StudioPortablePreferences {
  const normalizedEditor = parseEditorPreferences(JSON.stringify(editor));
  const normalizedLayout = parseWorkspaceLayout(JSON.stringify(layout));
  const normalizedIntelligence = strictIntelliSensePreferences(Object.fromEntries(
    Object.keys(DEFAULT_INTELLISENSE_PREFERENCES).map(key => [key, intelligence[key as keyof IntelliSensePreferences]])));
  return Object.freeze({
    appearance: Object.freeze({ theme: theme === 'light' ? 'light' as const : 'dark' as const }),
    editor: Object.freeze(normalizedEditor),
    intelliSense: Object.freeze(normalizedIntelligence.ok ? normalizedIntelligence.value : { ...DEFAULT_INTELLISENSE_PREFERENCES }),
    layout: Object.freeze(normalizedLayout),
    files: Object.freeze({ autoSaveDelay: parseAutoSavePreferences(JSON.stringify({ delay })).delay }),
  });
}
export const DEFAULT_STUDIO_PORTABLE = captureStudioPreferences('dark', DEFAULT_EDITOR_PREFERENCES,
  DEFAULT_INTELLISENSE_PREFERENCES, DEFAULT_WORKSPACE_LAYOUT, DEFAULT_AUTO_SAVE.delay);

function canonical(value: StudioPortablePreferences): StudioPortablePreferences {
  return captureStudioPreferences(value.appearance.theme, value.editor, value.intelliSense, value.layout, value.files.autoSaveDelay);
}
export function serializeStudioPreferences(value: StudioPortablePreferences): string {
  return JSON.stringify(canonical(value));
}
export function sameStudioPreferences(a: StudioPortablePreferences, b: StudioPortablePreferences): boolean {
  return serializeStudioPreferences(a) === serializeStudioPreferences(b);
}
export function exportStudioPreferences(value: StudioPortablePreferences): string {
  return JSON.stringify({ format: STUDIO_TRANSFER_FORMAT, version: STUDIO_TRANSFER_VERSION,
    intelliSenseVersion: PROFILE_FORMAT_VERSION, preferences: canonical(value) }, null, 2);
}

function exactNormalized<T extends object>(value: unknown, defaults: T, parse: (raw: string) => T,
  label: string): ProfileResult<T> {
  const record = recordOf(value);
  const keys = Object.keys(defaults) as (keyof T & string)[];
  if (!record || !exactKeys(record, keys)) return profileError(label + ' must contain exactly the supported fields.');
  const normalized = parse(JSON.stringify(record));
  for (const key of keys) {
    if (record[key] !== normalized[key]) return profileError('Unsupported ' + label + ' value: ' + key + '.');
  }
  return { ok: true, value: normalized };
}

/** Strict transfer parser, distinct from the tolerant local-storage parser.
 * Never accept extra fields, silently clamp imported dimensions, or coerce
 * types. The versioned IntelliSense subrecord has independent migration. */
export function importStudioPreferences(raw: string): ProfileResult<StudioPortablePreferences> {
  if (raw.length > MAX_STUDIO_TRANSFER_UNITS) return profileError('Studio configuration is too large.');
  if (!raw.trim()) return profileError('Paste a Studio configuration first.');
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return profileError('Studio configuration is not valid JSON.'); }
  if (!hasUniqueJsonKeys(raw)) return profileError('Studio configuration has duplicate keys or unsupported nesting.');
  const root = recordOf(data);
  if (!root || !exactKeys(root, ['format', 'version', 'intelliSenseVersion', 'preferences']) ||
      root.format !== STUDIO_TRANSFER_FORMAT || root.version !== STUDIO_TRANSFER_VERSION ||
      typeof root.intelliSenseVersion !== 'number') return profileError('Unsupported Studio configuration format or version.');
  const prefs = recordOf(root.preferences);
  if (!prefs || !exactKeys(prefs, PORTABLE_GROUPS)) return profileError('Studio configuration must contain exactly the portable categories.');
  const appearance = recordOf(prefs.appearance);
  if (!appearance || !exactKeys(appearance, ['theme']) || (appearance.theme !== 'dark' && appearance.theme !== 'light')) {
    return profileError('Unsupported appearance preferences.');
  }
  const editor = exactNormalized(prefs.editor, DEFAULT_EDITOR_PREFERENCES, parseEditorPreferences, 'editor');
  if (!editor.ok) return editor;
  const layout = exactNormalized(prefs.layout, DEFAULT_WORKSPACE_LAYOUT, parseWorkspaceLayout, 'layout');
  if (!layout.ok) return layout;
  const intelliSense = strictIntelliSensePreferences(prefs.intelliSense, root.intelliSenseVersion);
  if (!intelliSense.ok) return intelliSense;
  const files = recordOf(prefs.files);
  if (!files || !exactKeys(files, ['autoSaveDelay']) ||
      (files.autoSaveDelay !== 1000 && files.autoSaveDelay !== 3000 && files.autoSaveDelay !== 5000)) {
    return profileError('Unsupported Auto Save timing. Enablement cannot be imported.');
  }
  return { ok: true, value: captureStudioPreferences(appearance.theme, editor.value, intelliSense.value, layout.value, files.autoSaveDelay) };
}
export interface StudioPreferenceChange {
  readonly group: PortableGroup;
  readonly key: string;
  readonly label: string;
  readonly before: string;
  readonly after: string;
}
const editorLabels: Record<keyof EditorPreferences, string> = {
  fontSize: 'Font size', tabSize: 'Tab width', wordWrap: 'Wrap long lines', minimap: 'Minimap',
  showWhitespace: 'Show whitespace', font: 'Font family', lineNumbers: 'Line numbers',
  highlightActiveLine: 'Active line highlighting', indentationGuides: 'Indentation guides',
  bracketColors: 'Bracket colors', smoothScrolling: 'Smooth scrolling',
};
function display(value: string | number | boolean, suffix = ''): string {
  return typeof value === 'boolean' ? value ? 'On' : 'Off' : String(value) + suffix;
}
export function diffStudioPreferences(before: StudioPortablePreferences, after: StudioPortablePreferences): StudioPreferenceChange[] {
  const changes: StudioPreferenceChange[] = [];
  function push(group: PortableGroup, key: string, label: string, a: string | number | boolean, b: string | number | boolean, suffix = '') {
    if (a !== b) changes.push({ group, key, label, before: display(a, suffix), after: display(b, suffix) });
  }
  push('appearance', 'theme', 'Color theme', before.appearance.theme, after.appearance.theme);
  for (const key of Object.keys(editorLabels) as (keyof EditorPreferences)[]) {
    push('editor', key, editorLabels[key], before.editor[key], after.editor[key], key === 'fontSize' ? ' px' : key === 'tabSize' ? ' spaces' : '');
  }
  for (const change of diffIntelliSensePreferences(before.intelliSense, after.intelliSense)) changes.push({ group: 'intelliSense', ...change });
  push('layout', 'explorerWidth', 'Explorer width', before.layout.explorerWidth, after.layout.explorerWidth, ' px');
  push('layout', 'outputHeight', 'Output height', before.layout.outputHeight, after.layout.outputHeight, ' px');
  push('files', 'autoSaveDelay', 'Auto Save delay', before.files.autoSaveDelay, after.files.autoSaveDelay, ' ms');
  return changes;
}
export interface StudioTransferReview {
  readonly baseline: StudioPortablePreferences;
  readonly target: StudioPortablePreferences;
  readonly groups: readonly PortableGroup[];
  readonly changes: readonly StudioPreferenceChange[];
}
export function reviewStudioPreferences(current: StudioPortablePreferences, incoming: StudioPortablePreferences,
  groups: readonly PortableGroup[]): StudioTransferReview {
  const baseline = canonical(current);
  const selected = Object.freeze(PORTABLE_GROUPS.filter(group => groups.includes(group)));
  const set = new Set(selected);
  const target = canonical({
    appearance: set.has('appearance') ? incoming.appearance : baseline.appearance,
    editor: set.has('editor') ? incoming.editor : baseline.editor,
    intelliSense: set.has('intelliSense') ? incoming.intelliSense : baseline.intelliSense,
    layout: set.has('layout') ? incoming.layout : baseline.layout,
    files: set.has('files') ? incoming.files : baseline.files,
  });
  return Object.freeze({ baseline, target, groups: selected,
    changes: Object.freeze(diffStudioPreferences(baseline, target).map(change => Object.freeze(change))) });
}
export function studioReviewIsCurrent(review: StudioTransferReview, current: StudioPortablePreferences): boolean {
  return sameStudioPreferences(review.baseline, current);
}
export function reviewStudioUndo(applied: StudioTransferReview, current: StudioPortablePreferences): ProfileResult<StudioTransferReview> {
  if (!sameStudioPreferences(applied.target, current)) return profileError('Preferences changed after the import. Undo would overwrite newer choices.');
  return { ok: true, value: reviewStudioPreferences(current, applied.baseline, applied.groups) };
}
