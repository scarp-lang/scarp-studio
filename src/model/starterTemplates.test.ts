import { describe, expect, it } from 'vitest';
import decimalLiteralSource from '../../qa/windows/09-decimal-literals.srp?raw';
import tupleUpdateSource from '../../qa/windows/10-tuple-updates.srp?raw';
import { getScarpStarterTemplate, scarpStarterTemplates } from './starterTemplates';

describe('Scarp-only starter templates', () => {
  it('offers independent real Scarp learning scenarios', () => {
    expect(scarpStarterTemplates.map(({ id }) => id)).toEqual([
      'hello', 'bindings', 'functions', 'decisions', 'loops', 'whilecontrol', 'nestedloops', 'bigint', 'input', 'prompts', 'arrays', 'exactmath', 'decimals', 'decimalliterals', 'tupleupdates', 'decimalinput', 'records', 'variants', 'collections', 'arrayupdates', 'optionresult',
    ]);
    expect(new Set(scarpStarterTemplates.map(({ id }) => id)).size).toBe(21);
  });

  it('uses only .srp snippets that can be edited in an untitled buffer', () => {
    for (const starter of scarpStarterTemplates) {
      expect(starter.id).toMatch(/^[a-z]+$/);
      expect(starter.title.length).toBeGreaterThan(2);
      expect(starter.source.endsWith('\n')).toBe(true);
      expect(starter.source.length).toBeLessThan(4096);
      expect(starter.source).not.toContain('fn main(');
      expect(starter.source).not.toMatch(/\b(?:class|let|mut|def|async|await)\b/);
    }
  });

  it('includes compiler-backed while, break, continue and nested loop starters', () => {
    const simple = getScarpStarterTemplate('whilecontrol');
    const nested = getScarpStarterTemplate('nestedloops');
    expect(simple?.source).toContain('while index < 10');
    expect(simple?.source).toContain('continue;');
    expect(simple?.source).toContain('break;');
    expect(simple?.source).toContain('assert(total == 12');
    expect(simple?.source).toContain('SCARP_STUDIO_GUI_WHILE_OK');
    expect(nested?.source).toContain('repeat 3 as outer');
    expect(nested?.source).toContain('while inner < 5');
    expect(nested?.source).toContain('assert(total == 18');
    expect(nested?.source).toContain('SCARP_STUDIO_GUI_NESTED_LOOP_OK');
  });

  it('includes an explicit saved-source compiler input example', () => {
    expect(getScarpStarterTemplate('input')?.source).toContain('read_line()');
    expect(getScarpStarterTemplate('input')?.source).toContain('Program Input');
  });

  it('includes a version-gated exact decimal BigInt example', () => {
    const source = getScarpStarterTemplate('bigint')?.source ?? '';
    expect(source).toContain('alpha.9');
    expect(source).toContain('bind large: bigint');
    expect(source).toContain('bigint_from_integer(1)');
  });

  it('version-gates three alpha.10 starter programs with explicit execution modes', () => {
    const prompt = getScarpStarterTemplate('prompts')?.source ?? '';
    expect(prompt).toContain('alpha.10');
    expect(prompt).toContain('BEFORE Run');
    expect(prompt).toContain('input("Name: ")');
    const arrays = getScarpStarterTemplate('arrays')?.source ?? '';
    expect(arrays).toContain('array<integer, 2>');
    expect(arrays).toContain('[array: 10, 20]');
    const exact = getScarpStarterTemplate('exactmath')?.source ?? '';
    expect(exact).toContain('bigint_gcd(left, right)');
  });

  it('provides alpha.11 exact-decimal and preloaded prompt examples', () => {
    const arithmetic = getScarpStarterTemplate('decimals')?.source ?? '';
    expect(arithmetic).toContain('alpha.11');
    expect(arithmetic).toContain('bind price: decimal');
    expect(arithmetic).toContain('decimal_format(');
    expect(arithmetic).toContain('half_even');
    const prompted = getScarpStarterTemplate('decimalinput')?.source ?? '';
    expect(prompted).toContain('input_decimal("Amount: ")');
    expect(prompted).toContain('BEFORE Run');
    expect(prompted).toContain('alpha.11');
  });

  it('offers alpha.12 records, variants, collections and optional propagation', () => {
    for (const id of ['records', 'variants', 'collections', 'optionresult']) {
      expect(getScarpStarterTemplate(id)?.source).toContain('alpha.12');
      expect(getScarpStarterTemplate(id)?.source).toContain('interpreter');
    }
    expect(getScarpStarterTemplate('records')?.source).toContain('new Task');
    expect(getScarpStarterTemplate('variants')?.source).toContain('match on hit');
    expect(getScarpStarterTemplate('collections')?.source).toContain('map_get_or(');
    expect(getScarpStarterTemplate('optionresult')?.source).toContain('value?');
  });

  it('offers an alpha.18 immutable array update starter with explicit compiler gate', () => {
    const starter = getScarpStarterTemplate('arrayupdates');
    expect(starter?.source).toContain('alpha.18');
    expect(starter?.source).toContain('array_set(original, 1, 99)');
    expect(starter?.source).toContain('original[1] == 8');
    expect(starter?.source).toContain('changed[1] == 99');
    expect(starter?.description).toContain('without mutating');
  });

  it('embeds exactly the alpha.20 CLI QA fixture bytes in both new starters', () => {
    expect(getScarpStarterTemplate('decimalliterals')?.source).toBe(decimalLiteralSource);
    expect(getScarpStarterTemplate('tupleupdates')?.source).toBe(tupleUpdateSource);
    expect(decimalLiteralSource).toContain('0.1d + 0.2d');
    expect(decimalLiteralSource).toContain('SCARP_STUDIO_GUI_DECIMAL_LITERAL_OK');
    expect(tupleUpdateSource).toContain('position[0] = 50;');
    expect(tupleUpdateSource).toContain('before < position');
    expect(tupleUpdateSource).toContain('SCARP_STUDIO_GUI_TUPLE_UPDATE_OK');
  });

  it('looks up only registered templates without accepting arbitrary source', () => {
    expect(getScarpStarterTemplate('functions')?.source).toContain('pure funcra add');
    expect(getScarpStarterTemplate('../../outside')).toBeNull();
    expect(getScarpStarterTemplate('')).toBeNull();
  });
});
