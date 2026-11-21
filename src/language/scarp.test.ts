import { describe, expect, it, vi } from 'vitest';
import { registerScarpLanguage } from './scarp';

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
  it('recognizes implemented Scarp statements, contracts and output forms', () => {
    const provider = captureProvider();
    for (const word of [
      'assert', 'needs', 'ensures', 'print', 'println', 'write', 'eprint', 'ewrite',
      'funcra', 'pure', 'pub', 'import', 'elif', 'repeat',
    ]) {
      expect(provider.keywords, word).toContain(word);
    }
    for (const type of ['integer', 'float', 'boolean', 'string', 'unit', 'vector', 'integers', 'tile', 'tuple']) {
      expect(provider.typeKeywords, type).toContain(type);
    }
  });

  it('keeps unsupported proposals and ordinary intrinsic calls out of keywords', () => {
    const provider = captureProvider();
    for (const name of ['for', 'match', 'ask', 'class', 'read_line']) {
      expect(provider.keywords, name).not.toContain(name);
    }
    expect(provider.legacyKeywords).toEqual(['let', 'mut']);
    expect(provider.builtinFunctions).toEqual(['array_len', 'array_get_or', 'input_boolean']);
    for (const builtin of provider.builtinFunctions) {
      expect(provider.keywords).not.toContain(builtin);
    }
    const identifier = provider.tokenizer.root.find(([, action]) =>
      typeof action === 'object' && action !== null && 'cases' in action
    );
    expect(identifier?.[1]).toEqual({
      cases: {
        '@keywords': 'keyword',
        '@typeKeywords': 'type',
        '@builtinFunctions': 'predefined',
        '@legacyKeywords': 'invalid',
        '@default': 'identifier',
      },
    });
  });

  it('accepts published hexadecimal and binary integers but rejects malformed literals', () => {
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
      },
    };
    registerScarpLanguage(mockMonaco as unknown as Parameters<typeof registerScarpLanguage>[0]);
    expect(register).not.toHaveBeenCalled();
    expect(setMonarchTokensProvider).not.toHaveBeenCalled();
  });
});
