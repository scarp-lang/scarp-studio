/** Editor-only Scarp assistance, based on real compiler alpha.8 examples.
 * These templates do not replace parser/compiler validation.
 */
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
    'and', 'or', 'not', 'pub', 'pure', 'needs', 'ensures'] as const).map((label) => ({
      label, kind: 'keyword' as const, detail: 'Scarp keyword',
      documentation: 'Scarp language keyword. Available syntax depends on the selected compiler version.',
      insertText: label,
    })),
  ...(['integer', 'float', 'boolean', 'string', 'unit', 'vector', 'integers', 'tile', 'tuple', 'bigint'] as const).map((label) => ({
    label, kind: 'type' as const, detail: 'Scarp type',
    documentation: 'Scarp built-in type. Availability depends on the selected compiler version.',
    insertText: label,
  })),
];

export function scarpCompletions(prefix: string): ScarpCompletion[] {
  const needle = prefix.trim().toLocaleLowerCase();
  return templates.filter((entry) => entry.label.toLocaleLowerCase().startsWith(needle)).slice(0, 40);
}

export function scarpTokenHelp(token: string): ScarpCompletion | undefined {
  return templates.find((entry) => entry.label === token);
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

/** A conservative, editor-only function outline; not a Scarp parser. */
export function scanScarpFunctions(content: string): ScarpFunctionSymbol[] {
  const results: ScarpFunctionSymbol[] = [];
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    // Avoid treating commented-out declarations as functions.
    const match = /^\s*(?:(?:pub|pure)\s+){0,2}funcra\s+([A-Za-z_][A-Za-z_0-9]*)\s*\(/.exec(line);
    if (!match) continue;
    const startColumn = line.indexOf(match[1], match[0].indexOf('funcra')) + 1;
    results.push({
      name: match[1], line: index + 1, startColumn, endColumn: startColumn + match[1].length,
    });
    if (results.length >= 500) break;
  }
  return results;
}
