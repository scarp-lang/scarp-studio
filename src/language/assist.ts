/** Editor-only Scarp assistance, including published alpha.12 features.
 * These templates do not replace parser/compiler validation.
 */
import { lineBreakWidth, nextLineBreak } from '../model/sourceLines';

export interface ScarpCompletion {
  label: string;
  insertText: string;
  kind: 'keyword' | 'type' | 'function' | 'snippet';
  detail: string;
  documentation: string;
}

const templates: readonly ScarpCompletion[] = [
  {
    label: 'funcra', kind: 'snippet', detail: 'Typed Scarp function',
    documentation: 'Define a typed Scarp function with an explicit return.',
    insertText: 'funcra ${1:name}(${2:value}: integer) -> integer {\n    ${3:return value;}\n}',
  },
  {
    label: 'pure funcra', kind: 'snippet', detail: 'Pure typed function',
    documentation: 'Define a pure Scarp function. Pure functions cannot perform output or input.',
    insertText: 'pure funcra ${1:name}(${2:value}: integer) -> integer {\n    ${3:return value;}\n}',
  },
  {
    label: 'bind', kind: 'snippet', detail: 'Immutable Scarp binding',
    documentation: 'Bind an immutable name to a value.',
    insertText: 'bind ${1:name} = ${2:0};',
  },
  {
    label: 'var', kind: 'snippet', detail: 'Mutable Scarp variable',
    documentation: 'Declare a mutable variable.',
    insertText: 'var ${1:name} = ${2:0};',
  },
  {
    label: 'if', kind: 'snippet', detail: 'Conditional branch',
    documentation: 'Execute a block when its condition evaluates to a boolean.',
    insertText: 'if ${1:condition} {\n    ${2:// then}\n} else {\n    ${3:// else}\n}',
  },
  {
    label: 'while', kind: 'snippet', detail: 'Conditional loop',
    documentation: 'Run the body repeatedly while the boolean condition is true.',
    insertText: 'while ${1:condition} {\n    ${2:// body}\n}',
  },
  {
    label: 'repeat', kind: 'snippet', detail: 'Counted loop with index',
    documentation: 'Evaluate a repeat count once and optionally bind the loop index.',
    insertText: 'repeat ${1:5} as ${2:index} {\n    ${3:// body}\n}',
  },
  {
    label: 'import', kind: 'snippet', detail: 'Import another Scarp source',
    documentation: 'Import a Scarp module through a relative .srp path.',
    insertText: 'import "${1:module.srp}" as ${2:module};',
  },
  {
    label: 'print', kind: 'function', detail: 'Scarp standard output',
    documentation: 'Print one or more values followed by a newline.',
    insertText: 'print(${1:value});',
  },
  {
    label: 'println', kind: 'function', detail: 'Scarp standard output',
    documentation: 'Write values followed by a newline.',
    insertText: 'println(${1:value});',
  },
  {
    label: 'write', kind: 'function', detail: 'Scarp standard output',
    documentation: 'Write values without appending a newline.',
    insertText: 'write(${1:value});',
  },
  {
    label: 'bigint', kind: 'function', detail: 'Exact signed integer (alpha.9+)',
    documentation: 'Since Scarp v0.0.6-alpha.9, construct an exact signed integer from ASCII decimal text. No implicit numeric widening.',
    insertText: 'bigint("${1:12345678901234567890}")',
  },
  {
    label: 'bigint_from_integer', kind: 'function', detail: 'Convert integer to bigint (alpha.9+)',
    documentation: 'Convert a signed 64-bit integer to exact bigint without losing precision.',
    insertText: 'bigint_from_integer(${1:value})',
  },
  {
    label: 'bigint_to_integer', kind: 'function', detail: 'Checked bigint to integer (alpha.9+)',
    documentation: 'Convert exact bigint to signed 64-bit integer; reports an error if out of range.',
    insertText: 'bigint_to_integer(${1:value})',
  },
  {
    label: 'bigint_abs', kind: 'function', detail: 'Absolute bigint (alpha.9+)',
    documentation: 'Return the nonnegative absolute value of an exact bigint.',
    insertText: 'bigint_abs(${1:value})',
  },
  {
    label: 'read_line', kind: 'function', detail: 'Read one line of text',
    documentation: 'Read UTF-8 input from standard input. Requires a compiler build with input support.',
    insertText: 'read_line()',
  },
  {
    label: 'assert', kind: 'function', detail: 'Runtime assertion',
    documentation: 'Check a boolean condition, optionally with a string message.',
    insertText: 'assert(${1:condition});',
  },
  ...(['return', 'break', 'continue', 'elif', 'else', 'true', 'false',
    'and', 'or', 'not', 'pub', 'pure', 'needs', 'ensures',
    'match', 'on', 'case', 'new'] as const).map((label) => ({
      label, kind: 'keyword' as const, detail: 'Scarp keyword',
      documentation: 'Scarp language keyword. Available syntax depends on the selected compiler version.',
      insertText: label,
    })),
  ...(['integer', 'float', 'boolean', 'string', 'unit', 'vector', 'integers', 'tile', 'tuple', 'bigint', 'decimal', 'list', 'map', 'option', 'result'] as const).map((label) => ({
    label, kind: 'type' as const, detail: 'Scarp type',
    documentation: ['list', 'map', 'option', 'result'].includes(label)
      ? 'Since alpha.12: concrete typed aggregate or tagged type; interpreter support only. Availability depends on the selected compiler version.'
      : 'Scarp built-in type. Availability depends on the selected compiler version.',
    insertText: label,
  })),
  {
    label: "input", kind: "function",
    detail: "Prompt a UTF-8 line",
    documentation: "Requires alpha.10+ and Studio prompt mode. Replies are preloaded; not a live terminal.",
    insertText: "input(\"${1:Prompt: }\")",
  },
  {
    label: "ask", kind: "function",
    detail: "Prompt a UTF-8 line (alias)",
    documentation: "Since alpha.10: write a prompt, flush, then read one input line; requires interactive prompt mode.",
    insertText: "ask(\"${1:Prompt: }\")",
  },
  {
    label: "ask_or", kind: "function",
    detail: "Prompt with EOF fallback",
    documentation: "Alpha.10 interactive input; return the fallback when the input stream reaches EOF.",
    insertText: "ask_or(\"${1:Prompt: }\", \"${2:Guest}\")",
  },
  {
    label: "input_integer", kind: "function",
    detail: "Prompt a signed integer",
    documentation: "Alpha.10 interactive input; parse a checked signed 64-bit integer from one line.",
    insertText: "input_integer(\"${1:Number: }\")",
  },
  {
    label: "input_float", kind: "function",
    detail: "Prompt a finite float",
    documentation: "Alpha.10 interactive input; parse a finite binary64 number from one line.",
    insertText: "input_float(\"${1:Number: }\")",
  },
  {
    label: "input_bigint", kind: "function",
    detail: "Prompt an exact integer",
    documentation: "Alpha.10 interactive input; parse an exact signed BigInt within configured quotas.",
    insertText: "input_bigint(\"${1:Number: }\")",
  },
  {
    label: "try_read_line", kind: "function",
    detail: "EOF-aware read",
    documentation: "Since alpha.10: return tuple<boolean,string> distinguishing EOF from an empty line; does not require interactive mode.",
    insertText: "try_read_line()",
  },
  {
    label: "flush_stdout", kind: "function",
    detail: "Flush stdout",
    documentation: "Since alpha.10: flush standard output in interactive evaluation.",
    insertText: "flush_stdout()",
  },
  {
    label: "flush_stderr", kind: "function",
    detail: "Flush stderr",
    documentation: "Since alpha.10: flush standard error in interactive evaluation.",
    insertText: "flush_stderr()",
  },
  {
    label: "array", kind: "snippet",
    detail: "Fixed-length array type",
    documentation: "Since alpha.10: immutable array<T,N>, maximum length 4096; literal syntax is [array: values].",
    insertText: "array<${1:integer}, ${2:2}>",
  },
  {
    label: "bigint_pow", kind: "function",
    detail: "Exact BigInt exponent",
    documentation: "Since alpha.10: exponent is a nonnegative integer. Work and digit budgets apply.",
    insertText: "bigint_pow(${1:value}, ${2:exponent})",
  },
  {
    label: "bigint_gcd", kind: "function",
    detail: "BigInt GCD",
    documentation: "Since alpha.10: nonnegative greatest common divisor of two exact integers.",
    insertText: "bigint_gcd(${1:a}, ${2:b})",
  },
  {
    label: "bigint_lcm", kind: "function",
    detail: "BigInt LCM",
    documentation: "Since alpha.10: nonnegative least common multiple of two exact integers.",
    insertText: "bigint_lcm(${1:a}, ${2:b})",
  },
  {
    label: "bigint_sqrt", kind: "function",
    detail: "Integer BigInt square root",
    documentation: "Since alpha.10: floor of square root for a nonnegative exact integer.",
    insertText: "bigint_sqrt(${1:value})",
  },
  {
    label: "bigint_bit_length", kind: "function",
    detail: "Magnitude bit width",
    documentation: "Since alpha.10: number of bits needed for the magnitude, zero gives 0.",
    insertText: "bigint_bit_length(${1:value})",
  },
  {
    label: "bigint_to_text", kind: "function",
    detail: "Exact decimal text",
    documentation: "Since alpha.10: convert exact integer to canonical signed decimal text.",
    insertText: "bigint_to_text(${1:value})",
  },
  {
    label: "bigint_from_radix", kind: "function",
    detail: "Parse BigInt radix",
    documentation: "Since alpha.10: parse a signed integer string with base 2 through 36.",
    insertText: "bigint_from_radix(\"${1:ff}\", ${2:16})",
  },
  {
    label: "bigint_to_radix", kind: "function",
    detail: "Format BigInt radix",
    documentation: "Since alpha.10: format exact integer in base 2 through 36.",
    insertText: "bigint_to_radix(${1:value}, ${2:16})",
  },
  {
    label: "bigint_and", kind: "function",
    detail: "Signed bitwise AND",
    documentation: "Since alpha.10: infinite two's-complement bitwise AND.",
    insertText: "bigint_and(${1:a}, ${2:b})",
  },
  {
    label: "bigint_or", kind: "function",
    detail: "Signed bitwise OR",
    documentation: "Since alpha.10: infinite two's-complement bitwise OR.",
    insertText: "bigint_or(${1:a}, ${2:b})",
  },
  {
    label: "bigint_xor", kind: "function",
    detail: "Signed bitwise XOR",
    documentation: "Since alpha.10: infinite two's-complement bitwise XOR.",
    insertText: "bigint_xor(${1:a}, ${2:b})",
  },
  {
    label: "bigint_not", kind: "function",
    detail: "Signed bitwise NOT",
    documentation: "Since alpha.10: infinite two's-complement bitwise complement.",
    insertText: "bigint_not(${1:value})",
  },
  {
    label: "bigint_shl", kind: "function",
    detail: "Exact left shift",
    documentation: "Since alpha.10: shift count must be a nonnegative integer.",
    insertText: "bigint_shl(${1:value}, ${2:bits})",
  },
  {
    label: "bigint_shr", kind: "function",
    detail: "Signed right shift",
    documentation: "Since alpha.10: sign-extending shift using a nonnegative bit count.",
    insertText: "bigint_shr(${1:value}, ${2:bits})",
  },
  {
    label: "bigint_pow_mod", kind: "function",
    detail: "BigInt modular exponent",
    documentation: "Since alpha.10: nonnegative exponent and positive modulus; variable-time arithmetic.",
    insertText: "bigint_pow_mod(${1:base}, ${2:exponent}, ${3:modulus})",
  },
  {
    label: "bigint_divmod", kind: "function",
    detail: "BigInt quotient and remainder",
    documentation: "Since alpha.10: returns tuple<bigint,bigint>; divisor must be nonzero.",
    insertText: "bigint_divmod(${1:a}, ${2:b})",
  },
  {
    label: 'decimal', kind: 'function', detail: 'Exact base-10 decimal constructor (alpha.11+)',
    documentation: 'Since alpha.11: parse exact signed ASCII decimal text. At most 28 coefficient digits and 18 fractional places; no exponent, separator, or implicit float conversion.',
    insertText: 'decimal("${1:199.99}")',
  },
  {
    label: 'decimal_from_integer', kind: 'function', detail: 'Exact integer to decimal (alpha.11+)',
    documentation: 'Since alpha.11: explicitly convert a signed integer to a decimal.',
    insertText: 'decimal_from_integer(${1:value})',
  },
  {
    label: 'decimal_to_integer', kind: 'function', detail: 'Checked decimal to integer (alpha.11+)',
    documentation: 'Since alpha.11: a decimal converts to a signed integer only if it is a whole value and in range.',
    insertText: 'decimal_to_integer(${1:value})',
  },
  {
    label: 'decimal_to_text', kind: 'function', detail: 'Canonical decimal text (alpha.11+)',
    documentation: 'Since alpha.11: return the exact canonical base-10 string without extra trailing fractional zeros.',
    insertText: 'decimal_to_text(${1:value})',
  },
  {
    label: 'decimal_round', kind: 'function', detail: 'Explicit decimal rounding (alpha.11+)',
    documentation: 'Since alpha.11: round an exact decimal to at most 0–18 places. Modes: half_even, half_up, toward_zero, away_from_zero.',
    insertText: 'decimal_round(${1:value}, ${2:2}, "${3:half_even}")',
  },
  {
    label: 'decimal_format', kind: 'function', detail: 'Fixed-places decimal text (alpha.11+)',
    documentation: 'Since alpha.11: return a string with exactly the selected decimal places (0–18), using an explicit rounding mode.',
    insertText: 'decimal_format(${1:value}, ${2:2}, "${3:half_even}")',
  },
  {
    label: 'decimal_div_rounded', kind: 'function', detail: 'Division with explicit rounding (alpha.11+)',
    documentation: 'Since alpha.11: divide exact decimals to a requested scale using an explicit rounding mode; ordinary division rejects inexact results.',
    insertText: 'decimal_div_rounded(${1:a}, ${2:b}, ${3:2}, "${4:half_even}")',
  },
  {
    label: 'input_decimal', kind: 'function', detail: 'Prompt for exact decimal input (alpha.11+)',
    documentation: 'Since alpha.11: requires interactive prompt mode. Studio preloads replies in its Program Input panel; it is not a live terminal.',
    insertText: 'input_decimal("${1:Amount: }")',
  },
  // Published alpha.12 interpreter features. No native aggregate codegen
  // or general user-defined generics are promised by editor suggestions.
  {
    label: 'record', kind: 'snippet', detail: 'Immutable typed record (alpha.12+)',
    documentation: 'Since alpha.12: declare a nominal record with typed fields, then construct it using new Name { field: value }. Scalar native backends do not yet execute aggregate operations.',
    insertText: 'record ${1:Task} {\n    ${2:title}: string,\n    ${3:done}: boolean\n}',
  },
  {
    label: 'variant', kind: 'snippet', detail: 'Tagged sum type (alpha.12+)',
    documentation: 'Since alpha.12: declare a variant with nullary or typed payload cases. Use new Choice::Case(value) and exhaustive match on statements.',
    insertText: 'variant ${1:Choice} { ${2:Missing}, ${3:Found}(integer) }',
  },
  {
    label: 'match on', kind: 'snippet', detail: 'Exhaustive tagged match (alpha.12+)',
    documentation: 'Since alpha.12: match a tagged variant or concrete Option/Result and handle each case. Nonexhaustive or duplicate arms are compiler errors.',
    insertText: 'match on ${1:value} {\n    case ${2:None} { ${3:print("none");} }\n    case ${4:Some}(item) { ${5:print(item);} }\n}',
  },
  ...([
    ['list_len', 'list_len(${1:items})', 'Read an immutable typed list length.'],
    ['list_push', 'list_push(${1:items}, ${2:value})', 'Append and return a new list snapshot.'],
    ['list_set', 'list_set(${1:items}, ${2:index}, ${3:value})', 'Return a list snapshot with one checked index updated.'],
    ['list_remove', 'list_remove(${1:items}, ${2:index})', 'Return a list snapshot with an indexed value removed.'],
    ['map_len', 'map_len(${1:entries})', 'Read a deterministic typed map size.'],
    ['map_keys', 'map_keys(${1:entries})', 'Produce a canonically sorted list of map keys.'],
    ['map_values', 'map_values(${1:entries})', 'Produce values in canonical key order.'],
    ['map_contains', 'map_contains(${1:entries}, ${2:key})', 'Check whether the typed map contains a key.'],
    ['map_get_or', 'map_get_or(${1:entries}, ${2:key}, ${3:fallback})', 'Return a map value or an eagerly evaluated typed fallback.'],
    ['map_set', 'map_set(${1:entries}, ${2:key}, ${3:value})', 'Return an immutable map snapshot with the key set.'],
    ['map_remove', 'map_remove(${1:entries}, ${2:key})', 'Return an immutable map snapshot with the key removed.'],
  ] as const).map(([label, insertText, description]) => ({
    label, kind: 'function' as const, detail: 'Scarp typed collection (alpha.12+)',
    documentation: 'Since alpha.12 (interpreter): ' + description +
      ' The compiler enforces bounded allocation and type checks; native aggregate backends are not yet supported.',
    insertText,
  })),
  // Published alpha.17 interpreter operations. These are callable built-ins,
  // not reserved keywords; the selected compiler must support this release.
  {
    label: 'array_len', kind: 'function', detail: 'Fixed array length (alpha.17+)',
    documentation: 'Since alpha.17 (interpreter): return the size of a fixed array, including an empty array. Useful as a repeat count. Requires an alpha.17+ compiler.',
    insertText: 'array_len(${1:values})',
  },
  {
    label: 'array_get_or', kind: 'function', detail: 'Safe fixed-array lookup (alpha.17+)',
    documentation: 'Since alpha.17 (interpreter): return a fixed-array element or the typed fallback for a negative or out-of-bounds index. The fallback expression is evaluated exactly once even for a valid index.',
    insertText: 'array_get_or(${1:values}, ${2:index}, ${3:fallback})',
  },
  {
    label: 'input_boolean', kind: 'function', detail: 'Boolean prompt (alpha.17+)',
    documentation: 'Since alpha.17 (interpreter): read exactly lowercase true or false. Requires interactive mode and a preloaded Program Input line in Studio. This is not a live interactive terminal; malformed or missing input reports a compiler diagnostic.',
    insertText: 'input_boolean("${1:Continue (true/false)? }")',
  },
];

