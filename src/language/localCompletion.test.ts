import { describe, expect, it } from 'vitest';
import { canCompleteLocalFunction, completeLocalFunctions, MAX_LOCAL_COMPLETIONS } from './localCompletion';
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
