import whileLoopSource from '../../qa/windows/06-while-control.srp?raw';
import decimalLiteralSource from '../../qa/windows/09-decimal-literals.srp?raw';
import tupleUpdateSource from '../../qa/windows/10-tuple-updates.srp?raw';
import nestedLoopSource from '../../qa/windows/07-nested-loop.srp?raw';

/** Small, explicitly created Scarp-only starter programs.
 * No template runs, saves, or accesses the filesystem automatically.
 */
export interface ScarpStarterTemplate {
  id: string;
  title: string;
  description: string;
  source: string;
}

export const scarpStarterTemplates: readonly ScarpStarterTemplate[] = [
  {
    id: 'hello',
    title: 'Hello World',
    description: 'Print a first Scarp message',
    source: '// Hello from Scarp Studio!\nprint("Hello, Scarp!");\n',
  },
  {
    id: 'bindings',
    title: 'Variables and Bindings',
    description: 'Immutable bind and mutable var',
    source: '// Bind once, update mutable state.\nbind language = "Scarp";\nvar count = 1;\ncount += 2;\nprint(language, count);\n',
  },
  {
    id: 'functions',
    title: 'Typed Functions',
    description: 'Define and call a pure funcra',
    source: '// Typed function declarations.\npure funcra add(a: integer, b: integer) -> integer {\n    return a + b;\n}\nprint(add(2, 3));\n',
  },
  {
    id: 'decisions',
    title: 'Conditional Logic',
    description: 'if / else branches',
    source: '// Branch on a boolean condition.\nbind score = 73;\nif score >= 60 {\n    print("Passed");\n} else {\n    print("Keep practicing");\n}\n',
  },
  {
    id: 'loops',
    title: 'Repeat Loops',
    description: 'Counted repeat with an index',
    source: '// Repeat a counted body.\nvar total = 0;\nrepeat 5 as index {\n    total += index;\n}\nprint(total);\n',
  },
  {
    id: 'whilecontrol',
    title: 'While, Break and Continue',
    description: 'Use a boolean while guard with explicit loop control',
    // Exact compiler-verified QA fixture, embedded statically in the app.
    source: whileLoopSource,
  },
  {
    id: 'nestedloops',
    title: 'Nested Repeat and While',
    description: 'Control the nearest loop with break and continue',
    source: nestedLoopSource,
  },
  {
    id: 'bigint',
    title: 'Exact Big Integers (alpha.9+)',
    description: 'Arbitrary-length decimal integers with bounded execution',
    source: '// Requires official Scarp v0.0.6-alpha.9 or newer.\nbind large: bigint = bigint("999999999999999999999999999999");\nbind next = large + bigint_from_integer(1);\nprint(next);\n',
  },
  {
    id: 'input',
    title: 'Read Program Input',
    description: 'Use read_line with the Run input panel',
    source: '// Enter a name in the Program Input panel before running.\nbind name: string = read_line();\nprint("Hello", name);\n',
  },
  {
    id: 'prompts',
    title: 'Prompted Input (alpha.10+)',
    description: 'Preload replies and enable Studio prompt mode',
    source: '// Requires official Scarp v0.0.6-alpha.10+.\n// Enable prompt mode and enter a name in Program Input BEFORE Run.\nbind name = input("Name: ");\nprint("Hello", name);\n',
  },
  {
    id: 'arrays',
    title: 'Fixed Arrays (alpha.10+)',
    description: 'Immutable typed arrays with checked indexing',
    source: '// Requires official Scarp v0.0.6-alpha.10+.\nbind numbers: array<integer, 2> = [array: 10, 20];\nprint(numbers[1]);\n',
  },
  {
    id: 'exactmath',
    title: 'BigInt Math (alpha.10+)',
    description: 'Exact GCD, division and number theory',
    source: '// Requires official Scarp v0.0.6-alpha.10+.\nbind left = bigint("120");\nbind right = bigint("18");\nprint(bigint_gcd(left, right));\n',
  },
  {
    id: 'decimals',
    title: 'Exact Decimals (alpha.11+)',
    description: 'Exact base-10 arithmetic and explicit rounding',
    source: '// Requires official Scarp v0.0.6-alpha.11+. No implicit float conversion.\nbind price: decimal = decimal("199.99");\nbind tax = decimal("0.18");\nprint(decimal_format(price + price * tax, 2, "half_even"));\nprint(decimal("0.1") + decimal("0.2"));\n',
  },
  {
    id: 'decimalliterals',
    title: 'Exact Decimal Literals (alpha.20+)',
    description: 'Use the d suffix for exact base-10 arithmetic',
    source: decimalLiteralSource,
  },
  {
    id: 'tupleupdates',
    title: 'Tuple Updates and Ordering (alpha.20+)',
    description: 'Replace tuple members persistently and compare numeric tuples',
    source: tupleUpdateSource,
  },
  {
    id: 'decimalinput',
    title: 'Prompted Decimal (alpha.11+)',
    description: 'Preload an exact decimal input and enable prompt mode',
    source: '// Requires official Scarp v0.0.6-alpha.11+.\n// Enable Studio prompt mode and preload 19.95 in Program Input BEFORE Run.\nbind amount: decimal = input_decimal("Amount: ");\nprint(decimal_format(amount, 2, "half_even"));\n',
  },
  {
    id: "records",
    title: "Typed Records (alpha.12+)",
    description: "Construct immutable records and read named fields",
    source: "// Requires official Scarp v0.0.6-alpha.12+ (interpreter).\nrecord Task { title: string, done: boolean }\nbind task = new Task { title: \"Review\", done: false };\nprint(task->title);\n",
  },
  {
    id: "variants",
    title: "Tagged Variants (alpha.12+)",
    description: "Match a tagged value with exhaustive cases",
    source: "// Requires official Scarp v0.0.6-alpha.12+ (interpreter).\nvariant Lookup { Missing, Found(integer) }\nbind hit = new Lookup::Found(42);\nmatch on hit {\n    case Missing { print(\"Absent\"); }\n    case Found(value) { print(value); }\n}\n",
  },
  {
    id: "collections",
    title: "Typed Lists and Maps (alpha.12+)",
    description: "Build immutable snapshots with deterministic map keys",
    source: "// Requires official Scarp v0.0.6-alpha.12+ (interpreter).\nbind names: list<string> = [list: \"alpha\", \"beta\"];\nbind expanded = list_push(names, \"gamma\");\nbind counts = [map: \"ready\": 2, \"pending\": 1];\nprint(list_len(expanded), map_get_or(counts, \"ready\", 0));\n",
  },
  {
    id: 'arrayupdates',
    title: 'Immutable Array Updates (alpha.18+)',
    description: 'Update a fixed array without mutating the original snapshot',
    source: '// Requires official Scarp v0.0.6-alpha.18+ (interpreter).\n' +
      'bind original = [array: 5, 8, 13];\n' +
      'bind changed = array_set(original, 1, 99);\n' +
      'assert(original[1] == 8, "original stays immutable");\n' +
      'assert(changed[1] == 99, "replacement is visible");\n' +
      'print(original[1], changed[1]);\n',
  },
  {
    id: "optionresult",
    title: "Option Propagation (alpha.12+)",
    description: "Early-return an absent optional value safely",
    source: "// Requires official Scarp v0.0.6-alpha.12+ (interpreter).\npure funcra is_positive(value: option<integer>) -> option<boolean> {\n    bind number = value?;\n    return new option<boolean>::Some(number > 0);\n}\nmatch on is_positive(new option<integer>::Some(3)) {\n    case None { print(\"No value\"); }\n    case Some(flag) { print(flag); }\n}\n",
  },
];

export function getScarpStarterTemplate(id: string): ScarpStarterTemplate | null {
  return scarpStarterTemplates.find((entry) => entry.id === id) ?? null;
}
