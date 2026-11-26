import { describe, expect, it } from 'vitest';
import { findLocalFunctionDefinition, indexLocalFunctionHeaders, MAX_LOCAL_DECLARATION_NESTING, MAX_DEFINITION_SOURCE_UNITS, scarpCallNameAt, scarpCallNameAtOffset } from './definition';
import { MAX_ASSIST_SCAN_UNITS } from './assist';

describe('conservative current-file function definition lookup', () => {
  it('finds an unqualified call inside nested expressions and uses one-based columns', () => {
    const line = 'print(add(1, 2));';
    expect(scarpCallNameAt(line, 7)).toBe('add');
    expect(scarpCallNameAt(line, 9)).toBe('add');
    expect(scarpCallNameAt(line, 10)).toBeNull();
    expect(scarpCallNameAt('return add (1, 2);', 8)).toBe('add');
  });
  it('does not treat strings, comments, qualified calls, declarations or constructors as calls', () => {
    for (const line of [
      '// add(1, 2)', 'print("add(1, 2)");', 'math.add(1, 2)',
      'math . add(1, 2)', 'value->add(1, 2)', 'new Choice::add(1)',
      'funcra add(a: integer) -> integer', 'pure funcra add()',
      'new add()', 'bind add = 2;', '1add(2)',
    ]) expect(scarpCallNameAt(line, line.indexOf('add') + 1), line).toBeNull();
    expect(scarpCallNameAt('add(1)', 0)).toBeNull();
    expect(scarpCallNameAt('add(1)', NaN)).toBeNull();
  });
  it('returns the exact declaration range on mixed line endings, case sensitively', () => {
    const source = '// funcra add() {}\r\npub pure funcra add(a: integer) -> integer {\rreturn a;\n}';
    expect(findLocalFunctionDefinition(source, 'add')).toEqual({
      name: 'add', line: 2, startColumn: 17, endColumn: 20,
    });
    expect(findLocalFunctionDefinition(source, 'Add')).toBeNull();
    expect(findLocalFunctionDefinition(source, 'missing')).toBeNull();
  });
  it('rejects ambiguous names and truncated inventories instead of returning the first hit', () => {
    expect(findLocalFunctionDefinition('funcra add() {}\nfuncra add() {}', 'add')).toBeNull();
    const many = Array.from({ length: 500 }, (_, i) => 'funcra f' + i + '() {}').join('\n');
    expect(findLocalFunctionDefinition(many, 'f0')).toBeNull();
    expect(findLocalFunctionDefinition(many.slice(0, many.lastIndexOf('\n')), 'f0')?.line).toBe(1);
  });
  it('detects duplicate declarations hidden on long lines and same-line bodies', () => {
    const first = 'funcra add() {}';
    for (const second of [
      ' '.repeat(3000) + 'funcra add() {}',
      'funcra\nadd\n() {}',
      'pub funcra // comment\nadd() {}',
    ]) expect(findLocalFunctionDefinition(first + '\n' + second, 'add')).toBeNull();
    expect(findLocalFunctionDefinition(first + ' funcra add() {}', 'add')).toBeNull();
  });
  it('tracks multiline headers, comments, UTF-16 columns and top-level scope', () => {
    const source = 'print("😀 funcra fake() {}"); funcra real\n() { // funcra hidden()\n print("}");\n}';
    const location = findLocalFunctionDefinition(source, 'real');
    expect(location).toEqual({ name: 'real', line: 1,
      startColumn: source.indexOf('real') + 1, endColumn: source.indexOf('real') + 5 });
    expect(findLocalFunctionDefinition(source, 'fake')).toBeNull();
    expect(findLocalFunctionDefinition(source, 'hidden')).toBeNull();
    expect(findLocalFunctionDefinition('funcra outer() { funcra inner() {} }', 'inner')).toBeNull();
    expect(findLocalFunctionDefinition('funcra real() {} "unterminated', 'real')).toBeNull();
  });
  it('bounds giant lines and source buffers', () => {
    expect(scarpCallNameAt('add()' + ' '.repeat(MAX_ASSIST_SCAN_UNITS), 1)).toBeNull();
    expect(findLocalFunctionDefinition('funcra add() {}\n' + ' '.repeat(MAX_DEFINITION_SOURCE_UNITS), 'add')).toBeNull();
  });
});

