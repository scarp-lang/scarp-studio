import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_BUDGETS, COMPLETION_MODES, DEFAULT_INTELLISENSE_PREFERENCES as defaults,
  ENTER_BEHAVIORS, HOVER_DELAYS, INTELLISENSE_PRESETS, INTELLISENSE_STORAGE_KEY,
  MAX_INTELLISENSE_STORAGE_UNITS, SUGGESTION_DELAYS, SUGGESTION_LIMITS, TAB_BEHAVIORS,
  allowsCatalogKind, createIntelliSenseStore, currentIntelliSensePreset,
  intelliSenseEditorOptions, parseIntelliSensePreferences, serializeIntelliSensePreferences,
  type IntelliSensePreferences, type IntelliSenseStorage,
} from './intelliSensePreferences';

function memory(initial: string | null = null) {
  let value = initial;
  let writes = 0;
  const storage: IntelliSenseStorage = {
    getItem: key => { expect(key).toBe(INTELLISENSE_STORAGE_KEY); return value; },
    setItem: (key, next) => { expect(key).toBe(INTELLISENSE_STORAGE_KEY); value = next; writes++; },
  };
  return { storage, raw: () => value, writes: () => writes };
}

describe('IntelliSense preference schema', () => {
  it('defaults safely and returns fresh objects for missing, invalid and oversized records', () => {
    for (const raw of [null, '', '{', 'null', 'true', '[]', '"text"',
      ' '.repeat(MAX_INTELLISENSE_STORAGE_UNITS) + '{"hover":false}']) {
      expect(parseIntelliSensePreferences(raw)).toEqual(defaults);
      expect(parseIntelliSensePreferences(raw)).not.toBe(defaults);
    }
  });
  it('preserves each supported enum independently', () => {
    const cases = [
      ['completionMode', COMPLETION_MODES], ['suggestionDelay', SUGGESTION_DELAYS],
      ['hoverDelay', HOVER_DELAYS], ['suggestionLimit', SUGGESTION_LIMITS],
      ['localAnalysisKiB', ANALYSIS_BUDGETS], ['acceptOnEnter', ENTER_BEHAVIORS],
      ['tabCompletion', TAB_BEHAVIORS],
    ] as const;
    for (const [key, choices] of cases) {
      for (const choice of choices) expect(parseIntelliSensePreferences(JSON.stringify({ [key]: choice }))[key]).toBe(choice);
      for (const invalid of [null, [], {}, 'invalid', -1, true]) {
        expect(parseIntelliSensePreferences(JSON.stringify({ [key]: invalid }))[key]).toBe(defaults[key]);
      }
    }
  });
  it('accepts explicit false and true, not coercion, for every flag', () => {
    for (const key of Object.keys(defaults) as (keyof IntelliSensePreferences)[]) {
      if (typeof defaults[key] !== 'boolean') continue;
      for (const value of [true, false]) expect(parseIntelliSensePreferences(JSON.stringify({ [key]: value }))[key]).toBe(value);
      for (const invalid of ['false', 0, 1, [], {}, null]) {
        expect(parseIntelliSensePreferences(JSON.stringify({ [key]: invalid }))[key]).toBe(defaults[key]);
      }
    }
  });
  it('ignores unknown and sensitive properties when parsing and serializing', () => {
    const raw = '{"hover":false,"source":"private","compilerPath":"C:/scarp.exe","approved":true,"__proto__":{"localFunctions":false}}';
    const parsed = parseIntelliSensePreferences(raw);
    expect(parsed).toEqual({ ...defaults, hover: false });
    expect(serializeIntelliSensePreferences({ ...parsed, source: 'private' } as IntelliSensePreferences)).not.toContain('private');
    expect(serializeIntelliSensePreferences(parsed)).not.toContain('compilerPath');
  });
  it('round-trips all presets and identifies custom preferences', () => {
    for (const [name, preset] of Object.entries(INTELLISENSE_PRESETS)) {
      expect(parseIntelliSensePreferences(serializeIntelliSensePreferences(preset))).toEqual(preset);
      expect(currentIntelliSensePreset(preset)).toBe(name);
    }
    expect(currentIntelliSensePreset({ ...defaults, hover: false })).toBe('custom');
  });
});

