import { safeRelativeScarpDirectory, MAX_DISPLAYED_SCARP_FILES } from './folderListing';
import { MAX_SEARCH_QUERY_UNITS, type SearchOptions } from './openFileSearch';
import {
  MAX_SCOPE_NAME_QUERY, PROJECT_SEARCH_BATCH_SIZE, sameProjectScope, planScopedProjectSearch,
  type ProjectSearchScope, type ProjectScopeInventory,
} from './projectSearchScope';
import { validRelativeLabel } from './projectSearchComparison';
import { assertWellFormedUtf16 } from './utf8Text';

export const MAX_SEARCH_PRESETS = 24;
export const MAX_SEARCH_PRESET_NAME = 64;
export const MAX_SEARCH_PRESET_BACKUP = 64 * 1024;
export const SEARCH_PRESET_FORMAT = 'scarp-studio-search-presets';
export interface ProjectSearchSettings {
  readonly query: string;
  readonly options: SearchOptions;
  readonly scope: ProjectSearchScope;
}
export interface SearchPreset {
  readonly id: number;
  readonly name: string;
  readonly settings: ProjectSearchSettings;
}
export interface SearchPresetLibrary {
  readonly revision: number;
  readonly nextId: number;
  readonly presets: readonly SearchPreset[];
}
export type PresetResult<T> = { readonly ok: true; readonly value: T } |
  { readonly ok: false; readonly error: string };
const fail = (error: string): PresetResult<never> => ({ ok: false, error });

