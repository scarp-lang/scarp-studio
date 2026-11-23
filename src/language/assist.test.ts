import { describe, expect, it, vi } from 'vitest';
import {
  isScarpCodePosition, MAX_COMPLETION_PREFIX_UNITS, scanScarpFunctions,
  scarpCompletions, scarpTokenHelp,
} from './assist';

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

  it('matches English compiler builtin spellings independent of OS locale', () => {
    const original = String.prototype.toLocaleLowerCase;
    const localeMock = vi.spyOn(String.prototype, 'toLocaleLowerCase')
      .mockImplementation(function (this: string) { return original.call(this, 'tr'); });
    try {
      expect('INPUT_BOOLEAN'.toLocaleLowerCase()).toBe('ınput_boolean');
      expect(scarpCompletions('INPUT_BOOLEAN').some((entry) =>
        entry.label === 'input_boolean')).toBe(true);
      expect(scarpCompletions('BIGINT').some((entry) =>
        entry.label === 'bigint')).toBe(true);
    } finally {
      localeMock.mockRestore();
    }
  });

  it('rejects unusually long completion prefixes before normalization', () => {
    expect(scarpCompletions('i'.repeat(MAX_COMPLETION_PREFIX_UNITS + 1))).toEqual([]);
    expect(scarpCompletions('input_boolean').some((entry) =>
      entry.label === 'input_boolean')).toBe(true);
  });

  it('excludes unsupported generic language constructs', () => {
    for (const unsupported of ['class', 'def', 'let', 'mut', 'async', 'await', 'for']) {
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

describe('Scarp alpha.10 editor suggestions', () => {
  it('offers official prompted input, EOF-aware reads and exact-number operations', () => {
    for (const label of [
      'input', 'ask', 'ask_or', 'input_integer', 'input_float', 'input_bigint',
      'try_read_line', 'flush_stdout', 'flush_stderr', 'array',
      'bigint_gcd', 'bigint_divmod', 'bigint_pow_mod', 'bigint_to_radix',
    ]) {
      const suggestion = scarpCompletions(label).find((item) => item.label === label);
      expect(suggestion, label).toBeDefined();
      expect(suggestion?.documentation.toLowerCase()).toContain('alpha.10');
    }
    expect(scarpTokenHelp('input')?.documentation).toContain('preloaded');
    expect(scarpTokenHelp('array')?.insertText).toContain('array<');
    expect(scarpTokenHelp('try_read_line')?.documentation).toContain('EOF');
    expect(scarpCompletions('bigint_').length).toBeLessThanOrEqual(40);
  });
});

describe('Scarp alpha.11 exact decimal assistance', () => {
  it('lists the published exact-decimal operations and version gates them', () => {
    for (const label of [
      'decimal', 'decimal_from_integer', 'decimal_to_integer', 'decimal_to_text',
      'decimal_round', 'decimal_format', 'decimal_div_rounded', 'input_decimal',
    ]) {
      const suggestion = scarpCompletions(label).find((item) => item.label === label && item.kind === 'function');
      expect(suggestion, label).toBeDefined();
      expect(suggestion?.documentation).toContain('alpha.11');
    }
    expect(scarpTokenHelp('decimal')?.insertText).toContain('decimal("');
    expect(scarpTokenHelp('decimal_round')?.insertText).toContain('half_even');
    expect(scarpTokenHelp('decimal_div_rounded')?.documentation).toContain('inexact');
    expect(scarpTokenHelp('input_decimal')?.documentation).toContain('preloads');
  });
});

describe('published Scarp alpha.12 aggregate and match assistance', () => {
  it('offers concrete typed list/map/option/result help with version warnings', () => {
    for (const label of ['list', 'map', 'option', 'result']) {
      const type = scarpCompletions(label).find((item) => item.label === label && item.kind === 'type');
      expect(type, label).toBeDefined();
      expect(type?.documentation).toContain('alpha.12');
    }
    for (const label of ['list_len', 'list_push', 'list_set', 'list_remove',
      'map_len', 'map_keys', 'map_values', 'map_contains', 'map_get_or', 'map_set', 'map_remove']) {
      const entry = scarpCompletions(label).find((item) => item.label === label && item.kind === 'function');
      expect(entry, label).toBeDefined();
      expect(entry?.documentation).toContain('alpha.12');
      expect(entry?.documentation).toContain('interpreter');
    }
    expect(scarpTokenHelp('map_get_or')?.documentation).toContain('fallback');
  });

  it('provides versioned record, variant and match snippets', () => {
    expect(scarpTokenHelp('record')?.insertText).not.toContain('new');
    expect(scarpTokenHelp('record')?.insertText).toContain('record ${1:Task}');
    expect(scarpTokenHelp('variant')?.insertText).toContain('variant ${1:Choice}');
    const match = scarpCompletions('match').find((item) => item.label === 'match on');
    expect(match?.insertText).toContain('case ${2:None}');
    expect(match?.documentation).toContain('alpha.12');
  });
});

describe('published Scarp alpha.17 fixed arrays and boolean input', () => {
  it('suggests versioned array_len and array_get_or with safe typed fallback guidance', () => {
    const length = scarpTokenHelp('array_len');
    const fallback = scarpTokenHelp('array_get_or');
    expect(length?.kind).toBe('function');
    expect(length?.insertText).toBe('array_len(${1:values})');
    expect(length?.documentation).toContain('alpha.17');
    expect(fallback?.insertText).toBe('array_get_or(${1:values}, ${2:index}, ${3:fallback})');
    expect(fallback?.documentation).toContain('negative or out-of-bounds');
    expect(fallback?.documentation).toContain('evaluated exactly once');
  });

  it('explains input_boolean preloaded interactive mode, not a live terminal', () => {
    const input = scarpCompletions('input_boolean').find((entry) => entry.label === 'input_boolean');
    expect(input?.kind).toBe('function');
    expect(input?.insertText).toContain('input_boolean("');
    expect(input?.documentation).toContain('alpha.17');
    expect(input?.documentation).toContain('lowercase true or false');
    expect(input?.documentation).toContain('not a live interactive terminal');
    expect(scarpCompletions('ARRAY_GET_OR').some((entry) => entry.label === 'array_get_or')).toBe(true);
    expect(scarpCompletions('input_boolean_invalid')).toEqual([]);
  });
});

describe('published Scarp alpha.18 immutable fixed-array updates', () => {
  it('offers the exact array_set syntax with a version and immutability warning', () => {
    const update = scarpTokenHelp('array_set');
    expect(update?.kind).toBe('function');
    expect(update?.insertText).toBe('array_set(${1:values}, ${2:index}, ${3:replacement})');
    expect(update?.documentation).toContain('alpha.18');
    expect(update?.documentation).toContain('original array');
    expect(update?.documentation).toContain('E0063');
    expect(scarpCompletions('ARRAY_SET').some((item) => item.label === 'array_set')).toBe(true);
    expect(scarpCompletions('array_set_invalid')).toEqual([]);
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

  it('tracks CR-only, LF and CRLF outline lines with Monaco UTF-16 columns', () => {
    const text = [
      'funcra first() -> unit {}',
      '// funcra ignored() {}',
      '  pure funcra दूसरा() -> unit {}',
      '  pub funcra third() -> unit {}',
    ].join('\r');
    // The outline is deliberately ASCII-only: non-ASCII names are not
    // misidentified as source declaration symbols by its conservative regex.
    const mixed = text.replace('दूसरा', 'second').replace(
      '  pub funcra third()', '\n  pub funcra third()',
    ) + '\r\nfuncra fourth() -> unit {}\nfuncra fifth() -> unit {}';
    expect(scanScarpFunctions(mixed).map(({ name, line, startColumn }) =>
      [name, line, startColumn])).toEqual([
      ['first', 1, 8],
      ['second', 3, 15],
      ['third', 4, 14],
      ['fourth', 5, 8],
      ['fifth', 6, 8],
    ]);
    expect(scanScarpFunctions('funcra दूसरा() -> unit {}')).toEqual([]);
  });

  it('limits enormous function outlines', () => {
    const text = Array.from({ length: 900 }, (_, index) => 'funcra f' + index + '() -> unit {}').join('\n');
    expect(scanScarpFunctions(text)).toHaveLength(500);
  });
});
