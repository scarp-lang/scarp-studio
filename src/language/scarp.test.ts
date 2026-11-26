import { describe, expect, it, vi } from 'vitest';
import { registerScarpLanguage } from './scarp';
import { MAX_ASSIST_SCAN_UNITS } from './assist';
import { DEFAULT_INTELLISENSE_PREFERENCES, type IntelliSensePreferences } from '../model/intelliSensePreferences';

type TokenRule = [RegExp, unknown];
type TokenProvider = {
  keywords: string[];
  typeKeywords: string[];
  legacyKeywords: string[];
  builtinFunctions: string[];
  tokenizer: { root: TokenRule[]; string: TokenRule[] };
};

function captureProvider(): TokenProvider {
  let captured: TokenProvider | null = null;
  const mockMonaco = {
    languages: {
      getLanguages: () => [],
      register: vi.fn(),
      setLanguageConfiguration: vi.fn(),
      setMonarchTokensProvider: vi.fn((_language: string, provider: TokenProvider) => {
        captured = provider;
      }),
      registerCompletionItemProvider: vi.fn(),
      registerHoverProvider: vi.fn(),
      registerDocumentSymbolProvider: vi.fn(),
      registerDefinitionProvider: vi.fn(),
      registerSignatureHelpProvider: vi.fn(),
      registerInlayHintsProvider: vi.fn(),
      CompletionItemKind: { Keyword: 17, Class: 5, Function: 1, Snippet: 27 },
    },
  };
  registerScarpLanguage(mockMonaco as unknown as Parameters<typeof registerScarpLanguage>[0]);
  if (!captured) throw new Error('Scarp tokens provider was not registered');
  return captured;
}

function matchesWhole(rule: RegExp, text: string): boolean {
  return new RegExp('^(?:' + rule.source + ')$').test(text);
}