function textValid(value: unknown, max: number): value is string {
  if (typeof value !== 'string' || value.length > max) return false;
  try { assertWellFormedUtf16(value, 'Search preset text'); return true; }
  catch { return false; }
}
const invisible = /[\x00-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/;
const queryControls = /[\x00-\x08\x0a-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/;
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  const keys = Object.keys(value);
  return required.every(key => Object.hasOwn(value, key)) &&
    keys.every(key => required.includes(key) || optional.includes(key));
}

export function normalizeSearchPresetName(input: unknown): PresetResult<string> {
  if (!textValid(input, MAX_SEARCH_PRESET_NAME) || invisible.test(input)) {
    return fail('Enter a name of at most 64 characters without control or directional formatting.');
  }
  const value = input.trim();
  return value ? { ok: true, value } : fail('Enter a nonempty preset name.');
}
function nameKey(name: string): string { return name.toLowerCase(); }

function copySettings(input: ProjectSearchSettings): ProjectSearchSettings {
  return Object.freeze({
    query: input.query,
    options: Object.freeze({ caseSensitive: input.options.caseSensitive, wholeWord: input.options.wholeWord }),
    scope: Object.freeze({
      directory: input.scope.directory, descendants: input.scope.descendants, filename: input.scope.filename,
      ...(input.scope.batch === undefined ? {} : { batch: input.scope.batch }),
    }),
  });
}

/** Only the exact search settings schema is supported. No replacement text,
 * source content, native paths, command arguments or executable metadata.
 */
export function validateProjectSearchSettings(input: unknown): PresetResult<ProjectSearchSettings> {
  if (!record(input) || !exactKeys(input, ['query', 'options', 'scope'])) {
    return fail('Search settings have unsupported fields.');
  }
  const { query, options, scope } = input;
  if (!textValid(query, MAX_SEARCH_QUERY_UNITS) || !query || queryControls.test(query)) {
    return fail('Enter a literal single-line search query of 1–120 characters without invisible controls.');
  }
  if (!record(options) || !exactKeys(options, ['caseSensitive', 'wholeWord']) ||
      typeof options.caseSensitive !== 'boolean' || typeof options.wholeWord !== 'boolean') {
    return fail('Search matching options are invalid.');
  }
  if (!record(scope) || !exactKeys(scope, ['directory', 'descendants', 'filename'], ['batch']) ||
      typeof scope.directory !== 'string' || !validRelativeLabel(scope.directory) ||
      (scope.directory !== '' && !safeRelativeScarpDirectory(scope.directory)) ||
      typeof scope.descendants !== 'boolean' || !textValid(scope.filename, MAX_SCOPE_NAME_QUERY) ||
      invisible.test(scope.filename) || /[/\\]/.test(scope.filename)) {
    return fail('Search directory or basename scope is invalid.');
  }
  const batch = scope.batch;
  if (batch !== undefined && (typeof batch !== 'number' || !Number.isSafeInteger(batch) ||
      batch < 1 || batch > Math.ceil(MAX_DISPLAYED_SCARP_FILES / PROJECT_SEARCH_BATCH_SIZE))) {
    return fail('Search batch number is invalid.');
  }
  return { ok: true, value: copySettings({
    query, options: { caseSensitive: options.caseSensitive, wholeWord: options.wholeWord },
    scope: { directory: scope.directory, descendants: scope.descendants, filename: scope.filename,
      ...(batch === undefined ? {} : { batch }) },
  }) };
}

export function sameProjectSearchSettings(a: ProjectSearchSettings, b: ProjectSearchSettings): boolean {
  return a.query === b.query && a.options.caseSensitive === b.options.caseSensitive &&
    a.options.wholeWord === b.options.wholeWord && sameProjectScope(a.scope, b.scope);
}
export function createSearchPresetLibrary(): SearchPresetLibrary {
  return Object.freeze({ revision: 0, nextId: 1, presets: Object.freeze([]) });
}
function updateLibrary(library: SearchPresetLibrary, presets: readonly SearchPreset[],
  nextId = library.nextId): SearchPresetLibrary {
  return Object.freeze({ revision: library.revision + 1, nextId, presets: Object.freeze([...presets]) });
}
function createPreset(id: number, name: string, settings: ProjectSearchSettings): SearchPreset {
  return Object.freeze({ id, name, settings: copySettings(settings) });
}
function duplicateName(library: SearchPresetLibrary, name: string, exceptId?: number): boolean {
  return library.presets.some(preset => preset.id !== exceptId && nameKey(preset.name) === nameKey(name));
}

export function addSearchPreset(library: SearchPresetLibrary, name: unknown,
  settings: unknown): PresetResult<SearchPresetLibrary> {
  if (library.presets.length >= MAX_SEARCH_PRESETS) return fail('Preset capacity reached.');
  const normalized = normalizeSearchPresetName(name);
  if (!normalized.ok) return normalized;
  if (duplicateName(library, normalized.value)) return fail('A preset with this name already exists.');
  const validated = validateProjectSearchSettings(settings);
  if (!validated.ok) return validated;
  return { ok: true, value: updateLibrary(library,
    [...library.presets, createPreset(library.nextId, normalized.value, validated.value)], library.nextId + 1) };
}
export function renameSearchPreset(library: SearchPresetLibrary, id: number,
  name: unknown): PresetResult<SearchPresetLibrary> {
  const preset = library.presets.find(item => item.id === id);
  if (!preset) return fail('The selected preset no longer exists.');
  const normalized = normalizeSearchPresetName(name);
  if (!normalized.ok) return normalized;
  if (duplicateName(library, normalized.value, id)) return fail('A preset with this name already exists.');
  if (normalized.value === preset.name) return { ok: true, value: library };
  return { ok: true, value: updateLibrary(library, library.presets.map(item =>
    item.id === id ? createPreset(id, normalized.value, item.settings) : item)) };
}
export function replaceSearchPresetSettings(library: SearchPresetLibrary, id: number,
  settings: unknown): PresetResult<SearchPresetLibrary> {
  const preset = library.presets.find(item => item.id === id);
  if (!preset) return fail('The selected preset no longer exists.');
  const validated = validateProjectSearchSettings(settings);
  if (!validated.ok) return validated;
  if (sameProjectSearchSettings(preset.settings, validated.value)) return { ok: true, value: library };
  return { ok: true, value: updateLibrary(library, library.presets.map(item =>
    item.id === id ? createPreset(id, item.name, validated.value) : item)) };
}
export interface SearchPresetReplaceReview {
  readonly base: SearchPresetLibrary;
  readonly preset: SearchPreset;
  readonly proposed: ProjectSearchSettings;
}
export function prepareSearchPresetReplace(library: SearchPresetLibrary, id: number,
  current: ProjectSearchSettings): PresetResult<SearchPresetReplaceReview> {
  const preset = library.presets.find(item => item.id === id);
  if (!preset) return fail('The selected preset no longer exists.');
  const validated = validateProjectSearchSettings(current);
  if (!validated.ok) return validated;
  return { ok: true, value: Object.freeze({ base: library, preset, proposed: validated.value }) };
}
export function confirmSearchPresetReplace(library: SearchPresetLibrary, review: SearchPresetReplaceReview,
  current: ProjectSearchSettings): PresetResult<SearchPresetLibrary> {
  if (library !== review.base || !library.presets.includes(review.preset) ||
      !sameProjectSearchSettings(review.proposed, current)) {
    return fail('The preset or proposed search settings changed. Review the replacement again.');
  }
  return replaceSearchPresetSettings(library, review.preset.id, review.proposed);
}
export function removeSearchPreset(library: SearchPresetLibrary, id: number): PresetResult<SearchPresetLibrary> {
  if (!library.presets.some(item => item.id === id)) return fail('The selected preset no longer exists.');
  return { ok: true, value: updateLibrary(library, library.presets.filter(item => item.id !== id)) };
}
export function clearSearchPresets(library: SearchPresetLibrary): SearchPresetLibrary {
  return library.presets.length ? updateLibrary(library, []) : library;
}

export interface PresetScopePreview {
  readonly labels: readonly string[];
  readonly listed: number;
  readonly eligible: number;
  readonly excluded: number;
  readonly withheld: number;
  readonly deferred: number;
}
function previewScope(inventory: ProjectScopeInventory, scope: ProjectSearchScope): PresetResult<PresetScopePreview> {
  const plan = planScopedProjectSearch(inventory, scope);
  if (!plan.ok) return plan;
  const labels = plan.value.sources.map(source => source.name).sort();
  if (!labels.length) return fail('No eligible listed sources match this preset scope.');
  if (!labels.every(validRelativeLabel)) return fail('This scope contains labels that cannot be safely reviewed.');
  return { ok: true, value: Object.freeze({
    labels: Object.freeze(labels),
    listed: plan.value.listed,
    eligible: plan.value.sources.length,
    excluded: plan.value.excluded,
    withheld: plan.value.invalid + plan.value.ambiguous + plan.value.uninspected,
    deferred: plan.value.batch?.deferred ?? 0,
  }) };
}
function sameScopePreview(a: PresetScopePreview, b: PresetScopePreview): boolean {
  return a.listed === b.listed && a.eligible === b.eligible && a.excluded === b.excluded &&
    a.withheld === b.withheld && a.deferred === b.deferred && a.labels.length === b.labels.length &&
    a.labels.every((label, index) => label === b.labels[index]);
}
export interface SearchPresetApplyReview {
  readonly base: SearchPresetLibrary;
  readonly preset: SearchPreset;
  readonly before: ProjectSearchSettings;
  readonly preview: PresetScopePreview;
}

/** Review the actual current listing, not a saved path or membership token.
 * This is a settings-only review: nothing authorizes or initiates native reads.
 */
export function prepareSearchPresetApply(
  library: SearchPresetLibrary, id: number, current: ProjectSearchSettings,
  inventory: ProjectScopeInventory,
): PresetResult<SearchPresetApplyReview> {
  const preset = library.presets.find(item => item.id === id);
  if (!preset) return fail('The selected preset no longer exists.');
  const preview = previewScope(inventory, preset.settings.scope);
  if (!preview.ok) return preview;
  return { ok: true, value: Object.freeze({ base: library, preset, before: copySettings(current), preview: preview.value }) };
}
export function confirmSearchPresetApply(
  library: SearchPresetLibrary, review: SearchPresetApplyReview,
  current: ProjectSearchSettings, inventory: ProjectScopeInventory,
): PresetResult<ProjectSearchSettings> {
  if (review.base !== library || !library.presets.includes(review.preset) ||
      !sameProjectSearchSettings(review.before, current)) {
    return fail('Preset library or current settings changed. Review the preset again.');
  }
  const preview = previewScope(inventory, review.preset.settings.scope);
  if (!preview.ok) return preview;
  if (!sameScopePreview(review.preview, preview.value)) return fail('The eligible listing changed. Review the preset again.');
  return { ok: true, value: copySettings(review.preset.settings) };
}

interface PortableSearchPreset { readonly name: string; readonly settings: ProjectSearchSettings }
export type PresetImportStatus = 'new' | 'identical' | 'conflict';
export interface PresetImportRow {
  readonly index: number;
  readonly name: string;
  readonly status: PresetImportStatus;
  readonly settings: ProjectSearchSettings;
}
export interface PresetImportReview {
  readonly base: SearchPresetLibrary;
  readonly source: string;
  readonly rows: readonly PresetImportRow[];
  readonly remainingCapacity: number;
}

/** Explicitly opt in before invoking this exporter. Its contents include
 * user-entered query text and relative scope metadata, not source snapshots.
 */
export function exportSearchPresetBackup(library: SearchPresetLibrary): PresetResult<string> {
  const output = JSON.stringify({
    format: SEARCH_PRESET_FORMAT, version: 1,
    presets: library.presets.map(item => ({ name: item.name, settings: copySettings(item.settings) })),
  }, null, 2);
  return output.length <= MAX_SEARCH_PRESET_BACKUP
    ? { ok: true, value: output } : fail('The backup exceeds the portable text limit.');
}
export function parseSearchPresetBackup(text: string): PresetResult<readonly PortableSearchPreset[]> {
  if (typeof text !== 'string' || text.length > MAX_SEARCH_PRESET_BACKUP) return fail('The backup exceeds the portable text limit.');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return fail('The backup is not valid JSON.'); }
  if (!record(parsed) || !exactKeys(parsed, ['format', 'version', 'presets']) ||
      parsed.format !== SEARCH_PRESET_FORMAT || parsed.version !== 1 ||
      !Array.isArray(parsed.presets) || parsed.presets.length > MAX_SEARCH_PRESETS) {
    return fail('Unsupported search preset backup format or record count.');
  }
  const seen = new Set<string>();
  const items: PortableSearchPreset[] = [];
  for (const item of parsed.presets) {
    if (!record(item) || !exactKeys(item, ['name', 'settings'])) return fail('A backup preset has unsupported fields.');
    const normalized = normalizeSearchPresetName(item.name);
    if (!normalized.ok) return normalized;
    if (seen.has(nameKey(normalized.value))) return fail('The backup contains duplicate preset names.');
    seen.add(nameKey(normalized.value));
    const validated = validateProjectSearchSettings(item.settings);
    if (!validated.ok) return validated;
    items.push(Object.freeze({ name: normalized.value, settings: validated.value }));
  }
  return { ok: true, value: Object.freeze(items) };
}
export function reviewSearchPresetImport(library: SearchPresetLibrary, text: string): PresetResult<PresetImportReview> {
  const parsed = parseSearchPresetBackup(text);
  if (!parsed.ok) return parsed;
  const rows = parsed.value.map((item, index): PresetImportRow => {
    const existing = library.presets.find(preset => nameKey(preset.name) === nameKey(item.name));
    return Object.freeze({ index, name: item.name, settings: item.settings, status: !existing ? 'new' :
      sameProjectSearchSettings(existing.settings, item.settings) ? 'identical' : 'conflict' });
  });
  return { ok: true, value: Object.freeze({
    base: library, source: text, rows: Object.freeze(rows),
    remainingCapacity: MAX_SEARCH_PRESETS - library.presets.length,
  }) };
}

