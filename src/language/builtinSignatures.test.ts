import { describe, expect, it } from 'vitest';
import { BUILTIN_SIGNATURE_NAMES, builtinSignatureAt, hasPotentialCatalogShadow } from './builtinSignatures';
import { LocalSourceAnalysis } from './localAnalysis';
import { scanScarpSource } from './sourceLex';
import { scarpTokenHelp } from './assist';

describe('catalog-backed built-in signatures', () => {
  it('covers only known catalog functions and isolates result mutations', () => {
    expect(BUILTIN_SIGNATURE_NAMES.length).toBeGreaterThan(50);
    for (const name of BUILTIN_SIGNATURE_NAMES) {
      expect(scarpTokenHelp(name)?.kind, name).toBe('function');
      const signature = builtinSignatureAt(name, 0)!;
      expect(signature.source).toBe('catalog');
      expect(signature.label.startsWith(name + '(')).toBe(true);
      expect(signature.documentation).toContain('Verify');
      signature.parameters.push('mutated');
      expect(builtinSignatureAt(name, 0)?.parameters).not.toContain('mutated');
    }
  });
  it('handles fixed, zero and variadic arguments', () => {
    expect(builtinSignatureAt('bigint_pow', 1)).toMatchObject({
      label: 'bigint_pow(value: bigint, exponent: integer)', activeParameter: 1,
    });
    expect(builtinSignatureAt('bigint_pow', 2)).toBeNull();
    expect(builtinSignatureAt('read_line', 0)?.parameters).toEqual([]);
    expect(builtinSignatureAt('read_line', 1)).toBeNull();
    expect(builtinSignatureAt('print', 15)?.activeParameter).toBe(0);
    for (const name of ['unknown', '__proto__', 'constructor', 'PRINT']) expect(builtinSignatureAt(name, 0)).toBeNull();
    expect(builtinSignatureAt('print', -1)).toBeNull();
    expect(builtinSignatureAt('print', NaN)).toBeNull();
  });
  it('does not mistake comments or strings for shadow declarations', () => {
    expect(hasPotentialCatalogShadow(scanScarpSource('print("bind bigint_pow"); // var bigint_pow'), 'bigint_pow')).toBe(false);
    expect(hasPotentialCatalogShadow(scanScarpSource('bind // comment\nbigint_pow = 1;'), 'bigint_pow')).toBe(true);
    expect(hasPotentialCatalogShadow(scanScarpSource('funcra f(bigint_pow: integer) {}'), 'bigint_pow')).toBe(true);
    expect(hasPotentialCatalogShadow(scanScarpSource('"unterminated'), 'bigint_pow')).toBe(true);
  });
});
describe('shared local and catalog parameter assistance', () => {
  const at = (marked: string, enabled = true) => {
    const offset = marked.indexOf('|');
    return new LocalSourceAnalysis(marked.replace('|', '')).assistedSignature(offset, enabled);
  };
  it('supports nested and multiline calls, only when enabled', () => {
    expect(at('print(bigint_pow(value, |2));')).toMatchObject({ name: 'bigint_pow', activeParameter: 1 });
    expect(at('decimal_round(value, // precision\n2, |"half_even");')?.activeParameter).toBe(2);
    expect(at('print(1, 2, |3);')?.activeParameter).toBe(0);
    expect(at('bigint_pow(value, |2);', false)).toBeNull();
  });
  it('prefers a local declaration even with built-in hints disabled', () => {
    const source = 'funcra bigint_pow(custom: integer) -> integer {}\nbigint_pow(|2);';
    for (const enabled of [true, false]) expect(at(source, enabled)).toMatchObject({
      source: 'local', label: 'bigint_pow(custom: integer)',
    });
  });
  it('rejects ambiguous, malformed, qualified or shadowed calls', () => {
    for (const source of [
      'funcra bigint_pow(a: integer) {} funcra bigint_pow(b: integer) {} bigint_pow(|2);',
      'funcra bigint_pow(a:) {} bigint_pow(|2);',
      'module.bigint_pow(value, |2);',
      'bind bigint_pow = 1; bigint_pow(value, |2);',
      'funcra f(bigint_pow: integer) {} bigint_pow(value, |2);',
      'print(unknown(|2));',
      'bigint_pow(value, |2); ]',
      'bigint_pow(value, "in|string");',
    ]) expect(at(source), source).toBeNull();
  });
});
