import { describe, expect, it } from 'vitest';
import { LocalAnalysisCache, LocalSourceAnalysis, type LocalAnalysisModel } from './localAnalysis';
import { MAX_DEFINITION_SOURCE_UNITS } from './definition';

const header = 'funcra add(a: integer, b: integer) -> integer {}\n';
const source = header + 'add(1, 2);';
function fake(text = source) {
  let value = text;
  let version = 1;
  let disposed = false;
  let reads = 0;
  const model: LocalAnalysisModel = {
    getValueLength: () => value.length,
    getValue: () => { reads++; return value; },
    getVersionId: () => version,
    isDisposed: () => disposed,
  };
  return { model, reads: () => reads, edit: (next: string) => { value = next; version++; },
    dispose: () => { disposed = true; } };
}
describe('bounded revision-aware local analysis cache', () => {
  it('shares exactly one snapshot across different local provider queries', () => {
    const c = new LocalAnalysisCache();
    const m = fake();
    const a = c.get(m.model, 65536)!;
    expect(a).toBeTruthy();
    expect(a.definition(header.length + 1)?.name).toBe('add');
    expect(a.hover(header.length + 1)).toEqual({ label: 'add(a: integer, b: integer)', line: 1 });
    expect(a.signature(source.lastIndexOf('2'))?.activeParameter).toBe(1);
    expect(a.complete(header.length, header.length + 3, 'ad', new Set())[0]?.name).toBe('add');
    expect(a.symbols().map(symbol => symbol.name)).toEqual(['add']);
    expect(c.get(m.model, 65536)).toBe(a);
    expect(m.reads()).toBe(1);
  });
  it('invalidates same-length edits and ABA undo/redo versions', () => {
    const c = new LocalAnalysisCache();
    const m = fake();
    const before = c.get(m.model, 65536)!;
    m.edit(source.replaceAll('add', 'sum'));
    const after = c.get(m.model, 65536)!;
    expect(after).not.toBe(before);
    expect(after.definition(header.length + 1)?.name).toBe('sum');
    m.edit(source);
    expect(c.get(m.model, 65536)).not.toBe(before);
    expect(m.reads()).toBe(3);
  });
  it('uses exact object identity, not file path, length or version alone', () => {
    const c = new LocalAnalysisCache();
    const a = fake();
    const b = fake(source.replaceAll('add', 'sum'));
    const old = c.get(a.model, 65536);
    const newer = c.get(b.model, 65536);
    expect(newer).not.toBe(old);
    expect(newer?.definition(header.length + 1)?.name).toBe('sum');
    expect(c.get(a.model, 65536)).not.toBe(old);
    expect(a.reads()).toBe(2);
  });
  it('does not copy oversized buffers or trust invalid budgets or disposed models', () => {
    const c = new LocalAnalysisCache();
    const m = fake(' '.repeat(65537));
    expect(c.get(m.model, 65536)).toBeNull();
    expect(m.reads()).toBe(0);
    expect(c.get(m.model, 0)).toBeNull();
    expect(c.get(m.model, Infinity)).toBeNull();
    const huge = fake(' '.repeat(MAX_DEFINITION_SOURCE_UNITS + 1));
    expect(c.get(huge.model, MAX_DEFINITION_SOURCE_UNITS * 2)).toBeNull();
    expect(huge.reads()).toBe(0);
    const small = fake();
    const old = c.get(small.model, 65536);
    expect(c.get(small.model, 2)).toBeNull();
    expect(c.get(small.model, 65536)).not.toBe(old);
    small.dispose();
    expect(c.get(small.model, 65536)).toBeNull();
  });
  it('rejects inconsistent snapshots and revision changes during source capture', () => {
    const c = new LocalAnalysisCache();
    expect(c.get({ getValueLength: () => 3, getValue: () => 'too long' }, 65536)).toBeNull();
    let version = 1;
    expect(c.get({ getValueLength: () => 3, getVersionId: () => version,
      getValue: () => { version++; return 'add'; } }, 65536)).toBeNull();
  });
  it('does not cache unversioned or explicitly cleared models', () => {
    const c = new LocalAnalysisCache();
    const model = { getValueLength: () => source.length, getValue: () => source };
    expect(c.get(model, 65536)).not.toBe(c.get(model, 65536));
    const m = fake();
    const old = c.get(m.model, 65536);
    c.clear();
    expect(c.get(m.model, 65536)).not.toBe(old);
  });
});
describe('local hover and shared analysis result isolation', () => {
  it('declines qualified, duplicated, declaration and malformed targets', () => {
    for (const value of [header + 'math.add(1);', header + header + 'add(1);',
      'funcra add(a: integer) -> integer {}', 'funcra add(a: ) {}\\nadd(1);',
      header + '// add(1);', header + '"add(1);"']) {
      const a = new LocalSourceAnalysis(value);
      expect(a.hover(value.lastIndexOf('add') + 1), value).toBeNull();
    }
  });
  it('supports multiline calls and preserves catalog-independent local signatures', () => {
    const value = header + 'add\n// args\n(1, 2);';
    expect(new LocalSourceAnalysis(value).hover(header.length + 1))
      .toEqual({ label: 'add(a: integer, b: integer)', line: 1 });
  });
  it('prevents mutations of returned provider data from poisoning the cache', () => {
    const a = new LocalSourceAnalysis(source);
    const signature = a.signature(source.lastIndexOf('2'))!;
    signature.parameters[0] = 'corrupted';
    expect(a.signature(source.lastIndexOf('2'))?.parameters[0]).toBe('a: integer');
    const symbol = a.definition(header.length + 1)!;
    symbol.name = 'corrupted';
    expect(a.definition(header.length + 1)?.name).toBe('add');
    a.symbols()[0].name = 'corrupted';
    expect(a.symbols()[0].name).toBe('add');
  });
});


describe('shared lexical inventory consistency', () => {
  it('does not return local completion, hover, definition or signature from malformed scope', () => {
    const text = 'funcra add(a: integer, b: integer) -> integer {} ]\nadd(1, 2);';
    const analysis = new LocalSourceAnalysis(text);
    const start = text.lastIndexOf('add');
    expect(analysis.complete(start, start + 3, 'ad', new Set())).toEqual([]);
    expect(analysis.definition(start + 1)).toBeNull();
    expect(analysis.hover(start + 1)).toBeNull();
    expect(analysis.signature(text.lastIndexOf('2'))).toBeNull();
  });
});
