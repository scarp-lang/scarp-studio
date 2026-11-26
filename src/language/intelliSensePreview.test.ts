import { describe, expect, it } from 'vitest';
import { DEFAULT_INTELLISENSE_PREFERENCES as defaults } from '../model/intelliSensePreferences';
import { evaluateIntelliSensePreview, INTELLISENSE_EXAMPLES } from './intelliSensePreview';

describe('Settings-only language assistance examples', () => {
  it('contains one bounded cursor and no real workspace data in each fixed example', () => {
    expect(new Set(INTELLISENSE_EXAMPLES.map(item => item.id)).size).toBe(INTELLISENSE_EXAMPLES.length);
    for (const item of INTELLISENSE_EXAMPLES) {
      expect(item.marked.match(/\|/g)).toHaveLength(1);
      expect(item.marked.length).toBeLessThan(1024);
      const result = evaluateIntelliSensePreview(item.id, defaults);
      expect(result.before + '|' + result.after).toBe(item.marked);
      if (item.id === 'abbreviation' || item.id === 'qualified' || item.id === 'multiline-qualified') expect(result.results, item.id).toEqual([]);
      else expect(result.results.length, item.id).toBeGreaterThan(0);
    }
  });
  it('uses actual catalog and local function results', () => {
    expect(evaluateIntelliSensePreview('templates', defaults).results.some(item => item.label === 'funcra')).toBe(true);
    expect(evaluateIntelliSensePreview('builtins', defaults).results.every(item => item.label.startsWith('bigint_'))).toBe(true);
    expect(evaluateIntelliSensePreview('local', defaults).results[0]?.label).toBe('add');
    expect(evaluateIntelliSensePreview('priority', defaults).results[0]?.label).toBe('print_total');
    expect(evaluateIntelliSensePreview('priority', { ...defaults, preferLocal: false }).results[0]?.kind).toContain('catalog');
  });
  it('respects mode and independent completion sources', () => {
    for (const id of ['templates', 'builtins', 'types', 'local', 'priority'] as const) {
      expect(evaluateIntelliSensePreview(id, { ...defaults, completionMode: 'off' }).results).toEqual([]);
    }
    expect(evaluateIntelliSensePreview('templates', { ...defaults, templates: false }).results).toEqual([]);
    expect(evaluateIntelliSensePreview('local', { ...defaults, localFunctions: false }).results).toEqual([]);
    expect(evaluateIntelliSensePreview('builtins', { ...defaults, builtins: false }).results).toEqual([]);
    expect(evaluateIntelliSensePreview('types', { ...defaults, keywordsAndTypes: false }).results).toEqual([]);
    expect(evaluateIntelliSensePreview('local', { ...defaults, completionMode: 'manual' }).explanation).toContain('Ctrl+Space');
  });
  it('shows actual typed parameters and locations, respecting individual navigation gates', () => {
    expect(evaluateIntelliSensePreview('local-hover', defaults).results[0].label).toBe('add(a: integer, b: integer)');
    expect(evaluateIntelliSensePreview('signature', defaults).results[0].detail).toBe('Active parameter: b: integer');
    expect(evaluateIntelliSensePreview('definition', defaults).results[0].detail).toBe('Line 1, column 8');
    expect(evaluateIntelliSensePreview('symbols', defaults).results.map(item => item.label)).toEqual(['add', 'Point']);
    expect(evaluateIntelliSensePreview('local-hover', { ...defaults, localFunctionHover: false }).results).toEqual([]);
    expect(evaluateIntelliSensePreview('catalog-hover', { ...defaults, localFunctionHover: false }).results).toHaveLength(1);
    expect(evaluateIntelliSensePreview('catalog-hover', { ...defaults, hover: false }).results).toEqual([]);
    expect(evaluateIntelliSensePreview('signature', { ...defaults, signatureHelp: false }).results).toEqual([]);
    expect(evaluateIntelliSensePreview('definition', { ...defaults, goToDefinition: false }).results).toEqual([]);
    expect(evaluateIntelliSensePreview('symbols', { ...defaults, documentSymbols: false }).results).toEqual([]);
  });
});


describe('matching and context preview', () => {
  it('uses ordered characters only when enabled and suppresses qualified catalog by default', () => {
    expect(evaluateIntelliSensePreview('abbreviation', defaults).results).toEqual([]);
    expect(evaluateIntelliSensePreview('abbreviation', { ...defaults, matchingMode: 'subsequence' }).results.some(item => item.label === 'bigint_pow')).toBe(true);
    expect(evaluateIntelliSensePreview('qualified', defaults).results).toEqual([]);
    expect(evaluateIntelliSensePreview('qualified', { ...defaults, conservativeCatalog: false }).results.some(item => item.label === 'print')).toBe(true);
  });
});


describe('safe insertion preview', () => {
  it('reuses existing arguments rather than adding a duplicate call', () => {
    const result = evaluateIntelliSensePreview('existing-call', defaults);
    expect(result.results.find(item => item.label === 'print')).toMatchObject({ insertion: 'print', asSnippet: false });
  });
});


it('suppresses a qualified multiline preview only under conservative catalog policy', () => {
  expect(evaluateIntelliSensePreview('multiline-qualified', defaults).results).toEqual([]);
  expect(evaluateIntelliSensePreview('multiline-qualified', { ...defaults, conservativeCatalog: false }).results.some(item => item.label === 'print')).toBe(true);
});
