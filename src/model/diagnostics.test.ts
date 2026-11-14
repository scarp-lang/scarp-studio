import { describe, expect, it } from 'vitest';
import {
  diagnosticBelongsToSource, diagnosticSourcePosition, parseScarpDiagnostic, scalarColumnToUtf16,
} from './diagnostics';

const fixture = {
  schema_version: 1,
  severity: 'error',
  code: 'E0015',
  message: 'expected integer, found string',
  span_encoding: 'utf-8-bytes',
  column_encoding: 'unicode-scalar',
  position_base: 1,
  primary: {
    path: 'main.srp', span: [0, 5],
    start: { line: 2, column: 4 }, end: { line: 2, column: 9 },
  },
  related: [],
  help: 'Keep primitive types consistent',
};
const stderr = (value: unknown) => JSON.stringify(value) + '\n';

describe('published Scarp JSON error diagnostics', () => {
  it('parses the documented schema-v1 error and its source position', () => {
    expect(parseScarpDiagnostic(stderr(fixture))).toEqual({
      code: 'E0015',
      message: 'expected integer, found string',
      path: 'main.srp', line: 2, column: 4,
      help: 'Keep primitive types consistent',
    });
  });
  it('navigates alpha.8 E0065 assertion diagnostics after Unicode scalars', () => {
    const source = 'print("👋"); assert(false);';
    const diagnostic = parseScarpDiagnostic(stderr({
      ...fixture,
      code: 'E0065',
      message: 'assertion failed',
      primary: {
        ...fixture.primary,
        path: 'main.srp',
        start: { line: 1, column: 13 },
        end: { line: 1, column: 19 },
      },
    }));
    expect(diagnostic).toMatchObject({
      code: 'E0065', message: 'assertion failed', path: 'main.srp',
      line: 1, column: 13,
    });
    expect(diagnosticSourcePosition(diagnostic, 'C:/Project/main.srp', source))
      .toEqual({ lineNumber: 1, column: 14 });
  });
  it('allows a diagnostic without a source position', () => {
    expect(parseScarpDiagnostic(stderr({
      ...fixture, code: null, primary: null, help: null,
    }))).toMatchObject({ code: null, path: null, line: null, column: null, help: null });
  });
  it('ignores unknown versions, malformed JSON, and normal program output', () => {
    expect(parseScarpDiagnostic(stderr({ ...fixture, schema_version: 2 }))).toBeNull();
    expect(parseScarpDiagnostic('not-json')).toBeNull();
    expect(parseScarpDiagnostic('print: ' + JSON.stringify(fixture))).toBeNull();
  });
  it('does not treat output markers or program stdout as diagnostics', () => {
    expect(parseScarpDiagnostic(null)).toBeNull();
    expect(parseScarpDiagnostic('\nCompiler diagnostics:\n' + JSON.stringify(fixture))).toBeNull();
    expect(parseScarpDiagnostic('program output: ' + JSON.stringify(fixture))).toBeNull();
  });
  it('requires the published column, span and coordinate encodings', () => {
    expect(parseScarpDiagnostic(stderr({ ...fixture, column_encoding: 'utf-16' }))).toBeNull();
    expect(parseScarpDiagnostic(stderr({ ...fixture, span_encoding: 'utf-16' }))).toBeNull();
    expect(parseScarpDiagnostic(stderr({ ...fixture, position_base: 0 }))).toBeNull();
  });
  it('rejects invalid positions without hiding a useful error message', () => {
    const actual = parseScarpDiagnostic(stderr({
      ...fixture, primary: { path: 'main.srp', start: { line: -2, column: 1 } },
    }));
    expect(actual).toMatchObject({ message: fixture.message, path: null, line: null });
  });
  it('limits error JSON size to prevent expensive rendering', () => {
    expect(parseScarpDiagnostic(stderr({ ...fixture, message: 'X'.repeat(70_000) }))).toBeNull();
  });
  it('navigates only the matching source file or a bare basename', () => {
    expect(diagnosticBelongsToSource('main.srp', 'C:/Project/main.srp')).toBe(true);
    expect(diagnosticBelongsToSource('C:\\Project\\Main.srp', 'c:/project/main.SRP')).toBe(true);
    expect(diagnosticBelongsToSource('other/main.srp', 'C:/project/main.srp')).toBe(false);
    expect(diagnosticBelongsToSource('unrelated.srp', 'C:/project/main.srp')).toBe(false);
  });
  it('resolves extended-length Windows canonical paths into editor source locations', () => {
    const diagnostic = parseScarpDiagnostic(stderr({
      ...fixture,
      primary: {
        ...fixture.primary,
        path: String.raw`\\?\C:\Project\main.srp`,
        start: { line: 1, column: 3 },
      },
    }));
    expect(diagnosticSourcePosition(diagnostic, 'c:/project/main.srp', 'A😀B'))
      .toEqual({ lineNumber: 1, column: 4 });
  });
  it('rejects invalid, stale or foreign positions without clamping', () => {
    const diagnostic = parseScarpDiagnostic(stderr(fixture));
    expect(diagnosticSourcePosition(diagnostic, 'C:/project/main.srp', 'first\nAB'))
      .toBeNull(); // source line 2 is too short for scalar column 4
    expect(diagnosticSourcePosition(diagnostic, 'C:/project/main.srp', 'single'))
      .toBeNull(); // line 2 does not exist
    expect(diagnosticSourcePosition(diagnostic, 'C:/project/other.srp', 'first\n123'))
      .toBeNull(); // wrong source file
    expect(diagnosticSourcePosition(diagnostic, 'C:/project/main.srp', 'first\nABC'))
      .toEqual({ lineNumber: 2, column: 4 }); // end-of-line is valid
  });
  it('rejects ambiguous bare-name locations in source files with imports', () => {
    const source = 'import "module.srp" as module;\nprint(unknown_name);';
    const diagnostic = parseScarpDiagnostic(stderr({
      ...fixture,
      primary: { ...fixture.primary, start: { line: 2, column: 7 } },
    }));
    expect(diagnosticSourcePosition(diagnostic, 'C:/project/main.srp', source)).toBeNull();
    expect(diagnosticSourcePosition({
      ...diagnostic!, path: 'C:/project/main.srp',
    }, 'C:/project/main.srp', source)).toEqual({ lineNumber: 2, column: 7 });
  });

  it('converts Unicode scalar positions to Monaco UTF-16 columns', () => {
    expect(scalarColumnToUtf16('A😀B', 1)).toBe(1);
    expect(scalarColumnToUtf16('A😀B', 3)).toBe(4);
    expect(scalarColumnToUtf16('A😀B', 4)).toBe(5);
    expect(scalarColumnToUtf16('ABC', 3)).toBe(3);
    expect(scalarColumnToUtf16('', -3)).toBe(1);
  });
});