export function scarpCompletions(prefix: string): ScarpCompletion[] {
  const needle = prefix.trim().toLocaleLowerCase();
  return templates.filter((entry) => entry.label.toLocaleLowerCase().startsWith(needle)).slice(0, 40);
}

export function scarpTokenHelp(token: string): ScarpCompletion | undefined {
  // A constructor and a type can share a label (decimal, bigint). Prefer
  // call-oriented help without turning the constructor into a keyword.
  return templates.find((entry) => entry.label === token && entry.kind === 'function') ??
    templates.find((entry) => entry.label === token && entry.kind === 'snippet') ??
    templates.find((entry) => entry.label === token);
}

/** Do not insert suggestions into a single-line string or // comment. */
export function isScarpCodePosition(line: string, zeroBasedOffset: number): boolean {
  let insideString = false;
  let escaped = false;
  const end = Math.max(0, Math.min(line.length, zeroBasedOffset));
  for (let index = 0; index < end; index += 1) {
    const char = line[index];
    if (insideString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') insideString = false;
    } else if (char === '"') insideString = true;
    else if (char === '/' && line[index + 1] === '/') return false;
  }
  return !insideString;
}

export interface ScarpFunctionSymbol {
  name: string;
  line: number;
  startColumn: number;
  endColumn: number;
}

/** A conservative, editor-only function outline; not a Scarp parser.
 * Share Monaco's CR, LF and CRLF boundaries with Search/Diagnostics and
 * scan lazily so we can stop after the 500-symbol UI budget.
 */
export function scanScarpFunctions(content: string): ScarpFunctionSymbol[] {
  const results: ScarpFunctionSymbol[] = [];
  let start = 0;
  let lineNumber = 1;
  while (start <= content.length) {
    const end = nextLineBreak(content, start);
    const line = content.slice(start, end < 0 ? content.length : end);
    // Avoid treating commented-out declarations as functions.
    const match = /^\s*(?:(?:pub|pure)\s+){0,2}funcra\s+([A-Za-z_][A-Za-z_0-9]*)\s*\(/.exec(line);
    if (match) {
      const startColumn = line.indexOf(match[1], match[0].indexOf('funcra')) + 1;
      results.push({
        name: match[1], line: lineNumber,
        startColumn, endColumn: startColumn + match[1].length,
      });
      if (results.length >= 500) break;
    }
    if (end < 0) break;
    start = end + lineBreakWidth(content, end);
    lineNumber++;
  }
  return results;
}
