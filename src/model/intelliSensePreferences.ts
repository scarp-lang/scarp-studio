/** User-facing editor assistance only. No source text, paths, compiler
 * capabilities or trust state belongs in this record. */
export const INTELLISENSE_STORAGE_KEY = 'studio.intelliSense.v1';
export const MAX_INTELLISENSE_STORAGE_UNITS = 4096;
export const MATCHING_MODES = ['prefix', 'subsequence'] as const;
export type MatchingMode = (typeof MATCHING_MODES)[number];
export const COMPLETION_MODES = ['automatic', 'manual', 'off'] as const;
export const SUGGESTION_DELAYS = [50, 100, 250, 500, 1000] as const;
export const HOVER_DELAYS = [150, 300, 500, 750] as const;
export const SUGGESTION_LIMITS = [10, 20, 40] as const;
export const ANALYSIS_BUDGETS = [64, 256, 512] as const;
export const ENTER_BEHAVIORS = ['on', 'smart', 'off'] as const;
export const TAB_BEHAVIORS = ['off', 'on', 'onlySnippets'] as const;
export type CompletionMode = (typeof COMPLETION_MODES)[number];

export interface IntelliSensePreferences {
  completionMode: CompletionMode;
  matchingMode: MatchingMode;
  conservativeCatalog: boolean;
  templates: boolean;
  builtins: boolean;
  keywordsAndTypes: boolean;
  localFunctions: boolean;
  documentWords: boolean;
  preferLocal: boolean;
  suggestionDelay: (typeof SUGGESTION_DELAYS)[number];
  suggestionLimit: (typeof SUGGESTION_LIMITS)[number];
  hover: boolean;
  localFunctionHover: boolean;
  hoverDelay: (typeof HOVER_DELAYS)[number];
  signatureHelp: boolean;
  goToDefinition: boolean;
  documentSymbols: boolean;
  localAnalysisKiB: (typeof ANALYSIS_BUDGETS)[number];
  acceptOnEnter: (typeof ENTER_BEHAVIORS)[number];
  tabCompletion: (typeof TAB_BEHAVIORS)[number];
}

export const DEFAULT_INTELLISENSE_PREFERENCES: Readonly<IntelliSensePreferences> = Object.freeze({
  completionMode: 'automatic',
  matchingMode: 'prefix',
  conservativeCatalog: true,
  templates: true,
  builtins: true,
  keywordsAndTypes: true,
  localFunctions: true,
  documentWords: false,
  preferLocal: true,
  suggestionDelay: 100,
  suggestionLimit: 40,
  hover: true,
  localFunctionHover: true,
  hoverDelay: 300,
  signatureHelp: true,
  goToDefinition: true,
  documentSymbols: true,
  localAnalysisKiB: 512,
  acceptOnEnter: 'on',
  tabCompletion: 'off',
});

function option<T extends string | number>(value: unknown, choices: readonly T[], fallback: T): T {
  return choices.find(choice => choice === value) ?? fallback;
}
function normalize(value: unknown, fallback: Readonly<IntelliSensePreferences>): IntelliSensePreferences {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { ...fallback };
  const record = value as Record<string, unknown>;
  const bool = (key: keyof IntelliSensePreferences): boolean => {
    const item = Object.hasOwn(record, key) ? record[key] : undefined;
    return typeof item === 'boolean' ? item : fallback[key] === true;
  };
  return {
    completionMode: option(record.completionMode, COMPLETION_MODES, fallback.completionMode),
    matchingMode: option(record.matchingMode, MATCHING_MODES, fallback.matchingMode),
    conservativeCatalog: bool('conservativeCatalog'),
    templates: bool('templates'),
    builtins: bool('builtins'),
    keywordsAndTypes: bool('keywordsAndTypes'),
    localFunctions: bool('localFunctions'),
    documentWords: bool('documentWords'),
    preferLocal: bool('preferLocal'),
    suggestionDelay: option(record.suggestionDelay, SUGGESTION_DELAYS, fallback.suggestionDelay),
    suggestionLimit: option(record.suggestionLimit, SUGGESTION_LIMITS, fallback.suggestionLimit),
    hover: bool('hover'),
    localFunctionHover: bool('localFunctionHover'),
    hoverDelay: option(record.hoverDelay, HOVER_DELAYS, fallback.hoverDelay),
    signatureHelp: bool('signatureHelp'),
    goToDefinition: bool('goToDefinition'),
    documentSymbols: bool('documentSymbols'),
    localAnalysisKiB: option(record.localAnalysisKiB, ANALYSIS_BUDGETS, fallback.localAnalysisKiB),
    acceptOnEnter: option(record.acceptOnEnter, ENTER_BEHAVIORS, fallback.acceptOnEnter),
    tabCompletion: option(record.tabCompletion, TAB_BEHAVIORS, fallback.tabCompletion),
  };
}
export function parseIntelliSensePreferences(raw: string | null): IntelliSensePreferences {
  if (!raw || raw.length > MAX_INTELLISENSE_STORAGE_UNITS) return { ...DEFAULT_INTELLISENSE_PREFERENCES };
  try { return normalize(JSON.parse(raw), DEFAULT_INTELLISENSE_PREFERENCES); }
  catch { return { ...DEFAULT_INTELLISENSE_PREFERENCES }; }
}
export function serializeIntelliSensePreferences(value: Readonly<IntelliSensePreferences>): string {
  return JSON.stringify(normalize(value, DEFAULT_INTELLISENSE_PREFERENCES));
}

