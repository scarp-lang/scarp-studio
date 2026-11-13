import { describe, expect, it, vi } from 'vitest';
import { registerScarpLanguage } from './scarp';

type TokenRule = [RegExp, unknown];
type TokenProvider = {
  keywords: string[];
  typeKeywords: string[];
  legacyKeywords: string[];
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

  it('keeps unsupported proposals and ordinary intrinsic calls out of keywords', () => {
    const provider = captureProvider();
    for (const name of ['for', 'match', 'ask', 'class', 'read_line']) {
      expect(provider.keywords, name).not.toContain(name);
    }
    expect(provider.legacyKeywords).toEqual(['let', 'mut']);
    const identifier = provider.tokenizer.root.find(([, action]) =>
      typeof action === 'object' && action !== null && 'cases' in action
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

  it('does not show unsupported hexadecimal, binary or underscored literals as numbers', () => {
    const root = captureProvider().tokenizer.root;
    const valid = root.find(([, token]) => token === 'number')?.[0];
    const invalid = root.find(([, token]) => token === 'number.invalid')?.[0];
    expect(valid).toBeDefined();
    expect(invalid).toBeDefined();
    for (const value of ['0', '42', '3.25', '1e3', '1.2E-4']) {
      expect(matchesWhole(valid!, value), value).toBe(true);
    }
    for (const value of ['0xFF', '0b101', '12_345']) {
      expect(matchesWhole(valid!, value), value).toBe(false);
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
        SymbolKind: { Function: 11 },
      },
    };
    registerScarpLanguage(mockMonaco as unknown as Parameters<typeof registerScarpLanguage>[0]);
    for (const spy of [provideCompletion, provideHover, provideSymbols]) {
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toBe('scarp');
    }
    const handler = provideCompletion.mock.calls[0][1] as {
      provideCompletionItems: (model: unknown, position: unknown) => { suggestions: Array<{ label: string }> },
    };
    const model = {
      getLineContent: () => 'func',
      getWordUntilPosition: () => ({ word: 'func', startColumn: 1, endColumn: 5 }),
    };
    const position = { lineNumber: 1, column: 5 };
    expect(handler.provideCompletionItems(model, position).suggestions.some((s) => s.label === 'funcra')).toBe(true);
    const commentModel = { ...model, getLineContent: () => '// func' };
    expect(handler.provideCompletionItems(commentModel, { lineNumber: 1, column: 8 }).suggestions).toEqual([]);
    const outline = provideSymbols.mock.calls[0][1] as {
      provideDocumentSymbols: (model: unknown) => Array<{ name: string }>,
    };
    expect(outline.provideDocumentSymbols({
      getValue: () => 'funcra add(a: integer) -> integer { return a; }',
      getLineMaxColumn: () => 44,
    }).map((item) => item.name)).toEqual(['add']);
  });
});
