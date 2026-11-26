import {
  DEFAULT_INTELLISENSE_PREFERENCES, parseIntelliSensePreferences,
  serializeIntelliSensePreferences, type IntelliSensePreferences,
} from './intelliSensePreferences';

export const PROFILE_FORMAT = 'scarp-studio.intellisense';
export const PROFILE_FORMAT_VERSION = 1;
export const MAX_PROFILE_TRANSFER_UNITS = 8192;
const KEYS = Object.keys(DEFAULT_INTELLISENSE_PREFERENCES) as (keyof IntelliSensePreferences)[];
export type ProfileResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function profileError(error: string): { ok: false; error: string } { return { ok: false, error }; }
export function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
export function exactKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(record).length === keys.length && keys.every(key => Object.hasOwn(record, key));
}

/** Unlike local preference migration, portable imports are strictly complete.
 * A typo, unknown setting or unsupported value must not silently reset a choice.
 * The existing canonical parser remains the single source of valid values. */
export function strictIntelliSensePreferences(value: unknown): ProfileResult<IntelliSensePreferences> {
  const record = recordOf(value);
  if (!record || !exactKeys(record, KEYS)) return profileError('Configuration must contain exactly the supported IntelliSense preferences.');
  const normalized = parseIntelliSensePreferences(JSON.stringify(record));
  for (const key of KEYS) {
    if (record[key] !== normalized[key]) return profileError('Unsupported preference value: ' + key + '.');
  }
  return { ok: true, value: normalized };
}
export function exportIntelliSenseProfile(preferences: Readonly<IntelliSensePreferences>): string {
  return JSON.stringify({
    format: PROFILE_FORMAT,
    version: PROFILE_FORMAT_VERSION,
    preferences: JSON.parse(serializeIntelliSensePreferences(preferences)),
  }, null, 2);
}
export function importIntelliSenseProfile(raw: string): ProfileResult<IntelliSensePreferences> {
  if (!raw.trim()) return profileError('Paste an exported IntelliSense configuration first.');
  if (raw.length > MAX_PROFILE_TRANSFER_UNITS) return profileError('Configuration is too large.');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return profileError('Configuration is not valid JSON.'); }
  const record = recordOf(value);
  if (!record || !exactKeys(record, ['format', 'version', 'preferences']) || record.format !== PROFILE_FORMAT) {
    return profileError('This is not a supported Scarp Studio IntelliSense configuration.');
  }
  if (record.version !== PROFILE_FORMAT_VERSION) return profileError('Unsupported IntelliSense configuration version.');
  return strictIntelliSensePreferences(record.preferences);
}

export interface PreferenceChange {
  key: keyof IntelliSensePreferences;
  label: string;
  before: string;
  after: string;
}
const labels: Record<keyof IntelliSensePreferences, string> = {
  completionMode: 'Completion mode',
  templates: 'Statement templates',
  builtins: 'Built-in functions',
  keywordsAndTypes: 'Keywords and types',
  localFunctions: 'Local function declarations',
  documentWords: 'Current document words',
  preferLocal: 'Prefer local functions',
  suggestionDelay: 'Automatic delay',
  suggestionLimit: 'Scarp result limit',
  hover: 'Hover documentation',
  localFunctionHover: 'Local function hover',
  hoverDelay: 'Hover delay',
  signatureHelp: 'Function parameter hints',
  goToDefinition: 'Go to Definition',
  documentSymbols: 'Monaco document symbols',
  localAnalysisKiB: 'Local analysis budget',
  acceptOnEnter: 'Accept using Enter',
  tabCompletion: 'Tab completion',
};
function display(key: keyof IntelliSensePreferences, value: IntelliSensePreferences[typeof key]): string {
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (key === 'suggestionDelay' || key === 'hoverDelay') return value + ' ms';
  if (key === 'localAnalysisKiB') return value + ' Ki UTF-16 units';
  return value === 'onlySnippets' ? 'Only snippets' : String(value);
}
export function diffIntelliSensePreferences(before: Readonly<IntelliSensePreferences>,
  after: Readonly<IntelliSensePreferences>): PreferenceChange[] {
  return KEYS.filter(key => before[key] !== after[key]).map(key => ({
    key, label: labels[key], before: display(key, before[key]), after: display(key, after[key]),
  }));
}
export interface ProfileReview {
  readonly baseline: string;
  readonly target: Readonly<IntelliSensePreferences>;
  readonly changes: readonly PreferenceChange[];
}
export function reviewIntelliSenseProfile(current: Readonly<IntelliSensePreferences>,
  target: Readonly<IntelliSensePreferences>): ProfileReview {
  const canonical = parseIntelliSensePreferences(serializeIntelliSensePreferences(target));
  return Object.freeze({
    baseline: serializeIntelliSensePreferences(current),
    target: Object.freeze(canonical),
    changes: Object.freeze(diffIntelliSensePreferences(current, canonical).map(change => Object.freeze(change))),
  });
}
export function isCurrentProfileReview(review: ProfileReview, current: Readonly<IntelliSensePreferences>): boolean {
  return review.baseline === serializeIntelliSensePreferences(current);
}
