import { describe, expect, it } from 'vitest';
import { completionMatchRank, lineCompletionContext } from './completionMatching';
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
