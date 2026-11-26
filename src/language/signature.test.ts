import { describe, expect, it } from 'vitest';
import { activeLocalCall, localSignatureAt, readLocalParameters, MAX_SIGNATURE_HEADER_UNITS } from './signature';
import { MAX_INSIGHT_TOKENS } from './sourceLex';

const header = 'pure funcra add(a: integer, b: integer) -> integer { return a + b; }\n';
function at(text: string) {
  const offset = text.indexOf('|');
  return localSignatureAt(text.replace('|', ''), offset);
}

describe('local function signature assistance', () => {
  it('shows exact typed labels and tracks the active argument', () => {
    expect(at(header + 'print(add(|));')).toEqual({
      name: 'add', label: 'add(a: integer, b: integer)',
      parameters: ['a: integer', 'b: integer'], activeParameter: 0,
    });
    expect(at(header + 'print(add(1, |));')?.activeParameter).toBe(1);
    expect(at(header + 'print(add(1, 2, |));')).toBeNull();
    expect(at(header + 'print(add(1, 2)|);')).toBeNull();
  });
  it('tracks nested calls, tuples, strings, comments and multiline arguments', () => {
    expect(at(header + 'add(add(1, |), 2);')?.activeParameter).toBe(1);
    expect(at(header + 'add((1, 2), |);')?.activeParameter).toBe(1);
    expect(at(header + 'add("a,b", |);')?.activeParameter).toBe(1);
    expect(at(header + 'add(1, // comment, ignored\r\n |);')?.activeParameter).toBe(1);
    expect(at(header + 'add(unknown(|), 2);')).toBeNull();
    expect(at(header + 'add("abc|", 2);')).toBeNull();
    expect(at(header + 'add(1, // |comment\n2);')).toBeNull();
  });
  it('preserves nested collection types and multiline declaration labels', () => {
    const src = 'funcra collect(\n items: map<string, list<integer>>, // comment\n count: integer\n) -> unit {}\ncollect(1, |);';
    expect(at(src)).toMatchObject({ parameters: ['items: map<string, list<integer>>', 'count: integer'], activeParameter: 1 });
    expect(at('funcra zero() -> unit {}\nzero(|);')).toMatchObject({ parameters: [], activeParameter: 0 });
  });
  it('rejects declarations, duplicate functions, imported/qualified calls and incomplete signatures', () => {
    expect(at('funcra add(a: integer, |b: integer) -> integer {}')).toBeNull();
    expect(at(header + header + 'add(|);')).toBeNull();
    expect(at(header + 'math.add(|);')).toBeNull();
    expect(at(header + 'math . add(|);')).toBeNull();
    expect(at(header + 'new Choice::add(|);')).toBeNull();
    expect(readLocalParameters('(a: map<string, integer)', 0)).toBeNull();
    expect(readLocalParameters('(a: integer,)', 0)).toBeNull();
    expect(readLocalParameters('(a: integer = 1)', 0)).toBeNull();
  });
  it('bounds nesting, header lengths and invalid positions', () => {
    expect(activeLocalCall('add(' + '('.repeat(130), 134)).toBeNull();
    expect(readLocalParameters('(' + ' '.repeat(MAX_SIGNATURE_HEADER_UNITS) + ')', 0)).toBeNull();
    expect(activeLocalCall('add(', -1)).toBeNull();
    expect(activeLocalCall('add(', 5)).toBeNull();
  });
});

describe('conservative signature context', () => {
  it('rejects declaration and qualified contexts across line breaks and comments', () => {
    for (const previous of ['funcra', 'new', 'record', 'variant', 'bind',
      'var', 'import', 'as', 'math.', 'Choice::', 'obj->']) {
      expect(at(header + previous + '\r\n// note\nadd(|);'), previous).toBeNull();
    }
    expect(at(header + 'add\n// arguments\n(1, |);')?.activeParameter).toBe(1);
  });

  it('does not borrow an outer signature for indirect or unsupported invocations', () => {
    for (const inner of ['factory()(', '(factory)(', 'items[0](', '"name"(', '123(']) {
      expect(at(header + 'add(' + inner + '|), 2);'), inner).toBeNull();
    }
    expect(at(header + 'add(factory()(1), |);')?.activeParameter).toBe(1);
    expect(at(header + 'add((1, 2), |);')?.activeParameter).toBe(1);
    expect(at(header + 'add([1, 2], |);')?.activeParameter).toBe(1);
  });

  it('rejects unsupported identifier fragments and invalid code controls', () => {
    for (const name of ['éadd', 'addé', 'add\u0000', 'add\u007f', 'a'.repeat(129)]) {
      expect(activeLocalCall(name + '(', name.length + 1), name).toBeNull();
      expect(at(header + 'add(' + name + '(|), 2);'), name).toBeNull();
    }
    expect(at(header + 'add("हिन्दी, é", |);')?.activeParameter).toBe(1);
    expect(at(header + '// हिन्दी é\nadd(1, |);')?.activeParameter).toBe(1);
  });

  it('limits significant prefix tokens even within the source length budget', () => {
    const dense = 'x;'.repeat(MAX_INSIGHT_TOKENS / 2);
    expect(activeLocalCall(dense + 'add(', dense.length + 4)).toBeNull();
    expect(activeLocalCall('x;add(', 6)).toEqual({ name: 'add', argument: 0 });
  });
});
