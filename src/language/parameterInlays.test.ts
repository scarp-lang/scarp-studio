import { describe, expect, it } from 'vitest';
import { collectParameterInlays, collectParameterShadowIndex, MAX_PARAMETER_INLAYS } from './parameterInlays';
import { LocalSourceAnalysis } from './localAnalysis';
import { scanScarpSource } from './sourceLex';

const header = 'funcra add(left: integer, right: integer) -> integer {}\n';
function labels(text: string, mode: 'off' | 'literals' | 'all' = 'all', builtin = true) {
  return new LocalSourceAnalysis(text).parameterInlays(mode, builtin).map(hint => ({
    label: hint.label, next: text.slice(hint.offset, hint.offset + 1),
  }));
}
describe('inline parameter labels', () => {
  it('is opt-in, distinguishes literals and nonliteral arguments, and omits redundant names', () => {
    const source = header + 'add(left, 2); add(x, y); add(-1, +2);';
    expect(labels(source, 'off')).toEqual([]);
    expect(labels(source, 'literals')).toEqual([
      { label: 'right', next: '2' }, { label: 'left', next: '-' }, { label: 'right', next: '+' },
    ]);
    expect(labels(source)).toEqual([
      { label: 'right', next: '2' }, { label: 'left', next: 'x' }, { label: 'right', next: 'y' },
      { label: 'left', next: '-' }, { label: 'right', next: '+' },
    ]);
  });
  it('preserves argument boundaries in nested calls, collections, strings and comments', () => {
    const source = header + 'add(add(1, 2), [3, 4]);\nadd("a,b", // ignored\n5);';
    expect(labels(source)).toEqual([
      { label: 'left', next: 'a' }, { label: 'left', next: '1' }, { label: 'right', next: '2' },
      { label: 'right', next: '[' }, { label: 'left', next: '"' }, { label: 'right', next: '5' },
    ]);
    expect(labels(source, 'literals')).toEqual([
      { label: 'left', next: '1' }, { label: 'right', next: '2' }, { label: 'left', next: '"' }, { label: 'right', next: '5' },
    ]);
  });
  it('omits incomplete, wrong-arity, qualified and ambiguous declarations', () => {
    for (const call of ['add(1,', 'add(1);', 'add(1, 2, 3);', 'add(1,);', 'module.add(1, 2);',
      'module.\n// note\nadd(1, 2);', 'add(1 < 2, 3);', 'add(,2);']) {
      expect(labels(header + call), call).toEqual([]);
    }
    expect(labels(header + header + 'add(1, 2);')).toEqual([]);
    expect(labels(header + 'add(1, 2); ]')).toEqual([]);
  });
  it('gates builtins independently and never treats variadic catalog calls as fixed', () => {
    const source = header + 'add(1, 2); bigint_pow(value, 20); print(1, 2);';
    expect(labels(source)).toEqual([{ label: 'left', next: '1' }, { label: 'right', next: '2' }, { label: 'exponent', next: '2' }]);
    expect(labels(source, 'all', false)).toEqual([{ label: 'left', next: '1' }, { label: 'right', next: '2' }]);
    expect(labels('bind bigint_pow = 1; bigint_pow(1, 2);')).toEqual([]);
  });
  it('shares immutable bounded results across queries', () => {
    const text = header + 'add(1, 2);\n'.repeat(600);
    const analysis = new LocalSourceAnalysis(text);
    const result = analysis.parameterInlays('all', true);
    expect(result).toHaveLength(MAX_PARAMETER_INLAYS);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result[0])).toBe(true);
    expect(analysis.parameterInlays('all', true)).toBe(result);
    expect(analysis.parameterInlays('literals', false)).not.toBe(result);
  });
  it('rejects incomplete lexical snapshots and avoids resolver work while off', () => {
    const source = 'add(1, 2);';
    const forbidden = () => { throw Error('disabled resolver'); };
    expect(collectParameterInlays(source, scanScarpSource(source), 'off', forbidden)).toEqual([]);
    expect(collectParameterInlays(source, scanScarpSource('"unterminated'), 'all', forbidden)).toEqual([]);
  });
});


describe('linear shadow inventory', () => {
  it('suppresses same-file calls with competing bindings, parameters or nested declarations', () => {
    for (const tail of [
      'bind add = 1; add(1, 2);',
      'funcra wrapper(add: integer) {} add(1, 2);',
      'funcra wrapper() { funcra add(a: integer, b: integer) -> integer {} } add(1, 2);',
    ]) expect(labels(header + tail), tail).toEqual([]);
  });
  it('indexes declaration tokens once and ignores comment and string lookalikes', () => {
    const lex = scanScarpSource('funcra add(x: integer) {} // bind ignored\nvar add = 1; print("funcra hidden"); funcra outer() { funcra add() {} }');
    const index = collectParameterShadowIndex(lex);
    expect(index.functions.get('add')).toBe(2);
    expect(index.functions.has('hidden')).toBe(false);
    expect(index.bindings.has('ignored')).toBe(false);
    expect(index.bindings.has('x')).toBe(true);
    expect(index.bindings.has('add')).toBe(true);
  });
  it('handles many distinct unknown calls without resolving them as builtins', () => {
    const source = Array.from({ length: 1000 }, (_, i) => 'unknown_' + i + '(1);').join('\n') + '\nbigint_pow(value, 2);';
    expect(labels(source)).toEqual([{ label: 'exponent', next: '2' }]);
  });
});
