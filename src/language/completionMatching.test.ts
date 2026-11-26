import { describe, expect, it } from 'vitest';
import { boundedCompletionContext, completionMatchRank, lineCompletionContext, MAX_COMPLETION_LOOKBACK_LINES, MAX_COMPLETION_LOOKBACK_UNITS } from './completionMatching';
import { DEFAULT_INTELLISENSE_PREFERENCES as defaults } from '../model/intelliSensePreferences';
import { collectScarpSuggestions } from './suggestionPipeline';
import { LocalSourceAnalysis } from './localAnalysis';

describe('bounded completion matching', () => {
  it('distinguishes exact, prefix, abbreviation and no match', () => {
    expect(completionMatchRank('add', 'add', 'prefix')).toBe(0);
    expect(completionMatchRank('add', 'ad', 'prefix')).toBe(1);
    expect(completionMatchRank('bigint_pow', 'bgpw', 'prefix')).toBe(Infinity);
    expect(completionMatchRank('bigint_pow', 'bgpw', 'subsequence')).toBeGreaterThan(1);
    expect(completionMatchRank('bigint_pow', 'pwg', 'subsequence')).toBe(Infinity);
    expect(completionMatchRank('add', 'AD', 'subsequence')).toBe(Infinity);
    expect(completionMatchRank('x'.repeat(257), 'x', 'prefix')).toBe(Infinity);
    expect(completionMatchRank('x', 'x'.repeat(129), 'subsequence')).toBe(Infinity);
    expect(completionMatchRank('bigint_pow', 'b*p', 'subsequence')).toBe(Infinity);
  });
  it('keeps catalog matching locale-independent and limits after ranking', () => {
    const settings = { ...defaults, matchingMode: 'subsequence' as const, suggestionLimit: 10 as const };
    const items = collectScarpSuggestions(settings, 'BGPW');
    expect(items.some(item => item.label === 'bigint_pow')).toBe(true);
    expect(items.length).toBeLessThanOrEqual(10);
    const rank = (label: string) => completionMatchRank(label.toLowerCase(), 'big', 'subsequence');
    const catalog = collectScarpSuggestions(settings, 'big');
    expect(catalog.map(item => rank(item.label))).toEqual(catalog.map(item => rank(item.label)).sort((a,b) => a-b));
  });
  it('ranks local prefix matches before abbreviations and preserves exact names', () => {
    const source = 'funcra add_values(a: integer) -> integer {}\nfuncra av(a: integer) -> integer {}\nav';
    const offset = source.length - 2;
    const analysis = new LocalSourceAnalysis(source);
    const rank = (name: string, needle: string) => completionMatchRank(name, needle, 'subsequence');
    const result = analysis.complete(offset, source.length, 'av', new Set(), (name, needle) => Number.isFinite(rank(name, needle)), rank);
    expect(result.map(item => item.name)).toEqual(['av', 'add_values']);
  });
});
describe('same-line catalog context', () => {
  it('recognizes explicit qualifier and declaration contexts but not comparisons', () => {
    for (const prefix of ['math.', 'Thing:: ', 'item-> ', 'bind ', 'var ', 'funcra ', 'record ', 'variant ', 'new ', 'as ']) {
      expect(lineCompletionContext(prefix + 'pri', prefix.length), prefix).toBe('blocked');
    }
    for (const prefix of ['', 'print(', 'return ', 'x > ', 'x >= ', 'mybind ', 'x + ']) {
      expect(lineCompletionContext(prefix + 'pri', prefix.length), prefix).toBe('unqualified');
    }
    expect(lineCompletionContext('x', -1)).toBe('blocked');
  });
  it('opt-out restores catalog but never invokes local resolution in blocked context', () => {
    const forbidden = () => { throw Error('blocked local context'); };
    expect(collectScarpSuggestions(defaults, 'pri', forbidden, 'blocked')).toEqual([]);
    expect(collectScarpSuggestions({ ...defaults, conservativeCatalog: false }, 'pri', forbidden, 'blocked').some(item => item.label === 'print')).toBe(true);
  });
});


describe('bounded multiline completion context', () => {
  function context(lines: string[]) {
    const line = lines.at(-1)!;
    return boundedCompletionContext(line, line.lastIndexOf('pri'), lines.length, (n, remaining) => {
      const previous = lines[n - 1];
      return previous.length <= remaining ? previous : null;
    });
  }
  it('carries explicit qualifiers and declaration introducers through comments and empty lines', () => {
    for (const prefix of ['module.', 'Choice:: // variant', 'obj->', 'funcra', 'bind // name']) {
      expect(context([prefix, '// trivia', '', '  pri']), prefix).toBe('blocked');
    }
  });
  it('does not treat comment text, strings or comparisons as qualifiers', () => {
    for (const prefix of ['// module.', 'print("module.")', '"funcra"', 'x >', 'x >=', 'return']) {
      expect(context([prefix, '  pri']), prefix).toBe('unqualified');
    }
    expect(context(['module.', 'print(pri'])).toBe('unqualified');
  });
  it('honors bounded line count and aggregate size and never reads past a blocked current prefix', () => {
    let reads = 0;
    const reader = () => { reads++; return ''; };
    expect(boundedCompletionContext('module.pri', 7, 100, reader)).toBe('blocked');
    expect(reads).toBe(0);
    expect(boundedCompletionContext('pri', 0, 100, reader)).toBe('unqualified');
    expect(reads).toBe(MAX_COMPLETION_LOOKBACK_LINES);
    let budget = 0;
    expect(boundedCompletionContext('pri', 0, 100, (_n, remaining) => {
      budget = remaining; return ' '.repeat(remaining + 1);
    })).toBe('unqualified');
    expect(budget).toBe(MAX_COMPLETION_LOOKBACK_UNITS);
  });
});
