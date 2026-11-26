import { scarpTokenHelp } from './assist';
import type { LocalSignature } from './signature';
import type { SourceLexResult } from './sourceLex';

export interface AssistedSignature extends LocalSignature {
  source: 'local' | 'catalog';
  documentation: string;
}
interface CatalogSignature {
  parameters: readonly string[];
  variadic?: boolean;
}
/** Editor-only hints for the alpha.20-era catalog, based on published
 * BigInt, Decimal, input docs and Studio's existing collection templates.
 * Generic collection arguments are descriptive, not inferred types. */
const entries: Readonly<Record<string, CatalogSignature>> = Object.freeze({
  print: { parameters: ['value, …'], variadic: true },
  println: { parameters: ['value, …'], variadic: true },
  write: { parameters: ['value, …'], variadic: true },
  assert: { parameters: ['condition: boolean'] },
  read_line: { parameters: [] },
  try_read_line: { parameters: [] },
  flush_stdout: { parameters: [] },
  flush_stderr: { parameters: [] },
  input: { parameters: ['prompt: string'] },
  ask: { parameters: ['prompt: string'] },
  ask_or: { parameters: ['prompt: string', 'fallback: string'] },
  input_integer: { parameters: ['prompt: string'] },
  input_float: { parameters: ['prompt: string'] },
  input_bigint: { parameters: ['prompt: string'] },
  input_boolean: { parameters: ['prompt: string'] },
  input_decimal: { parameters: ['prompt: string'] },
  bigint: { parameters: ['text: string'] },
  bigint_from_integer: { parameters: ['value: integer'] },
  bigint_to_integer: { parameters: ['value: bigint'] },
  bigint_abs: { parameters: ['value: bigint'] },
  bigint_pow: { parameters: ['value: bigint', 'exponent: integer'] },
  bigint_gcd: { parameters: ['a: bigint', 'b: bigint'] },
  bigint_lcm: { parameters: ['a: bigint', 'b: bigint'] },
  bigint_sqrt: { parameters: ['value: bigint'] },
  bigint_bit_length: { parameters: ['value: bigint'] },
  bigint_to_text: { parameters: ['value: bigint'] },
  bigint_from_radix: { parameters: ['text: string', 'base: integer'] },
  bigint_to_radix: { parameters: ['value: bigint', 'base: integer'] },
  bigint_and: { parameters: ['a: bigint', 'b: bigint'] },
  bigint_or: { parameters: ['a: bigint', 'b: bigint'] },
  bigint_xor: { parameters: ['a: bigint', 'b: bigint'] },
  bigint_not: { parameters: ['value: bigint'] },
  bigint_shl: { parameters: ['value: bigint', 'bits: integer'] },
  bigint_shr: { parameters: ['value: bigint', 'bits: integer'] },
  bigint_pow_mod: { parameters: ['base: bigint', 'exponent: integer', 'modulus: bigint'] },
  bigint_divmod: { parameters: ['a: bigint', 'b: bigint'] },
  decimal: { parameters: ['text: string'] },
  decimal_from_integer: { parameters: ['value: integer'] },
  decimal_to_integer: { parameters: ['value: decimal'] },
  decimal_to_text: { parameters: ['value: decimal'] },
  decimal_round: { parameters: ['value: decimal', 'places: integer', 'mode: string'] },
  decimal_format: { parameters: ['value: decimal', 'places: integer', 'mode: string'] },
  decimal_div_rounded: { parameters: ['a: decimal', 'b: decimal', 'places: integer', 'mode: string'] },
  list_len: { parameters: ['items'] },
  list_push: { parameters: ['items', 'value'] },
  list_set: { parameters: ['items', 'index: integer', 'value'] },
  list_remove: { parameters: ['items', 'index: integer'] },
  map_len: { parameters: ['entries'] },
  map_keys: { parameters: ['entries'] },
  map_values: { parameters: ['entries'] },
  map_contains: { parameters: ['entries', 'key'] },
  map_get_or: { parameters: ['entries', 'key', 'fallback'] },
  map_set: { parameters: ['entries', 'key', 'value'] },
  map_remove: { parameters: ['entries', 'key'] },
  array_len: { parameters: ['values'] },
  array_get_or: { parameters: ['values', 'index: integer', 'fallback'] },
  array_set: { parameters: ['values', 'index: integer', 'replacement'] },
});

export const BUILTIN_SIGNATURE_NAMES: readonly string[] = Object.freeze(Object.keys(entries));
export function builtinSignatureAt(name: string, argument: number): AssistedSignature | null {
  if (!Number.isSafeInteger(argument) || argument < 0 || !Object.hasOwn(entries, name)) return null;
  const entry = entries[name];
  const help = scarpTokenHelp(name);
  if (!help || help.kind !== 'function') return null;
  if (!entry.variadic && argument >= Math.max(1, entry.parameters.length)) return null;
  return { name, label: name + '(' + entry.parameters.join(', ') + ')',
    parameters: [...entry.parameters], activeParameter: entry.variadic ? 0 : argument,
    source: 'catalog', documentation: help.documentation +
      ' Catalog hint only; use Verify to confirm installed compiler support and types.' };
}

/** Suppress catalog hints for names declared as bindings, parameters or
 * functions anywhere in this bounded source. This is not scope resolution. */
export function hasPotentialCatalogShadow(lexical: SourceLexResult, name: string): boolean {
  if (!lexical.complete || lexical.issues.length) return true;
  const declarations = new Set(['funcra', 'bind', 'var', 'record', 'variant', 'as']);
  const tokens = lexical.tokens;
  let previous = '';
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.kind === 'comment') continue;
    if (token.kind === 'identifier' && token.text === name) {
      if (declarations.has(previous)) return true;
      let next = i + 1;
      while (next < tokens.length && tokens[next].kind === 'comment') next++;
      if (tokens[next]?.kind === 'operator' && tokens[next].text === ':') return true;
    }
    previous = token.kind === 'identifier' ? token.text : '';
  }
  return false;
}
