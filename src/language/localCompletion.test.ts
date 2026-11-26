import { describe, expect, it } from 'vitest';
import { canCompleteLocalFunction, canCompleteLocalFunctionAtOffset, completeLocalFunctions, MAX_LOCAL_COMPLETIONS } from './localCompletion';
import { MAX_DEFINITION_SOURCE_UNITS } from './definition';

describe('local user-function completions', () => {
  it('offers typed, case-sensitive unique names in declaration order', () => {
    const source = [
      'funcra add(a: integer, b: integer) -> integer {}',
      'funcra add_many(values: list<integer>) -> integer {}',
      'funcra Add() -> unit {}',
      'funcra add_duplicate() -> unit {}',
      'funcra add_duplicate() -> unit {}',
      '// funcra add_fake() -> unit {}',
    ].join('\n');
    expect(completeLocalFunctions(source, 'add')).toEqual([
      { name: 'add', detail: 'add(a: integer, b: integer)' },
      { name: 'add_many', detail: 'add_many(values: list<integer>)' },
    ]);
    expect(completeLocalFunctions(source, 'add', new Set(['add'])).map(item => item.name)).toEqual(['add_many']);
    expect(completeLocalFunctions(source, 'Add').map(item => item.name)).toEqual(['Add']);
  });
  it('only offers local functions in unqualified identifier contexts', () => {
    for (const line of ['print(ad', 'return ad', 'ad(1)', '  ad']) {
      expect(canCompleteLocalFunction(line, line.indexOf('ad'), 'ad'), line).toBe(true);
    }
    for (const line of [
      '// ad', '"ad"', 'math.ad', 'math . ad', 'Choice::ad', 'x->ad',
      'funcra ad', 'new ad', 'record ad', 'bind ad', 'var ad', '1ad',
    ]) expect(canCompleteLocalFunction(line, line.indexOf('ad'), 'ad'), line).toBe(false);
    expect(canCompleteLocalFunction('ad', 0, '')).toBe(false);
    expect(canCompleteLocalFunction('ad', 0, 'ax')).toBe(false);
  });
  it('bounds inventories, result counts and malformed signature suggestions', () => {
    const many = Array.from({ length: 30 }, (_, i) => 'funcra add' + i + '() -> unit {}').join('\n');
    expect(completeLocalFunctions(many, 'add')).toHaveLength(MAX_LOCAL_COMPLETIONS);
    expect(completeLocalFunctions(many + ' '.repeat(MAX_DEFINITION_SOURCE_UNITS), 'add')).toEqual([]);
    expect(completeLocalFunctions('funcra add(a: map<string, integer) {}', 'add')).toEqual([]);
    expect(completeLocalFunctions(many, '')).toEqual([]);
  });
});

describe('whole-source local completion context', () => {
  function check(text: string, prefix = 'ad', suffix = 'd') {
    const start = text.indexOf('|');
    return canCompleteLocalFunctionAtOffset(text.replace('|', ''), start,
      start + prefix.length + suffix.length, prefix);
  }

  it('allows ordinary multiline expressions and complete replacement ranges', () => {
    for (const text of ['return\n|add', 'print(\r\n|add)', '// math.\n|add',
      'print("math.");\n|add', '|add(1)', 'return // note\n|add']) {
      expect(check(text), text).toBe(true);
    }
    expect(check('print(|ad)', 'ad', '')).toBe(true);
  });

  it('rejects qualifiers and declaration contexts across comments and newlines', () => {
    for (const qualifier of ['math.', 'Choice::', 'x->', 'funcra', 'new',
      'record', 'variant', 'bind', 'var', 'import', 'as']) {
      expect(check(qualifier + '\r\n// comment\n|add'), qualifier).toBe(false);
    }
  });

  it('rejects non-code, malformed lexical snapshots and unsafe token boundaries', () => {
    for (const text of ['// |add', '"|add"', '1|add', 'x|add',
      'é|add', '|addé', '"unterminated\n|add', '\u0000\n|add']) {
      expect(check(text), text).toBe(false);
    }
    expect(check('|add', 'ad', '')).toBe(false);
    expect(check('|add_more')).toBe(false);
    expect(check('|add', 'ax')).toBe(false);
    expect(canCompleteLocalFunctionAtOffset('add', -1, 3, 'ad')).toBe(false);
    expect(canCompleteLocalFunctionAtOffset('add', 0, 4, 'ad')).toBe(false);
    expect(canCompleteLocalFunctionAtOffset('add', 0, 3, '')).toBe(false);
  });

  it('never treats an incomplete bounded token inventory as authoritative', () => {
    expect(check('x;'.repeat(12001) + '\n|add')).toBe(false);
    expect(check(' '.repeat(MAX_DEFINITION_SOURCE_UNITS) + '|add')).toBe(false);
  });
});