describe('Monaco option mapping', () => {
  it('maps automatic, manual and off modes without changing independent navigation settings', () => {
    const auto = intelliSenseEditorOptions(defaults);
    expect(auto).toMatchObject({ quickSuggestions: { other: true, comments: false, strings: false },
      quickSuggestionsDelay: 100, suggestOnTriggerCharacters: true, wordBasedSuggestions: 'off',
      hover: { enabled: true, delay: 300 }, parameterHints: { enabled: true } });
    const manual = intelliSenseEditorOptions({ ...defaults, completionMode: 'manual', documentWords: true });
    expect(manual).toMatchObject({ quickSuggestions: false, suggestOnTriggerCharacters: false,
      wordBasedSuggestions: 'currentDocument', hover: { enabled: true }, parameterHints: { enabled: true } });
    const off = intelliSenseEditorOptions({ ...defaults, completionMode: 'off', documentWords: true, tabCompletion: 'on' });
    expect(off).toMatchObject({ quickSuggestions: false, suggestOnTriggerCharacters: false,
      wordBasedSuggestions: 'off', snippetSuggestions: 'none', acceptSuggestionOnEnter: 'off', tabCompletion: 'off',
      hover: { enabled: true }, parameterHints: { enabled: true } });
  });
  it('maps timing, acceptance, and hover settings independently', () => {
    expect(intelliSenseEditorOptions({ ...defaults, suggestionDelay: 500, hoverDelay: 750,
      hover: false, signatureHelp: false, acceptOnEnter: 'smart', tabCompletion: 'onlySnippets', templates: false }))
      .toMatchObject({ quickSuggestionsDelay: 500, hover: { enabled: false, delay: 750 },
        parameterHints: { enabled: false }, acceptSuggestionOnEnter: 'smart', tabCompletion: 'onlySnippets', snippetSuggestions: 'none' });
  });
  it('gates every catalog kind independently and disables all when off', () => {
    for (const [kind, key] of [['snippet', 'templates'], ['function', 'builtins'],
      ['keyword', 'keywordsAndTypes'], ['type', 'keywordsAndTypes']] as const) {
      expect(allowsCatalogKind(defaults, kind)).toBe(true);
      expect(allowsCatalogKind({ ...defaults, [key]: false }, kind)).toBe(false);
      expect(allowsCatalogKind({ ...defaults, completionMode: 'off' }, kind)).toBe(false);
    }
  });
});

describe('live IntelliSense store', () => {
  it('loads once, keeps stable snapshots and persists only on changes', () => {
    const m = memory('{"hover":false}');
    const store = createIntelliSenseStore(m.storage);
    const before = store.getSnapshot();
    expect(before.preferences.hover).toBe(false);
    expect(store.getSnapshot()).toBe(before);
    store.update({ hover: false });
    expect(m.writes()).toBe(0);
    expect(store.getSnapshot()).toBe(before);
    store.update({ hover: true });
    expect(store.getSnapshot()).not.toBe(before);
    expect(store.getSnapshot().preferences.hover).toBe(true);
    expect(m.writes()).toBe(1);
    expect(parseIntelliSensePreferences(m.raw())).toEqual(defaults);
  });
  it('publishes a synchronous immutable snapshot and unsubscribes cleanly', () => {
    const store = createIntelliSenseStore(memory().storage);
    const observed: boolean[] = [];
    const unsubscribe = store.subscribe(() => observed.push(store.getSnapshot().preferences.localFunctions));
    store.update({ localFunctions: false });
    expect(observed).toEqual([false]);
    expect(Object.isFrozen(store.getSnapshot())).toBe(true);
    expect(Object.isFrozen(store.getSnapshot().preferences)).toBe(true);
    unsubscribe();
    store.update({ localFunctions: true });
    expect(observed).toEqual([false]);
  });
  it('preserves valid current values when a malformed runtime patch arrives', () => {
    const store = createIntelliSenseStore(memory().storage);
    store.update({ suggestionLimit: 20, hover: false });
    store.update({ suggestionLimit: 999, hover: 'false', compilerPath: 'private' } as unknown as IntelliSensePreferences);
    expect(store.getSnapshot().preferences).toEqual({ ...defaults, suggestionLimit: 20, hover: false });
  });
  it('keeps working when storage is blocked and retries after a write failure', () => {
    let fail = true;
    const store = createIntelliSenseStore({
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { if (fail) throw new Error('quota'); },
    });
    expect(store.getSnapshot().persistence).toBe('session-only');
    store.update({ hover: false });
    expect(store.getSnapshot().preferences.hover).toBe(false);
    expect(store.getSnapshot().persistence).toBe('session-only');
    fail = false;
    store.update({ hover: false });
    expect(store.getSnapshot().persistence).toBe('available');
  });
  it('applies resets and presets without affecting other storage keys', () => {
    const m = memory();
    const store = createIntelliSenseStore(m.storage);
    store.update(INTELLISENSE_PRESETS.minimal);
    expect(currentIntelliSensePreset(store.getSnapshot().preferences)).toBe('minimal');
    store.reset();
    expect(store.getSnapshot().preferences).toEqual(defaults);
    expect(parseIntelliSensePreferences(m.raw())).toEqual(defaults);
    const session = createIntelliSenseStore(null);
    session.update({ completionMode: 'off' });
    expect(session.getSnapshot().preferences.completionMode).toBe('off');
    expect(session.getSnapshot().persistence).toBe('session-only');
  });
});
