import { describe, expect, it } from 'vitest';
import { findLocalFunctionDefinition, MAX_DEFINITION_SOURCE_UNITS, scarpCallNameAt } from './definition';
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
  it('bounds giant lines and source buffers', () => {
    expect(scarpCallNameAt('add()' + ' '.repeat(MAX_ASSIST_SCAN_UNITS), 1)).toBeNull();
    expect(findLocalFunctionDefinition('funcra add() {}\n' + ' '.repeat(MAX_DEFINITION_SOURCE_UNITS), 'add')).toBeNull();
  });
});