export type IntelliSensePreset = 'balanced' | 'manual' | 'minimal';
export const INTELLISENSE_PRESETS: Readonly<Record<IntelliSensePreset, Readonly<IntelliSensePreferences>>> = Object.freeze({
  balanced: DEFAULT_INTELLISENSE_PREFERENCES,
  manual: Object.freeze({ ...DEFAULT_INTELLISENSE_PREFERENCES, completionMode: 'manual', acceptOnEnter: 'off' }),
  minimal: Object.freeze({ ...DEFAULT_INTELLISENSE_PREFERENCES, completionMode: 'manual',
    templates: false, localFunctions: false, hover: false, localFunctionHover: false, signatureHelp: false,
    suggestionLimit: 10, localAnalysisKiB: 64, acceptOnEnter: 'off' }),
});
export function currentIntelliSensePreset(value: Readonly<IntelliSensePreferences>): IntelliSensePreset | 'custom' {
  const serialized = serializeIntelliSensePreferences(value);
  return (Object.keys(INTELLISENSE_PRESETS) as IntelliSensePreset[]).find(
    key => serializeIntelliSensePreferences(INTELLISENSE_PRESETS[key]) === serialized,
  ) ?? 'custom';
}
export function allowsCatalogKind(settings: Readonly<IntelliSensePreferences>, kind: 'snippet' | 'function' | 'keyword' | 'type'): boolean {
  if (settings.completionMode === 'off') return false;
  if (kind === 'snippet') return settings.templates;
  if (kind === 'function') return settings.builtins;
  return settings.keywordsAndTypes;
}

/** Native Monaco UI options and provider gates share the same preference snapshot. */
export function intelliSenseEditorOptions(settings: Readonly<IntelliSensePreferences>) {
  const enabled = settings.completionMode !== 'off';
  const automatic = settings.completionMode === 'automatic';
  return {
    quickSuggestions: automatic ? { other: true, comments: false, strings: false } : false,
    quickSuggestionsDelay: settings.suggestionDelay,
    suggestOnTriggerCharacters: automatic,
    wordBasedSuggestions: enabled && settings.documentWords ? 'currentDocument' as const : 'off' as const,
    snippetSuggestions: enabled && settings.templates ? 'inline' as const : 'none' as const,
    acceptSuggestionOnEnter: enabled ? settings.acceptOnEnter : 'off' as const,
    tabCompletion: enabled ? settings.tabCompletion : 'off' as const,
    hover: { enabled: settings.hover, delay: settings.hoverDelay },
    parameterHints: { enabled: settings.signatureHelp },
  };
}

export interface IntelliSenseStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export interface IntelliSenseSnapshot {
  readonly preferences: Readonly<IntelliSensePreferences>;
  readonly persistence: 'available' | 'session-only';
}

/** A synchronous, stable external store: the once-registered Monaco providers
 * and React settings use the same exact snapshot. No effect-time stale window. */
export function createIntelliSenseStore(storage: IntelliSenseStorage | null) {
  let initial = { ...DEFAULT_INTELLISENSE_PREFERENCES };
  let persistence: IntelliSenseSnapshot['persistence'] = storage ? 'available' : 'session-only';
  try {
    if (storage) initial = parseIntelliSensePreferences(storage.getItem(INTELLISENSE_STORAGE_KEY));
  } catch { persistence = 'session-only'; }
  let snapshot: IntelliSenseSnapshot = Object.freeze({ preferences: Object.freeze(initial), persistence });
  const listeners = new Set<() => void>();
  const getSnapshot = () => snapshot;
  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }
  function update(patch: Partial<IntelliSensePreferences>): void {
    const next = normalize({ ...snapshot.preferences, ...patch }, snapshot.preferences);
    const serialized = serializeIntelliSensePreferences(next);
    const changed = serialized !== serializeIntelliSensePreferences(snapshot.preferences);
    if (!changed && snapshot.persistence === 'available') return;
    let nextPersistence: IntelliSenseSnapshot['persistence'] = 'session-only';
    try {
      if (storage) {
        storage.setItem(INTELLISENSE_STORAGE_KEY, serialized);
        nextPersistence = 'available';
      }
    } catch { /* Keep session choices active even if storage fails. */ }
    if (!changed && nextPersistence === snapshot.persistence) return;
    snapshot = Object.freeze({ preferences: Object.freeze(next), persistence: nextPersistence });
    for (const listener of [...listeners]) listener();
  }
  const reset = () => update({ ...DEFAULT_INTELLISENSE_PREFERENCES });
  return { getSnapshot, subscribe, update, reset };
}

function storageOrNull(): IntelliSenseStorage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; }
  catch { return null; }
}
export const intelliSenseStore = createIntelliSenseStore(storageOrNull());
export function readIntelliSensePreferences(): Readonly<IntelliSensePreferences> {
  return intelliSenseStore.getSnapshot().preferences;
}
