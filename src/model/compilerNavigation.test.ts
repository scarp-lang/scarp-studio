import { describe, expect, it } from 'vitest';
import {
  parseCompilerNavigation, DEFAULT_NAVIGATION_FILTER, filterCompilerSymbols, referencesToSymbol,
  symbolOwnerLabel, symbolKindCounts, referenceKindCounts, navigationPage, formatCompilerLocation,
  MAX_NAVIGATION_JSON_UNITS, NAVIGATION_PAGE_SIZE,
} from './compilerNavigation';

const site = (source = 0, start = 0, end = 1) => ({
  source, span: [start, end], start: { line: 1, column: start + 1 },
  end: { line: 1, column: end + 1 },
});
function symbol(id: number, name: string, kind: string, owner: number | null = null, extra = {}) {
  return { id, name, kind, owner, public: false, mutable: false, target_module: null, location: site(), ...extra };
}
function fixture() {
  return {
    schema_version: 1, kind: 'scarp.references', span_encoding: 'utf-8-bytes',
    column_encoding: 'unicode-scalar', position_base: 1,
    files: [{ id: 0, path: 'src/main.srp' }, { id: 1, path: 'src/lib.srp' }],
    symbols: [
      symbol(0, 'main', 'module', null, { location: site(0, 0, 0), target_module: 0 }),
      symbol(1, 'work', 'function', 0, { public: true, location: site(1, 15, 19) }),
      symbol(2, 'count', 'binding', 1, { mutable: true }),
      symbol(3, 'count', 'parameter', 1),
      symbol(4, 'print', 'builtin', null, { location: null }),
    ],
    references: [
      { target: 2, kind: 'read', location: site(1, 40, 45) },
      { target: 3, kind: 'read', location: site(1, 50, 55) },
      { target: 2, kind: 'write', location: site(1, 60, 65) },
      { target: 4, kind: 'call', location: site(0, 20, 25) },
    ],
  };
}
function parsed() {
  const result = parseCompilerNavigation(JSON.stringify(fixture()), 'inspect-references');
  if (!result.ok) throw Error(result.reason);
  return result.report;
}
function rejects(change: (value: ReturnType<typeof fixture>) => void) {
  const value = fixture(); change(value);
  expect(parseCompilerNavigation(JSON.stringify(value), 'inspect-references').ok).toBe(false);
}
describe('compiler navigation schema boundary', () => {
  it('preserves compiler identity and byte/scalar positions', () => {
    const report = parsed();
    expect(report.symbols[1]).toMatchObject({id: 1, name: 'work', public: true,
      location: {source: 1, byteStart: 15, byteEnd: 19, column: 16}});
    expect(report.symbols[4].location).toBeNull();
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.symbols)).toBe(true);
    expect(Object.isFrozen(report.references[0].location)).toBe(true);
  });
  it('rejects malformed, oversized or mismatched reports', () => {
    for (const json of ['', '{', 'null', '[]', 'x'.repeat(MAX_NAVIGATION_JSON_UNITS + 1)]) {
      expect(parseCompilerNavigation(json, 'inspect-references').ok).toBe(false);
    }
    expect(parseCompilerNavigation(JSON.stringify(fixture()), 'inspect-symbols').ok).toBe(false);
    rejects(v => {v.schema_version = 2;});
    rejects(v => {v.span_encoding = 'utf-16';});
    rejects(v => {v.column_encoding = 'bytes';});
    rejects(v => {v.position_base = 0;});
  });
  it('validates file and symbol identity, owner links, flags and module links', () => {
    rejects(v => {v.files[0].id = 9;});
    rejects(v => {v.files[1].path = v.files[0].path;});
    rejects(v => {v.files[0].path = 'x\u0000.srp';});
    rejects(v => {v.files[0].path = 'x\u202e.srp';});
    rejects(v => {v.symbols[2].id = 7;});
    rejects(v => {v.symbols[2].kind = 'unknown';});
    rejects(v => {v.symbols[2].owner = 99;});
    rejects(v => {v.symbols[2].owner = 2;});
    rejects(v => {v.symbols[1].owner = 2;});
    rejects(v => {Object.assign(v.symbols[2], {public: 'false'});});
    rejects(v => {Object.assign(v.symbols[2], {target_module: 99});});
  });
  it('rejects invalid references and inconsistent coordinates', () => {
    rejects(v => {v.references[0].target = 99;});
    rejects(v => {v.references[0].kind = 'unknown';});
    rejects(v => {v.references[0].location.source = 99;});
    rejects(v => {v.references[0].location.span = [5, 4];});
    rejects(v => {v.references[0].location.span = [4, 4];});
    rejects(v => {v.references[0].location.start.line = 0;});
    rejects(v => {v.references[0].location.end.column = 1;});
  });
  it('does not infer references from a definitions-only report', () => {
    const value = fixture();
    const {references: _references, ...definitions} = value;
    expect(parseCompilerNavigation(JSON.stringify({...definitions, kind: 'scarp.symbols'}), 'inspect-symbols'))
      .toMatchObject({ok: true, report: {kind: 'symbols', references: []}});
  });
});
describe('compiler inspection projections', () => {
  it('distinguishes same-spelling bindings by native ID', () => {
    const report = parsed();
    expect(referencesToSymbol(report, 2, {kind: 'all', file: 'all'}).map(r => r.location.byteStart)).toEqual([40, 60]);
    expect(referencesToSymbol(report, 3, {kind: 'all', file: 'all'}).map(r => r.location.byteStart)).toEqual([50]);
    expect(referencesToSymbol(report, 2, {kind: 'write', file: 1})).toHaveLength(1);
    expect(referencesToSymbol(report, 2, {kind: 'all', file: 0})).toEqual([]);
  });
  it('filters and summarizes explicit metadata only', () => {
    const report = parsed();
    const filter = (patch: Partial<typeof DEFAULT_NAVIGATION_FILTER>) =>
      filterCompilerSymbols(report, {...DEFAULT_NAVIGATION_FILTER, ...patch}).map(s => s.id);
    expect(filter({query: 'count work'})).toEqual([2, 3]);
    expect(filter({query: 'count', mutableOnly: true})).toEqual([2]);
    expect(filter({visibility: 'public'})).toEqual([1]);
    expect(filter({file: 'implicit'})).toEqual([4]);
    expect(symbolOwnerLabel(report, report.symbols[2])).toBe('main / work');
    expect(symbolKindCounts(report)).toMatchObject({function: 1, binding: 1, parameter: 1, builtin: 1});
    expect(referenceKindCounts(report.references)).toMatchObject({read: 2, write: 1, call: 1});
    expect(formatCompilerLocation(report, report.references[0].location)).toContain('src/lib.srp:1:41');
  });
  it('clamps pages and preserves source order', () => {
    const items = Array.from({length: NAVIGATION_PAGE_SIZE * 2 + 1}, (_, i) => i);
    expect(navigationPage(items, Infinity).page).toBe(1);
    expect(navigationPage(items, 99).items).toEqual([NAVIGATION_PAGE_SIZE * 2]);
    expect([1, 2, 3].flatMap(page => navigationPage(items, page).items)).toEqual(items);
    expect(navigationPage([], 1)).toEqual({items: [], page: 1, pages: 1});
  });
});
