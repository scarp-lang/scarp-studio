import { describe, expect, it } from 'vitest';
import { createUntitled } from './documents';
import {
  MAX_QUICK_OPEN_LOCATION_UNITS, parseQuickOpenLocation, quickOpenLocationTarget,
} from './quickOpenLocation';

function doc(content: string) {
  return { ...createUntitled(1), content, revision: 5 };
}

function target(content: string, line: number, column: number) {
  const result = quickOpenLocationTarget(doc(content), { line, column });
  if (!result) throw Error('Expected source location');
  return result;
}

describe('optional Quick Open source location', () => {
  it('treats an empty optional field as a normal file open', () => {
    expect(parseQuickOpenLocation('')).toEqual({ kind: 'none' });
    expect(parseQuickOpenLocation('   ')).toEqual({ kind: 'none' });
  });

  it('accepts line-only and line-column input with a one-based default column', () => {
    expect(parseQuickOpenLocation('12')).toEqual({ kind: 'valid', location: { line: 12, column: 1 } });
    expect(parseQuickOpenLocation(' 12:4 ')).toEqual({ kind: 'valid', location: { line: 12, column: 4 } });
    expect(parseQuickOpenLocation('999999999:999999999')).toEqual({
      kind: 'valid', location: { line: 999999999, column: 999999999 },
    });
  });

  it('rejects unsafe, malformed, zero, negative and fractional positions', () => {
    for (const text of ['0', '-1', '0:4', '1:0', '1:-2', '1.5', '1:2.5', '1:', ':1',
      '01', '1:02', '1:2:3', '1e3', '0x10', 'NaN', 'Infinity', '1 : 2',
      '9999999999', 'x'.repeat(MAX_QUICK_OPEN_LOCATION_UNITS + 1)]) {
      expect(parseQuickOpenLocation(text).kind).toBe('invalid');
    }
  });

  it('rejects pasted control characters rather than silently changing location', () => {
    for (const text of ['\n', '\t', '1\n', '1:2\0', '1\u007f']) {
      expect(parseQuickOpenLocation(text).kind).toBe('invalid');
    }
  });

  it('resolves exact first, middle and final line positions', () => {
    const content = 'alpha\nbeta\ngamma';
    expect(target(content, 1, 3)).toMatchObject({ line: 1, column: 3, clamped: false });
    expect(target(content, 2, 5)).toMatchObject({ line: 2, column: 5, clamped: false });
    expect(target(content, 3, 2)).toMatchObject({ line: 3, column: 2, clamped: false });
  });

  it('clamps line and column to the final available physical line', () => {
    expect(target('abc\nxy', 90, 90)).toMatchObject({ line: 2, column: 3, clamped: true });
    expect(target('abc\nxy', 1, 90)).toMatchObject({ line: 1, column: 4, clamped: true });
    expect(target('abc\nxy', 90, 1)).toMatchObject({ line: 2, column: 1, clamped: true });
  });

  it('counts CRLF as one newline, and supports LF and CR within mixed source', () => {
    const content = 'one\r\ntwo\rthree\nfour';
    expect(target(content, 2, 20)).toMatchObject({ line: 2, column: 4, clamped: true });
    expect(target(content, 3, 20)).toMatchObject({ line: 3, column: 6, clamped: true });
    expect(target(content, 4, 3)).toMatchObject({ line: 4, column: 3, clamped: false });
    expect(target(content, 5, 4)).toMatchObject({ line: 4, column: 4, clamped: true });
  });

  it('preserves empty and trailing blank editor lines', () => {
    expect(target('', 1, 1)).toMatchObject({ line: 1, column: 1, clamped: false });
    expect(target('', 999, 999)).toMatchObject({ line: 1, column: 1, clamped: true });
    expect(target('first\n', 2, 1)).toMatchObject({ line: 2, column: 1, clamped: false });
    expect(target('first\r\n\r\n', 9, 2)).toMatchObject({ line: 3, column: 1, clamped: true });
    expect(target('\n\n', 2, 2)).toMatchObject({ line: 2, column: 1, clamped: true });
  });

  it('uses editor UTF-16 columns without placing the cursor within a surrogate pair', () => {
    const content = 'a🌟b';
    expect(target(content, 1, 2)).toMatchObject({ column: 2, clamped: false });
    expect(target(content, 1, 3)).toMatchObject({ column: 2, clamped: true });
    expect(target(content, 1, 4)).toMatchObject({ column: 4, clamped: false });
    expect(target(content, 1, 99)).toMatchObject({ column: 5, clamped: true });
  });

  it('ties navigation to the working buffer, not to the saved disk contents', () => {
    const working = { ...doc('new\nsecond'), savedContent: 'old' };
    const result = quickOpenLocationTarget(working, { line: 2, column: 4 });
    expect(result).toEqual({
      documentId: working.id, revision: 5, source: 'new\nsecond', line: 2, column: 4, clamped: false,
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('rejects invalid positions and source revisions at the model boundary', () => {
    for (const location of [
      { line: 0, column: 1 }, { line: 1, column: -1 },
      { line: 1.5, column: 1 }, { line: 1, column: Infinity },
      { line: NaN, column: 1 }, { line: Number.MAX_SAFE_INTEGER + 1, column: 1 },
    ]) expect(quickOpenLocationTarget(doc('one'), location)).toBeNull();
    expect(quickOpenLocationTarget({ ...doc('one'), revision: -1 }, { line: 1, column: 1 })).toBeNull();
  });

  it('does not allocate an array of all lines to resolve a far position', () => {
    const content = 'line\n'.repeat(100000) + 'last';
    expect(target(content, 100001, 5)).toMatchObject({ line: 100001, column: 5, clamped: false });
    expect(target(content, 999999999, 999999999)).toMatchObject({ line: 100001, column: 5, clamped: true });
  });
});
