import { describe, expect, it } from 'vitest';
import { isScarpCodePosition, scanScarpFunctions, scarpCompletions, scarpTokenHelp } from './assist';

describe('Scarp completion catalog', () => {
  it('returns compiler-aligned function, loop, and binding snippets', () => {
    for (const label of ['funcra', 'pure funcra', 'bind', 'var', 'if', 'while', 'repeat', 'read_line', 'print']) {
      expect(scarpCompletions('').some((item) => item.label === label), label).toBe(true);
    }
    const funcra = scarpCompletions('funcra')[0];
    expect(funcra.insertText).toContain('-> integer');
    expect(funcra.insertText).toContain('${1:name}');
    expect(scarpTokenHelp('repeat')?.insertText).toContain(' as ${2:index}');
  });

  it('excludes unsupported generic language constructs', () => {
    for (const unsupported of ['class', 'match', 'def', 'let', 'mut', 'async', 'await', 'for']) {
      expect(scarpCompletions(unsupported)).toEqual([]);
    }
  });

  it('filters case-insensitively and bounds completion count', () => {
    expect(scarpCompletions('PRINT').some((entry) => entry.label === 'print')).toBe(true);
    expect(scarpCompletions('unknown_keyword')).toEqual([]);
    expect(scarpCompletions('')).toHaveLength(scarpCompletions('').length);
    expect(scarpCompletions('').length).toBeLessThanOrEqual(40);
  });
});

describe('Scarp alpha.9 exact integer assistance', () => {
  it('offers checked BigInt functions without suggesting unbounded numeric literals', () => {
    for (const name of ['bigint', 'bigint_from_integer', 'bigint_to_integer', 'bigint_abs']) {
      expect(scarpCompletions(name).some((item) => item.label === name)).toBe(true);
    }
    const constructor = scarpCompletions('bigint').find((item) => item.kind === 'function' && item.label === 'bigint');
    expect(constructor?.insertText).toContain('bigint("');
    expect(constructor?.documentation).toContain('alpha.9');
  });
});

describe('lexical completion safety', () => {
  it('suppresses suggestions inside comments and quoted strings', () => {
    const line = 'print("https://test"); // trailing comment';
    expect(isScarpCodePosition(line, line.indexOf('https') + 2)).toBe(false);
    expect(isScarpCodePosition(line, line.indexOf(' //') - 1)).toBe(true);
    expect(isScarpCodePosition(line, line.indexOf('comment') + 3)).toBe(false);
  });

  it('handles escaped quotes without treating text as executable code', () => {
    const line = 'print("say \\"hello\\""); bind answer = 42;';
    expect(isScarpCodePosition(line, line.indexOf('hello') + 2)).toBe(false);
    expect(isScarpCodePosition(line, line.indexOf('bind') + 3)).toBe(true);
  });
});

describe('Scarp function outline', () => {
  it('finds normal, pure and public function declarations', () => {
    const text = [
      '// funcra skipped() {}',
      'funcra add(a: integer, b: integer) -> integer {',
      'pure funcra twice(x: integer) -> integer {',
      'pub funcra exported() -> unit {',
      '    print("funcra fake()");',
    ].join('\n');
    expect(scanScarpFunctions(text).map((symbol) => [symbol.name, symbol.line]))
      .toEqual([['add', 2], ['twice', 3], ['exported', 4]]);
    expect(scanScarpFunctions(text)[0].startColumn).toBe(8);
  });

  it('limits enormous function outlines', () => {
    const text = Array.from({ length: 900 }, (_, index) => 'funcra f' + index + '() -> unit {}').join('\n');
    expect(scanScarpFunctions(text)).toHaveLength(500);
  });
});
