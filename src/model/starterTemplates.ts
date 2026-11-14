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
];

export function getScarpStarterTemplate(id: string): ScarpStarterTemplate | null {
  return scarpStarterTemplates.find((entry) => entry.id === id) ?? null;
}