describe('Scarp syntax highlighting and compiler compatibility', () => {
  it('recognizes implemented alpha.8 statements, contracts and output forms', () => {
    const provider = captureProvider();
    for (const word of [
      'assert', 'needs', 'ensures', 'print', 'println', 'write', 'eprint', 'ewrite',
      'funcra', 'pure', 'pub', 'import', 'elif', 'repeat',
    ]) {
      expect(provider.keywords, word).toContain(word);
    }
    for (const type of ['integer', 'float', 'boolean', 'string', 'unit', 'vector', 'integers', 'tile', 'tuple', 'bigint']) {
      expect(provider.typeKeywords, type).toContain(type);
    }
  });

  it('highlights published while and repeat flow control without inventing for loops', () => {
    const provider = captureProvider();
    for (const word of ['while', 'repeat', 'break', 'continue']) {
      expect(provider.keywords).toContain(word);
      expect(provider.typeKeywords).not.toContain(word);
    }
    expect(provider.keywords).not.toContain('for');
  });

  it('keeps unsupported proposals and ordinary intrinsic calls out of keywords', () => {
    const provider = captureProvider();
    for (const name of ['for', 'ask', 'class', 'read_line']) {
      expect(provider.keywords, name).not.toContain(name);
    }
    expect(provider.legacyKeywords).toEqual(['let', 'mut']);
    const identifier = provider.tokenizer.root.find(([, action]) =>
      typeof action === 'object' && action !== null && 'cases' in action &&
      typeof action.cases === 'object' && action.cases !== null &&
      '@typeKeywords' in action.cases
    );
    expect(identifier?.[1]).toEqual({
      cases: {
        '@keywords': 'keyword',
        '@typeKeywords': 'type',
        '@legacyKeywords': 'invalid',
        '@default': 'identifier',
      },
    });
  });

  it('recognizes alpha.10 calls but keeps them distinct from Scarp keywords', () => {
    const provider = captureProvider();
    for (const builtin of ['input', 'ask', 'ask_or', 'input_integer', 'input_bigint',
      'try_read_line', 'flush_stdout', 'bigint_gcd', 'bigint_divmod']) {
      expect(provider.builtinFunctions).toContain(builtin);
      expect(provider.keywords).not.toContain(builtin);
    }
    const contextualType = provider.tokenizer.root.find(([, token]) => token === 'type')?.[0];
    expect(contextualType?.test('array<integer, 2>')).toBe(true);
    expect(contextualType?.test('array = 2')).toBe(false);
  });

  it('recognizes alpha.11 exact decimal type and built-ins without inventing keywords', () => {
    const provider = captureProvider();
    expect(provider.typeKeywords).toContain('decimal');
    for (const name of [
      'decimal', 'decimal_from_integer', 'decimal_to_integer', 'decimal_to_text',
      'decimal_round', 'decimal_format', 'decimal_div_rounded', 'input_decimal',
    ]) {
      expect(provider.builtinFunctions).toContain(name);
      expect(provider.keywords).not.toContain(name);
    }
  });

  it('highlights published alpha.12 records, variants, tagged matches and collections', () => {
    const provider = captureProvider();
    for (const keyword of ['record', 'variant', 'match', 'on', 'case', 'new']) {
      expect(provider.keywords).toContain(keyword);
    }
    for (const type of ['list', 'map', 'option', 'result']) {
      expect(provider.typeKeywords).toContain(type);
    }
    for (const name of ['list_len', 'list_push', 'list_remove', 'map_len',
      'map_keys', 'map_values', 'map_contains', 'map_get_or', 'map_set', 'map_remove']) {
      expect(provider.builtinFunctions).toContain(name);
      expect(provider.keywords).not.toContain(name);
    }
    const contextualType = provider.tokenizer.root.find(([, token]) => token === 'type')?.[0];
    for (const generic of ['list<integer>', 'map<string, integer>', 'option<boolean>', 'result<integer,string>']) {
      expect(contextualType?.test(generic), generic).toBe(true);
    }
    expect(contextualType?.test('list = 2')).toBe(false);
  });

  it('highlights alpha.17 built-in calls without reserving user identifier spellings', () => {
    const provider = captureProvider();
    for (const name of ['array_len', 'array_get_or', 'input_boolean']) {
      expect(provider.builtinFunctions).toContain(name);
      expect(provider.keywords).not.toContain(name);
      expect(provider.legacyKeywords).not.toContain(name);
    }
    const callRule = provider.tokenizer.root.find(([, action]) =>
      typeof action === 'object' && action !== null && 'cases' in action &&
      typeof action.cases === 'object' && action.cases !== null &&
      '@builtinFunctions' in action.cases
    );
    expect(callRule?.[1]).toMatchObject({ cases: { '@builtinFunctions': 'predefined' } });
  });

  it('recognizes published hexadecimal and binary integer literals', () => {
    const root = captureProvider().tokenizer.root;
    const valid = root.filter(([, token]) => token === 'number').map(([rule]) => rule);
    const invalid = root.find(([, token]) => token === 'number.invalid')?.[0];
    expect(valid.length).toBeGreaterThan(0);
    expect(invalid).toBeDefined();
    for (const value of ['0', '42', '3.25', '1e3', '1.2E-4', '0xFF', '0X2a', '0b101', '0B010']) {
      expect(valid.some((rule) => matchesWhole(rule, value)), value).toBe(true);
    }
    for (const value of ['0x', '0b', '0xGG', '0b102', '0xFF_', '12_345']) {
      expect(valid.some((rule) => matchesWhole(rule, value)), value).toBe(false);
      expect(matchesWhole(invalid!, value), value).toBe(true);
    }
  });

  it('colors complete exact decimal literals without accepting malformed suffixes or exponents', () => {
    const root = captureProvider().tokenizer.root;
    // Check the first anchored rule that matches, just as the tokenizer does.
    const token = (value: string) => {
      for (const [rule, action] of root) {
        const match = new RegExp('^(?:' + rule.source + ')').exec(value);
        if (match) return [match[0], action];
      }
      return null;
    };
    for (const value of ['0.1d', '42d', '1.20d', '0001d']) {
      expect(token(value)).toEqual([value, 'number']);
    }
    for (const value of ['1.2d_more', '42d2', '1e3d', '1.2E-4d']) {
      expect(token(value)).toEqual([value, 'number.invalid']);
    }
    expect(token('0.1d + 0.2d')).toEqual(['0.1d', 'number']);
    expect(token('1.2E-4')).toEqual(['1.2E-4', 'number']);
  });

  it('colors published Unicode scalar escapes while leaving malformed forms unrecognized', () => {
    const escape = captureProvider().tokenizer.string.find(([rule, token]) =>
      token === 'string.escape' && rule.source.includes('u')
    )?.[0];
    expect(escape).toBeDefined();
    for (const valid of ['\\u{41}', '\\u{0928}', '\\u{1F44B}', '\\u{10FFFF}']) {
      expect(matchesWhole(escape!, valid), valid).toBe(true);
    }
    for (const invalid of ['\\u{}', '\\u{0000000}', '\\u{1G}', '\\u0041']) {
      expect(matchesWhole(escape!, invalid), invalid).toBe(false);
    }
  });

  it('does not register a second provider if Scarp is already registered', () => {
    const register = vi.fn();
    const setMonarchTokensProvider = vi.fn();
    const mockMonaco = {
      languages: {
        getLanguages: () => [{ id: 'scarp' }],
        register,
        setLanguageConfiguration: vi.fn(),
        setMonarchTokensProvider,
        registerCompletionItemProvider: vi.fn(),
        registerHoverProvider: vi.fn(),
        registerDocumentSymbolProvider: vi.fn(),
      registerDefinitionProvider: vi.fn(),
      registerSignatureHelpProvider: vi.fn(),
      registerInlayHintsProvider: vi.fn(),
        CompletionItemKind: { Keyword: 17, Class: 5, Function: 1, Snippet: 27 },
      },
    };
    registerScarpLanguage(mockMonaco as unknown as Parameters<typeof registerScarpLanguage>[0]);
    expect(register).not.toHaveBeenCalled();
    expect(setMonarchTokensProvider).not.toHaveBeenCalled();
  });
});

