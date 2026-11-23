import { describe, expect, it, vi } from 'vitest';
import { registerScarpLanguage } from './scarp';
import { MAX_ASSIST_SCAN_UNITS } from './assist';

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
        CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
        CompletionItemKind: { Keyword: 17, Class: 5, Function: 1, Snippet: 27 },
        SymbolKind: { Function: 11, Enum: 9, Struct: 22 },
      },
    };
    registerScarpLanguage(mockMonaco as unknown as Parameters<typeof registerScarpLanguage>[0]);
    for (const spy of [provideCompletion, provideHover, provideSymbols]) {
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
    const commentModel = { ...model, getLineContent: () => '// func' };
    expect(handler.provideCompletionItems(commentModel, { lineNumber: 1, column: 8 }).suggestions).toEqual([]);
    // Mid-word accepting "funcra" must replace the entire existing token.
    const middle = {
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
        getLineContent: () => 'fun(',
        getWordUntilPosition: () => ({ word: 'fun', startColumn: 1, endColumn: 4 }),
        getWordAtPosition: () => other,
      };
      const suggestion = handler.provideCompletionItems(boundary, {
        lineNumber: 1, column: 4,
      }).suggestions.find((item) => item.label === 'funcra');
      expect(suggestion?.range).toMatchObject({ startColumn: 1, endColumn: 4 });
    }
    const outline = provideSymbols.mock.calls[0][1] as {
      provideDocumentSymbols: (model: unknown) => Array<{ name: string }>,
    };
    expect(outline.provideDocumentSymbols({
      getValue: () => 'funcra add(a: integer) -> integer { return a; }',
      getLineMaxColumn: () => 44,
    }).map((item) => item.name)).toEqual(['add']);
    const nominal = outline.provideDocumentSymbols({
      getValue: () => [
        'pub record Task { title: string }',
        'pub variant State { Ready }',
        'pure funcra check() -> boolean { return true; }',
      ].join('\n'),
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
  });
});