describe('whole-source call context', () => {
  const at = (source: string, name = 'add') =>
    scarpCallNameAtOffset(source, source.lastIndexOf(name));
  it.each(['\n', '\r\n', '\r', ' // argument list\n'])('accepts unqualified calls split by %j', gap => {
    expect(at('print(add' + gap + '(1));')).toBe('add');
  });
  it.each(['.', '::', '->'])('rejects qualified calls split across lines after %s', separator => {
    expect(at('module' + separator + '\n// continuation\nadd(1)')).toBeNull();
  });
  it.each(['funcra', 'new', 'bind', 'var', 'record', 'variant', 'import', 'as'])(
    'rejects a multiline declaration or constructor after %s', keyword => {
      expect(at(keyword + '\n// continuation\nadd(1)')).toBeNull();
    });
  it('does not erase string tokens or treat strings/comments as calls', () => {
    expect(at('add "not trivia" (1)')).toBeNull();
    expect(at('print("add(1)")')).toBeNull();
    expect(at('// add(1)')).toBeNull();
    expect(at('1add(1)')).toBeNull();
    expect(at('éadd(1)')).toBeNull();
    expect(at('addé(1)')).toBeNull();
  });
  it('uses exact UTF-16 offsets and refuses invalid cursor positions', () => {
    const source = 'print("😀");\r\nadd(1)';
    const start = source.indexOf('add');
    for (let i = 0; i < 3; i++) expect(scarpCallNameAtOffset(source, start + i)).toBe('add');
    for (const offset of [-1, NaN, 1.5, start + 3, source.length]) {
      expect(scarpCallNameAtOffset(source, offset)).toBeNull();
    }
  });
  it('rejects incomplete lexical inventories, malformed strings and huge identifiers', () => {
    expect(at('add(1);\n"unfinished')).toBeNull();
    expect(at('add(1);\n\u0000')).toBeNull();
    expect(at('x;'.repeat(13000) + 'add(1)')).toBeNull();
    expect(at(' '.repeat(MAX_DEFINITION_SOURCE_UNITS) + 'add(1)')).toBeNull();
    expect(scarpCallNameAtOffset('a'.repeat(241) + '()', 0)).toBeNull();
  });
});


describe('shared lexical declaration inventory', () => {
  it('ignores declaration-shaped tokens inside grouping and nested bodies', () => {
    const text = 'print(funcra fake() {}); [funcra other() {}]; funcra real() {}';
    expect(indexLocalFunctionHeaders(text)?.map(item => item.name)).toEqual(['real']);
    expect(findLocalFunctionDefinition('module.funcra fake() {}; funcra real() {}', 'fake')).toBeNull();
  });
  it('fails closed for mismatched delimiters, dense tokens and unsupported code units', () => {
    const header = 'funcra real() {} ';
    for (const tail of [']', '([)]', 'x;'.repeat(13000), 'éfuncra fake() {}',
      '\x7f', '('.repeat(MAX_LOCAL_DECLARATION_NESTING + 1)]) {
      expect(indexLocalFunctionHeaders(header + tail), tail.slice(0, 50)).toBeNull();
    }
    expect(findLocalFunctionDefinition(header + 'print("हिन्दी 😀"); // हिन्दी', 'real')?.name).toBe('real');
  });
  it('retains declarations when the user is editing an unfinished trailing call', () => {
    expect(findLocalFunctionDefinition('funcra real() {} real(', 'real')?.name).toBe('real');
    expect(findLocalFunctionDefinition('funcra real() {} print(real([', 'real')?.name).toBe('real');
  });
  it('does not offer long or unsupported declaration names', () => {
    expect(indexLocalFunctionHeaders('funcra ' + 'a'.repeat(129) + '() {}')).toEqual([]);
    expect(indexLocalFunctionHeaders('funcra 123name() {}')).toEqual([]);
  });
});