/** Merge only the reviewed new rows. Conflicts and identical records remain
 * untouched. Reparse the exact backup on commit, and reject stale libraries.
 */
export function applySearchPresetImport(library: SearchPresetLibrary, review: PresetImportReview,
  selected: readonly number[]): PresetResult<SearchPresetLibrary> {
  if (review.base !== library) return fail('The preset library changed. Review the backup again.');
  if (!selected.length || selected.length > MAX_SEARCH_PRESETS || new Set(selected).size !== selected.length ||
      selected.some(index => !Number.isSafeInteger(index) || index < 0)) return fail('Select distinct new preset rows.');
  const checked = reviewSearchPresetImport(library, review.source);
  if (!checked.ok) return checked;
  if (review.rows.length !== checked.value.rows.length || review.remainingCapacity !== checked.value.remainingCapacity ||
      review.rows.some((row, index) => {
        const expected = checked.value.rows[index];
        return row.index !== expected.index || row.name !== expected.name || row.status !== expected.status ||
          !sameProjectSearchSettings(row.settings, expected.settings);
      })) return fail('The reviewed backup evidence changed. Review the backup again.');
  if (selected.length > checked.value.remainingCapacity) return fail('The selection exceeds the remaining preset capacity.');
  if (selected.some(index => checked.value.rows[index]?.status !== 'new')) return fail('Only reviewed new preset rows can be imported.');
  const parsed = parseSearchPresetBackup(review.source);
  if (!parsed.ok) return parsed;
  const additions = [...selected].sort((a, b) => a - b).map((index, offset) =>
    createPreset(library.nextId + offset, parsed.value[index].name, parsed.value[index].settings));
  return { ok: true, value: updateLibrary(library, [...library.presets, ...additions], library.nextId + additions.length) };
}