describe('Scarp editor assistance registration', () => {
  it('registers code completion, hover, and document symbols for .srp only', () => {
    const provideCompletion = vi.fn();
    const provideHover = vi.fn();
    const provideSymbols = vi.fn();
    const provideDefinition = vi.fn();
    const provideSignature = vi.fn();
    const provideInlays = vi.fn();
    const mockMonaco = {
      Range: class {
        constructor(public startLineNumber: number, public startColumn: number,
          public endLineNumber: number, public endColumn: number) {}
      },
      languages: {
        getLanguages: () => [],
        register: vi.fn(),
        setLanguageConfiguration: vi.fn(),
        setMonarchTokensProvider: vi.fn(),
        registerCompletionItemProvider: provideCompletion,
        registerHoverProvider: provideHover,
        registerDocumentSymbolProvider: provideSymbols,
        registerDefinitionProvider: provideDefinition,
        registerSignatureHelpProvider: provideSignature,
        registerInlayHintsProvider: provideInlays,
        InlayHintKind: { Parameter: 2 },
        CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
        CompletionItemKind: { Keyword: 17, Class: 5, Function: 1, Snippet: 27 },
        SymbolKind: { Function: 11, Enum: 9, Struct: 22 },
      },
    };
    let settings: IntelliSensePreferences = { ...DEFAULT_INTELLISENSE_PREFERENCES };
    registerScarpLanguage(mockMonaco as unknown as Parameters<typeof registerScarpLanguage>[0], () => settings);
    for (const spy of [provideCompletion, provideHover, provideSymbols, provideDefinition, provideSignature, provideInlays]) {
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toBe('scarp');
    }
    const handler = provideCompletion.mock.calls[0][1] as {
      provideCompletionItems: (model: unknown, position: unknown) => { suggestions: Array<{
        label: string;
        range: { startColumn: number; endColumn: number };
      }> },
    };
    const model = {
      getValueLength: () => 0, getValue: () => '',
      getLineContent: () => 'func',
      getWordUntilPosition: () => ({ word: 'func', startColumn: 1, endColumn: 5 }),
      getWordAtPosition: () => ({ word: 'func', startColumn: 1, endColumn: 5 }),
    };
    const position = { lineNumber: 1, column: 5 };
    expect(handler.provideCompletionItems(model, position).suggestions.some((s) => s.label === 'funcra')).toBe(true);
    const giantModel = {
      getLineContent: () => { throw new Error('must not load giant lines for assistance'); },
      getWordUntilPosition: () => { throw new Error('must not complete giant lines'); },
      getWordAtPosition: () => { throw new Error('must not inspect giant lines'); },
    };
    const tooFar = { lineNumber: 1, column: MAX_ASSIST_SCAN_UNITS + 2 };
    expect(handler.provideCompletionItems(giantModel, tooFar).suggestions).toEqual([]);
    const hoverHandler = provideHover.mock.calls[0][1] as {
      provideHover: (model: unknown, position: unknown) => unknown;
    };
    expect(hoverHandler.provideHover(giantModel, tooFar)).toBeNull();
    const decimalModel = { ...model, getLineContent: () => 'bind sum = 0.1d;' };
    const decimalHover = hoverHandler.provideHover(decimalModel, { lineNumber: 1, column: 14 });
    expect(decimalHover).toMatchObject({
      range: { startColumn: 12, endColumn: 16 },
      contents: [{ value: expect.stringContaining('alpha.20') }, { value: expect.stringContaining('base-10') }],
    });
    const commentModel = { ...model, getLineContent: () => '// func' };
    expect(handler.provideCompletionItems(commentModel, { lineNumber: 1, column: 8 }).suggestions).toEqual([]);
    // Mid-word accepting "funcra" must replace the entire existing token.
    const middle = {
      getValueLength: () => 0, getValue: () => '',
      getLineContent: () => 'funcra',
      getWordUntilPosition: () => ({ word: 'fun', startColumn: 1, endColumn: 4 }),
      getWordAtPosition: () => ({ word: 'funcra', startColumn: 1, endColumn: 7 }),
    };
    const accepted = handler.provideCompletionItems(middle, {
      lineNumber: 1, column: 4,
    }).suggestions.find((item) => item.label === 'funcra');
    expect(accepted?.range).toEqual({ startLineNumber: 1, endLineNumber: 1,
      startColumn: 1, endColumn: 7 });
    // At punctuation or an inconsistent word boundary do not swallow other text.
    for (const other of [
      null,
      { word: 'other', startColumn: 1, endColumn: 6 },
      { word: 'funcra', startColumn: 2, endColumn: 7 },
    ]) {
      const boundary = {
        getValueLength: () => 0, getValue: () => '',
        getLineContent: () => 'fun(',
        getWordUntilPosition: () => ({ word: 'fun', startColumn: 1, endColumn: 4 }),
        getWordAtPosition: () => other,
      };
      const suggestion = handler.provideCompletionItems(boundary, {
        lineNumber: 1, column: 4,
      }).suggestions.find((item) => item.label === 'funcra');
      expect(suggestion?.range).toMatchObject({ startColumn: 1, endColumn: 4 });
    }
    const existingCall = {
      ...model, getLineContent: () => 'print(42);',
      getWordUntilPosition: () => ({ word: 'pri', startColumn: 1, endColumn: 4 }),
      getWordAtPosition: () => ({ word: 'print', startColumn: 1, endColumn: 6 }),
    };
    const existingCallSuggestion = handler.provideCompletionItems(existingCall, { lineNumber: 1, column: 4 }).suggestions.find(item => item.label === 'print');
    expect(existingCallSuggestion).toMatchObject({ insertText: 'print', range: { startColumn: 1, endColumn: 6 } });
    expect(existingCallSuggestion).not.toHaveProperty('insertTextRules');
    const localSource = 'funcra add(a: integer) -> integer {}\nadd(1);';
    const localModel = {
      getValueLength: () => localSource.length, getValue: () => localSource,
      getLineContent: () => 'add(1);',
      getOffsetAt: (p: { column: number }) => localSource.lastIndexOf('add') + p.column - 1,
      getWordUntilPosition: () => ({ word: 'ad', startColumn: 1, endColumn: 3 }),
      getWordAtPosition: () => ({ word: 'add', startColumn: 1, endColumn: 4 }),
    };
    const localResult = handler.provideCompletionItems(localModel, { lineNumber: 2, column: 3 }).suggestions;
    expect(localResult[0]).toMatchObject({
      label: 'add', detail: 'add(a: integer)', insertText: 'add',
      range: { startColumn: 1, endColumn: 4 },
    });
    expect(localResult[0]).not.toHaveProperty('insertTextRules');
    for (const [context, expected] of [
      ['return\n', true], ['// math.\n', true], ['math.\n', false],
      ['Choice::\n// note\n', false], ['funcra\n', false],
    ] as const) {
      const multi = 'funcra add(a: integer) -> integer {}\n' + context + 'add(1);';
      const candidate = {
        ...localModel, getValue: () => multi, getValueLength: () => multi.length,
        getOffsetAt: (p: { column: number }) => multi.lastIndexOf('add') + p.column - 1,
      };
      const result = handler.provideCompletionItems(candidate,
        { lineNumber: multi.split('\n').length, column: 3 }).suggestions;
      expect(result.some(item => item.label === 'add'), context).toBe(expected);
    }
    const qualifiedLines = ['module. // qualifier', '// continuation', 'pri'];
    const qualifiedModel = {
      ...model, getLineContent: (n: number) => qualifiedLines[n - 1],
      getLineMaxColumn: (n: number) => qualifiedLines[n - 1].length + 1,
      getWordUntilPosition: () => ({ word: 'pri', startColumn: 1, endColumn: 4 }),
      getWordAtPosition: () => ({ word: 'pri', startColumn: 1, endColumn: 4 }),
    };
    expect(handler.provideCompletionItems(qualifiedModel, { lineNumber: 3, column: 4 }).suggestions).toEqual([]);
    const oversizedCompletion = {
      ...localModel, getValueLength: () => 1024 * 1024,
      getValue: () => { throw new Error('large buffer must not be copied'); },
    };
    expect(handler.provideCompletionItems(oversizedCompletion,
      { lineNumber: 2, column: 3 }).suggestions.some(item => item.label === 'add')).toBe(false);
    const definitions = provideDefinition.mock.calls[0][1] as {
      provideDefinition: (model: unknown, position: unknown, token: unknown) => unknown;
    };
    const source = 'funcra add(a: integer) -> integer { return a; }\nprint(add(1));';
    const uri = { path: '/unsaved.srp' };
    const definitionModel = {
      uri, getValue: () => source, getValueLength: () => source.length,
      getLineContent: () => 'print(add(1));', getLineMaxColumn: () => 15,
      getOffsetAt: () => source.lastIndexOf('add'),
    };
    expect(definitions.provideDefinition(definitionModel,
      { lineNumber: 2, column: 7 }, { isCancellationRequested: false })).toEqual({
      uri, range: { startLineNumber: 1, startColumn: 8, endLineNumber: 1, endColumn: 11 },
    });
    expect(definitions.provideDefinition(definitionModel,
      { lineNumber: 2, column: 7 }, { isCancellationRequested: true })).toBeNull();
    const oversized = { ...definitionModel, getValueLength: () => 1024 * 1024,
      getValue: () => { throw new Error('large buffer must not be copied'); } };
    expect(definitions.provideDefinition(oversized,
      { lineNumber: 2, column: 7 }, { isCancellationRequested: false })).toBeNull();
    for (const [call, expected] of [
      ['add\n// args\n(1)', true],
      ['math.\nadd(1)', false],
      ['funcra\nadd(1)', false],
    ] as const) {
      const multi = 'funcra add(a: integer) -> integer {}\n' + call;
      const multilineModel = {
        ...definitionModel, getValue: () => multi, getValueLength: () => multi.length,
        getOffsetAt: () => multi.lastIndexOf('add'),
      };
      const result = definitions.provideDefinition(multilineModel,
        { lineNumber: 2, column: 1 }, { isCancellationRequested: false });
      if (expected) expect(result).toEqual({
        uri, range: { startLineNumber: 1, startColumn: 8, endLineNumber: 1, endColumn: 11 },
      });
      else expect(result).toBeNull();
    }
    const signatures = provideSignature.mock.calls[0][1] as {
      provideSignatureHelp: (model: unknown, position: unknown, token: unknown) => unknown;
    };
    const signatureSource = 'funcra add(a: integer, b: integer) -> integer {}\nadd(1, );';
    const signatureModel = {
      getValueLength: () => signatureSource.length, getValue: () => signatureSource,
      getOffsetAt: () => signatureSource.lastIndexOf(')'),
    };
    expect(signatures.provideSignatureHelp(signatureModel, { lineNumber: 2, column: 8 },
      { isCancellationRequested: false })).toMatchObject({
      value: { activeSignature: 0, activeParameter: 1,
        signatures: [{ label: 'add(a: integer, b: integer)',
          parameters: [{ label: 'a: integer' }, { label: 'b: integer' }] }] },
    });
    expect(signatures.provideSignatureHelp(signatureModel, { lineNumber: 2, column: 8 },
      { isCancellationRequested: true })).toBeNull();
    for (const context of ['math.\nadd(', 'record\nadd(', 'éadd(', 'add(factory()(']) {
      const text = 'funcra add(a: integer, b: integer) -> integer {}\n' + context;
      const candidate = {
        getValueLength: () => text.length, getValue: () => text,
        getOffsetAt: () => text.length,
      };
      expect(signatures.provideSignatureHelp(candidate,
        { lineNumber: text.split('\n').length, column: context.split('\n').at(-1)!.length + 1 },
        { isCancellationRequested: false }), context).toBeNull();
    }
    expect(signatures.provideSignatureHelp({
      getValueLength: () => 1024 * 1024,
      getValue: () => { throw new Error('large buffer must not be copied'); },
    }, { lineNumber: 2, column: 8 }, { isCancellationRequested: false })).toBeNull();
    const builtinSource = 'bigint_pow(value, 2);';
    const builtinModel = {
      getValueLength: () => builtinSource.length, getValue: () => builtinSource,
      getOffsetAt: () => builtinSource.indexOf('2'),
    };
    expect(signatures.provideSignatureHelp(builtinModel, { lineNumber: 1, column: 19 }, { isCancellationRequested: false })).toMatchObject({
      value: { activeParameter: 1, signatures: [{ label: 'bigint_pow(value: bigint, exponent: integer)' }] },
    });
    settings = { ...settings, builtinSignatureHelp: false };
    expect(signatures.provideSignatureHelp(builtinModel, { lineNumber: 1, column: 19 }, { isCancellationRequested: false })).toBeNull();
    settings = { ...DEFAULT_INTELLISENSE_PREFERENCES };
    const inlays = provideInlays.mock.calls[0][1] as {
      provideInlayHints: (model: unknown, range: unknown, token: unknown) => unknown;
    };
    const inlayRange = { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 21 };
    expect(inlays.provideInlayHints(forbiddenInlayModel(), inlayRange, { isCancellationRequested: false })).toBeNull();
    function forbiddenInlayModel() { return { getValueLength: () => { throw Error('disabled inlay accessed model'); } }; }
    settings = { ...settings, inlayHintMode: 'literals' };
    const inlaySource = 'bigint_pow(value, 2);';
    const inlayModel = {
      getValueLength: () => inlaySource.length, getValue: () => inlaySource,
      getOffsetAt: (p: { column: number }) => p.column - 1,
      getPositionAt: (offset: number) => ({ lineNumber: 1, column: offset + 1 }),
    };
    expect(inlays.provideInlayHints(inlayModel, inlayRange, { isCancellationRequested: false })).toMatchObject({
      hints: [{ label: 'exponent:', position: { lineNumber: 1, column: 19 }, kind: 2 }],
    });
    expect(inlays.provideInlayHints(inlayModel, { ...inlayRange, endColumn: 10 }, { isCancellationRequested: false })).toMatchObject({ hints: [] });
    expect(inlays.provideInlayHints(forbiddenInlayModel(), inlayRange, { isCancellationRequested: true })).toBeNull();
    settings = { ...DEFAULT_INTELLISENSE_PREFERENCES };
    const outline = provideSymbols.mock.calls[0][1] as {
      provideDocumentSymbols: (model: unknown) => Array<{ name: string }>,
    };
    expect(outline.provideDocumentSymbols({
      getValueLength: () => 'funcra add(a: integer) -> integer { return a; }'.length,
      getValue: () => 'funcra add(a: integer) -> integer { return a; }',
      getLineMaxColumn: () => 44,
    }).map((item) => item.name)).toEqual(['add']);
    const nominalSource = [
        'pub record Task { title: string }',
        'pub variant State { Ready }',
        'pure funcra check() -> boolean { return true; }',
      ].join('\n');
    const nominal = outline.provideDocumentSymbols({
      getValueLength: () => nominalSource.length, getValue: () => nominalSource,
      getLineMaxColumn: () => 48,
    }) as Array<{ name: string; detail: string; kind: number;
      selectionRange: { startLineNumber: number; startColumn: number } }>;
    expect(nominal.map(({ name, detail, kind }) => [name, detail, kind])).toEqual([
      ['Task', 'Scarp record', 22],
      ['State', 'Scarp variant', 9],
      ['check', 'Scarp function', 11],
    ]);
    expect(nominal[0].selectionRange.startLineNumber).toBe(1);
    expect(nominal[1].selectionRange.startColumn).toBe(13);
    const localHoverSource = 'funcra add(a: integer) -> integer {}\nadd(1);';
    const localHoverModel = {
      getLineContent: () => 'add(1);',
      getWordAtPosition: () => ({ word: 'add', startColumn: 1, endColumn: 4 }),
      getValueLength: () => localHoverSource.length, getValue: () => localHoverSource,
      getOffsetAt: () => localHoverSource.lastIndexOf('add') + 1,
      getVersionId: () => 1,
    };
    expect(hoverHandler.provideHover(localHoverModel, { lineNumber: 2, column: 2 })).toMatchObject({
      contents: [{ value: '\x60add(a: integer)\x60', isTrusted: false, supportHtml: false },
        { value: expect.stringContaining('line 1') }],
    });
    settings = { ...settings, localFunctionHover: false };
    expect(hoverHandler.provideHover({
      ...localHoverModel, getValueLength: () => { throw new Error('disabled local hover read size'); },
    }, { lineNumber: 2, column: 2 })).toBeNull();
    settings = { ...DEFAULT_INTELLISENSE_PREFERENCES };
    // Live Settings changes must gate providers before any model access.
    const forbidden = new Proxy({}, { get() { throw new Error('disabled provider read model'); } });
    settings = { ...settings, completionMode: 'off', hover: false,
      signatureHelp: false, goToDefinition: false, documentSymbols: false };
    expect(handler.provideCompletionItems(forbidden, position).suggestions).toEqual([]);
    expect(hoverHandler.provideHover(forbidden, position)).toBeNull();
    expect(signatures.provideSignatureHelp(forbidden, position, { isCancellationRequested: false })).toBeNull();
    expect(definitions.provideDefinition(forbidden, position, { isCancellationRequested: false })).toBeNull();
    expect(outline.provideDocumentSymbols(forbidden)).toEqual([]);
    // Manual mode leaves explicit suggestions available; categories are independent.
    settings = { ...DEFAULT_INTELLISENSE_PREFERENCES, completionMode: 'manual', templates: false };
    expect(handler.provideCompletionItems(model, position).suggestions.some(s => s.label === 'funcra')).toBe(false);
    settings = { ...settings, templates: true };
    expect(handler.provideCompletionItems(model, position).suggestions.some(s => s.label === 'funcra')).toBe(true);
    settings = { ...settings, localFunctions: false };
    expect(handler.provideCompletionItems({
      ...localModel, getValueLength: () => { throw new Error('disabled local scan read size'); },
      getValue: () => { throw new Error('disabled local scan copied source'); },
    }, { lineNumber: 2, column: 3 }).suggestions.some(s => s.label === 'add')).toBe(false);
    settings = { ...DEFAULT_INTELLISENSE_PREFERENCES, localAnalysisKiB: 64 };
    const tooLarge = { ...localModel, getValueLength: () => 65537,
      getValue: () => { throw new Error('local analysis budget exceeded'); } };
    expect(handler.provideCompletionItems(tooLarge, { lineNumber: 2, column: 3 }).suggestions.some(s => s.label === 'add')).toBe(false);
    expect(signatures.provideSignatureHelp(tooLarge, position, { isCancellationRequested: false })).toBeNull();
    expect(outline.provideDocumentSymbols(tooLarge)).toEqual([]);
    expect(definitions.provideDefinition({ ...definitionModel, ...tooLarge },
      position, { isCancellationRequested: false })).toBeNull();
    settings = { ...DEFAULT_INTELLISENSE_PREFERENCES, suggestionLimit: 10 };
    const empty = { ...model, getLineContent: () => '', getWordUntilPosition: () => ({ word: '', startColumn: 1, endColumn: 1 }), getWordAtPosition: () => null };
    expect(handler.provideCompletionItems(empty, { lineNumber: 1, column: 1 }).suggestions).toHaveLength(10);
    settings = { ...settings, templates: false, builtins: false, keywordsAndTypes: false, localFunctions: false };
    expect(handler.provideCompletionItems(forbidden, position).suggestions).toEqual([]);
  });
});
